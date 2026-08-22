"use server";

/**
 * Matin ehdottamien muutosten suoritus.
 *
 * Tämä on ainoa paikka jossa Matin ehdotus muuttuu muutokseksi, ja se
 * on tarkoituksella erillään mallista.
 *
 * KOLME ASIAA JOTKA TEKEVÄT TÄSTÄ TURVALLISEN
 *
 * 1. Argumentit luetaan KANNASTA, eivät pyynnöstä. Selain lähettää
 *    vain ehdotuksen tunnisteen. Jos argumentit kulkisivat asiakkaan
 *    kautta, hyväksyntä olisi muodollisuus: summan voisi vaihtaa
 *    esikatselun näyttämisen ja suorituksen välissä.
 *
 * 2. Ehdotus ratkaistaan atomisesti. ai_resolve_action päivittää rivin
 *    vain jos se oli vielä odottamassa, ja palauttaa sen. Kaksi
 *    painallusta ei siis voi suorittaa samaa muutosta kahdesti.
 *
 * 3. Suoritus kulkee samojen tietokantafunktioiden kautta kuin
 *    käyttöliittymä. Matti ei saa omaa reittiään kantaan, joten sen
 *    oikeudet ovat täsmälleen samat kuin käyttäjän.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { requireContext } from "@/lib/restoflow/session";
import { can } from "@/lib/restoflow/permissions";
import { findTool } from "@/lib/matti/tools";
import { formatMoney } from "@/lib/money";
import { weekStartOf } from "@/lib/restoflow/lunch";

export interface MattiActionState {
  ok?: boolean;
  message?: string;
  error?: string;
}

const idSchema = z.string().uuid();

export async function cancelMattiAction(
  _prev: MattiActionState,
  formData: FormData,
): Promise<MattiActionState> {
  const parsed = idSchema.safeParse(formData.get("actionId"));
  if (!parsed.success) return { error: "Tuntematon ehdotus." };

  const supabase = await createClient();
  await supabase.rpc("ai_resolve_action", {
    p_action: parsed.data,
    p_status: "cancelled",
  });

  return { ok: false, message: "Peruutettu. Mitään ei muutettu." };
}

export async function confirmMattiAction(
  _prev: MattiActionState,
  formData: FormData,
): Promise<MattiActionState> {
  const parsed = idSchema.safeParse(formData.get("actionId"));
  if (!parsed.success) return { error: "Tuntematon ehdotus." };

  const { restaurant, role } = await requireContext("/admin");
  const supabase = await createClient();

  // Varaa ehdotus. Palauttaa rivin vain kerran.
  const { data: rows, error: claimError } = await supabase.rpc("ai_resolve_action", {
    p_action: parsed.data,
    p_status: "confirmed",
  });

  const action = normalizeRow(rows);

  if (claimError || !action) {
    return { error: "Ehdotus on jo käsitelty tai se ei ole enää voimassa." };
  }

  const tool = findTool(action.tool);

  if (!tool || tool.level !== "write") {
    await log(supabase, action, restaurant.id, null, null, false, "Tuntematon työkalu");
    return { error: "Tuntematon toiminto." };
  }

  // Oikeus tarkistetaan uudelleen suoritushetkellä. Rooli on voinut
  // muuttua ehdotuksen ja hyväksynnän välissä.
  if (!can(role, tool.requires)) {
    await log(supabase, action, restaurant.id, null, null, false, "Ei oikeutta");
    return { error: "Sinulla ei ole oikeutta tähän toimintoon." };
  }

  /*
   * Argumentit validoidaan TYÖKALUN omalla skeemalla.
   *
   * Aiemmin tässä oli käsin kirjoitettu kopio jokaisesta skeemasta.
   * Kopio ehti vioittua: päivämääräkuviosta katosivat kenoviivat,
   * jolloin ehdotus meni läpi mutta hyväksyntä kaatui. Kaksi
   * totuutta samasta muodosta on aina yksi liikaa.
   */
  const args = tool.schema.safeParse(action.arguments);

  if (!args.success) {
    await log(
      supabase,
      action,
      restaurant.id,
      null,
      null,
      false,
      args.error.issues[0]?.message ?? "Virheelliset argumentit",
    );
    return { error: "Ehdotuksen tiedot eivät kelpaa. Mitään ei tallennettu." };
  }

  try {
    const result = await execute(
      supabase,
      action,
      args.data as Record<string, unknown>,
    );

    await log(
      supabase,
      action,
      restaurant.id,
      result.before,
      result.after,
      true,
      null,
      result.target,
    );

    revalidatePath("/admin", "layout");
    revalidatePath("/lounas", "layout");

    return { ok: true, message: result.message };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await log(supabase, action, restaurant.id, null, null, false, message);

    return {
      error: readable(message),
    };
  }
}

// ---------------------------------------------------------------------------

interface PendingRow {
  id: string;
  conversation_id: string;
  tool: string;
  arguments: Record<string, unknown>;
}

/** ai_resolve_action palauttaa rivin joko oliona tai yhden alkion listana. */
function normalizeRow(rows: unknown): PendingRow | null {
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row || typeof row !== "object") return null;

  const candidate = row as Partial<PendingRow>;
  if (!candidate.id || !candidate.tool) return null;

  return {
    id: candidate.id,
    conversation_id: candidate.conversation_id ?? "",
    tool: candidate.tool,
    arguments: (candidate.arguments ?? {}) as Record<string, unknown>,
  };
}

interface ExecutionResult {
  message: string;
  target: string | null;
  before: unknown;
  after: unknown;
}

/**
 * Suorittaa ehdotuksen.
 *
 * Argumentit validoidaan uudelleen työkalun skeemalla. Ne on
 * validoitu jo ehdotusta luotaessa, mutta kanta on tallentanut ne
 * JSONina — ja JSON kannassa on dataa jonka muotoon ei luoteta
 * sokeasti.
 */
async function execute(
  supabase: Awaited<ReturnType<typeof createClient>>,
  action: PendingRow,
  args: Record<string, unknown>,
): Promise<ExecutionResult> {
  switch (action.tool) {
    case "propose_lunch_items": {
      const { days, replace } = args as {
        days: {
          date: string;
          priceEuros?: number;
          items: {
            name: string;
            description?: string;
            diets?: string[];
            allergens?: string[];
          }[];
        }[];
        replace?: boolean;
      };

      const { restaurant } = await requireContext("/admin");

      /*
       * Viikko avataan ensin.
       *
       * "Tee ensi viikon lounaslista" osuu yleensä viikkoon jota ei ole
       * vielä olemassa. Ilman tätä ehdotuksen hyväksyminen kaatuisi
       * siihen ettei päivää löydy — ja käyttäjän pitäisi tietää käydä
       * luomassa viikko itse ensin.
       */
      const weeks = new Set(days.map((d) => weekStartOf(d.date)));

      for (const week of weeks) {
        const { error } = await supabase.rpc("open_lunch_week", {
          p_restaurant: restaurant.id,
          p_week_start: week,
        });
        if (error) throw new Error(error.message);
      }

      let added = 0;
      const touched: string[] = [];

      for (const day of days) {
        const row = await lunchDay(supabase, day.date);
        if (!row) throw new Error(`Päivää ${day.date} ei löytynyt`);

        touched.push(row.id);

        if (replace) {
          const { error } = await supabase.rpc("clear_lunch_day_items", {
            p_day: row.id,
          });
          if (error) throw new Error(error.message);
        }

        if (day.priceEuros !== undefined) {
          const { error } = await supabase.rpc("set_lunch_price", {
            p_day: row.id,
            p_name: "Lounas",
            p_cents: Math.round(day.priceEuros * 100),
          });
          if (error) throw new Error(error.message);
        }

        for (const item of day.items) {
          const { error } = await supabase.rpc("save_lunch_item", {
            p_day: row.id,
            p_item: null,
            p_name: item.name,
            p_description: item.description ?? null,
            p_diets: item.diets ?? [],
            p_allergens: item.allergens ?? [],
          });
          if (error) throw new Error(error.message);

          added += 1;
        }
      }

      return {
        message:
          `Valmis. Lisäsin ${added} ruokaa ${days.length} päivälle. ` +
          "Lista on luonnos — julkaise se kun se on valmis.",
        target: touched.join(","),
        before: null,
        after: { days: days.length, items: added },
      };
    }

    case "propose_lunch_price": {
      const { date, euros, priceName } = args as {
        date: string;
        euros: number;
        priceName?: string;
      };

      const name = priceName ?? "Lounas";
      const cents = Math.round(euros * 100);

      const day = await lunchDay(supabase, date);
      if (!day) throw new Error("Päivää ei löytynyt");

      const before = day.prices.find((p) => p.name === name)?.cents ?? null;

      const { error } = await supabase.rpc("set_lunch_price", {
        p_day: day.id,
        p_name: name,
        p_cents: cents,
      });
      if (error) throw new Error(error.message);

      return {
        message: `Valmis. ${name} ${date} on nyt ${formatMoney(cents)}.`,
        target: day.id,
        before: { cents: before },
        after: { cents },
      };
    }

    case "propose_copy_lunch_week": {
      const { fromWeekStart, toWeekStart } = args as {
        fromWeekStart: string;
        toWeekStart: string;
      };

      const { restaurant } = await requireContext("/admin");

      const { error } = await supabase.rpc("copy_lunch_week", {
        p_restaurant: restaurant.id,
        p_from_week: weekStartOf(fromWeekStart),
        p_to_week: weekStartOf(toWeekStart),
      });
      if (error) throw new Error(error.message);

      return {
        message: "Valmis. Lounaslista kopioitiin luonnokseksi.",
        target: weekStartOf(toWeekStart),
        before: null,
        after: { weekStart: weekStartOf(toWeekStart), status: "draft" },
      };
    }

    case "propose_publish_lunch_week": {
      const { weekStart } = args as { weekStart: string };

      const week = weekStartOf(weekStart);
      const menu = await lunchMenu(supabase, week);
      if (!menu) throw new Error("Viikkoa ei löytynyt");

      const { error } = await supabase.rpc("publish_lunch_week", {
        p_menu: menu.id,
      });
      if (error) throw new Error(error.message);

      return {
        message: "Valmis. Lounaslista on julkaistu.",
        target: menu.id,
        before: { status: menu.status },
        after: { status: "published" },
      };
    }

    default:
      throw new Error("Tuntematon toiminto");
  }
}

async function lunchDay(
  supabase: Awaited<ReturnType<typeof createClient>>,
  date: string,
): Promise<{ id: string; prices: { name: string; cents: number }[] } | null> {
  const { data } = await supabase
    .from("lunch_days")
    .select("id, lunch_prices ( name, price_cents )")
    .eq("date", date)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id as string,
    prices: ((data.lunch_prices as unknown as { name: string; price_cents: number }[]) ?? []).map(
      (p) => ({ name: p.name, cents: p.price_cents }),
    ),
  };
}

async function lunchMenu(
  supabase: Awaited<ReturnType<typeof createClient>>,
  weekStart: string,
): Promise<{ id: string; status: string } | null> {
  const { data } = await supabase
    .from("lunch_menus")
    .select("id, status")
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!data) return null;
  return { id: data.id as string, status: data.status as string };
}

async function log(
  supabase: Awaited<ReturnType<typeof createClient>>,
  action: PendingRow,
  restaurantId: string,
  before: unknown,
  after: unknown,
  success: boolean,
  error: string | null,
  target: string | null = null,
): Promise<void> {
  await supabase.rpc("ai_log_action", {
    p_restaurant: restaurantId,
    p_conversation: action.conversation_id || null,
    p_tool: action.tool,
    p_arguments: action.arguments,
    p_target: target,
    p_before: before,
    p_after: after,
    p_confirmed: true,
    p_success: success,
    p_error: error,
  });

  // Ehdotuksen tila kertoo että se on käsitelty, ei sitä onnistuiko
  // suoritus. Se mitä oikeasti tapahtui on auditlokissa: onnistuminen,
  // virhe, arvo ennen ja jälkeen. Kaksi paikkaa samalle tiedolle olisi
  // kaksi totuutta.
}

/** Kannan virheteksti luettavaksi. */
function readable(message: string): string {
  if (message.includes("Vain esihenkilö")) return message;
  if (message.includes("Tyhjää lounaslistaa")) return message;
  if (message.includes("ei löytynyt")) return message;

  return "En saanut muutosta tehtyä. Mitään ei tallennettu.";
}

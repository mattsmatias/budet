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

  try {
    const result = await execute(supabase, action);

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
): Promise<ExecutionResult> {
  switch (action.tool) {
    case "propose_lunch_price": {
      const args = z
        .object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          euros: z.number().min(0).max(1000),
          priceName: z.string().max(40).optional(),
        })
        .parse(action.arguments);

      const name = args.priceName ?? "Lounas";
      const cents = Math.round(args.euros * 100);

      const day = await lunchDay(supabase, args.date);
      if (!day) throw new Error("Päivää ei löytynyt");

      const before = day.prices.find((p) => p.name === name)?.cents ?? null;

      const { error } = await supabase.rpc("set_lunch_price", {
        p_day: day.id,
        p_name: name,
        p_cents: cents,
      });
      if (error) throw new Error(error.message);

      return {
        message: `Valmis. ${name} ${args.date} on nyt ${formatMoney(cents)}.`,
        target: day.id,
        before: { cents: before },
        after: { cents },
      };
    }

    case "propose_copy_lunch_week": {
      const args = z
        .object({
          fromWeekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          toWeekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
        .parse(action.arguments);

      const { restaurant } = await requireContext("/admin");

      const { error } = await supabase.rpc("copy_lunch_week", {
        p_restaurant: restaurant.id,
        p_from_week: weekStartOf(args.fromWeekStart),
        p_to_week: weekStartOf(args.toWeekStart),
      });
      if (error) throw new Error(error.message);

      return {
        message: "Valmis. Lounaslista kopioitiin luonnokseksi.",
        target: weekStartOf(args.toWeekStart),
        before: null,
        after: { weekStart: weekStartOf(args.toWeekStart), status: "draft" },
      };
    }

    case "propose_publish_lunch_week": {
      const args = z
        .object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
        .parse(action.arguments);

      const week = weekStartOf(args.weekStart);
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

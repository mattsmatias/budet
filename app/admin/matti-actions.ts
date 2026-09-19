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
import type { AdminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { adminText } from "@/lib/i18n/admin-text";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { requireContext } from "@/lib/restoflow/session";
import { can } from "@/lib/restoflow/permissions";
import { findTool } from "@/lib/matti/tools";

export interface MattiActionState {
  ok?: boolean;
  message?: string;
  error?: string;
  /** Linkki tulokseen. Näytetään onnistumisen jälkeen. */
  href?: string;
  linkLabel?: string;
}

const idSchema = z.string().uuid();

export async function cancelMattiAction(
  _prev: MattiActionState,
  formData: FormData,
): Promise<MattiActionState> {
  const t = adminText(await resolveLocale());
  const parsed = idSchema.safeParse(formData.get("actionId"));
  if (!parsed.success) return { error: t.loput.unknownProposal };

  const supabase = await createClient();
  await supabase.rpc("ai_resolve_action", {
    p_action: parsed.data,
    p_status: "cancelled",
  });

  return { ok: false, message: t.loput.cancelledNothing };
}

export async function confirmMattiAction(
  _prev: MattiActionState,
  formData: FormData,
): Promise<MattiActionState> {
  const t = adminText(await resolveLocale());
  const parsed = idSchema.safeParse(formData.get("actionId"));
  if (!parsed.success) return { error: t.loput.unknownProposal };

  const { restaurant, role } = await requireContext("/admin");
  const supabase = await createClient();

  // Varaa ehdotus. Palauttaa rivin vain kerran.
  const { data: rows, error: claimError } = await supabase.rpc(
    "ai_resolve_action",
    {
      p_action: parsed.data,
      p_status: "confirmed",
    },
  );

  const action = normalizeRow(rows);

  if (claimError || !action) {
    return { error: t.loput.proposalHandled };
  }

  const tool = findTool(action.tool);

  if (!tool || tool.level !== "write") {
    await log(
      supabase,
      action,
      restaurant.id,
      null,
      null,
      false,
      t.loput.unknownTool,
    );
    return { error: t.loput.unknownAction };
  }

  // Oikeus tarkistetaan uudelleen suoritushetkellä. Rooli on voinut
  // muuttua ehdotuksen ja hyväksynnän välissä.
  if (!can(role, tool.requires)) {
    await log(
      supabase,
      action,
      restaurant.id,
      null,
      null,
      false,
      t.loput.noRight,
    );
    return { error: t.loput.noRightBody };
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
      args.error.issues[0]?.message ?? t.loput.badArguments,
    );
    return { error: t.loput.badArgumentsBody };
  }

  try {
    const result = await execute(action);

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

    return {
      ok: true,
      message: result.message,
      href: result.href,
      linkLabel: result.linkLabel,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await log(supabase, action, restaurant.id, null, null, false, message);

    return {
      error: readable(message, t),
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
  /**
   * Linkki tulokseen.
   *
   * Ilman tätä Matti sanoi "Valmis, lisäsin 25 ruokaa" eikä kertonut
   * mihin. Lista meni ensi viikolle, käyttäjä katsoi kuluvaa viikkoa,
   * ja joutui etsimään sen lounashistoriasta.
   */
  href?: string;
  linkLabel?: string;
}

/**
 * Suorittaa ehdotuksen.
 *
 * Argumentit validoidaan uudelleen työkalun skeemalla. Ne on
 * validoitu jo ehdotusta luotaessa, mutta kanta on tallentanut ne
 * JSONina — ja JSON kannassa on dataa jonka muotoon ei luoteta
 * sokeasti.
 */
async function execute(action: PendingRow): Promise<ExecutionResult> {
  const t = adminText(await resolveLocale());
  /*
   * Ei kirjoittavia työkaluja tällä hetkellä.
   *
   * Matin ainoat kirjoittavat työkalut olivat lounaslistan ehdotuksia,
   * ja lounas poistui Katesta. Koneisto jää: se on se reitti jota
   * pitkin tuleva kirjoittava työkalu kulkee, ja sen turvallisuus on
   * jo rakennettu ja testattu. Tuntematon ehdotus hylätään.
   */
  switch (action.tool) {
    default:
      throw new Error(t.loput.unknownActionShort);
  }
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
function readable(message: string, t: AdminText): string {
  if (message.includes("Vain esihenkilö")) return message;
  if (message.includes("ei löytynyt")) return message;

  return t.loput.couldNotChange;
}

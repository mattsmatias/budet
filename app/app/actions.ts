"use server";

/**
 * Työntekijän toiminnot.
 *
 * Kaikki kirjoitus kulkee tästä. Selain ei kirjoita tietokantaan suoraan
 * edes silloin kun RLS sallisi sen — palvelin on ainoa paikka jossa
 * siirtymien kelvollisuus tarkistetaan ja jossa virheen voi kääntää
 * ihmisluettavaksi.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { requireContext } from "@/lib/restoflow/session";
import type { ClockEventType } from "@/lib/restoflow/types";

export interface ActionState {
  error?: string;
  notice?: string;
}

// ---------------------------------------------------------------------------
// Työaika
// ---------------------------------------------------------------------------

const CLOCK_TYPES: ClockEventType[] = ["in", "break_start", "break_end", "out"];

/**
 * Leimaa työajan.
 *
 * Siirtymän kelvollisuus tarkistetaan tietokantafunktiossa, ei täällä:
 * kaksi auki olevaa välilehteä voisi muuten tuottaa kaksi sisäänleimausta
 * peräkkäin, ja työaika laskettaisiin väärin.
 */
export async function recordClockEvent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const type = String(formData.get("type") ?? "") as ClockEventType;
  if (!CLOCK_TYPES.includes(type)) {
    return { error: "Tuntematon leimaustyyppi." };
  }

  const { restaurant } = await requireContext("/app/tyoaika");
  const supabase = await createClient();

  const { error } = await supabase.rpc("record_clock_event", {
    p_restaurant: restaurant.id,
    p_type: type,
  });

  if (error) {
    if (error.message?.includes("ei ole mahdollinen")) {
      return {
        error:
          "Leimaus ei käy nykyisessä tilassa. Lataa sivu uudelleen — " +
          "tilanne on saattanut muuttua toisessa välilehdessä.",
      };
    }
    return { error: explain(error, "Leimaus epäonnistui") };
  }

  revalidatePath("/app", "layout");
  revalidatePath("/admin", "layout");

  return { notice: LABELS[type] };
}

const LABELS: Record<ClockEventType, string> = {
  in: "Sisäänleimaus kirjattu.",
  break_start: "Tauko alkoi.",
  break_end: "Takaisin töissä.",
  out: "Uloskirjaus kirjattu.",
};

// ---------------------------------------------------------------------------
// Työvuorot
// ---------------------------------------------------------------------------

/**
 * Hyväksyy tai kieltäytyy vuorosta.
 *
 * RLS sallii vain oman vuoron ja vain tilan vaihdon; liipaisin estää aikojen
 * muuttamisen. Tämä funktio ei siis voi tehdä enempää kuin mihin
 * työntekijällä on oikeus, vaikka sitä kutsuttaisiin väärillä arvoilla.
 */
export async function respondToShift(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const shiftId = String(formData.get("shiftId") ?? "");
  const answer = String(formData.get("answer") ?? "");

  if (!shiftId) return { error: "Vuoroa ei löytynyt." };
  if (answer !== "accepted" && answer !== "declined") {
    return { error: "Tuntematon vastaus." };
  }

  await requireContext("/app/vuorot");
  const supabase = await createClient();

  const { error } = await supabase
    .from("shifts")
    .update({ status: answer })
    .eq("id", shiftId);

  if (error) return { error: explain(error, "Vastauksen tallennus epäonnistui") };

  revalidatePath("/app", "layout");
  revalidatePath("/admin", "layout");

  return {
    notice: answer === "accepted" ? "Vuoro hyväksytty." : "Ilmoitettu esihenkilölle.",
  };
}

// ---------------------------------------------------------------------------
// Poissaolot
// ---------------------------------------------------------------------------

const absenceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarkista päivämäärä."),
  kind: z.enum(["sick", "other", "cannot_attend"]),
  note: z.string().trim().max(300).nullable(),
});

export async function reportAbsence(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = absenceSchema.safeParse({
    date: formData.get("date"),
    kind: formData.get("kind"),
    note: (formData.get("note") as string) || null,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { restaurant, user } = await requireContext("/app/vuorot");
  const supabase = await createClient();

  const { error } = await supabase.from("absences").insert({
    restaurant_id: restaurant.id,
    user_id: user.id,
    absence_date: parsed.data.date,
    kind: parsed.data.kind,
    note: parsed.data.note,
  });

  if (error) return { error: explain(error, "Ilmoituksen tallennus epäonnistui") };

  revalidatePath("/app", "layout");
  revalidatePath("/admin", "layout");

  return { notice: "Poissaolo ilmoitettu." };
}

/** Peruu oman poissaoloilmoituksen. */
export async function cancelAbsence(formData: FormData): Promise<void> {
  const id = String(formData.get("absenceId") ?? "");
  if (!id) return;

  await requireContext("/app/vuorot");
  const supabase = await createClient();
  await supabase.from("absences").delete().eq("id", id);

  revalidatePath("/app", "layout");
  revalidatePath("/admin", "layout");
}

// ---------------------------------------------------------------------------

/**
 * Kääntää tietokannan virheen toimintakelpoiseksi.
 *
 * Yleinen "yritä uudelleen" piilottaisi syyn, jolloin käyttäjä ei voi tehdä
 * mitään. Tuntematon virhe näytetään sellaisenaan.
 */
function explain(
  error: { code?: string; message?: string } | null,
  prefix: string,
): string {
  const code = error?.code ?? "";
  const message = error?.message ?? "";

  if (code === "PGRST202" || message.includes("schema cache")) {
    return "Tietokannan rakenteet puuttuvat. Aja migraatiot ensin.";
  }
  if (code === "42501" || message.includes("row-level security")) {
    return "Sinulla ei ole oikeutta tähän toimintoon.";
  }
  if (message.includes("Kirjautuminen vaaditaan")) {
    return "Istunto on vanhentunut. Kirjaudu uudelleen sisään.";
  }
  if (message.includes("Vain vuoron tilan")) {
    return "Vuoron aikoja voi muuttaa vain esihenkilö.";
  }

  return message ? `${prefix}: ${message}` : `${prefix}.`;
}

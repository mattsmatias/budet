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
// Poissaolot
// ---------------------------------------------------------------------------

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Loppupäivä on vapaaehtoinen ja tarkoittaa tyhjänä samaa päivää.
 *
 * Sairausloma kestää usein useamman päivän, mutta yhden päivän ilmoitus
 * on silti tavallisin. Pakollinen loppupäivä lisäisi kentän joka
 * täytettäisiin joka kerta samalla arvolla kuin alku.
 */
const absenceSchema = z
  .object({
    date: z.string().regex(isoDate, "Tarkista päivämäärä."),
    endDate: z.string().regex(isoDate, "Tarkista loppupäivä.").nullable(),
    kind: z.enum(["sick", "other", "cannot_attend"]),
    note: z.string().trim().max(300).nullable(),
  })
  .refine((value) => value.endDate === null || value.endDate >= value.date, {
    message: "Poissaolo ei voi päättyä ennen kuin se alkaa.",
  });

export async function reportAbsence(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = absenceSchema.safeParse({
    date: formData.get("date"),
    endDate: (formData.get("endDate") as string) || null,
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
    end_date: parsed.data.endDate ?? parsed.data.date,
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
// Oma profiili
// ---------------------------------------------------------------------------

const nameSchema = z.object({
  fullName: z.string().trim().min(1, "Nimi puuttuu.").max(120),
});

/**
 * Oman nimen muutos.
 *
 * Nimi elää kahdessa paikassa: auth-tunnuksen metadatassa ja
 * profiles-taulussa, josta sovellus lukee sen. Molemmat päivitetään,
 * muuten nimi vaihtuisi vain toisessa ja näkymät erkanisivat.
 */
export async function updateProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = nameSchema.safeParse({ fullName: formData.get("fullName") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { user } = await requireContext("/app/asetukset");
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName })
    .eq("id", user.id);

  if (error) return { error: explain(error, "Nimen tallennus epäonnistui") };

  await supabase.auth.updateUser({ data: { full_name: parsed.data.fullName } });

  revalidatePath("/app", "layout");
  revalidatePath("/admin", "layout");

  return { notice: "Nimi tallennettu." };
}

const passwordSchema = z
  .object({
    password: z.string().min(8, "Salasanassa on oltava vähintään 8 merkkiä."),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Salasanat eivät täsmää.",
    path: ["confirm"],
  });

/**
 * Salasanan vaihto kirjautuneena.
 *
 * Supabase vaatii voimassa olevan istunnon, joten vanhaa salasanaa ei
 * kysytä erikseen. Jos istunto on vanhentunut, vaihto ei onnistu — ja
 * juuri niin sen kuuluukin mennä.
 */
export async function changePassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await requireContext("/app/asetukset");
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      error: error.message.includes("same as the old")
        ? "Uusi salasana ei voi olla sama kuin vanha."
        : "Salasanan vaihto ei onnistunut. Kirjaudu ulos ja takaisin sisään, ja yritä uudelleen.",
    };
  }

  return { notice: "Salasana vaihdettu." };
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

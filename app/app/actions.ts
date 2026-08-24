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
import { ISO_DATE } from "@/lib/restoflow/dates";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { requireContext } from "@/lib/restoflow/session";
import type { ClockEventType } from "@/lib/restoflow/types";

export interface ActionState {
  error?: string;
  notice?: string;
  /**
   * Mitä juuri leimattiin ja milloin.
   *
   * Käyttöliittymä näyttää onnistumisen vasta kun palvelin on
   * vahvistanut tapahtuman. Kellonaika tulee tästä eikä selaimen
   * kellosta: näytetty aika on se joka kirjattiin.
   */
  clocked?: { type: ClockEventType; at: string };
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
    // Kanta on ainoa joka tietää onko vuoroa. Käännetään sen sanoma
    // ihmisen kielelle sen sijaan että näytettäisiin poikkeus.
    if (error.message?.includes("Ei voimassa olevaa työvuoroa")) {
      return {
        error:
          "Sinulla ei ole juuri nyt voimassa olevaa työvuoroa. " +
          "Leimaus avautuu vuoron alkaessa.",
      };
    }
    if (error.message?.includes("ei ole mahdollinen")) {
      return {
        error:
          "Leimaus ei käy nykyisessä tilassa. Tilanne on päivitetty — " +
          "se on saattanut muuttua toisessa välilehdessä.",
      };
    }
    return { error: explain(error, "Leimaus epäonnistui") };
  }

  revalidatePath("/app", "layout");
  revalidatePath("/admin", "layout");

  return { notice: LABELS[type], clocked: { type, at: new Date().toISOString() } };
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


/**
 * Loppupäivä on vapaaehtoinen ja tarkoittaa tyhjänä samaa päivää.
 *
 * Sairausloma kestää usein useamman päivän, mutta yhden päivän ilmoitus
 * on silti tavallisin. Pakollinen loppupäivä lisäisi kentän joka
 * täytettäisiin joka kerta samalla arvolla kuin alku.
 */
const absenceSchema = z
  .object({
    date: z.string().regex(ISO_DATE, "Tarkista päivämäärä."),
    endDate: z.string().regex(ISO_DATE, "Tarkista loppupäivä.").nullable(),
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

// ---------------------------------------------------------------------------
// Syntymäpäivä
// ---------------------------------------------------------------------------

/**
 * Oma syntymäpäivä työyhteisöä varten.
 *
 * Päivä ja kuukausi, ei vuotta. Vuotta ei kysytä koska Budet ei tarvitse
 * ikää mihinkään, eikä tietoa jota ei ole voi vuotaa.
 *
 * Tyhjä syöte poistaa merkinnän. Syntymäpäivän kertominen on
 * vapaaehtoista, ja siitä on päästävä myös pois.
 */
export async function updateBirthday(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user } = await requireContext("/app/asetukset");

  const raw = String(formData.get("birthday") ?? "").trim();

  let day: number | null = null;
  let month: number | null = null;

  if (raw !== "") {
    // Selaimen date-kenttä antaa muodon "2000-08-24". Vuosi jätetään
    // lukematta: se on kentän pakko, ei meidän tarpeemme.
    const match = raw.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if (!match) return { error: "Tarkista päivämäärä." };

    month = Number(match[1]);
    day = Number(match[2]);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ birth_day: day, birth_month: month })
    .eq("id", user.id);

  if (error) return { error: explain(error, "Syntymäpäivän tallennus epäonnistui") };

  revalidatePath("/app", "layout");
  return { notice: raw === "" ? "Syntymäpäivä poistettu." : "Syntymäpäivä tallennettu." };
}

// ---------------------------------------------------------------------------
// Avoimet vuorot
// ---------------------------------------------------------------------------

/**
 * Ota avoin vuoro itselle.
 *
 * Kaikki säännöt ovat claim_open_shift-funktiossa: asema,
 * päällekkäisyys, päättynyt vuoro ja se ettei joku muu ehtinyt ensin.
 * Tämä ei tarkista niitä uudelleen — kaksi totuutta samasta säännöstä
 * ajautuu erilleen, ja kanta on se joka ratkaisee.
 *
 * Kilpajuoksu on tavallinen eikä poikkeus: avoin vuoro ilmestyy
 * kaikille kerralla, ja kaksi ihmistä voi painaa samalla sekunnilla.
 * Siksi häviäjälle kerrotaan mitä tapahtui eikä näytetä virhettä.
 */
export async function claimOpenShift(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const shiftId = String(formData.get("shiftId") ?? "");
  if (!UUID.test(shiftId)) {
    return { error: "Tuntematon työvuoro." };
  }

  await requireContext("/app/vuorot");
  const supabase = await createClient();

  const { error } = await supabase.rpc("claim_open_shift", { p_shift: shiftId });

  if (error) {
    const message = error.message ?? "";

    if (message.includes("Joku ehti ensin") || message.includes("jo tekijä")) {
      return {
        error: "Joku ehti ensin — vuoro on jo otettu.",
      };
    }
    if (message.includes("samaan aikaan")) {
      return {
        error: "Sinulla on jo työvuoro samaan aikaan. Kysy esihenkilöltä.",
      };
    }
    if (message.includes("jo päättynyt")) {
      return { error: "Työvuoro on jo päättynyt." };
    }
    if (message.includes("toiselle asemalle")) {
      return { error: "Työvuoro on toiselle asemalle." };
    }
    if (message.includes("ei ole käytössä")) {
      return { error: "Vuorojen ottaminen ei ole käytössä tässä ravintolassa." };
    }

    return { error: explain(error, "Vuoron ottaminen epäonnistui") };
  }

  revalidatePath("/app", "layout");
  revalidatePath("/admin", "layout");

  return { notice: "Työvuoro on nyt sinun." };
}

/** Tunniste tulee lomakkeelta, joten muoto tarkistetaan ennen kantaa. */
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

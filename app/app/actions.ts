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
import { resolveLocale } from "@/lib/i18n/resolve";
import { workerErrors, type WorkerErrors } from "@/lib/i18n/worker-errors";
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
  const v = workerErrors(await resolveLocale());

  const type = String(formData.get("type") ?? "") as ClockEventType;
  if (!CLOCK_TYPES.includes(type)) {
    return { error: v.unknownClockType };
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
      return { error: v.noActiveShift };
    }
    if (error.message?.includes("ei ole mahdollinen")) {
      return { error: v.badState };
    }
    return { error: explain(error, v.clockFailed, v) };
  }

  revalidatePath("/app", "layout");
  revalidatePath("/admin", "layout");

  return {
    notice: kuittaukset(v)[type],
    clocked: { type, at: new Date().toISOString() },
  };
}

const kuittaukset = (v: WorkerErrors): Record<ClockEventType, string> => ({
  in: v.clockedIn,
  break_start: v.breakStarted,
  break_end: v.backAtWork,
  out: v.clockedOut,
});

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
const absenceSchema = (v: WorkerErrors) =>
  z
    .object({
      date: z.string().regex(ISO_DATE, v.checkDate),
      endDate: z.string().regex(ISO_DATE, v.checkEndDate).nullable(),
      kind: z.enum(["sick", "other", "cannot_attend"]),
      note: z.string().trim().max(300).nullable(),
    })
    .refine((value) => value.endDate === null || value.endDate >= value.date, {
      message: v.endBeforeStart,
    });

export async function reportAbsence(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const v = workerErrors(await resolveLocale());

  const parsed = absenceSchema(v).safeParse({
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

  if (error) return { error: explain(error, v.absenceSaveFailed, v) };

  revalidatePath("/app", "layout");
  revalidatePath("/admin", "layout");

  return { notice: v.absenceReported };
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

const nameSchema = (v: WorkerErrors) =>
  z.object({
    fullName: z.string().trim().min(1, v.nameMissing).max(120),
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
  const v = workerErrors(await resolveLocale());

  const parsed = nameSchema(v).safeParse({ fullName: formData.get("fullName") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { user } = await requireContext("/app/asetukset");
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName })
    .eq("id", user.id);

  if (error) return { error: explain(error, v.nameSaveFailed, v) };

  await supabase.auth.updateUser({ data: { full_name: parsed.data.fullName } });

  revalidatePath("/app", "layout");
  revalidatePath("/admin", "layout");

  return { notice: v.nameSaved };
}

const passwordSchema = (v: WorkerErrors) =>
  z
    .object({
      password: z.string().min(8, v.passwordMin),
      confirm: z.string(),
    })
    .refine((data) => data.password === data.confirm, {
      message: v.passwordsDiffer,
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
  const v = workerErrors(await resolveLocale());

  const parsed = passwordSchema(v).safeParse({
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
        ? v.samePassword
        : v.passwordChangeFailed,
    };
  }

  return { notice: v.passwordChanged };
}

// ---------------------------------------------------------------------------

/**
 * Kääntää tietokannan virheen toimintakelpoiseksi.
 *
 * Yleinen "yritä uudelleen" piilottaisi syyn, jolloin käyttäjä ei voi tehdä
 * mitään. Tuntematon virhe näytetään sellaisenaan.
 */
/**
 * Kannan virhe ihmisen kielella.
 *
 * Tunnetut tapaukset kaannetaan; tuntemattoman perassa kulkee kannan
 * oma viesti sellaisenaan, koska vaara arvaus olisi pahempi kuin
 * vieraskielinen tosiasia.
 */
function explain(
  error: { code?: string; message?: string } | null,
  prefix: string,
  v: WorkerErrors,
): string {
  const code = error?.code ?? "";
  const message = error?.message ?? "";

  if (code === "PGRST202" || message.includes("schema cache")) {
    return v.migrationsMissing;
  }
  if (code === "42501" || message.includes("row-level security")) {
    return v.noPermission;
  }
  if (message.includes("Kirjautuminen vaaditaan")) {
    return v.sessionExpired;
  }
  if (message.includes("Vain vuoron tilan")) {
    return v.onlyManagerTimes;
  }

  return message ? `${prefix}: ${message}` : `${prefix}.`;
}

// ---------------------------------------------------------------------------
// Syntymäpäivä
// ---------------------------------------------------------------------------

/**
 * Oma syntymäpäivä työyhteisöä varten.
 *
 * Päivä ja kuukausi, ei vuotta. Vuotta ei kysytä koska Kate ei tarvitse
 * ikää mihinkään, eikä tietoa jota ei ole voi vuotaa.
 *
 * Tyhjä syöte poistaa merkinnän. Syntymäpäivän kertominen on
 * vapaaehtoista, ja siitä on päästävä myös pois.
 */
export async function updateBirthday(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const v = workerErrors(await resolveLocale());

  const { user } = await requireContext("/app/asetukset");

  const raw = String(formData.get("birthday") ?? "").trim();

  let day: number | null = null;
  let month: number | null = null;

  if (raw !== "") {
    // Selaimen date-kenttä antaa muodon "2000-08-24". Vuosi jätetään
    // lukematta: se on kentän pakko, ei meidän tarpeemme.
    const match = raw.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if (!match) return { error: v.checkDate };

    month = Number(match[1]);
    day = Number(match[2]);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ birth_day: day, birth_month: month })
    .eq("id", user.id);

  if (error) return { error: explain(error, v.birthdaySaveFailed, v) };

  revalidatePath("/app", "layout");
  return { notice: raw === "" ? v.birthdayRemoved : v.birthdaySaved };
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
  const v = workerErrors(await resolveLocale());

  const shiftId = String(formData.get("shiftId") ?? "");
  if (!UUID.test(shiftId)) {
    return { error: v.unknownShift };
  }

  await requireContext("/app/vuorot");
  const supabase = await createClient();

  const { error } = await supabase.rpc("claim_open_shift", { p_shift: shiftId });

  if (error) {
    const message = error.message ?? "";

    if (message.includes("Joku ehti ensin") || message.includes("jo tekijä")) {
      return {
        error: v.someoneFirst,
      };
    }
    if (message.includes("samaan aikaan")) {
      return {
        error: v.overlappingShift,
      };
    }
    if (message.includes("jo päättynyt")) {
      return { error: v.shiftEnded };
    }
    if (message.includes("toiselle asemalle")) {
      return { error: v.otherPosition };
    }
    if (message.includes("ei ole käytössä")) {
      return { error: v.claimingDisabled };
    }

    return { error: explain(error, v.claimFailed, v) };
  }

  revalidatePath("/app", "layout");
  revalidatePath("/admin", "layout");

  return { notice: v.shiftIsYours };
}

/** Tunniste tulee lomakkeelta, joten muoto tarkistetaan ennen kantaa. */
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

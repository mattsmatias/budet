"use server";

/**
 * Palkkojen toiminnot.
 *
 * Kaksi sääntöä ohjaa tätä tiedostoa.
 *
 * 1. Alkuperäistä leimausta ei muuteta. Korjaus on oma rivinsä joka
 *    kantaa alkuperäiset ajat, uudet ajat, tekijän ja syyn.
 *
 * 2. Hyväksyntä laskee palkan uudelleen palvelimella. Selaimen
 *    lähettämä summa ei kelpaa: se olisi lomakekenttä johon palkan voi
 *    kirjoittaa.
 */

import { revalidatePath } from "next/cache";
import { ISO_DATE } from "@/lib/restoflow/dates";
import { createClient } from "@/utils/supabase/server";
import { requireContext } from "@/lib/restoflow/session";
import { can } from "@/lib/restoflow/permissions";
import { fetchClockEvents } from "@/lib/restoflow/queries";
import { loadPayroll } from "@/lib/restoflow/payroll-data";
import { eventsOnDate } from "@/lib/restoflow/timeclock";
import { fingerprint, type PeriodBounds } from "@/lib/restoflow/payroll";

export interface PayrollState {
  error?: string;
  notice?: string;
}

const PATH = "/admin/palkat";

function explain(error: { message?: string }, fallback: string): string {
  const message = error.message ?? "";
  if (message.includes("Palkkakausi on hyväksytty")) {
    return "Palkkakausi on hyväksytty. Avaa kausi ennen muutosta.";
  }
  return `${fallback}: ${message || "tuntematon virhe"}`;
}

/** Edellisen vuorokauden alku UTC:nä — hakuikkunan puskuriksi. */
function previousDayIso(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString();
}

/** "10:02" ja päivä ravintolan ajassa → UTC-aikaleima. */
function localToIso(date: string, hhmm: string, timezone: string): string | null {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;

  /*
   * Vyöhykkeen siirtymä selvitetään kokeilemalla.
   *
   * Intl osaa kertoa mikä paikallinen kello on annetulla hetkellä,
   * muttei suoraan mikä hetki vastaa annettua paikallista kelloa.
   * Otetaan arvaus UTC:nä, katsotaan mitä siitä tulee paikallisesti ja
   * korjataan erotuksella. Yksi kierros riittää kaikkialla missä
   * siirtymä on tasaminuutteja.
   */
  const guess = new Date(`${date}T${hhmm}:00.000Z`);
  if (Number.isNaN(guess.getTime())) return null;

  const asLocal = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(guess);

  const part = (type: string) => Number(asLocal.find((p) => p.type === type)?.value ?? 0);
  const localMs = Date.UTC(
    part("year"), part("month") - 1, part("day"), part("hour"), part("minute"),
  );

  const offset = localMs - guess.getTime();
  return new Date(guess.getTime() - offset).toISOString();
}

// ---------------------------------------------------------------------------
// Työajan korjaus
// ---------------------------------------------------------------------------

/**
 * Korjaa yhden päivän toteutunut aika.
 *
 * Alkuperäiset ajat luetaan leimauksista ja tallennetaan korjaukseen
 * ennen kuin uudet kirjoitetaan. Ilman sitä tietoa ei jälkeenpäin näkisi
 * mitä muutettiin, vaan ainoastaan mihin päädyttiin.
 */
export async function correctWorkTime(
  _prev: PayrollState,
  formData: FormData,
): Promise<PayrollState> {
  const { restaurant, role, user } = await requireContext(PATH);
  if (!can(role, "payroll.manage")) return { error: "Ei oikeutta korjata työaikaa." };

  const userId = String(formData.get("userId") ?? "");
  const date = String(formData.get("date") ?? "");
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const breakMinutes = Number(formData.get("breakMinutes") ?? 0);

  if (!userId || !ISO_DATE.test(date)) return { error: "Puutteelliset tiedot." };
  if (!reason) return { error: "Kerro miksi aikaa korjataan." };

  const correctedIn = localToIso(date, from, restaurant.timezone);
  const correctedOut = localToIso(date, to, restaurant.timezone);

  if (!correctedIn || !correctedOut) return { error: "Kellonaika on virheellinen." };
  if (Date.parse(correctedOut) <= Date.parse(correctedIn)) {
    return { error: "Lopetusajan on oltava aloitusajan jälkeen." };
  }
  if (!Number.isFinite(breakMinutes) || breakMinutes < 0) {
    return { error: "Tauko ei voi olla negatiivinen." };
  }

  /*
   * Alkuperäiset ajat talteen ennen korjausta.
   *
   * Haku alkaa edellisestä vuorokaudesta. Päivä on paikallinen mutta
   * rajaus UTC:tä: Helsingissä paikallinen vuorokausi alkaa kolme tuntia
   * aiemmin, joten klo 02:15 tehty leimaus on edellisen UTC-päivän
   * puolella. Ilman puskuria se jäisi hakuikkunan ulkopuolelle ja
   * korjaukseen tallentuisi väärä alkuperäinen aika.
   */
  const events = await fetchClockEvents(restaurant.id, previousDayIso(date));
  const dayEvents = eventsOnDate(
    events.filter((e) => e.userId === userId),
    date,
    restaurant.timezone,
  );

  const originalIn = dayEvents.find((e) => e.type === "in")?.at ?? null;
  const originalOut =
    [...dayEvents].reverse().find((e) => e.type === "out")?.at ?? null;

  const supabase = await createClient();
  const { error } = await supabase.from("time_corrections").upsert(
    {
      restaurant_id: restaurant.id,
      user_id: userId,
      work_date: date,
      original_in: originalIn,
      original_out: originalOut,
      corrected_in: correctedIn,
      corrected_out: correctedOut,
      corrected_break_minutes: Math.round(breakMinutes),
      reason,
      created_by: user.id,
    },
    { onConflict: "restaurant_id,user_id,work_date" },
  );

  if (error) return { error: explain(error, "Korjaus epäonnistui") };

  revalidatePath(PATH, "layout");
  return { notice: "Työaika korjattu." };
}

/** Poistaa korjauksen, jolloin leimaukset palaavat voimaan. */
export async function removeCorrection(formData: FormData): Promise<void> {
  const { restaurant, role } = await requireContext(PATH);
  if (!can(role, "payroll.manage")) return;

  const id = String(formData.get("correctionId") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("time_corrections")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurant.id);

  revalidatePath(PATH, "layout");
}

// ---------------------------------------------------------------------------
// Palkkakausi
// ---------------------------------------------------------------------------

async function periodRow(restaurantId: string, period: PeriodBounds) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("pay_periods")
    .select("id, status")
    .eq("restaurant_id", restaurantId)
    .eq("starts_on", period.startsOn)
    .eq("ends_on", period.endsOn)
    .maybeSingle();

  if (data) return data as { id: string; status: string };

  const { data: created } = await supabase
    .from("pay_periods")
    .insert({
      restaurant_id: restaurantId,
      starts_on: period.startsOn,
      ends_on: period.endsOn,
    })
    .select("id, status")
    .single();

  return (created as { id: string; status: string } | null) ?? null;
}

/**
 * Hyväksyy yhden työntekijän palkkalaskelman.
 *
 * Laskelma lasketaan uudelleen ja tallennetaan riveineen. Tästä hetkestä
 * eteenpäin se on tilannekuva: myöhempi muutos vuoroon ei muuta jo
 * hyväksyttyä summaa vaan näkyy sormenjäljen erona.
 */
export async function approvePayslip(
  _prev: PayrollState,
  formData: FormData,
): Promise<PayrollState> {
  const { restaurant, role, user } = await requireContext(PATH);
  if (!can(role, "payroll.manage")) return { error: "Ei oikeutta hyväksyä palkkoja." };

  const userId = String(formData.get("userId") ?? "");
  const startsOn = String(formData.get("startsOn") ?? "");
  const endsOn = String(formData.get("endsOn") ?? "");

  if (!userId || !ISO_DATE.test(startsOn) || !ISO_DATE.test(endsOn)) {
    return { error: "Palkkakausi puuttuu." };
  }

  const period = { startsOn, endsOn };
  const nowIso = new Date().toISOString();

  const data = await loadPayroll(restaurant.id, restaurant.timezone, period, nowIso);
  const slip = data.slips.find((s) => s.userId === userId);
  if (!slip) return { error: "Palkkalaskelmaa ei löytynyt." };

  /*
   * Epäselvästä työvuorosta ei muodosteta lopullista palkkaa.
   *
   * Puuttuva uloskirjaus tai puuttuva palkkatieto on korjattava ensin.
   * Hyväksyminen varoituksen päälle tarkoittaisi että joku maksaa
   * summan jota järjestelmä itse pitää epäluotettavana.
   */
  if (slip.issues.length > 0) {
    return {
      error: `Korjaa ensin: ${slip.issues[0].message}`,
    };
  }

  const row = await periodRow(restaurant.id, period);
  if (!row) return { error: "Palkkakauden luonti epäonnistui." };

  const supabase = await createClient();

  const { data: saved, error } = await supabase
    .from("payslips")
    .upsert(
      {
        restaurant_id: restaurant.id,
        pay_period_id: row.id,
        user_id: userId,
        status: "approved",
        hourly_rate_cents: slip.hourlyRateCents,
        worked_minutes: slip.workedMinutes,
        base_cents: slip.baseCents,
        supplements_cents: slip.supplementsCents,
        gross_cents: slip.grossCents,
        source_fingerprint: fingerprint(slip),
        computed_at: nowIso,
        approved_at: nowIso,
        approved_by: user.id,
      },
      { onConflict: "pay_period_id,user_id" },
    )
    .select("id")
    .single();

  if (error || !saved) return { error: explain(error ?? {}, "Hyväksyntä epäonnistui") };

  const payslipId = (saved as { id: string }).id;

  // Rivit kirjoitetaan aina uusiksi: osittainen päivitys jättäisi
  // vanhoja rivejä jos laskelma on lyhentynyt.
  await supabase.from("payslip_lines").delete().eq("payslip_id", payslipId);

  if (slip.lines.length > 0) {
    const { error: lineError } = await supabase.from("payslip_lines").insert(
      slip.lines.map((line) => ({
        payslip_id: payslipId,
        work_date: line.date,
        shift_id: line.shiftId,
        pay_component_id: line.componentId,
        correction_id: line.correctionId,
        description: line.description,
        minutes: line.minutes,
        rate_cents: line.rateCents,
        amount_cents: line.amountCents,
      })),
    );

    if (lineError) return { error: explain(lineError, "Rivien tallennus epäonnistui") };
  }

  revalidatePath(PATH, "layout");
  return { notice: "Palkka hyväksytty." };
}

/** Hyväksyy koko kauden. Sen jälkeen laskelmat lukkiutuvat. */
export async function approvePeriod(
  _prev: PayrollState,
  formData: FormData,
): Promise<PayrollState> {
  const { restaurant, role, user } = await requireContext(PATH);
  if (!can(role, "payroll.manage")) return { error: "Ei oikeutta hyväksyä palkkakautta." };

  const startsOn = String(formData.get("startsOn") ?? "");
  const endsOn = String(formData.get("endsOn") ?? "");
  if (!ISO_DATE.test(startsOn) || !ISO_DATE.test(endsOn)) {
    return { error: "Palkkakausi puuttuu." };
  }

  const nowIso = new Date().toISOString();
  const data = await loadPayroll(
    restaurant.id, restaurant.timezone, { startsOn, endsOn }, nowIso,
  );

  if (data.issues.length > 0) {
    return { error: `Kaudella on ${data.issues.length} tarkistettavaa kohtaa.` };
  }

  const row = await periodRow(restaurant.id, { startsOn, endsOn });
  if (!row) return { error: "Palkkakautta ei löytynyt." };

  const paid = data.slips.filter((s) => s.workedMinutes > 0);
  const approved = await countApproved(row.id);

  if (approved < paid.length) {
    return {
      error: `Hyväksy ensin kaikki palkkalaskelmat (${approved}/${paid.length}).`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("pay_periods")
    .update({ status: "approved", approved_at: nowIso, approved_by: user.id })
    .eq("id", row.id);

  if (error) return { error: explain(error, "Kauden hyväksyntä epäonnistui") };

  revalidatePath(PATH, "layout");
  return { notice: "Palkkakausi hyväksytty ja lukittu." };
}

async function countApproved(periodId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("payslips")
    .select("id", { count: "exact", head: true })
    .eq("pay_period_id", periodId)
    .eq("status", "approved");

  return count ?? 0;
}

/** Avaa hyväksytyn kauden uudelleen muokattavaksi. */
export async function reopenPeriod(
  _prev: PayrollState,
  formData: FormData,
): Promise<PayrollState> {
  const { restaurant, role } = await requireContext(PATH);
  if (!can(role, "payroll.manage")) return { error: "Ei oikeutta avata palkkakautta." };

  const startsOn = String(formData.get("startsOn") ?? "");
  const endsOn = String(formData.get("endsOn") ?? "");
  if (!ISO_DATE.test(startsOn) || !ISO_DATE.test(endsOn)) {
    return { error: "Palkkakausi puuttuu." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("pay_periods")
    .update({ status: "open", approved_at: null, approved_by: null })
    .eq("restaurant_id", restaurant.id)
    .eq("starts_on", startsOn)
    .eq("ends_on", endsOn);

  if (error) return { error: explain(error, "Avaaminen epäonnistui") };

  revalidatePath(PATH, "layout");
  return { notice: "Palkkakausi avattu. Laskelmat vaativat uuden hyväksynnän." };
}

// ---------------------------------------------------------------------------
// Palkkalajit
// ---------------------------------------------------------------------------

/** "18:00" → 1080. Tyhjä → null. */
function toMinuteOfDay(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  if (!/^\d{2}:\d{2}$/.test(text)) return null;
  const [h, m] = text.split(":").map(Number);
  return h * 60 + m;
}

export async function savePayComponent(
  _prev: PayrollState,
  formData: FormData,
): Promise<PayrollState> {
  const { restaurant, role } = await requireContext(PATH);
  if (!can(role, "payroll.manage")) return { error: "Ei oikeutta muokata palkkalajeja." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Anna palkkalajille nimi." };

  const unit = String(formData.get("unit") ?? "per_hour");
  if (!["per_hour", "percent", "fixed"].includes(unit)) {
    return { error: "Tuntematon yksikkö." };
  }

  const raw = String(formData.get("value") ?? "").replace(",", ".");
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return { error: "Arvo puuttuu." };

  // per_hour ja fixed sentteinä, percent prosentteina.
  const value = unit === "percent" ? parsed : Math.round(parsed * 100);

  const weekdays = formData
    .getAll("weekdays")
    .map((d) => Number(d))
    .filter((d) => d >= 1 && d <= 7);

  const from = toMinuteOfDay(formData.get("from"));
  const to = toMinuteOfDay(formData.get("to"));
  if ((from === null) !== (to === null)) {
    return { error: "Anna ikkunalle sekä alku että loppu, tai jätä molemmat tyhjiksi." };
  }

  const supabase = await createClient();
  const id = String(formData.get("componentId") ?? "");

  const row = {
    restaurant_id: restaurant.id,
    name,
    code: String(formData.get("code") ?? "other"),
    unit,
    value,
    weekdays,
    from_minute: from,
    to_minute: to,
    stackable: formData.get("stackable") === "on",
    valid_from: ISO_DATE.test(String(formData.get("validFrom") ?? ""))
      ? String(formData.get("validFrom"))
      : new Date().toISOString().slice(0, 10),
    valid_to: ISO_DATE.test(String(formData.get("validTo") ?? ""))
      ? String(formData.get("validTo"))
      : null,
  };

  const { error } = id
    ? await supabase.from("pay_components").update(row).eq("id", id)
    : await supabase.from("pay_components").insert(row);

  if (error) return { error: explain(error, "Palkkalajin tallennus epäonnistui") };

  revalidatePath(PATH, "layout");
  return { notice: id ? "Palkkalaji päivitetty." : "Palkkalaji lisätty." };
}

/**
 * Poistaa palkkalajin käytöstä.
 *
 * Rivi jää kantaan, koska hyväksytyt palkkalaskelmat viittaavat siihen.
 * Poistettu laji tekisi vanhasta laskelmasta lukukelvottoman.
 */
export async function deactivatePayComponent(formData: FormData): Promise<void> {
  const { restaurant, role } = await requireContext(PATH);
  if (!can(role, "payroll.manage")) return;

  const id = String(formData.get("componentId") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from("pay_components")
    .update({ active: false })
    .eq("id", id)
    .eq("restaurant_id", restaurant.id);

  revalidatePath(PATH, "layout");
}

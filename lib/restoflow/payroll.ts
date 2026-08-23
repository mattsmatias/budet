/**
 * Palkkakertymä toteutuneesta työajasta.
 *
 * Moduulin yksi sääntö, josta kaikki muu seuraa:
 *
 *   SUUNNITELTU AIKA EI OLE PALKKA-AIKA.
 *
 * Vuoron kellonajat ovat suunnitelma. Palkkaan oikeuttaa vain se aika
 * joka on johdettu leimauksista tai jonka esihenkilö on nimenomaisesti
 * korjannut ja perustellut. Siksi tässä tiedostossa ei lueta kertaakaan
 * `shift.startTime`- tai `shift.endTime`-kenttiä laskentaan: vuoro on
 * mukana vain jäljitettävyyttä varten.
 *
 * Toinen sääntö: jokainen euro osoittaa alkuperänsä. Rivi kertoo päivän,
 * vuoron, palkkalajin ja mahdollisen korjauksen. Ilman niitä laskelma on
 * laskin; niiden kanssa se on tarkastettavissa.
 */

import { minutesOfDayIn, timeIn, weekdayIn } from "./clock-context";
import {
  datesInRange,
  eventsOnDate,
  msToHours,
  workSegments,
  type WorkSegment,
} from "./timeclock";
import type { ClockEvent, Shift, User } from "./types";

// ---------------------------------------------------------------------------
// Tyypit
// ---------------------------------------------------------------------------

export type PayComponentUnit = "per_hour" | "percent" | "fixed";

export interface PayComponent {
  id: string;
  name: string;
  /** evening, night, saturday, sunday, overtime, other. */
  code: string;
  unit: PayComponentUnit;
  /** per_hour ja fixed sentteinä, percent prosentteina (100 = +100 %). */
  value: number;
  /** 1 = maanantai ... 7 = sunnuntai. Tyhjä = kaikki päivät. */
  weekdays: number[];
  /** Minuutteja paikallisesta keskiyöstä. Null = koko vuorokausi. */
  fromMinute: number | null;
  toMinute: number | null;
  stackable: boolean;
  validFrom: string;
  validTo: string | null;
  active: boolean;
}

export interface TimeCorrection {
  id: string;
  userId: string;
  workDate: string;
  correctedIn: string;
  correctedOut: string;
  correctedBreakMinutes: number;
  reason: string;
}

export type PayrollIssueKind =
  | "missing_out"
  | "missing_rate"
  | "illogical"
  | "implausible"
  | "running";

/**
 * Pisin uskottava yhtenäinen työjakso.
 *
 * Kuudentoista tunnin putki ei ole vuoro vaan unohtunut leimaus. Tämä
 * löytyi oikeasta aineistosta: yöllä klo 02:15 tehty sisäänleimaus jäi
 * auki, ja seuraavan illan leimaus sulki sen — 20 tuntia työaikaa
 * yhdeltä päivältä, ilman että mikään varoitti.
 *
 * Uloskirjaus oli olemassa, joten puuttuvan leimauksen tarkistus ei
 * huomannut mitään. Kesto on se mikä paljastaa virheen.
 */
const IMPLAUSIBLE_SEGMENT_MINUTES = 16 * 60;

export interface PayrollIssue {
  kind: PayrollIssueKind;
  userId: string;
  date: string;
  message: string;
}

/** Yhden työntekijän yhden päivän toteutunut aika. */
export interface Workday {
  date: string;
  segments: WorkSegment[];
  workedMinutes: number;
  breakMinutes: number;
  /** Ensimmäinen sisään ja viimeinen ulos, näytettäväksi. */
  firstIn: string | null;
  lastOut: string | null;
  source: "clock" | "corrected";
  correctionId: string | null;
  /** Vuoro samalta päivältä, jos sellainen on. Vain jäljitystä varten. */
  shiftId: string | null;
  issues: PayrollIssue[];
}

export interface PayslipLine {
  date: string;
  shiftId: string | null;
  componentId: string | null;
  correctionId: string | null;
  description: string;
  minutes: number;
  /** Tuntihinta sentteinä, tai prosentti jos laji on percent. */
  rateCents: number;
  amountCents: number;
}

export interface Payslip {
  userId: string;
  workedMinutes: number;
  baseCents: number;
  supplementsCents: number;
  grossCents: number;
  hourlyRateCents: number | null;
  lines: PayslipLine[];
  workdays: Workday[];
  issues: PayrollIssue[];
}

// ---------------------------------------------------------------------------
// Toteutunut työaika
// ---------------------------------------------------------------------------

/**
 * Yhden päivän toteutunut aika yhdelle työntekijälle.
 *
 * Korjaus voittaa leimaukset. Se ei kuitenkaan poista niitä: alkuperäiset
 * tapahtumat jäävät kantaan, ja korjauksen tunnus kulkee palkkariville
 * asti. Näin laskelmasta näkee että aikaa on muutettu ja kenen toimesta.
 */
export function resolveWorkday(input: {
  userId: string;
  date: string;
  events: ClockEvent[];
  correction: TimeCorrection | undefined;
  shift: Shift | undefined;
  nowIso: string;
  timezone: string;
}): Workday {
  const { userId, date, events, correction, shift, nowIso, timezone } = input;
  const issues: PayrollIssue[] = [];

  if (correction) {
    const startMs = Date.parse(correction.correctedIn);
    const endMs = Date.parse(correction.correctedOut);
    const breakMs = correction.correctedBreakMinutes * 60000;

    /*
     * Korjattu aika on yksi jakso josta tauko on vähennetty lopusta.
     *
     * Tauon tarkkaa sijaintia ei kysytä: esihenkilö tietää että tauko
     * oli, muttei minuutilleen milloin. Loppupää on parempi arvaus kuin
     * keskikohta, koska ilta- ja yölisät alkavat myöhemmin — tauon
     * sijoittaminen loppuun ei kasvata lisää vaan pienentää sitä.
     */
    const workedMs = Math.max(0, endMs - startMs - breakMs);

    return {
      date,
      segments: workedMs > 0 ? [{ startMs, endMs: startMs + workedMs }] : [],
      workedMinutes: Math.round(workedMs / 60000),
      breakMinutes: correction.correctedBreakMinutes,
      firstIn: correction.correctedIn,
      lastOut: correction.correctedOut,
      source: "corrected",
      correctionId: correction.id,
      shiftId: shift?.id ?? null,
      issues,
    };
  }

  const dayEvents = eventsOnDate(events, date, timezone);
  const segments = workSegments(dayEvents, nowIso);

  const firstIn = dayEvents.find((e) => e.type === "in")?.at ?? null;
  const lastOut = [...dayEvents].reverse().find((e) => e.type === "out")?.at ?? null;

  /*
   * Auki jäänyt leimaus ei muodosta palkkaa.
   *
   * Ilman uloskirjausta kesto lasketaan nykyhetkeen, mikä kasvaa niin
   * kauan kuin kukaan ei huomaa. Sellaisesta päivästä ei saa syntyä
   * lopullista palkkaa; se on korjattava ensin.
   */
  const hasOpenClock = firstIn !== null && lastOut === null;
  if (hasOpenClock) {
    issues.push({
      kind: "missing_out",
      userId,
      date,
      message: `Uloskirjaus puuttuu ${date}. Palkkaa ei muodosteta ennen korjausta.`,
    });
  }

  if (firstIn && lastOut && Date.parse(lastOut) <= Date.parse(firstIn)) {
    issues.push({
      kind: "illogical",
      userId,
      date,
      message: `Työvuoron aika on epälooginen ${date}: ulos ennen sisään.`,
    });
  }

  const workedMs = segments.reduce((sum, s) => sum + (s.endMs - s.startMs), 0);

  const longest = segments.reduce((max, s) => Math.max(max, s.endMs - s.startMs), 0);
  if (longest > IMPLAUSIBLE_SEGMENT_MINUTES * 60000) {
    issues.push({
      kind: "implausible",
      userId,
      date,
      message:
        `${date}: yhtenäinen työjakso on ${Math.round(longest / 3600000)} tuntia. ` +
        `Leimaus on todennäköisesti jäänyt auki — tarkista toteutunut aika.`,
    });
  }

  return {
    date,
    // Auki jäänyt päivä ei kerrytä minuutteja ennen kuin se on korjattu.
    segments: hasOpenClock ? [] : segments,
    workedMinutes: hasOpenClock ? 0 : Math.round(workedMs / 60000),
    breakMinutes: 0,
    firstIn,
    lastOut,
    source: "clock",
    correctionId: null,
    shiftId: shift?.id ?? null,
    issues,
  };
}

// ---------------------------------------------------------------------------
// Palkkalajien osuminen
// ---------------------------------------------------------------------------

/** Onko palkkalaji voimassa annettuna päivänä? */
export function componentApplies(component: PayComponent, date: string): boolean {
  if (!component.active) return false;
  if (date < component.validFrom) return false;
  if (component.validTo !== null && date > component.validTo) return false;
  return true;
}

/**
 * Kuinka monta minuuttia työjaksoista osuu palkkalajin ikkunaan.
 *
 * Käydään minuutti kerrallaan. Analyyttinen leikkaus olisi nopeampi
 * mutta vaikeampi lukea ja tarkistaa, ja tässä on kyse palkasta:
 * kuukauden aineisto yhdelle työntekijälle on joitakin tuhansia
 * minuutteja, mikä ei ole ongelma.
 *
 * Jokainen minuutti tulkitaan ravintolan ajassa. Lauantai-illan lisä
 * loppuu kun kello on paikallisesti sunnuntai, ei kun UTC vaihtaa
 * vuorokautta.
 */
export function componentMinutes(
  segments: WorkSegment[],
  component: PayComponent,
  timezone: string,
): number {
  let minutes = 0;

  for (const segment of segments) {
    for (let ms = segment.startMs; ms < segment.endMs; ms += 60000) {
      const iso = new Date(ms).toISOString();

      if (component.weekdays.length > 0) {
        if (!component.weekdays.includes(weekdayIn(timezone, iso))) continue;
      }

      if (component.fromMinute !== null && component.toMinute !== null) {
        const minute = minutesOfDayIn(timezone, iso);
        const { fromMinute: from, toMinute: to } = component;

        // from > to tarkoittaa keskiyön yli: 23:00-06:00 on 1380 -> 360.
        const inside =
          from <= to ? minute >= from && minute < to : minute >= from || minute < to;

        if (!inside) continue;
      }

      minutes += 1;
    }
  }

  return minutes;
}

/**
 * Palkkalajit jotka koskevat päivää, arvokkain ensin.
 *
 * Järjestys ratkaisee kun lisät eivät ole yhdisteltäviä: silloin samalta
 * minuutilta maksetaan vain paras. Vertailu tehdään tuntihinnalla, ja
 * prosenttilisä muunnetaan tuntipalkan avulla vertailukelpoiseksi.
 */
export function rankComponents(
  components: PayComponent[],
  hourlyRateCents: number,
): PayComponent[] {
  const worth = (c: PayComponent) =>
    c.unit === "percent" ? (hourlyRateCents * c.value) / 100 : c.value;

  return [...components].sort((a, b) => worth(b) - worth(a));
}

// ---------------------------------------------------------------------------
// Palkkalaskelma
// ---------------------------------------------------------------------------

/**
 * Yhden työntekijän palkkakertymä yhdeltä kaudelta.
 *
 * Peruspalkka lasketaan päivä kerrallaan, jotta jokainen rivi osoittaa
 * yhteen päivään ja yhteen vuoroon. Summa pyöristetään vasta riviä
 * kohti: minuuttikohtainen pyöristys kertyisi kuukaudessa euroiksi.
 */
export function buildPayslip(input: {
  user: User;
  from: string;
  to: string;
  events: ClockEvent[];
  shifts: Shift[];
  corrections: TimeCorrection[];
  components: PayComponent[];
  nowIso: string;
  timezone: string;
}): Payslip {
  const {
    user, from, to, events, shifts, corrections, components, nowIso, timezone,
  } = input;

  const mine = events.filter((e) => e.userId === user.id);
  const rate = user.hourlyRateCents;
  const issues: PayrollIssue[] = [];
  const lines: PayslipLine[] = [];
  const workdays: Workday[] = [];

  if (rate === null || rate === 0) {
    issues.push({
      kind: "missing_rate",
      userId: user.id,
      date: from,
      message: `${user.name}: palkkatieto puuttuu. Palkkaa ei voi laskea.`,
    });
  }

  const correctionByDate = new Map(
    corrections.filter((c) => c.userId === user.id).map((c) => [c.workDate, c]),
  );

  for (const date of datesInRange(from, to)) {
    const shift = shifts.find((s) => s.userId === user.id && s.date === date);

    const workday = resolveWorkday({
      userId: user.id,
      date,
      events: mine,
      correction: correctionByDate.get(date),
      shift,
      nowIso,
      timezone,
    });

    issues.push(...workday.issues);
    if (workday.workedMinutes === 0) continue;

    workdays.push(workday);

    // --- Peruspalkka -----------------------------------------------------

    const baseCents =
      rate === null ? 0 : Math.round(msToHours(workday.workedMinutes * 60000) * rate);

    lines.push({
      date,
      shiftId: workday.shiftId,
      componentId: null,
      correctionId: workday.correctionId,
      description: describeWorkday(workday, timezone),
      minutes: workday.workedMinutes,
      rateCents: rate ?? 0,
      amountCents: baseCents,
    });

    // --- Lisät -----------------------------------------------------------

    const applicable = rankComponents(
      components.filter((c) => componentApplies(c, date)),
      rate ?? 0,
    );

    /*
     * Yhdistelemättömät lisät varaavat minuutin itselleen.
     *
     * Kun sama minuutti osuu sekä sunnuntai- että iltalisään ja
     * kumpikaan ei ole yhdisteltävä, maksetaan arvokkaampi. Varatut
     * minuutit pidetään kirjaa jaksoittain, koska lisä lasketaan
     * minuuttimääränä eikä minuuttijoukkona.
     */
    let reservedMinutes = 0;

    for (const component of applicable) {
      const minutes = componentMinutes(workday.segments, component, timezone);
      if (minutes === 0) continue;

      const payable = component.stackable
        ? minutes
        : Math.max(0, minutes - reservedMinutes);

      if (payable === 0) continue;
      if (!component.stackable) reservedMinutes += payable;

      const hours = msToHours(payable * 60000);
      const amountCents =
        component.unit === "per_hour"
          ? Math.round(hours * component.value)
          : component.unit === "percent"
            ? Math.round(hours * ((rate ?? 0) * component.value) / 100)
            : Math.round(component.value);

      lines.push({
        date,
        shiftId: workday.shiftId,
        componentId: component.id,
        correctionId: workday.correctionId,
        description: component.name,
        minutes: component.unit === "fixed" ? 0 : payable,
        rateCents:
          component.unit === "per_hour"
            ? Math.round(component.value)
            : Math.round(component.value),
        amountCents,
      });
    }
  }

  const workedMinutes = workdays.reduce((sum, d) => sum + d.workedMinutes, 0);
  const baseCents = lines
    .filter((l) => l.componentId === null)
    .reduce((sum, l) => sum + l.amountCents, 0);
  const supplementsCents = lines
    .filter((l) => l.componentId !== null)
    .reduce((sum, l) => sum + l.amountCents, 0);

  return {
    userId: user.id,
    workedMinutes,
    baseCents,
    supplementsCents,
    grossCents: baseCents + supplementsCents,
    hourlyRateCents: rate,
    lines,
    workdays,
    issues,
  };
}

/** "10:02–18:01" tai "10:02–18:00 (korjattu)". */
export function describeWorkday(workday: Workday, timezone: string): string {
  const start = workday.firstIn ? timeIn(timezone, workday.firstIn) : "?";
  const end = workday.lastOut ? timeIn(timezone, workday.lastOut) : "?";
  const suffix = workday.source === "corrected" ? " (korjattu)" : "";
  return `${start}–${end}${suffix}`;
}

// ---------------------------------------------------------------------------
// Palkkakausi
// ---------------------------------------------------------------------------

export interface PeriodBounds {
  startsOn: string;
  endsOn: string;
}

/**
 * Kuukauden puolikkaat: 1.–15. ja 16.–kuun loppu.
 *
 * Tarjotaan valmiina, koska se on ravintola-alan tavallisin jakso.
 * Kausi tallennetaan silti päivävälinä, joten mikä tahansa muu rajaus
 * on yhtä lailla mahdollinen.
 */
export function halfMonthPeriods(month: string): PeriodBounds[] {
  const [year, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();

  return [
    { startsOn: `${month}-01`, endsOn: `${month}-15` },
    { startsOn: `${month}-16`, endsOn: `${month}-${String(last).padStart(2, "0")}` },
  ];
}

/** Koko kuukausi yhtenä kautena. */
export function monthPeriod(month: string): PeriodBounds {
  const [year, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return {
    startsOn: `${month}-01`,
    endsOn: `${month}-${String(last).padStart(2, "0")}`,
  };
}

/**
 * Lähtötietojen sormenjälki.
 *
 * Hyväksytty palkkalaskelma ei saa muuttua äänettömästi. Sormenjälki
 * lasketaan niistä tiedoista joista laskelma syntyi; jos se ei enää
 * täsmää, laskelma on vanhentunut ja vaatii uuden tarkistuksen.
 *
 * Ei kryptografiaa: tarkoitus on havaita muutos, ei estää väärennöstä.
 * Väärentäminen vaatisi kirjoitusoikeuden kantaan, ja silloin
 * sormenjälki olisi pienin ongelma.
 */
export function fingerprint(payslip: Payslip): string {
  const parts = payslip.lines.map(
    (l) =>
      `${l.date}|${l.componentId ?? "base"}|${l.correctionId ?? "-"}|` +
      `${l.minutes}|${l.rateCents}|${l.amountCents}`,
  );

  let hash = 0;
  const text = parts.join(";");
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }

  return `${payslip.lines.length}-${(hash >>> 0).toString(36)}`;
}

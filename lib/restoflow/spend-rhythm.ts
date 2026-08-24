/**
 * Kulurytmi.
 *
 * RAVINTOLAN KULUT EIVÄT OLE VIRTA VAAN RYTMI.
 *
 * Tukkutoimitukset tulevat tiettyinä päivinä, ja kuukauden loppusumma
 * piilottaa sen täysin. "3 482,60 €" kertoo paljonko meni; se ei kerro
 * että kaksi kolmasosaa siitä meni maanantaisin ja torstaisin, eikä
 * sitä että viime torstai oli kaksinkertainen edellisiin nähden.
 *
 * Tämä moduuli laskee päiväkohtaiset kulut ja etsii niistä rytmin.
 *
 * TULEVA PÄIVÄ EI OLE NOLLA.
 *
 * Kuluvan kuukauden loput päivät eivät ole kuluttomia vaan tulematta.
 * Ilman tätä eroa kuukauden loppu näyttäisi romahdukselta joka kerta.
 */

import { receiptsInMonth } from "./expenses";
import type { Receipt } from "./types";

/** Montako saman viikonpäivän havaintoa tarvitaan väitteeseen. */
const MIN_SAMPLES = 2;

/** Kuinka paljon keskiarvon yli viikonpäivän on oltava, jotta se on rytmi. */
const PEAK_RATIO = 1.5;

export interface SpendDay {
  date: string;
  /** Kuukauden päivä, 1–31. */
  day: number;
  /** 1 = maanantai … 7 = sunnuntai. */
  weekday: number;
  cents: number;
  receipts: number;
  isToday: boolean;
  /** Tuleva päivä: ei kuluton vaan tulematta. */
  isFuture: boolean;
}

export interface SpendRhythm {
  days: SpendDay[];
  /** Suurimman päivän summa. Palkkien mittakaava. */
  maxCents: number;
  totalCents: number;
  /** Kuinka moni päivä sisältää kuluja. */
  activeDays: number;
  /**
   * Viikonpäivä jolle kulut kasautuvat.
   *
   * Null kun havaintoja on liian vähän tai kasauma ei ole selvä. Yhden
   * torstain perusteella tehty väite "torstait ovat kalleimmat" on
   * arvaus joka näyttää tiedolta.
   */
  peakWeekday: { weekday: number; label: string; cents: number; share: number } | null;
  busiestDay: SpendDay | null;
}

export const WEEKDAY_LABELS = ["ma", "ti", "ke", "to", "pe", "la", "su"] as const;
export const WEEKDAY_NAMES = [
  "maanantai",
  "tiistai",
  "keskiviikko",
  "torstai",
  "perjantai",
  "lauantai",
  "sunnuntai",
] as const;

export function spendRhythm(
  receipts: Receipt[],
  month: string,
  today: string,
): SpendRhythm {
  const inMonth = receiptsInMonth(receipts, month);

  const totals = new Map<string, { cents: number; count: number }>();
  for (const receipt of inMonth) {
    const entry = totals.get(receipt.date) ?? { cents: 0, count: 0 };
    entry.cents += receipt.totalCents;
    entry.count += 1;
    totals.set(receipt.date, entry);
  }

  const days: SpendDay[] = datesOfMonth(month).map((date) => {
    const entry = totals.get(date);
    return {
      date,
      day: Number(date.slice(8, 10)),
      weekday: weekdayOf(date),
      cents: entry?.cents ?? 0,
      receipts: entry?.count ?? 0,
      isToday: date === today,
      isFuture: date > today,
    };
  });

  const past = days.filter((d) => !d.isFuture);
  const maxCents = Math.max(0, ...days.map((d) => d.cents));
  const totalCents = days.reduce((sum, d) => sum + d.cents, 0);

  /*
   * Rytmi lasketaan vain menneestä.
   *
   * Tulevalle päivälle kirjattu kuitti — ennakkoon merkitty tilaus —
   * vääristäisi sekä keskiarvon että osuuden. Aiemmin tässä käytettiin
   * koko kuukauden summaa, ja yksi tuleva rivi riitti hiljentämään
   * rytmin kokonaan.
   */
  const pastCents = past.reduce((sum, d) => sum + d.cents, 0);

  const busiest = past.reduce<SpendDay | null>(
    (best, day) => (day.cents > (best?.cents ?? 0) ? day : best),
    null,
  );

  return {
    days,
    maxCents,
    totalCents,
    activeDays: past.filter((d) => d.cents > 0).length,
    peakWeekday: findPeak(past, pastCents),
    busiestDay: busiest,
  };
}

// ---------------------------------------------------------------------------

/**
 * Kasautuuko kulu jollekin viikonpäivälle?
 *
 * Kaksi ehtoa. Havaintoja on oltava vähintään kaksi, jottei yksittäinen
 * suurtilaus tee päivästä sääntöä. Ja summan on oltava selvästi
 * keskiarvon yli — muuten seitsemästä viikonpäivästä yksi on aina
 * "suurin", eikä se tarkoita mitään.
 *
 * Summa on menneiden päivien summa, ei koko kuukauden.
 */
function findPeak(
  days: SpendDay[],
  pastCents: number,
): SpendRhythm["peakWeekday"] {
  if (pastCents <= 0) return null;

  const byWeekday = new Map<number, { cents: number; samples: number }>();

  for (const day of days) {
    if (day.cents <= 0) continue;
    const entry = byWeekday.get(day.weekday) ?? { cents: 0, samples: 0 };
    entry.cents += day.cents;
    entry.samples += 1;
    byWeekday.set(day.weekday, entry);
  }

  if (byWeekday.size < 2) return null;

  const average = pastCents / byWeekday.size;

  let best: { weekday: number; cents: number; samples: number } | null = null;
  for (const [weekday, entry] of byWeekday) {
    if (entry.cents > (best?.cents ?? 0)) {
      best = { weekday, cents: entry.cents, samples: entry.samples };
    }
  }

  if (!best) return null;
  if (best.samples < MIN_SAMPLES) return null;
  if (best.cents < average * PEAK_RATIO) return null;

  return {
    weekday: best.weekday,
    label: WEEKDAY_NAMES[best.weekday - 1],
    cents: best.cents,
    share: best.cents / pastCents,
  };
}

/** Kuukauden kaikki päivät ISO-muodossa. */
function datesOfMonth(month: string): string[] {
  const [year, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();

  return Array.from(
    { length: last },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
}

/**
 * Viikonpäivä 1–7, maanantaista sunnuntaihin.
 *
 * Päivämäärä on pelkkä päivä ilman kellonaikaa, joten keskipäivä
 * UTC:ssä on turvallinen lukutapa: yksikään aikavyöhyke ei siirrä sitä
 * toiselle päivälle.
 */
function weekdayOf(isoDate: string): number {
  const d = new Date(`${isoDate}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

// ---------------------------------------------------------------------------

/** Kuukausivirran piste: kulut ja myynti samalta kuukaudelta. */
export interface FlowPoint {
  month: string;
  label: string;
  costCents: number;
  /** Null kun myyntiä ei ole kirjattu. Ei nolla. */
  salesCents: number | null;
}

export interface MonthlyFlow {
  labels: string[];
  costs: number[];
  sales: (number | null)[];
  /** Onko jokin kuukausi ilman myyntiä? Kaavio kertoo sen. */
  salesMissing: boolean;
}

/**
 * Kulujen ja myynnin kehitys viimeisiltä kuukausilta.
 *
 * MYYNNIN PUUTTUMINEN EI OLE NOLLAMYYNTI.
 *
 * Myynti on Budetissa uusi taulu, ja historiaa on vasta siitä asti
 * kun sitä on alettu kirjata. Nollaan putoava viiva väittäisi että
 * ravintola lakkasi myymästä — kaavio katkaisee viivan sen sijaan,
 * ja siksi tässä palautetaan null eikä 0.
 */
export function monthlyFlow(
  receipts: Receipt[],
  sales: { date: string; netCents: number }[],
  month: string,
  count: number,
): MonthlyFlow {
  const months: string[] = [];
  let cursor = month;
  for (let i = 0; i < count; i += 1) {
    months.unshift(cursor);
    cursor = previousMonthOf(cursor);
  }

  const costs = months.map((m) =>
    receiptsInMonth(receipts, m).reduce((sum, r) => sum + r.totalCents, 0),
  );

  const salesByMonth = months.map((m) => {
    const rows = sales.filter((s) => s.date.startsWith(m));
    return rows.length === 0 ? null : rows.reduce((sum, s) => sum + s.netCents, 0);
  });

  return {
    labels: months.map(shortMonth),
    costs,
    sales: salesByMonth,
    salesMissing: salesByMonth.some((v) => v === null),
  };
}

/**
 * "2026-08" → "Elo"
 *
 * Isolla alkukirjaimella: akselin merkinnät ovat nimiä eivätkä
 * lauseen sanoja, ja pienellä kirjoitettuina ne lukivat kaavion alla
 * kuin keskeneräinen virke.
 */
function shortMonth(month: string): string {
  const names = [
    "Tam", "Hel", "Maa", "Huh", "Tou", "Kes",
    "Hei", "Elo", "Syy", "Lok", "Mar", "Jou",
  ];
  return names[Number(month.slice(5, 7)) - 1] ?? month;
}

function previousMonthOf(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return m === 1
    ? `${year - 1}-12`
    : `${year}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * Matin tilannekatsaus ja havainnot.
 *
 * MATTI EI KEKSI HAVAINTOJA.
 *
 * Jokainen rivi tässä lasketaan Katen omasta datasta, ja jokaisella
 * on kynnys sekä vähimmäishistoria. Kynnys on siksi, että kolmen
 * prosentin heilahdus ei ole havainto vaan kohinaa. Vähimmäishistoria
 * on siksi, että kahden viikon aineistosta laskettu "keskiarvoa
 * korkeampi" olisi arvaus jolla on prosenttiluku.
 *
 * Kun ehdot eivät täyty, havaintoa ei ole. Tyhjä on oikea vastaus
 * useammin kuin täytetty — ja väärä havainto maksaa enemmän kuin
 * puuttuva, koska sen perusteella tehdään päätöksiä.
 */

import type { Alert, Receipt, Shift } from "@/lib/restoflow/types";
import type { DailySales } from "@/lib/restoflow/sales";
import { addDays } from "@/lib/restoflow/dates";

export interface Observation {
  id: string;
  /** Mitä havaittiin, yhtenä lauseena. */
  text: string;
  href: string;
  linkLabel: string;
  /** Suunta: nouseva luku ei ole automaattisesti huono. */
  tone: "neutral" | "warn";
}

export interface Briefing {
  /** Vaatii huomiota nyt. */
  critical: Alert[];
  /** Kannattaa tarkistaa. */
  warnings: Alert[];
  /** Havainnot datasta — poikkeamat, eivät hälytykset. */
  observations: Observation[];
}

/** Summa aikavälillä [alku, loppu). */
function sumBetween(
  rows: { date: string }[],
  alku: string,
  loppu: string,
  arvo: (r: never) => number,
): number {
  let total = 0;
  for (const row of rows) {
    if (row.date >= alku && row.date < loppu) {
      total += arvo(row as never);
    }
  }
  return total;
}

function countBetween(
  rows: { date: string }[],
  alku: string,
  loppu: string,
): number {
  return rows.filter((r) => r.date >= alku && r.date < loppu).length;
}

/** Prosenttimuutos vertailukohtaan. Null jos vertailukohta on nolla. */
function muutos(nyt: number, vertailu: number): number | null {
  if (vertailu <= 0) return null;
  return ((nyt - vertailu) / vertailu) * 100;
}

function prosentti(n: number): string {
  return `${Math.abs(n).toFixed(0).replace(".", ",")} %`;
}

// ---------------------------------------------------------------------------

/** Kulut: viime seitsemän päivää vs. neljän edellisen viikon keskiarvo. */
export function expenseObservation(
  receipts: Receipt[],
  today: string,
): Observation | null {
  const viikko = addDays(today, -7);

  const nyt = sumBetween(receipts, viikko, today, (r: Receipt) => r.totalCents);

  /*
   * Neljä täyttä vertailuviikkoa, ei liukuvaa keskiarvoa.
   *
   * Jokaisessa on oltava kuitteja. Jos yksi viikko on tyhjä —
   * kesäloma, kiinniolo — keskiarvo putoaa ja kuluva viikko näyttää
   * piikiltä joka ei ole piikki.
   */
  const viikot: number[] = [];
  for (let i = 1; i <= 4; i++) {
    const alku = addDays(today, -7 * (i + 1));
    const loppu = addDays(today, -7 * i);
    const summa = sumBetween(
      receipts,
      alku,
      loppu,
      (r: Receipt) => r.totalCents,
    );
    if (summa <= 0) return null;
    viikot.push(summa);
  }

  const keskiarvo = viikot.reduce((a, b) => a + b, 0) / viikot.length;
  const ero = muutos(nyt, keskiarvo);
  if (ero === null || Math.abs(ero) < 10) return null;

  return {
    id: "kulut-viikko",
    text:
      ero > 0
        ? `Kulut ovat tällä viikolla ${prosentti(ero)} korkeammat kuin neljän edellisen viikon keskiarvo.`
        : `Kulut ovat tällä viikolla ${prosentti(ero)} matalammat kuin neljän edellisen viikon keskiarvo.`,
    href: "/admin/kulut",
    linkLabel: "Analysoi kulut",
    tone: ero > 0 ? "warn" : "neutral",
  };
}

/** Myynti: viime seitsemän päivää vs. sitä edeltävät seitsemän. */
export function salesObservation(
  sales: DailySales[],
  today: string,
): Observation | null {
  const viikko = addDays(today, -7);
  const edellinen = addDays(today, -14);

  /*
   * Molemmissa jaksoissa on oltava vähintään kolme kirjattua päivää.
   *
   * Kaksi päivää vastaan seitsemän ei ole vertailu vaan aukko
   * kirjauksissa, ja se näyttäisi myynnin romahdukselta.
   */
  const nytPaivia = countBetween(sales, viikko, today);
  const ennenPaivia = countBetween(sales, edellinen, viikko);
  if (nytPaivia < 3 || ennenPaivia < 3) return null;

  const nyt = sumBetween(sales, viikko, today, (s: DailySales) => s.netCents);
  const ennen = sumBetween(
    sales,
    edellinen,
    viikko,
    (s: DailySales) => s.netCents,
  );

  const ero = muutos(nyt, ennen);
  if (ero === null || Math.abs(ero) < 8) return null;

  return {
    id: "myynti-viikko",
    text:
      ero > 0
        ? `Myynti on viime viikolla ${prosentti(ero)} korkeampi kuin sitä edeltävällä viikolla.`
        : `Myynti on viime viikolla ${prosentti(ero)} matalampi kuin sitä edeltävällä viikolla.`,
    href: "/admin/myynti",
    linkLabel: "Katso myynti",
    tone: ero > 0 ? "neutral" : "warn",
  };
}

/** Työvuorot: ensi viikko vs. neljän edellisen viikon keskiarvo. */
export function shiftObservation(
  shifts: Shift[],
  today: string,
): Observation | null {
  const alku = addDays(today, 7);
  const loppu = addDays(today, 14);
  const ensiViikko = countBetween(shifts, alku, loppu);

  const viikot: number[] = [];
  for (let i = 1; i <= 4; i++) {
    const a = addDays(today, -7 * i);
    const b = addDays(today, -7 * (i - 1));
    const n = countBetween(shifts, a, b);
    if (n === 0) return null;
    viikot.push(n);
  }

  const keskiarvo = viikot.reduce((a, b) => a + b, 0) / viikot.length;
  const erotus = ensiViikko - keskiarvo;

  /*
   * Kynnys on vuoroina eikä prosentteina.
   *
   * Pienessä ravintolassa yksi vuoro on kymmenen prosenttia, ja
   * prosenttikynnys nostaisi joka viikko havainnon jota ei ole.
   */
  if (Math.abs(erotus) < 2) return null;

  const maara = Math.round(Math.abs(erotus));

  return {
    id: "vuorot-ensi-viikko",
    text:
      erotus > 0
        ? `Ensi viikolle on suunniteltu ${maara} vuoroa enemmän kuin neljän edellisen viikon keskiarvo.`
        : `Ensi viikolle on suunniteltu ${maara} vuoroa vähemmän kuin neljän edellisen viikon keskiarvo.`,
    href: "/admin/tyovuorot",
    linkLabel: "Tarkista vuorot",
    tone: "warn",
  };
}

// ---------------------------------------------------------------------------

/**
 * Koko tilannekatsaus.
 *
 * Hälytykset tulevat buildAlertsista, joka on sama lähde kuin kellon
 * merkissä ja Ilmoituksissa. Matti ei siis voi kertoa eri tilannetta
 * kuin muu sovellus.
 */
export function buildBriefing({
  alerts,
  receipts,
  sales,
  shifts,
  today,
}: {
  alerts: Alert[];
  receipts: Receipt[];
  sales: DailySales[];
  shifts: Shift[];
  today: string;
}): Briefing {
  const observations = [
    expenseObservation(receipts, today),
    salesObservation(sales, today),
    shiftObservation(shifts, today),
  ].filter((o): o is Observation => o !== null);

  return {
    critical: alerts.filter((a) => a.severity === "critical"),
    warnings: alerts.filter((a) => a.severity === "warning"),
    observations,
  };
}

/**
 * Tervehdys kellonajan mukaan.
 *
 * Ravintolan aikavyöhykkeellä eikä selaimen: esihenkilö voi katsoa
 * Katea lomalla toisessa maassa, eikä "hyvää yötä" ole silloin
 * totta ravintolassa.
 */
export function greeting(now: Date, timezone: string): string {
  const tunti = Number(
    new Intl.DateTimeFormat("fi-FI", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    }).format(now),
  );

  if (tunti < 5) return "Hyvää yötä";
  if (tunti < 10) return "Hyvää huomenta";
  if (tunti < 17) return "Hyvää päivää";
  return "Hyvää iltaa";
}

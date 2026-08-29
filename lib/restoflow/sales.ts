/**
 * Päivän myynti ja sen vertailukohdat.
 *
 * Luku yksin ei kerro mitään. "4 280 €" on tieto vasta kun sen vieressä
 * on jokin johon verrata, ja tämä tiedosto päättää mikä se on.
 *
 * SÄÄNTÖ: VERTAILUKOHTAA EI KEKSITÄ.
 *
 * Jos tavoitetta ei ole asetettu eikä historiaa ole tarpeeksi, luku
 * näytetään ilman vertailua. Keksitty prosentti näyttää tiedolta ja saa
 * tekemään päätöksiä.
 */

export interface DailySales {
  date: string;
  /** Veroton myynti sentteinä. Ainoa pakollinen luku. */
  netCents: number;
  /** Päivän tavoite, jos asetettu. */
  targetCents: number | null;
  note: string | null;

  /*
   * Päiväraportin lisätiedot.
   *
   * Null kun päivä on kirjattu käsin yhtenä lukuna. Vanhat rivit ovat
   * siis yhtä kelvollisia kuin uudet — raportin kuvaaminen täydentää
   * mutta ei ole ehto.
   */
  /** Verollinen myynti sentteinä. */
  grossCents: number | null;
  /** ALV yhteensä sentteinä. */
  vatCents: number | null;
  /** Kuittien määrä. */
  transactions: number | null;
  /** Kirjattu käsin vai luettu raportista. */
  source: "manual" | "report";

  /*
   * Kassan ilmoittamat luvut sellaisenaan.
   *
   * Erillään Katen omasta laskelmasta: täsmäytys vertaa näitä
   * riveiltä laskettuihin. Jos ne korvattaisiin laskennalla, vertailu
   * vertaisi lukua itseensä ja täsmäisi aina.
   */
  posGrossCents: number | null;
  posVatCents: number | null;
}

/** Montako saman viikonpäivän havaintoa tarvitaan vertailuun. */
const MIN_SAMPLES = 2;

export type SalesComparison =
  /** Tavoite on asetettu — verrataan siihen. */
  | { kind: "target"; targetCents: number; diffCents: number; ratio: number }
  /** Ei tavoitetta, mutta saman viikonpäivän historiaa on. */
  | { kind: "weekday"; averageCents: number; samples: number; ratio: number }
  /** Ei kumpaakaan. Luku näytetään sellaisenaan. */
  | { kind: "none" };

/**
 * Mihin päivän myyntiä verrataan.
 *
 * Tavoite voittaa historian: se on ravintoloitsijan oma päätös siitä
 * mikä on hyvä päivä, ja historia on vain arvaus siitä.
 *
 * Ilman tavoitetta verrataan saman viikonpäivän keskiarvoon eikä
 * kaikkien päivien keskiarvoon. Maanantai ei ole perjantai, ja
 * viikonpäivien sekoittaminen tekisi jokaisesta maanantaista huonon ja
 * jokaisesta perjantaista hyvän.
 */
export function compareSales(
  day: DailySales,
  history: DailySales[],
): SalesComparison {
  if (day.targetCents !== null && day.targetCents > 0) {
    return {
      kind: "target",
      targetCents: day.targetCents,
      diffCents: day.netCents - day.targetCents,
      ratio: day.netCents / day.targetCents,
    };
  }

  const weekday = weekdayOf(day.date);
  const same = history.filter(
    (h) => h.date !== day.date && weekdayOf(h.date) === weekday,
  );

  if (same.length < MIN_SAMPLES) return { kind: "none" };

  const total = same.reduce((sum, h) => sum + h.netCents, 0);
  const averageCents = Math.round(total / same.length);

  if (averageCents === 0) return { kind: "none" };

  return {
    kind: "weekday",
    averageCents,
    samples: same.length,
    ratio: day.netCents / averageCents,
  };
}

/**
 * Työvoiman osuus myynnistä.
 *
 * Ravintola-alan tunnusluku. Null jos myyntiä ei ole kirjattu tai se on
 * nolla: nollalla jakaminen antaisi äärettömän, ja ääretön näyttää
 * ruudulla luvulta.
 */
export function labourShareOfSales(
  labourCents: number,
  netSalesCents: number,
): number | null {
  if (netSalesCents <= 0) return null;
  return labourCents / netSalesCents;
}

/**
 * Karkea tulos: myynti miinus kirjatut kulut ja työvoima.
 *
 * TÄRKEÄ RAJAUS: tämä ei ole tulos kirjanpidon mielessä. Se ei sisällä
 * vuokraa, sivukuluja, poistoja eikä mitään mikä ei kulje Katen läpi.
 * Käyttöliittymän on sanottava se, jottei lukua käytetä päätöksiin
 * joihin se ei riitä.
 */
export function roughResult(input: {
  netSalesCents: number;
  expenseCents: number;
  labourCents: number;
}): number {
  return input.netSalesCents - input.expenseCents - input.labourCents;
}

/** Myynti aikaväliltä, päättömät päivät pois. */
export function salesBetween(
  sales: DailySales[],
  from: string,
  to: string,
): DailySales[] {
  return sales
    .filter((s) => s.date >= from && s.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function totalSalesCents(sales: DailySales[]): number {
  return sales.reduce((sum, s) => sum + s.netCents, 0);
}

/**
 * Päivät joilta myynti puuttuu.
 *
 * Vain menneet päivät ja vain ne joilta on leimauksia: ravintola on
 * voinut olla kiinni, eikä kiinni ollut päivä ole puuttuva merkintä.
 */
export function missingSalesDays(
  dates: string[],
  sales: DailySales[],
  today: string,
): string[] {
  const known = new Set(sales.map((s) => s.date));
  return dates.filter((d) => d < today && !known.has(d));
}

// ---------------------------------------------------------------------------

/** 1 = maanantai ... 7 = sunnuntai. Päivä on jo paikallinen. */
function weekdayOf(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return ((d.getUTCDay() + 6) % 7) + 1;
}

import type { TimeEntry } from "./employees";

/**
 * Työnantajan kustannus toteutuneista tunneista.
 *
 * MIKÄ TÄMÄ ON JA MIKÄ EI.
 *
 * Tämä arvioi mitä työ maksaa työnantajalle: bruttopalkka, sen päälle
 * ilta- ja viikonloppulisät, lomakorvaus ja työnantajan sivukulut.
 * Kaikki prosentit tulevat yrityksen omista asetuksista, koska ne
 * riippuvat työehtosopimuksesta ja vaihtuvat vuosittain.
 *
 * Tämä EI laske palkkaa. Ennakonpidätys, sairausajan palkka,
 * vuosilomalain mukaiset päivät ja TES-tulkinnat kuuluvat
 * palkkapalveluun. Verokortti ei kuulu tähän lainkaan: se määrää mitä
 * työntekijä saa käteen, ei mitä työnantaja maksaa.
 *
 * LISÄT EIVÄT KERRY PÄÄLLEKKÄIN.
 *
 * Sunnuntai-illan tunnista lasketaan suurin sovellettava lisä, ei
 * niiden summaa. Oikea työehtosopimus voi kertoa toisin; arvion
 * tarkoitus on kertoa suuruusluokka, ja liian suureksi arvattu kulu
 * johtaisi harhaan yhtä lailla kuin liian pieni.
 */

export interface PayrollSettings {
  /** Työnantajan sivukulut osuutena palkasta, esim. 0.23. */
  sideCostRate: number;
  /** Lomakorvaus osuutena palkasta, esim. 0.115. */
  holidayRate: number;
  /** Iltalisä osuutena tuntipalkasta, esim. 0.15. */
  eveningRate: number;
  /** Lauantailisä osuutena tuntipalkasta. */
  saturdayRate: number;
  /** Sunnuntailisä osuutena tuntipalkasta, esim. 1 = sadan prosentin korotus. */
  sundayRate: number;
  /** Illan alku paikallista aikaa, minuutteina vuorokauden alusta. */
  eveningStartMinute: number;
  /** Illan loppu paikallista aikaa. Pienempi kuin alku = yli keskiyön. */
  eveningEndMinute: number;
}

export const DEFAULT_PAYROLL: PayrollSettings = {
  sideCostRate: 0,
  holidayRate: 0,
  eveningRate: 0,
  saturdayRate: 0,
  sundayRate: 0,
  /* Kello 18–06 on tavallinen iltatyön raja, mutta se on asetus. */
  eveningStartMinute: 18 * 60,
  eveningEndMinute: 6 * 60,
};

export interface MinuteSplit {
  /** Minuutit ilman lisää. */
  base: number;
  evening: number;
  saturday: number;
  sunday: number;
}

export const EMPTY_SPLIT: MinuteSplit = {
  base: 0,
  evening: 0,
  saturday: 0,
  sunday: 0,
};

/**
 * Viikonpäivä ja kellonaika yrityksen aikavyöhykkeellä.
 *
 * Palvelin käy UTC:ssä. Ilman vyöhykettä kello 22 Helsingissä olisi
 * kello 19 eikä osuisi iltalisään lainkaan.
 */
function localParts(
  date: Date,
  timezone: string,
): { weekday: number; minuteOfDay: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "0";

  const days: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    weekday: days[get("weekday")] ?? 0,
    minuteOfDay: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function isEvening(minuteOfDay: number, settings: PayrollSettings): boolean {
  const { eveningStartMinute: start, eveningEndMinute: end } = settings;
  if (start === end) return false;

  /* Yli keskiyön menevä jakso, esimerkiksi 18–06. */
  if (start > end) return minuteOfDay >= start || minuteOfDay < end;

  return minuteOfDay >= start && minuteOfDay < end;
}

/**
 * Vuoron minuutit lisäluokkiin.
 *
 * Minuutti kerrallaan, koska vuoro ylittää usein sekä keskiyön että
 * illan rajan: perjantain iltavuoro jatkuu lauantain puolelle, ja
 * kesäajan vaihtuminen siirtää rajaa tunnilla. Kellonaika katsotaan
 * siis joka minuutille erikseen eikä päätellä alusta ja lopusta.
 *
 * Kesken oleva vuoro palauttaa nollat: sen kesto kasvaa joka sekunti,
 * eikä lukua joka muuttuu itsestään voi esittää kustannuksena.
 */
export function splitMinutes(
  entry: TimeEntry,
  timezone: string,
  settings: PayrollSettings,
): MinuteSplit {
  if (entry.clockOut === null || entry.minutes === null) return EMPTY_SPLIT;

  const start = new Date(entry.clockIn).getTime();
  const split: MinuteSplit = { ...EMPTY_SPLIT };

  for (let i = 0; i < entry.minutes; i += 1) {
    const { weekday, minuteOfDay } = localParts(
      new Date(start + i * 60_000),
      timezone,
    );

    if (weekday === 0) split.sunday += 1;
    else if (weekday === 6) split.saturday += 1;
    else if (isEvening(minuteOfDay, settings)) split.evening += 1;
    else split.base += 1;
  }

  return split;
}

export function addSplits(a: MinuteSplit, b: MinuteSplit): MinuteSplit {
  return {
    base: a.base + b.base,
    evening: a.evening + b.evening,
    saturday: a.saturday + b.saturday,
    sunday: a.sunday + b.sunday,
  };
}

export interface EmployerCost {
  /** Minuutit yhteensä. */
  minutes: number;
  /** Peruspalkka ilman lisiä. */
  baseCents: number;
  /** Ilta-, lauantai- ja sunnuntailisät yhteensä. */
  supplementCents: number;
  /** Lomakorvaus. */
  holidayCents: number;
  /** Työnantajan sivukulut. */
  sideCostCents: number;
  /** Kaikki yhteensä: tämä on se mitä työ maksaa. */
  totalCents: number;
}

/**
 * Mitä tunnit maksavat työnantajalle.
 *
 * Pyöristys tehdään vasta jokaisen erän lopussa eikä minuuteittain:
 * minuutin pyöristys kertyisi kuukauden aikana euroiksi.
 */
export function employerCost(
  split: MinuteSplit,
  hourlyCents: number,
  settings: PayrollSettings,
): EmployerCost {
  const minutes = split.base + split.evening + split.saturday + split.sunday;

  if (hourlyCents <= 0 || minutes <= 0) {
    return {
      minutes,
      baseCents: 0,
      supplementCents: 0,
      holidayCents: 0,
      sideCostCents: 0,
      totalCents: 0,
    };
  }

  const perMinute = hourlyCents / 60;
  const baseCents = Math.round(minutes * perMinute);

  const supplementCents = Math.round(
    split.evening * perMinute * settings.eveningRate +
      split.saturday * perMinute * settings.saturdayRate +
      split.sunday * perMinute * settings.sundayRate,
  );

  const wage = baseCents + supplementCents;
  const holidayCents = Math.round(wage * settings.holidayRate);
  const sideCostCents = Math.round((wage + holidayCents) * settings.sideCostRate);

  return {
    minutes,
    baseCents,
    supplementCents,
    holidayCents,
    sideCostCents,
    totalCents: wage + holidayCents + sideCostCents,
  };
}

/**
 * Prosenttiluku tekstistä osuudeksi, tai null.
 *
 * "23" ja "23,5" ovat prosentteja; tallennettu arvo on osuus 0,23.
 * Yläraja on kaksisataa, koska sunnuntailisä voi olla sata prosenttia
 * ja sitä suurempi luku on näppäilyvirhe.
 */
export function parsePercent(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (cleaned === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0 || value > 200) return null;

  return Math.round(value * 100) / 10000;
}

/** Osuus prosenttitekstiksi kenttään: 0,235 → "23,5". */
export function formatPercent(rate: number): string {
  const percent = Math.round(rate * 10000) / 100;
  return String(percent).replace(".", ",");
}

/**
 * Yhden työntekijän kustannus kuukaudessa.
 *
 * Jako lasketaan vuoro kerrallaan, koska lisät riippuvat kellonajasta
 * ja viikonpäivästä — kuukauden yhteistunneista niitä ei voi päätellä.
 */
export function costFor(
  entries: TimeEntry[],
  hourlyCents: number,
  timezone: string,
  settings: PayrollSettings,
): EmployerCost {
  const split = entries.reduce(
    (sum, entry) => addSplits(sum, splitMinutes(entry, timezone, settings)),
    EMPTY_SPLIT,
  );

  return employerCost(split, hourlyCents, settings);
}

/** Kustannukset yhteen: yrityksen kuukauden työvoimakulu. */
export function sumCosts(costs: EmployerCost[]): EmployerCost {
  return costs.reduce(
    (sum, cost) => ({
      minutes: sum.minutes + cost.minutes,
      baseCents: sum.baseCents + cost.baseCents,
      supplementCents: sum.supplementCents + cost.supplementCents,
      holidayCents: sum.holidayCents + cost.holidayCents,
      sideCostCents: sum.sideCostCents + cost.sideCostCents,
      totalCents: sum.totalCents + cost.totalCents,
    }),
    {
      minutes: 0,
      baseCents: 0,
      supplementCents: 0,
      holidayCents: 0,
      sideCostCents: 0,
      totalCents: 0,
    },
  );
}

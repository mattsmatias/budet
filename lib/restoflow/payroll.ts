import type { TimeEntry } from "./employees";

/**
 * Työnantajan kustannus toteutuneista tunneista.
 *
 * MIKÄ TÄMÄ ON JA MIKÄ EI.
 *
 * Tämä arvioi mitä työ maksaa työnantajalle: tuntipalkka, sen päälle
 * työaikalisät, lomakustannus ja työnantajan sivukulut. Kaikki arvot
 * tulevat yrityksen omista asetuksista.
 *
 * Tämä EI laske palkkaa. Ennakonpidätys, sairausajan palkka ja
 * lomapäivät kuuluvat palkkapalveluun. Verokortti ei kuulu tähän
 * lainkaan: se määrää mitä työntekijä saa käteen, ei mitä työnantaja
 * maksaa.
 *
 * EUROA TUNNILTA JA PROSENTTI OVAT ERI ASIOITA.
 *
 * Ravintola-alan työehtosopimuksissa iltalisä on tyypillisesti euroja
 * tunnilta — esimerkiksi 1,40 €/h — kun taas sunnuntaikorotus on
 * prosentti. Pelkkä prosenttikenttä olisi väärä tietomalli euromäärälle
 * ja pakottaisi käyttäjän laskemaan sen itse joka kerta kun tuntipalkka
 * muuttuu. Jokaisella lisällä on siksi molemmat, ja ne lasketaan yhteen.
 *
 * LISIEN EHDOT OVAT KÄYTTÄJÄN MÄÄRITTÄMÄT.
 *
 * Kate ei tiedä mikä työehtosopimus yritystä koskee eikä milloin kaksi
 * lisää kertyy päällekkäin. Se laskee sen minkä käyttäjä on asettanut:
 * viikonpäivän lisä ja kellonajan lisä ovat erillisiä asetuksia ja
 * molemmat pätevät tunnille johon ne osuvat. Ehdot tarkistetaan
 * sovellettavasta työehtosopimuksesta.
 */

/** Yksi lisä: euroa tunnilta ja/tai prosenttia tuntipalkasta. */
export interface Supplement {
  /** Euroa tunnilta sentteinä, esim. 140 = 1,40 €/h. */
  cents: number;
  /** Osuus tuntipalkasta, esim. 1 = sadan prosentin korotus. */
  rate: number;
}

export const NO_SUPPLEMENT: Supplement = { cents: 0, rate: 0 };

export interface PayrollSettings {
  /** Työnantajan sivukulut osuutena palkasta, esim. 0.23. */
  sideCostRate: number;
  /** Lomakustannus osuutena palkasta, esim. 0.115. */
  holidayRate: number;

  evening: Supplement;
  saturday: Supplement;
  sunday: Supplement;
  /** Yö- tai muu lisä omalla kellonaikavälillään. */
  night: Supplement;

  /** Illan rajat paikallista aikaa, minuutteina vuorokauden alusta. */
  eveningStartMinute: number;
  eveningEndMinute: number;
  /** Yön rajat. Sama alku ja loppu = ei yölisää. */
  nightStartMinute: number;
  nightEndMinute: number;
}

export const DEFAULT_PAYROLL: PayrollSettings = {
  sideCostRate: 0,
  holidayRate: 0,
  evening: NO_SUPPLEMENT,
  saturday: NO_SUPPLEMENT,
  sunday: NO_SUPPLEMENT,
  night: NO_SUPPLEMENT,
  /* Kello 18–23 ja 23–06 ovat tavallisia rajoja, mutta ne ovat asetus. */
  eveningStartMinute: 18 * 60,
  eveningEndMinute: 23 * 60,
  nightStartMinute: 23 * 60,
  nightEndMinute: 6 * 60,
};

/**
 * Minuutit luokittain.
 *
 * Luokat menevät päällekkäin tarkoituksella: sunnuntai-illan minuutti
 * on sekä sunnuntaita että iltaa, ja kumpikin lisä pätee siihen jos
 * käyttäjä on molemmat asettanut. Yhteistunnit ovat total, eivät
 * luokkien summa.
 */
export interface MinuteSplit {
  total: number;
  evening: number;
  night: number;
  saturday: number;
  sunday: number;
}

export const EMPTY_SPLIT: MinuteSplit = {
  total: 0,
  evening: 0,
  night: 0,
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

/** Osuuko hetki väliin? Loppu ennen alkua tarkoittaa keskiyön ylitystä. */
function inWindow(minuteOfDay: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start > end) return minuteOfDay >= start || minuteOfDay < end;
  return minuteOfDay >= start && minuteOfDay < end;
}

/**
 * Vuoron minuutit luokkiin.
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

    split.total += 1;

    if (weekday === 6) split.saturday += 1;
    if (weekday === 0) split.sunday += 1;

    /*
     * Yö voittaa illan päällekkäisellä välillä.
     *
     * Kaksi kellonajan lisää samasta minuutista olisi sama tunti
     * kahdesti. Jos välit eivät mene päällekkäin — kuten 18–23 ja
     * 23–06 — tällä ei ole vaikutusta.
     */
    if (
      inWindow(minuteOfDay, settings.nightStartMinute, settings.nightEndMinute)
    ) {
      split.night += 1;
    } else if (
      inWindow(
        minuteOfDay,
        settings.eveningStartMinute,
        settings.eveningEndMinute,
      )
    ) {
      split.evening += 1;
    }
  }

  return split;
}

export function addSplits(a: MinuteSplit, b: MinuteSplit): MinuteSplit {
  return {
    total: a.total + b.total,
    evening: a.evening + b.evening,
    night: a.night + b.night,
    saturday: a.saturday + b.saturday,
    sunday: a.sunday + b.sunday,
  };
}

export interface EmployerCost {
  /** Minuutit yhteensä. */
  minutes: number;
  /** Peruspalkka ilman lisiä. */
  baseCents: number;
  /** Työaikalisät yhteensä. */
  supplementCents: number;
  /** Lomakustannus. */
  holidayCents: number;
  /** Työnantajan sivukulut. */
  sideCostCents: number;
  /** Kaikki yhteensä: tämä on se mitä työ maksaa. */
  totalCents: number;
}

export const EMPTY_COST: EmployerCost = {
  minutes: 0,
  baseCents: 0,
  supplementCents: 0,
  holidayCents: 0,
  sideCostCents: 0,
  totalCents: 0,
};

/** Yhden lisän hinta minuuteille: euroa tunnilta ja prosentti yhteen. */
function supplementCents(
  minutes: number,
  hourlyCents: number,
  supplement: Supplement,
): number {
  const hours = minutes / 60;
  return hours * supplement.cents + hours * hourlyCents * supplement.rate;
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
  if (split.total <= 0) return { ...EMPTY_COST };

  const baseCents = Math.round((split.total / 60) * hourlyCents);

  /*
   * Lisät lasketaan yhteen.
   *
   * Viikonpäivän lisä ja kellonajan lisä ovat eri asetuksia, ja
   * molemmat pätevät tunnille johon ne osuvat. Kate ei tiedä minkä
   * työehtosopimuksen mukaan ne kertyvät — se laskee sen mitä
   * käyttäjä on asettanut.
   */
  const supplements = Math.round(
    supplementCents(split.evening, hourlyCents, settings.evening) +
      supplementCents(split.night, hourlyCents, settings.night) +
      supplementCents(split.saturday, hourlyCents, settings.saturday) +
      supplementCents(split.sunday, hourlyCents, settings.sunday),
  );

  const wage = baseCents + supplements;
  const holidayCents = Math.round(wage * settings.holidayRate);
  const sideCostCents = Math.round(
    (wage + holidayCents) * settings.sideCostRate,
  );

  return {
    minutes: split.total,
    baseCents,
    supplementCents: supplements,
    holidayCents,
    sideCostCents,
    totalCents: wage + holidayCents + sideCostCents,
  };
}

/**
 * Todellinen kustannus tunnilta.
 *
 * Yrittäjälle hyödyllisempi luku kuin tuntipalkka: 15 €/h maksaa
 * lisineen ja sivukuluineen esimerkiksi 20,10 €/h. Null kun tunteja
 * ei ole, koska nollalla ei jaeta.
 */
export function costPerHourCents(cost: EmployerCost): number | null {
  if (cost.minutes <= 0) return null;
  return Math.round(cost.totalCents / (cost.minutes / 60));
}

/**
 * Prosenttiluku tekstistä osuudeksi, tai null.
 *
 * "23" ja "23,5" ovat prosentteja; tallennettu arvo on osuus 0,23.
 * Yläraja on kaksisataa, koska sunnuntaikorotus voi olla sata
 * prosenttia ja sitä suurempi luku on näppäilyvirhe.
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
 * Euromäärä tunnilta sentteinä, tai null.
 *
 * Tyhjä on nolla eikä virhe: yritys jolla ei ole iltalisää ei joudu
 * keksimään sille arvoa.
 */
export function parseEuroPerHour(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (cleaned === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const cents = Math.round(Number(cleaned) * 100);
  if (!Number.isFinite(cents) || cents < 0 || cents > 100000) return null;

  return cents;
}

/** Sentit euroteksiksi kenttään: 140 → "1,40". Nolla jää tyhjäksi. */
export function formatEuroPerHour(cents: number): string {
  if (cents === 0) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
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
    { ...EMPTY_COST },
  );
}

import { dateFormat } from "@/lib/intl-cache";
import { isEveWithSupplement, isSundayOrHoliday } from "./holidays";
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
  /**
   * Viikonpäivät joina lisä maksetaan: 1 = maanantai … 7 = sunnuntai.
   *
   * Tyhjä tai puuttuva tarkoittaa kaikkia päiviä, jolloin käytös on
   * sama kuin ennen tätä kenttää.
   *
   * MIKSI TÄTÄ TARVITAAN.
   *
   * Kaupan alan iltalisää ei makseta arkilauantai-iltana, koska
   * samoista tunneista maksetaan lauantailisä. Ilman päivärajausta
   * Kate maksaisi molemmat, ja lauantai-illan kustannus olisi liian
   * suuri joka kuukausi.
   */
  days?: number[] | null;
  /**
   * Ei makseta sunnuntaina eikä pyhäpäivänä.
   *
   * Kaupan yölisä jätetään maksamatta sunnuntai- ja juhlapäiväyönä,
   * koska niiltä tunneilta maksetaan sunnuntaikorotus. Pelkkä
   * viikonpäivälista ei riitä: juhlapäivä voi olla mikä päivä tahansa.
   */
  notOnHolidays?: boolean;
  /**
   * Korotus lasketaan vain peruspalkasta.
   *
   * Kaupan sopimus sanoo suoraan: "Sunnuntaityökorvausta laskettaessa
   * työaikalisiä ei oteta huomioon peruspalkassa." MaRassa korotus
   * koskee myös ilta- ja yölisää, joten ero on sopimuksen eikä
   * laskennan — ja siksi se on sopimuksen kentässä.
   */
  baseOnly?: boolean;
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
  /** Aattotyön korotus: sopimuksen tuntemat aatot iltapäivästä alkaen. */
  eve: Supplement;
  /** Yö- tai muu lisä omalla kellonaikavälillään. */
  night: Supplement;

  /** Illan rajat paikallista aikaa, minuutteina vuorokauden alusta. */
  eveningStartMinute: number;
  eveningEndMinute: number;
  /** Yön rajat. Sama alku ja loppu = ei yölisää. */
  nightStartMinute: number;
  nightEndMinute: number;

  /*
   * Viikonpäivän lisän rajat.
   *
   * Osa sopimuksista maksaa lauantailisää vasta iltapäivästä alkaen,
   * jolloin aamuvuoron minuutit eivät sitä saa. Koko vuorokausi on
   * 0–1440, ja se on oletus: ilman rajaa lisä koskee koko päivää.
   */
  saturdayStartMinute: number;
  saturdayEndMinute: number;
  sundayStartMinute: number;
  sundayEndMinute: number;
  /** Aattokorotuksen raja, sopimuksessa klo 15. */
  eveStartMinute: number;
  eveEndMinute: number;
}

/** Koko vuorokausi minuutteina: rajaton viikonpäivälisä. */
export const WHOLE_DAY_END = 24 * 60;

export const DEFAULT_PAYROLL: PayrollSettings = {
  sideCostRate: 0,
  holidayRate: 0,
  evening: NO_SUPPLEMENT,
  saturday: NO_SUPPLEMENT,
  sunday: NO_SUPPLEMENT,
  night: NO_SUPPLEMENT,
  eve: NO_SUPPLEMENT,
  /* Kello 18–23 ja 23–06 ovat tavallisia rajoja, mutta ne ovat asetus. */
  eveningStartMinute: 18 * 60,
  eveningEndMinute: 23 * 60,
  nightStartMinute: 23 * 60,
  nightEndMinute: 6 * 60,
  /* Viikonpäivälisä koskee oletuksena koko päivää. */
  saturdayStartMinute: 0,
  saturdayEndMinute: WHOLE_DAY_END,
  sundayStartMinute: 0,
  sundayEndMinute: WHOLE_DAY_END,
  eveStartMinute: 0,
  eveEndMinute: WHOLE_DAY_END,
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
  /** Sunnuntain ja pyhäpäivän minuutit. */
  sunday: number;
  /*
   * Sunnuntaiminuutit joilla myös kellonajan lisä.
   *
   * Sunnuntaikorotus koskee sopimuksen mukaan peruspalkan lisäksi
   * ilta- ja yölisää, joten korotettavat minuutit on tiedettävä
   * erikseen — kuukauden yhteistunneista niitä ei voi päätellä.
   */
  sundayEvening: number;
  sundayNight: number;
  /** Aaton minuutit ja niistä ne joilla myös iltalisä. */
  eve: number;
  eveEvening: number;
}

export const EMPTY_SPLIT: MinuteSplit = {
  total: 0,
  evening: 0,
  night: 0,
  saturday: 0,
  sunday: 0,
  sundayEvening: 0,
  sundayNight: 0,
  eve: 0,
  eveEvening: 0,
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
): { weekday: number; minuteOfDay: number; day: string } {
  const parts = dateFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
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
    /* Pyhäpäivä katsotaan paikallisesta päivästä, ei UTC:n päivästä. */
    day: `${get("year")}-${get("month")}-${get("day")}`,
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
/**
 * Päteekö lisä tähän päivään?
 *
 * Kellonaika ratkaistaan erikseen ikkunalla; tämä vastaa vain
 * kysymykseen kuuluuko päivä lisän piiriin lainkaan. Ilman
 * rajauksia vastaus on kyllä, jolloin käytös on sama kuin ennen
 * näitä kenttiä.
 */
function paivaSallii(
  supplement: Supplement,
  isoWeekday: number,
  holiday: boolean,
): boolean {
  if (supplement.notOnHolidays && holiday) return false;

  const days = supplement.days;
  if (!days || days.length === 0) return true;

  return days.includes(isoWeekday);
}

export function splitMinutes(
  entry: TimeEntry,
  timezone: string,
  settings: PayrollSettings,
): MinuteSplit {
  if (entry.clockOut === null || entry.minutes === null) return EMPTY_SPLIT;

  const start = new Date(entry.clockIn).getTime();
  const split: MinuteSplit = { ...EMPTY_SPLIT };

  for (let i = 0; i < entry.minutes; i += 1) {
    const { weekday, minuteOfDay, day } = localParts(
      new Date(start + i * 60_000),
      timezone,
    );

    split.total += 1;

    /*
     * Viikonpäivälisä vain sille osalle päivää jolle se kuuluu.
     *
     * Jos sopimus maksaa lauantailisää klo 13 alkaen, aamuvuoron
     * minuutit eivät sitä saa. Ilman rajaa väli on koko vuorokausi,
     * jolloin ehto täyttyy aina.
     */
    if (
      weekday === 6 &&
      paivaSallii(settings.saturday, 6, isSundayOrHoliday(day, weekday)) &&
      inWindow(
        minuteOfDay,
        settings.saturdayStartMinute,
        settings.saturdayEndMinute,
      )
    ) {
      split.saturday += 1;
    }

    /*
     * Sunnuntaikorotus koskee myös pyhäpäiviä.
     *
     * Sopimus puhuu sunnuntaista, kirkollisista juhlapäivistä,
     * vapusta ja itsenäisyyspäivästä. Päivälista on omassa
     * tiedostossaan, jotta sitä voi lukea ja testata erikseen.
     */
    /* Pyhäpäivä sellaisenaan: rajauksiin, ei vain sunnuntailisään. */
    const pyhapaiva = isSundayOrHoliday(day, weekday);

    /* Sunnuntai on viikon 7. päivä, ei nollas. */
    const isoWeekday = weekday === 0 ? 7 : weekday;

    const pyha =
      pyhapaiva &&
      inWindow(
        minuteOfDay,
        settings.sundayStartMinute,
        settings.sundayEndMinute,
      );

    if (pyha) split.sunday += 1;

    /*
     * Aattokorotus alkaa kesken päivän.
     *
     * Sopimus maksaa sen vasta klo 15 jälkeen tehdystä työstä, joten
     * aamuvuoro jää ilman. Raja tulee sopimuksesta eikä koodista.
     */
    const aatto =
      isEveWithSupplement(day, weekday) &&
      inWindow(minuteOfDay, settings.eveStartMinute, settings.eveEndMinute);

    if (aatto) split.eve += 1;

    /*
     * Yö voittaa illan päällekkäisellä välillä.
     *
     * Kaksi kellonajan lisää samasta minuutista olisi sama tunti
     * kahdesti. Jos välit eivät mene päällekkäin — kuten 18–23 ja
     * 23–06 — tällä ei ole vaikutusta.
     */
    if (
      paivaSallii(settings.night, isoWeekday, pyhapaiva) &&
      inWindow(minuteOfDay, settings.nightStartMinute, settings.nightEndMinute)
    ) {
      split.night += 1;
      if (pyha) split.sundayNight += 1;
    } else if (
      paivaSallii(settings.evening, isoWeekday, pyhapaiva) &&
      inWindow(
        minuteOfDay,
        settings.eveningStartMinute,
        settings.eveningEndMinute,
      )
    ) {
      split.evening += 1;
      if (pyha) split.sundayEvening += 1;
      if (aatto) split.eveEvening += 1;
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
    sundayEvening: a.sundayEvening + b.sundayEvening,
    sundayNight: a.sundayNight + b.sundayNight,
    eve: a.eve + b.eve,
    eveEvening: a.eveEvening + b.eveEvening,
  };
}

export interface EmployerCost {
  /** Minuutit yhteensä. */
  minutes: number;
  /** Peruspalkka ilman lisiä. */
  baseCents: number;
  /** Työaikalisät yhteensä. */
  supplementCents: number;
  /**
   * Provisio omasta myynnistä.
   *
   * Nolla kaikilla tuntipalkkaisilla. Oma kenttänsä eikä osa
   * peruspalkkaa, koska yrittäjän kysymys on juuri se kumpi osuus
   * palkasta tuli tunneista ja kumpi myynnistä.
   */
  commissionCents: number;
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
  commissionCents: 0,
  holidayCents: 0,
  sideCostCents: 0,
  totalCents: 0,
};

/** Lisän arvo euroa tunnilta: euromäärä ja prosentti yhteen. */
function perHourCents(hourlyCents: number, supplement: Supplement): number {
  return supplement.cents + hourlyCents * supplement.rate;
}

/** Yhden lisän hinta minuuteille: euroa tunnilta ja prosentti yhteen. */
function supplementCents(
  minutes: number,
  hourlyCents: number,
  supplement: Supplement,
): number {
  return (minutes / 60) * perHourCents(hourlyCents, supplement);
}

/**
 * Sunnuntai- ja pyhätyön korotus.
 *
 * KOROTUS KOHDISTUU PALKKAERIIN, EI LOPPUSUMMAAN.
 *
 * Sopimus korottaa peruspalkan sekä ilta- ja yölisän, ei koko
 * työnantajakustannusta: lomakustannus ja sivukulut lasketaan vasta
 * korotetusta palkasta, eikä niitä koroteta uudestaan. Loppusumman
 * kertominen kahdella antaisi eri tuloksen ja väärän erittelyn.
 *
 * Prosenttiosuus lasketaan niistä minuuteista jotka ovat sekä pyhää
 * että lisäaikaa — koko vuoron lisistä laskettuna sunnuntain korotus
 * ulottuisi myös arkiminuuteille.
 */
function sundayCents(
  split: MinuteSplit,
  hourlyCents: number,
  settings: PayrollSettings,
): number {
  const hours = split.sunday / 60;
  if (hours <= 0) return 0;

  /*
   * Mistä korotus lasketaan, on sopimuksen asia.
   *
   * MaRassa sunnuntaikorotus koskee peruspalkkaa ja sen päälle
   * maksettavia ilta- ja yölisiä. Kaupan sopimus sanoo päinvastoin:
   * "Sunnuntaityökorvausta laskettaessa työaikalisiä ei oteta
   * huomioon peruspalkassa." Kumpikaan ei ole laskennan mielipide.
   */
  const korotettava = settings.sunday.baseOnly
    ? hours * hourlyCents
    : hours * hourlyCents +
      (split.sundayEvening / 60) * perHourCents(hourlyCents, settings.evening) +
      (split.sundayNight / 60) * perHourCents(hourlyCents, settings.night);

  return hours * settings.sunday.cents + settings.sunday.rate * korotettava;
}

/**
 * Aattotyön korotus.
 *
 * Sama muoto kuin sunnuntaissa: korotus kohdistuu peruspalkkaan ja
 * iltalisään, ei loppusummaan. Yölisää sopimus ei aatolta korota, eikä
 * sitä tässä koroteta — aatto vaihtuu keskiyöllä joko juhlapäiväksi
 * tai tavalliseksi päiväksi, ja sen minuutit lasketaan silloin sen
 * päivän sääntöjen mukaan.
 */
function eveCents(
  split: MinuteSplit,
  hourlyCents: number,
  settings: PayrollSettings,
): number {
  const hours = split.eve / 60;
  if (hours <= 0) return 0;

  const korotettava = settings.eve.baseOnly
    ? hours * hourlyCents
    : hours * hourlyCents +
      (split.eveEvening / 60) * perHourCents(hourlyCents, settings.evening);

  return hours * settings.eve.cents + settings.eve.rate * korotettava;
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
      sundayCents(split, hourlyCents, settings) +
      eveCents(split, hourlyCents, settings),
  );

  const wage = baseCents + supplements;
  const holidayCents = Math.round(wage * settings.holidayRate);
  const sideCostCents = Math.round(
    (wage + holidayCents) * settings.sideCostRate,
  );

  return {
    minutes: split.total,
    baseCents,
    commissionCents: 0,
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

/** Kustannukset yhteen: yrityksen kuukauden työvoimakulu. */
export function sumCosts(costs: EmployerCost[]): EmployerCost {
  return costs.reduce(
    (sum, cost) => ({
      minutes: sum.minutes + cost.minutes,
      baseCents: sum.baseCents + cost.baseCents,
      supplementCents: sum.supplementCents + cost.supplementCents,
      commissionCents: sum.commissionCents + cost.commissionCents,
      holidayCents: sum.holidayCents + cost.holidayCents,
      sideCostCents: sum.sideCostCents + cost.sideCostCents,
      totalCents: sum.totalCents + cost.totalCents,
    }),
    { ...EMPTY_COST },
  );
}

/**
 * Kustannus kun asetukset vaihtuvat päivän mukaan.
 *
 * Työehtosopimus uusitaan kesken vuotta, ja kuukausi voi ylittää
 * vaihtumisen. Siksi asetukset ratkaistaan vuoro kerrallaan sen
 * päivän mukaan jona vuoro tehtiin — ei kerran kuukaudessa.
 */
export function costForDated(
  entries: TimeEntry[],
  hourlyCents: number,
  timezone: string,
  resolve: (date: string) => PayrollSettings,
): EmployerCost {
  return sumCosts(
    entries.map((entry) => {
      const settings = resolve(entry.date);
      return employerCost(
        splitMinutes(entry, timezone, settings),
        hourlyCents,
        settings,
      );
    }),
  );
}

// ---------------------------------------------------------------------------
// Provisio
// ---------------------------------------------------------------------------

/**
 * Palkkamalli.
 *
 * KOLME MALLIA, KOSKA ALALLA ON KOLME TAPAA.
 *
 * Ravintolassa palkka on tunneista. Hiusalalla se on usein omasta
 * myynnistä: tuntipalkan päälle, tuntipalkka takuuna, tai kokonaan
 * ilman tuntipalkkaa. Malli on työntekijäkohtainen, koska samassa
 * liikkeessä voi olla useampi näistä.
 *
 * PELKKÄ PROVISIO EI KATSO TUNTEJA LAINKAAN.
 *
 * Työaika kirjataan silti — se on työaikakirjanpitoa eikä palkan
 * peruste — mutta peruspalkkaa ja työaikalisiä ei kerry, koska niillä
 * ei ole tuntipalkkaa josta laskea.
 */
export type PayModel =
  | "hourly"
  | "hourly_commission"
  | "commission_guaranteed"
  | "commission_only";

export function isPayModel(value: unknown): value is PayModel {
  return (
    value === "hourly" ||
    value === "hourly_commission" ||
    value === "commission_guaranteed" ||
    value === "commission_only"
  );
}

/** Onko palkka kokonaan tai osittain myynnistä? */
export function isCommissionModel(model: PayModel): boolean {
  return model !== "hourly";
}

/**
 * Paljonko provisiota maksetaan tuntipalkan lisäksi.
 *
 * TAKUU VERTAA PERUSPALKKAAN, EI LOPPUSUMMAAN.
 *
 * Takuupalkkamallissa verrataan tehtyjä tunteja provisioon:
 * kumpi on suurempi, se maksetaan. Työaikalisät tulevat molempien
 * päälle, koska ilta- ja lauantailisä maksetaan tehdystä työajasta
 * eikä siitä kumpi palkkatapa voitti. Sivukulut ja lomakustannus
 * lasketaan lopuksi koko palkasta samalla tavalla kuin tunneille.
 *
 * Pyöristys kerran, lopussa: sentin pyöristys jokaisessa välivaiheessa
 * kertyisi kuukauden aikana euroiksi.
 */
export function commissionExtraCents(
  model: PayModel,
  rate: number,
  netSalesCents: number,
  baseCents: number,
): number {
  if (model === "hourly") return 0;
  if (rate <= 0 || netSalesCents <= 0) return 0;

  const provisio = Math.round(netSalesCents * rate);

  /*
   * Takuumalli on ainoa joka vähentää peruspalkan.
   *
   * Tuntipalkan päälle maksettava provisio ja pelkkä provisio ovat
   * molemmat koko summa: edellisessä tunnit maksetaan erikseen,
   * jälkimmäisessä tunneista ei makseta mitään.
   */
  return model === "commission_guaranteed"
    ? Math.max(0, provisio - baseCents)
    : provisio;
}

/**
 * Provisio kustannukseen.
 *
 * Provisio on palkkaa, joten siitä kertyy lomakustannus ja sivukulut
 * samalla prosentilla kuin tunneista. Ilman tätä provisio näyttäisi
 * halvemmalta kuin tuntipalkka, ja juuri sitä vertailua yrittäjä
 * tällä sivulla tekee.
 *
 * Lomakustannuksen ja sivukulun prosentit ovat yrityksen omat eivätkä
 * sopimuksen, joten tässä käytetään yrityksen asetuksia — ei sen
 * päivän sopimusversiota, jota kuukausitason luvulla ei ole.
 */
export function withCommission(
  cost: EmployerCost,
  extraCents: number,
  settings: PayrollSettings,
): EmployerCost {
  if (extraCents <= 0) return cost;

  const holiday = Math.round(extraCents * settings.holidayRate);
  const sideCost = Math.round((extraCents + holiday) * settings.sideCostRate);

  return {
    minutes: cost.minutes,
    baseCents: cost.baseCents,
    supplementCents: cost.supplementCents,
    commissionCents: cost.commissionCents + extraCents,
    holidayCents: cost.holidayCents + holiday,
    sideCostCents: cost.sideCostCents + sideCost,
    totalCents: cost.totalCents + extraCents + holiday + sideCost,
  };
}

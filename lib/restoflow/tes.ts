import { formatDayIn } from "@/lib/i18n/labels";
import type { AppLocale } from "@/lib/i18n/app-locales";
import type { BusinessType } from "./business";
import {
  DEFAULT_PAYROLL,
  NO_SUPPLEMENT,
  WHOLE_DAY_END,
  type PayrollSettings,
  type Supplement,
} from "./payroll";

/**
 * Työehtosopimus ja sen versiot.
 *
 * TES-arvot tulevat kannasta eivätkä koodista. Kovakoodattu iltalisä
 * olisi oikein yhden sopimuskauden ja väärin kaikki muut, eikä kukaan
 * huomaisi milloin se vaihtui.
 *
 * VERSIO VALITAAN VUORON PÄIVÄLLÄ.
 *
 * Sopimus uusitaan muutaman vuoden välein. Viime vuoden vuorot on
 * laskettu silloin voimassa olleilla lisillä, joten uusi versio ei saa
 * muuttaa niitä jälkikäteen. Versiot kuuluvat samaan perheeseen
 * slugin kautta, ja laskenta etsii sen joka oli voimassa.
 *
 * TÄMÄ EI OLE TES-MOOTTORI.
 *
 * Ylityö, työaikalain tulkinta, palkkaryhmät ja sairausajan palkka
 * eivät ole täällä eikä niitä teeskennellä osattavan.
 */

export type TesRuleType =
  | "evening"
  | "night"
  | "saturday"
  | "sunday"
  /** Aattotyo: sopimuksen tuntemat aatot kellonajasta alkaen. */
  | "eve";
export type TesUnit = "eur_per_hour" | "percent";

export interface TesRule {
  id: string;
  ruleType: TesRuleType;
  name: string;
  unit: TesUnit;
  /** Euroa tunnilta tai prosenttilukuna, sen mukaan mikä unit on. */
  value: number;
  /** "18:00" tai null. */
  startTime: string | null;
  endTime: string | null;
}

export interface TesAgreement {
  id: string;
  slug: string;
  name: string;
  industry: BusinessType;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  rules: TesRule[];
}

/**
 * Voimassa ollut versio päivänä, tai null.
 *
 * Päällekkäiset versiot ovat syöttövirhe, mutta jos niitä on, voittaa
 * myöhemmin alkanut: se on todennäköisemmin se uusi joka korvasi
 * vanhan.
 */
export function versionFor(
  versions: TesAgreement[],
  date: string,
): TesAgreement | null {
  const osuvat = versions
    .filter((v) => v.isActive)
    .filter((v) => v.validFrom <= date)
    .filter((v) => v.validUntil === null || v.validUntil >= date)
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom));

  return osuvat[0] ?? null;
}

/**
 * "18:00" → 1080. Kelvoton tai puuttuva → null.
 *
 * VUOROKAUDEN LOPPU ON 24:00.
 *
 * Työehtosopimus kirjoittaa iltalisän välin muodossa "klo 18–24", ja
 * juuri niin se myös syötetään. Aiemmin 24:00 hylättiin kelvottomana,
 * jolloin väli putosi hiljaa oletusarvoon ja tunti 23–24 jäi ilman
 * lisää. Hiljainen oletus on pahempi kuin virheilmoitus.
 */
export function minuteOfDay(time: string | null): number | null {
  if (!time) return null;
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59) return null;
  if (hours > 24 || (hours === 24 && minutes > 0)) return null;

  return hours * 60 + minutes;
}

function supplementOf(rule: TesRule | undefined): Supplement {
  if (!rule) return NO_SUPPLEMENT;

  return rule.unit === "eur_per_hour"
    ? { cents: Math.round(rule.value * 100), rate: 0 }
    : { cents: 0, rate: rule.value / 100 };
}

/**
 * TES-versio laskenta-asetuksiksi.
 *
 * Sivukulut ja lomakustannus eivät tule sopimuksesta vaan yritykseltä:
 * työeläke- ja vakuutusmaksut riippuvat yrityksestä, eivät alasta.
 * Ne annetaan tässä erikseen ja säilyvät ennallaan.
 *
 * Ilman sopimusta palautetaan yrityksen omat asetukset sellaisenaan.
 * Näin ennen TES-hallintaa perustetut yritykset jatkavat toimintaansa
 * eikä kenenkään arvio muutu tämän muutoksen takia.
 */
export function settingsFromTes(
  tes: TesAgreement | null,
  company: PayrollSettings,
): PayrollSettings {
  if (!tes) return company;

  const rule = (type: TesRuleType) => tes.rules.find((r) => r.ruleType === type);

  const evening = rule("evening");
  const night = rule("night");
  const saturday = rule("saturday");
  const sunday = rule("sunday");
  const eve = rule("eve");

  /* Ilman kellonaikaa lisä koskee koko päivää. */
  const alku = (r: TesRule | undefined, oletus: number) =>
    minuteOfDay(r?.startTime ?? null) ?? oletus;
  const loppu = (r: TesRule | undefined, oletus: number) =>
    minuteOfDay(r?.endTime ?? null) ?? oletus;

  return {
    /* Yrityksen omat: nämä eivät ole sopimuksen asia. */
    sideCostRate: company.sideCostRate,
    holidayRate: company.holidayRate,

    evening: supplementOf(evening),
    night: supplementOf(night),
    saturday: supplementOf(saturday),
    sunday: supplementOf(sunday),
    eve: supplementOf(eve),

    eveningStartMinute: alku(evening, DEFAULT_PAYROLL.eveningStartMinute),
    eveningEndMinute: loppu(evening, DEFAULT_PAYROLL.eveningEndMinute),
    nightStartMinute: alku(night, DEFAULT_PAYROLL.nightStartMinute),
    nightEndMinute: loppu(night, DEFAULT_PAYROLL.nightEndMinute),

    /* Viikonpäivälisän väli sopimuksesta, muuten koko päivä. */
    saturdayStartMinute: alku(saturday, 0),
    saturdayEndMinute: loppu(saturday, WHOLE_DAY_END),
    sundayStartMinute: alku(sunday, 0),
    sundayEndMinute: loppu(sunday, WHOLE_DAY_END),
    eveStartMinute: alku(eve, 0),
    eveEndMinute: loppu(eve, WHOLE_DAY_END),
  };
}

/**
 * Asetukset vuoron päivän mukaan.
 *
 * Kuukausi voi ylittää sopimuskauden vaihtumisen, joten versio
 * ratkaistaan päivä kerrallaan eikä kerran kuukaudessa.
 */
export function settingsResolver(
  versions: TesAgreement[],
  company: PayrollSettings,
): (date: string) => PayrollSettings {
  const muisti = new Map<string, PayrollSettings>();

  return (date: string) => {
    const valmis = muisti.get(date);
    if (valmis) return valmis;

    const settings = settingsFromTes(versionFor(versions, date), company);
    muisti.set(date, settings);
    return settings;
  };
}

/**
 * Päivät joille sopimuksesta ei löydy versiota.
 *
 * HILJAINEN OLETUS ON PAHIN VAIHTOEHTO.
 *
 * Jos yritykselle on määritetty sopimus mutta vuoron päivälle ei ole
 * versiota, laskenta putoaa yrityksen omiin asetuksiin. Se on
 * kelvollinen arvio muttei sopimuksen mukainen luku, eikä käyttäjä
 * saa luulla sitä sellaiseksi. Nämä päivät palautetaan, jotta
 * käyttöliittymä voi sanoa sen ääneen.
 *
 * Ilman sopimusta lista on tyhjä: silloin mitään ei ole luvattu.
 */
export function datesWithoutTes(
  versions: TesAgreement[],
  dates: string[],
): string[] {
  if (versions.length === 0) return [];

  const puuttuvat = new Set(
    dates.filter((date) => versionFor(versions, date) === null),
  );

  return [...puuttuvat].sort();
}

/**
 * "1.4.2025 – 31.3.2028" kayttajan kielella.
 *
 * ISO-paiva on oikea muoto kannassa mutta vaara muoto ihmiselle:
 * sopimuksen voimassaolo luetaan silmailemalla, ei vertailemalla.
 */
export function formatTesValidity(
  tes: { validFrom: string; validUntil: string | null },
  locale: AppLocale,
  untilFurther: string,
): string {
  const alku = formatDayIn(tes.validFrom, locale);
  const loppu = tes.validUntil
    ? formatDayIn(tes.validUntil, locale)
    : untilFurther;

  return `${alku} – ${loppu}`;
}

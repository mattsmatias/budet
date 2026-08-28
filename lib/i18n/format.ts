import { LOCALE_INFO, type AppLocale } from "./app-locales";

/**
 * Päivämäärät, kellonajat ja luvut kielen mukaan.
 *
 * INTL TEKEE TÄMÄN, EI ME.
 *
 * Sovelluksessa on omia muotoilijoita jotka kirjoittavat "28.08.2026"
 * ja "2 845,50 €" käsin. Ne ovat oikein suomeksi ja väärin
 * kahdellakymmenelläyhdeksällä muulla kielellä: englanniksi
 * desimaalierotin on piste, saksaksi euro tulee luvun perään mutta
 * kiinaksi eteen, ja arabiaksi numerot voivat olla eri merkkejä.
 *
 * Intl tietää kaiken tämän. Käsin kirjoitettu muotoilu tietää yhden
 * kielen.
 *
 * FORMATOIJAT OVAT KALLIITA, JOTEN NE MUISTETAAN.
 *
 * Intl.NumberFormatin luonti on raskaampi kuin sen käyttö. Taulukossa
 * jossa on kolmesataa lukua se tehtäisiin kolmesataa kertaa. Välimuisti
 * on prosessikohtainen ja pieni: kolmekymmentä kieltä kertaa kourallinen
 * muotoja.
 */

const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function numberFormat(
  locale: AppLocale,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `n:${locale}:${JSON.stringify(options)}`;
  let f = cache.get(key) as Intl.NumberFormat | undefined;
  if (!f) {
    f = new Intl.NumberFormat(LOCALE_INFO[locale].tag, options);
    cache.set(key, f);
  }
  return f;
}

function dateFormat(
  locale: AppLocale,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `d:${locale}:${JSON.stringify(options)}`;
  let f = cache.get(key) as Intl.DateTimeFormat | undefined;
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE_INFO[locale].tag, options);
    cache.set(key, f);
  }
  return f;
}

/**
 * Raha sentteinä.
 *
 * Sovellus tallentaa rahan kokonaisina sentteinä, joten jako sadalla
 * tehdään vasta tässä. Valuutta on parametri eikä vakio: ravintolalla
 * on oma valuuttansa, ja se voi olla muu kuin euro.
 */
export function money(
  cents: number,
  locale: AppLocale,
  currency = "EUR",
): string {
  return numberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Kokonaisluku tuhaterottimineen. */
export function integer(value: number, locale: AppLocale): string {
  return numberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

/** Desimaaliluku, oletuksena yksi desimaali (tunnit). */
export function decimal(
  value: number,
  locale: AppLocale,
  digits = 1,
): string {
  return numberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/**
 * Prosentti.
 *
 * Osuutena eikä valmiiksi kerrottuna lukuna: 0,255 eikä 25,5. Intl
 * kertoo sadalla itse, ja kaksi eri tapaa antaa prosentti johtaisi
 * ennen pitkää sataakertaiseen virheeseen.
 */
export function percent(
  ratio: number,
  locale: AppLocale,
  digits = 1,
): string {
  return numberFormat(locale, {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(ratio);
}

// ---------------------------------------------------------------------------

/**
 * ISO-päivä ilman aikavyöhykemuunnosta.
 *
 * "2026-08-28" on päivä eikä hetki. new Date("2026-08-28") olisi
 * keskiyö UTC:ssä, ja se on edellinen päivä länteen päin. Osat
 * puretaan siksi käsin ja annetaan Intlille UTC-keskipäivänä.
 */
function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** "28.8.2026" · "Aug 28, 2026" · "2026年8月28日" */
export function date(iso: string, locale: AppLocale): string {
  return dateFormat(locale, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  }).format(fromIsoDate(iso));
}

/** Pitkä muoto: "28. elokuuta 2026" · "28 August 2026" */
export function dateLong(iso: string, locale: AppLocale): string {
  return dateFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(fromIsoDate(iso));
}

/** Viikonpäivä ja päivä: "ma 28.8." · "Mon 28 Aug" */
export function dateShortWeekday(iso: string, locale: AppLocale): string {
  return dateFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(fromIsoDate(iso));
}

/**
 * Kellonaika ravintolan aikavyöhykkeellä.
 *
 * Aikavyöhyke on parametri eikä palvelimen oletus: ravintola on
 * Helsingissä vaikka palvelin olisi missä tahansa, ja leimausaika
 * tarkoittaa ravintolan kelloa.
 */
export function time(
  isoTimestamp: string,
  locale: AppLocale,
  timeZone: string,
): string {
  return dateFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(isoTimestamp));
}

/** Päivä ja kello samassa. */
export function dateTime(
  isoTimestamp: string,
  locale: AppLocale,
  timeZone: string,
): string {
  return dateFormat(locale, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(isoTimestamp));
}

/** Kuukausi otsikkona: "elokuu 2026" · "August 2026" */
export function monthName(month: string, locale: AppLocale): string {
  return dateFormat(locale, {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(fromIsoDate(`${month}-01`));
}

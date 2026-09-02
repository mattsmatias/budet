/**
 * Päivämäärämuotojen tarkistus.
 *
 * Sama säännöllinen lauseke oli kirjoitettu käsin kahteenkymmeneen
 * paikkaan. Kaksi niistä oli vioittunut niin että kenoviivat olivat
 * kadonneet — /^d{4}-d{2}-d{2}$/ hyväksyy vain merkkijonon "dddd-dd-dd"
 * eikä yhtäkään oikeaa päivämäärää.
 *
 * Kumpikaan vika ei näkynyt käännöksessä eikä linttauksessa. Rikkinäinen
 * kopio näyttää ehjältä, koska vertailukohtaa ei ole. Toinen niistä
 * hiljensi kokonaisen ominaisuuden: raporttisivun kuukausivalinta ei
 * koskaan hyväksynyt parametria, joten se näytti aina kuluvaa kuukautta.
 *
 * Nyt kuvio on yhdessä paikassa ja testattu. Kahtakymmentä kopiota ei
 * voi tarkistaa silmällä; yhden voi.
 */

/** "2026-08-24" */
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-08" */
export const ISO_MONTH = /^\d{4}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE.test(value);
}

export function isIsoMonth(value: unknown): value is string {
  return typeof value === "string" && ISO_MONTH.test(value);
}

/**
 * Kyselyparametri päivämääränä, tai varasija.
 *
 * Sivut lukevat päivän osoitteesta, ja osoitteessa voi lukea mitä
 * tahansa. Tämä on se sama kolmen rivin kuvio joka oli toistettu
 * jokaisella sivulla erikseen.
 */
export function isoDateOr(value: unknown, fallback: string): string {
  return isIsoDate(value) ? value : fallback;
}

export function isoMonthOr(value: unknown, fallback: string): string {
  return isIsoMonth(value) ? value : fallback;
}

/**
 * Yläpalkin valitsimen näyttämä kuukausi.
 *
 * VALITSIN EI TIEDÄ VALINTAA PROPSISTAAN.
 *
 * Kuori antaa sille kuluvan kuukauden, koska Next-kuori ei saa
 * osoitteen hakuparametreja lainkaan — se ei renderöidy uudestaan kun
 * ne muuttuvat. Sivu sen sijaan lukee ?kuukausi-parametrin. Niinpä
 * heinäkuun valitseminen vaihtoi sivun luvut mutta jätti painikkeeseen
 * lukemaan "Elokuu 2026".
 *
 * Valinta luetaan siis osoitteesta ja kuluva kuukausi on vain vara.
 * Tuntematon arvo putoaa varaan: osoiterivin voi kirjoittaa itse, eikä
 * "2026-99" saa jäädä painikkeeseen näkyviin.
 */
export function pickedMonth(
  param: string | null,
  fallback: string,
  months: string[],
): string {
  return param !== null && isIsoMonth(param) && months.includes(param)
    ? param
    : fallback;
}

/**
 * Päivien laskenta ISO-päivämäärillä.
 *
 * UTC-keskipäivä välivaiheena: keskiyöstä laskettuna kesäajan vaihdos
 * siirtäisi tuloksen päivän verran niinä kahtena yönä vuodessa joina
 * kello siirtyy. Keskipäivällä siirtymä on aina saman päivän sisällä.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

function noon(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00Z`);
}

export function addDays(isoDate: string, days: number): string {
  return new Date(noon(isoDate).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Kokonaisia päiviä ensimmäisestä toiseen. Negatiivinen jos toinen on aiemmin. */
export function daysBetween(from: string, to: string): number {
  return Math.round((noon(to).getTime() - noon(from).getTime()) / DAY_MS);
}

/**
 * Paikallisen päivän alku UTC-hetkenä.
 *
 * Loki tallentaa aikaleimat UTC:nä mutta "tänään" on ravintolan päivä.
 * Suodatus pelkällä päivämäärällä leikkaisi Suomessa kesäaikaan kolme
 * ensimmäistä tuntia pois: paikallinen keskiyö on UTC:ssä edellisen
 * päivän puolella.
 *
 * Siirtymä luetaan Intl:ltä eikä lasketa käsin, jolloin kesä- ja
 * talviaika hoituvat samalla säännöllä.
 */
export function startOfDayIso(isoDate: string, timezone: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);

  // Arvaus: paikallinen keskiyö olisi sama hetki UTC:ssä.
  const guess = Date.UTC(year, month - 1, day);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(guess));

  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  /*
   * Ero arvauksen ja sen paikallisen esityksen välillä on vyöhykkeen
   * siirtymä. Vähentämällä se arvauksesta saadaan hetki jonka
   * paikallinen esitys on tasan keskiyö.
   */
  const asLocal = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    // Intl esittää keskiyön muodossa 24 osassa vyöhykkeitä.
    value("hour") % 24,
    value("minute"),
    value("second"),
  );

  return new Date(guess - (asLocal - guess)).toISOString();
}

/**
 * Katseltava kuukausi sivun hakuparametreista.
 *
 * Tuntematon tai virheellinen arvo putoaa kuluvaan kuukauteen. Sivu ei
 * siis voi kaatua osoitteeseen jonka joku kirjoitti käsin.
 *
 * EI KORVAA VANHOJA KOPIOITA.
 *
 * Sama kuvio on kirjoitettu erikseen Kuluilla, Palkoilla,
 * Raportoinnissa ja neljällä muulla sivulla. Niitä ei ole yhdistetty
 * tähän kahdesta syystä: osa rajaa tulevaisuuden pois ja osa ei —
 * työvuorokalenteri katsoo tarkoituksella eteenpäin — ja kaikissa
 * seitsemässä paikallinen muuttuja on jo nimeltään viewMonth, joten
 * tuonti varjostaisi sen.
 *
 * Uudet sivut käyttävät tätä. Vanhat kannattaa siirtää tähän vasta jos
 * rajaussääntö joskus yhtenäistyy.
 */
export function monthFromParams(
  params: { kuukausi?: string | string[] },
  fallback: string,
): string {
  const raw = params.kuukausi;
  const value = typeof raw === "string" ? raw : fallback;
  return isIsoMonth(value) ? value : fallback;
}

/**
 * Kuukauden ensimmäinen ja viimeinen päivä.
 *
 * Viimeinen lasketaan seuraavan kuun nollannesta päivästä: helmikuun
 * pituutta ei tarvitse tietää eikä karkausvuotta muistaa.
 */
export function monthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, m, 0));
  return {
    from: `${month}-01`,
    to: `${month}-${String(last.getUTCDate()).padStart(2, "0")}`,
  };
}

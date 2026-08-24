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

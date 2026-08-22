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

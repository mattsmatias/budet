/**
 * Yritykset jotka käyttävät Katea.
 *
 * TYHJÄ LISTA PIILOTTAA KOKO OSION.
 *
 * Etusivun logorivi vastaa kysymykseen "kuka muu luottaa tähän".
 * Juuri siksi siihen ei saa laittaa ketään joka ei oikeasti käytä
 * Katea: keksitty logo on valhe siinä kohdassa jossa ostopäätös
 * tehdään, ja ensimmäinen oikea asiakas kysyy ensimmäisenä keitä nuo
 * muut ovat.
 *
 * Kun lista on tyhjä, osiota ei renderöidä lainkaan. Se on parempi
 * kuin tyhjä laatikko tai paikanpitäjälogot.
 *
 * KOLME EHTOA ENNEN KUIN RIVI LISÄTÄÄN.
 *
 * 1. Yritys on oikeasti Katen asiakas — ei kokeilu jota ei jatkettu
 *    eikä tuttu joka lupasi katsoa.
 * 2. Yritykseltä on kirjallinen lupa käyttää nimeä ja logoa. Logo on
 *    tavaramerkki, eikä lupaa oleteta. Kysy se käyttöönotossa.
 * 3. Logotiedosto on public/asiakkaat-kansiossa: SVG jos saatavilla,
 *    muuten läpinäkyvä PNG vähintään 240 pikseliä leveänä.
 *
 * Jos lupa perutaan, rivi poistetaan tästä samana päivänä.
 */

export interface Customer {
  /** Yrityksen nimi sellaisena kuin se itse kirjoittaa sen. */
  name: string;
  /** Polku public-kansiosta, esimerkiksi "/asiakkaat/nimi.svg". */
  logo: string;
  /** Milloin lupa nimen ja logon käyttöön saatiin. Vain meille. */
  permissionOn: string;
}

export const CUSTOMERS: Customer[] = [];

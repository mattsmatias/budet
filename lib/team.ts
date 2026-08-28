/**
 * Budetin tiimi.
 *
 * TYHJÄ, KOSKA EN TIEDÄ KEITÄ TE OLETTE.
 *
 * Tähän ei ole keksitty nimiä, rooleja, esittelyjä eikä kuvia.
 * Keksitty perustaja on pahempi kuin puuttuva: sivun tarkoitus on
 * rakentaa luottamusta, ja väärä nimi tuhoaa sen kertaheitolla siinä
 * vaiheessa kun joku kysyy.
 *
 * Sivu osaa olla tyhjä. Se kertoo että esittelyt julkaistaan kun kuvat
 * ovat valmiina, ja näyttää paikat jo nyt — asettelu ei siis muutu kun
 * tiedot lisätään.
 *
 * LISÄÄMINEN
 *
 * 1. Kopioi kuvat kansioon /public/team/ nimillä joita käytät alla.
 * 2. Lisää rivit tähän taulukkoon.
 *
 * Kuvien pitää olla samassa kuvasuhteessa (4:5, esimerkiksi
 * 800 × 1000) jotta rivi pysyy suorana. Sivu rajaa ne joka tapauksessa
 * object-fitillä, mutta samasta suhteesta lähtevä rajaus näyttää
 * siltä kuin sama kuvaaja olisi ottanut kaikki.
 */

export interface TeamMember {
  /** Nimi sellaisena kuin se halutaan näkyvän. */
  name: string;
  /** Rooli. Lyhyt: "Founder & Product", ei kolmea riviä. */
  role: string;
  /** Yksi tai kaksi lausetta. */
  bio: string;
  /** Polku /public-kansiosta, esim. "/team/founder.jpg". */
  image: string;
}

export const TEAM: TeamMember[] = [
  // {
  //   name: "Nimi Tähän",
  //   role: "Founder & Product",
  //   bio: "Lyhyt esittely yhdellä tai kahdella lauseella.",
  //   image: "/team/founder.jpg",
  // },
];

/**
 * Yhteiskuva.
 *
 * null kunnes kuva on olemassa. Sivu piirtää silloin saman muotoisen
 * paikan, joten hero ja kuvateksti ovat oikeilla korkeuksillaan jo
 * ennen kuvaa.
 */
export const TEAM_PHOTO: string | null = null;

/**
 * Montako paikkaa näytetään kun tiimiä ei ole vielä lisätty.
 *
 * Kolme, koska työpöydän ruudukko on kolme saraketta: tyhjä rivi
 * näyttää siltä miltä täysikin.
 */
export const TEAM_PLACEHOLDERS = 3;

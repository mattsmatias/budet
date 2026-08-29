/**
 * Katen tunnus.
 *
 * YKSI TIEDOSTO, EI KOLMEA KOPIOTA.
 *
 * Vanha B-tunnus oli kirjoitettu kolmeen paikkaan: kirjautumisen
 * kuoreen, työntekijänäkymän kiskoon ja etusivun navigaatioon. Ne
 * olivat jo ehtineet erota toisistaan — työntekijänäkymässä tunnus oli
 * pelkkä kirjain merkkivärisessä laatikossa, kahdessa muussa piirretty
 * merkki. Nimenvaihdon yhteydessä ne yhdistettiin, jotta seuraavaa
 * vaihtoa ei tarvitse tehdä kolmeen kertaan.
 *
 * K on piirretty eikä kirjoitettu kirjasimella: kirjasin vaihtuu
 * järjestelmän mukana, tunnus ei saa vaihtua.
 *
 *
 * GEOMETRIA
 *
 * Tunnus ei ole vapaalla kädellä piirretty vaan rakentuu kolmesta
 * mitasta. Ensimmäinen versio arvattiin silmämääräisesti ja se näytti
 * suunnilleen oikealta, mikä on tunnuksessa eri asia kuin oikea.
 *
 *   varsi   pyöristetty suorakaide, korkeus 15, leveys 4,84
 *   haarat  neljännesrenkaita, keskipisteenä varren kulma
 *   säteet  sisä 3,95 ja ulko 8,59
 *
 * Ylähaaran keskipiste on varren oikeassa YLÄkulmassa ja alahaaran
 * oikeassa ALAkulmassa. Kumpikin kaartuu vaakasuorasta pystysuoraan,
 * eli neljänneskierroksen.
 *
 * Tästä seuraa kaksi asiaa itsestään, ilman että niitä piirretään
 * erikseen:
 *
 * 1. Haarojen yläreuna on vaakasuora ja alkaa sisäsäteen päästä —
 *    varren ja haaran väliin jää kiila, joka kapenee alaspäin ja
 *    sulkeutuu.
 * 2. Renkaat menevät keskellä päällekkäin: ylähaara ulottuu
 *    y-arvoon 15,09 ja alahaara arvoon 12,91. Juuri siksi
 *    tunnuksessa on lovi — se erottaa kaksi päällekkäistä muotoa,
 *    eikä ole koriste.
 *
 * Mittasuhteet on luettu alkuperäisestä kuvasta: varsi 120/372 osaa
 * korkeudesta, sisäsäde 98/372, ulkosäde 213/372.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
    >
      <rect width="28" height="28" rx="7.5" fill="#0f1729" />

      {/* Varsi. */}
      <rect x="7.3" y="6.5" width="4.84" height="15" rx="0.6" fill="#fff" />

      {/*
        Ylähaara: neljännesrengas keskipisteenä (12,14 · 6,5).
        Ulkokaari vaakasuorasta alas, sisäkaari takaisin.
      */}
      <path
        d="M16.09 6.5h4.64a8.59 8.59 0 0 1-8.59 8.59v-4.64a3.95 3.95 0 0 0 3.95-3.95Z"
        fill="#fff"
      />

      {/* Alahaara: sama peilattuna, keskipisteenä (12,14 · 21,5). */}
      <path
        d="M16.09 21.5h4.64a8.59 8.59 0 0 0-8.59-8.59v4.64a3.95 3.95 0 0 1 3.95 3.95Z"
        fill="#fff"
      />

      {/*
        Lovi.

        Piirretään laatikon värillä päällekkäisten kaarien yli. Alkaa
        varren sisältä ja päättyy siihen mihin muoto ulottuu tällä
        korkeudella (x = 16,33), jottei pyöreä pää jää roikkumaan
        tyhjän päälle.
      */}
      <path
        d="M10.65 14h5.6"
        stroke="#0f1729"
        strokeWidth="0.45"
        strokeLinecap="round"
      />
    </svg>
  );
}

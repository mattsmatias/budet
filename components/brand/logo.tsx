/**
 * Katen tunnus.
 *
 * YKSI TIEDOSTO, EI KOLMEA KOPIOTA.
 *
 * Vanha B-tunnus oli kirjoitettu kolmeen paikkaan: kirjautumisen
 * kuoreen, työntekijänäkymän kiskoon ja etusivun navigaatioon. Ne
 * olivat jo ehtineet erota toisistaan — työntekijänäkymässä tunnus oli
 * pelkkä kirjain merkkivärisessä laatikossa, kahdessa muussa piirretty
 * merkki. Nimenvaihdon yhteydessä ne yhdistetään, jotta seuraavaa
 * vaihtoa ei tarvitse tehdä kolmeen kertaan.
 *
 * K on piirretty eikä kirjoitettu kirjasimella: kirjasin vaihtuu
 * järjestelmän mukana, tunnus ei saa vaihtua.
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

      {/* Pystyvarsi. Pyöristetyt päät, koska laatikkokin on pyöristetty. */}
      <rect x="7.4" y="6.5" width="4.7" height="15" rx="1.2" fill="#fff" />

      {/*
        Kaartuvat haarat.

        Suora vinoviiva olisi ollut helpompi piirtää, mutta tunnuksen
        koko luonne on siinä että haarat kaartuvat: ylähaara lähtee
        varresta, nousee ja kääntyy oikeaan yläkulmaan, alahaara peilaa
        sen.

        Kaari on loiva ja haara yltää tunnuksen oikeaan reunaan asti.
        Ensimmäinen versio kaartui liian tiukasti ja jäi lyhyeksi,
        jolloin K näytti enemmän R:ltä kuin K:lta.

        Ulkoreuna on yksi kuutiokäyrä varresta reunaan; sisäreuna
        palaa loivempana takaisin. Kahden eri jyrkkyyden ero on se
        mikä antaa haaralle paksuuden.
      */}
      <path
        d="M16.6 6.5h4.9c0 4.1-4.2 7.2-9.4 7.2v-3.4c2.5 0 4.5-1.7 4.5-3.8Z"
        fill="#fff"
      />
      <path
        d="M16.6 21.5h4.9c0-4.1-4.2-7.2-9.4-7.2v3.4c2.5 0 4.5 1.7 4.5 3.8Z"
        fill="#fff"
      />

      {/*
        Haarojen välinen lovi.

        Haarojen väliin jää jo rako, mutta sen päät jäisivät tylpiksi
        siihen mihin haarat kapenevat. Laatikon värinen pyöreäpäinen
        viiva sen päällä tekee lovesta tasapaksun ja siistin, ja
        jatkaa sen varren reunaan asti kuten tunnuksessa.
      */}
      <path
        d="M11.9 14h6.6"
        stroke="#0f1729"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

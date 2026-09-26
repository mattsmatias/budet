import type { Metadata } from "next";
import { Legal, type LegalSection } from "@/components/landing/legal";
import "../landing.css";

export const metadata: Metadata = {
  title: { absolute: "Tietosuojaseloste – Kate" },
  description:
    "Mitä tietoja Kate käsittelee, missä niitä säilytetään ja mitkä oikeudet sinulla on.",
};

/**
 * Tietosuojaseloste.
 *
 * JOKAINEN LAUSE KUVAA SITÄ MITÄ JÄRJESTELMÄ OIKEASTI TEKEE.
 *
 * Teksti on kirjoitettu koodin ja tietokannan perusteella: käsitellyt
 * tiedot ovat ne jotka tauluissa oikeasti ovat, alikäsittelijät ne
 * joille pyyntö oikeasti menee, ja sijainti se jossa kanta oikeasti
 * on (Supabase, eu-west-1, Irlanti). Seloste joka lupaa enemmän kuin
 * järjestelmä tekee on pahempi kuin puuttuva seloste, koska sen
 * varaan rakennetaan sopimuksia.
 *
 * Säilytysaikoja ja poistokäytäntöä ei ole keksitty: ne kuvataan
 * sellaisina kuin ne tänään ovat — tiedot säilyvät asiakkuuden ajan
 * ja poistetaan pyynnöstä.
 */

const OSAT: LegalSection[] = [
  {
    otsikko: "Rekisterinpitäjä ja yhteydenotot",
    kappaleet: [
      "Kate on palvelu, jolla yritys hoitaa oman taloutensa: myynnin, kuitit, kulut, kirjanpidon ja työajan. Yritys, joka käyttää Katea, on omien tietojensa rekisterinpitäjä. Kate toimii näiden tietojen käsittelijänä yrityksen lukuun.",
      "Omien käyttäjätietojemme ja yhteydenottojen osalta rekisterinpitäjä on Kate. Kaikki tietosuojaa koskevat kysymykset ja pyynnöt hoidetaan yhteydenottolomakkeella, ja vastaamme samaa kanavaa käyttäen.",
    ],
  },
  {
    otsikko: "Mitä tietoja käsittelemme",
    kappaleet: [
      "Käsittelemme vain niitä tietoja, jotka yritys itse tuo palveluun tai jotka syntyvät palvelun käytöstä.",
    ],
    lista: [
      "Yrityksen tiedot: nimi, y-tunnus, osoite, yhteystiedot, toimiala ja aikavyöhyke.",
      "Käyttäjät: nimi, sähköpostiosoite, rooli yrityksessä ja kirjautumistiedot.",
      "Työntekijätiedot: nimi, tehtävänimike, tuntipalkka sekä työvuorojen alkamis- ja päättymisajat.",
      "Talousaineisto: kuitit ja niiden kuvat, toimittajat, myyntipäivät, kulut, budjetit, kirjanpidon viennit ja raportit.",
      "Tiedostot: yrityksen palveluun tallentamat sopimukset ja tositteet.",
      "Toimintaloki: kuka teki minkä muutoksen ja milloin.",
      "Yhteydenotot: lomakkeella annettu nimi, yritys, sähköposti, puhelin ja viesti.",
    ],
  },
  {
    otsikko: "Mihin tietoja käytetään",
    kappaleet: [
      "Tietoja käytetään palvelun tuottamiseen: talouden seurantaan, kirjanpidon muodostamiseen, raportteihin ja työajan kirjaamiseen. Perusteena on sopimus yrityksen kanssa sekä yrityksen lakisääteiset velvoitteet, kuten kirjanpito- ja verovelvoitteet.",
      "Emme käytä yrityksen aineistoa markkinointiin emmekä myy tai luovuta sitä eteenpäin.",
    ],
  },
  {
    otsikko: "Tekoälyn käyttö",
    kappaleet: [
      "Kun kuitti, kassaraportti tai lasku luetaan kuvasta, kuva ja siitä poimittu teksti lähetetään luettavaksi Anthropicin kielimallipalveluun. Tulos palautuu ehdotuksena, jonka käyttäjä tarkistaa ennen tallennusta.",
      "Aineistoa ei käytetä mallien kouluttamiseen. Jos yritys ei halua käyttää kuvien lukemista, kuitit voi kirjata käsin ilman että kuvia lähetetään minnekään.",
    ],
  },
  {
    otsikko: "Missä tietoja säilytetään",
    kappaleet: [
      "Tietokanta ja tiedostot sijaitsevat Supabasen palvelimilla Euroopan unionin alueella (Irlanti). Sovellus toimii Vercelin alustalla. Tiedostot tallennetaan yksityiseen säilöön, eikä niistä muodosteta julkisia linkkejä.",
    ],
    lista: [
      "Supabase — tietokanta, kirjautuminen ja tiedostojen tallennus (EU).",
      "Vercel — sovelluksen ajoympäristö.",
      "Anthropic — kuittien ja kassaraporttien lukeminen kuvasta.",
    ],
  },
  {
    otsikko: "Kuinka kauan tietoja säilytetään",
    kappaleet: [
      "Tiedot säilyvät niin kauan kuin yrityksen asiakkuus on voimassa. Asiakkuuden päätyttyä tiedot säilyvät, kunnes yritys pyytää niiden poistamista; poisto tehdään pyynnöstä ja se poistaa yrityksen tiedot palvelusta.",
      "Huomaa, että kirjanpitolaki velvoittaa yritystä säilyttämään kirjanpitoaineistoa määräajan. Suosittelemme ottamaan aineiston talteen raporttien vientitoiminnolla ennen poistopyyntöä.",
    ],
  },
  {
    otsikko: "Tietojen suojaus",
    kappaleet: [
      "Pääsy tietoihin on rajattu tietokantatasolla: jokainen rivi on sidottu yritykseen, ja oikeus tarkistetaan tietokannassa asti eikä pelkästään käyttöliittymässä. Käyttäjän rooli ratkaisee mitä hän näkee — työntekijä näkee vain omat työvuoronsa, eikä kirjanpitäjä näe työntekijöiden palkkatietoja.",
      "Yhteydet on salattu, tiedostot ovat yksityisessä säilössä ja muutokset kirjautuvat toimintalokiin.",
    ],
  },
  {
    otsikko: "Sinun oikeutesi",
    kappaleet: [
      "Sinulla on oikeus saada tietää, mitä tietoja sinusta käsitellään, sekä oikeus pyytää niiden oikaisua tai poistamista, käsittelyn rajoittamista ja tietojen siirtämistä. Pyynnöt hoidetaan yhteydenottolomakkeella.",
      "Jos olet yrityksen työntekijä ja pyyntösi koskee työaika- tai palkkatietoja, ota ensin yhteyttä työnantajaasi: hän on näiden tietojen rekisterinpitäjä.",
      "Jos katsot, että tietojasi on käsitelty virheellisesti, voit tehdä ilmoituksen tietosuojavaltuutetun toimistolle.",
    ],
  },
  {
    otsikko: "Muutokset tähän selosteeseen",
    kappaleet: [
      "Kun palveluun tulee muutoksia, jotka vaikuttavat tietojen käsittelyyn, päivitämme tämän selosteen ja muutamme päivämäärän sivun alussa. Olennaisista muutoksista kerromme asiakkaille erikseen.",
    ],
  },
];

export default function TietosuojaPage() {
  return (
    <Legal
      title="Tietosuojaseloste"
      intro="Tämä seloste kertoo, mitä tietoja Kate käsittelee, missä niitä säilytetään ja mitkä oikeudet sinulla on. Seloste kuvaa palvelun nykyistä toimintaa."
      updated="27.9.2026"
      sections={OSAT}
    />
  );
}

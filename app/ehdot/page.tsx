import type { Metadata } from "next";
import { Legal, type LegalSection } from "@/components/landing/legal";
import "../landing.css";

export const metadata: Metadata = {
  title: { absolute: "Käyttöehdot – Kate" },
  description:
    "Kokeilu, hinta, vastuunjako ja tietojen omistus. Katen käyttöehdot lyhyesti ja selvällä kielellä.",
};

/**
 * Käyttöehdot.
 *
 * VASTUUNJAKO ON TÄRKEIN KOHTA.
 *
 * Kate laskee, koostaa ja muistuttaa, mutta se ei tee ilmoituksia
 * eikä maksa palkkoja. Sama raja sanotaan sovelluksessa ALV-sivulla ja
 * palkkasivulla, ja se sanotaan tässä samoilla sanoilla: ehdot jotka
 * lupaavat enemmän kuin tuote tekee kaatuvat ensimmäisessä
 * riitatilanteessa.
 *
 * Hinta, kokeilun pituus ja laskutuksen alkamishetki ovat samat kuin
 * etusivulla. Jos ne muuttuvat, ne muuttuvat molemmissa.
 */

const OSAT: LegalSection[] = [
  {
    otsikko: "Palvelu ja sopijapuolet",
    kappaleet: [
      "Kate on selaimessa toimiva palvelu, jolla yritys hoitaa myyntinsä, kuittinsa, kulunsa, kirjanpitonsa, työaikansa ja raporttinsa. Näitä ehtoja sovelletaan Katen ja palvelua käyttävän yrityksen välillä.",
      "Palvelun käyttöönotossa autamme: luomme tunnukset ja perustamme yrityksen tiedot. Yritys nimeää omistajan, joka hallinnoi omia käyttäjiään.",
    ],
  },
  {
    otsikko: "Kokeilu",
    kappaleet: [
      "Uusi yritys aloittaa 30 päivän maksuttomalla kokeilulla. Kokeilun aikana käytössä on koko palvelu ilman rajoituksia.",
      "Laskutus alkaa vasta kokeilun jälkeen. Kokeilun päättymispäivä näkyy sovelluksessa, ja päivien loppuessa kerromme siitä ajoissa. Jos yritys ei halua jatkaa, riittää että kertoo siitä — kokeilu ei muutu maksulliseksi itsestään ilman sopimusta.",
    ],
  },
  {
    otsikko: "Hinta",
    kappaleet: [
      "Palvelun hinta on 79 euroa kuukaudessa tai 790 euroa vuodessa, arvonlisäveroineen laskun mukaisesti. Hinta sisältää kaikki ominaisuudet eikä käyttäjien määrä vaikuta siihen: yrityksen kirjanpitäjä pääsee mukaan samaan hintaan.",
      "Hinnanmuutoksista kerromme etukäteen, eivätkä ne koske jo laskutettua kautta.",
    ],
  },
  {
    otsikko: "Mitä Kate tekee ja mitä se ei tee",
    kappaleet: [
      "Kate koostaa aineiston, muodostaa kirjanpidon viennit, laskee ALV-luvut ja arvioi henkilöstön kustannukset. Vastuu aineiston oikeellisuudesta ja viranomaisilmoituksista on yrityksellä.",
    ],
    lista: [
      "Kate valmistelee ALV-luvut, mutta ilmoituksen tekee yritys itse OmaVerossa. Kate ei lähetä ilmoituksia.",
      "Kate arvioi työnantajan henkilöstökustannuksen toteutuneista työtunneista. Se ei laske palkkoja: ennakonpidätys, sairausajan palkka ja lomapalkat tulevat palkkapalvelusta.",
      "Kuittien ja kassaraporttien lukeminen kuvasta tuottaa ehdotuksen, jonka käyttäjä tarkistaa. Ehdotus ei tallennu kirjanpitoon itsestään.",
      "Kate ei korvaa kirjanpitäjää eikä anna vero- tai sijoitusneuvontaa.",
    ],
  },
  {
    otsikko: "Tiedot ovat yrityksen omia",
    kappaleet: [
      "Palveluun tallennettu aineisto kuuluu yritykselle. Aineiston saa ulos milloin tahansa raporttien vientitoiminnolla, joka tuottaa tiedostot yleisissä muodoissa.",
      "Emme käytä yrityksen aineistoa muuhun kuin palvelun tuottamiseen. Tietojen käsittelystä kerrotaan tarkemmin tietosuojaselosteessa.",
    ],
  },
  {
    otsikko: "Käyttäjätunnukset ja käyttö",
    kappaleet: [
      "Tunnukset ovat henkilökohtaisia. Yrityksen omistaja vastaa siitä, kenelle hän antaa pääsyn ja millä roolilla, sekä siitä että pääsy poistetaan kun työsuhde päättyy.",
      "Palvelua ei saa käyttää lainvastaiseen toimintaan eikä sen toimintaa saa yrittää häiritä tai purkaa.",
    ],
  },
  {
    otsikko: "Saatavuus ja tuki",
    kappaleet: [
      "Pidämme palvelun käytettävissä parhaamme mukaan. Huoltokatkot ja häiriöt ovat mahdollisia, emmekä lupaa keskeytyksetöntä toimintaa.",
      "Tuki hoidetaan yhteydenottolomakkeella. Vastaamme arkipäivisin.",
    ],
  },
  {
    otsikko: "Sopimuksen päättyminen",
    kappaleet: [
      "Yritys voi lopettaa palvelun käytön milloin tahansa ilmoittamalla siitä. Laskutus päättyy kuluvan laskutuskauden loppuun.",
      "Sopimuksen päätyttyä aineisto säilyy, kunnes yritys pyytää sen poistamista. Suosittelemme ottamaan aineiston talteen ennen poistopyyntöä.",
      "Voimme keskeyttää palvelun, jos laskua ei makseta muistutuksesta huolimatta tai jos palvelua käytetään näiden ehtojen vastaisesti.",
    ],
  },
  {
    otsikko: "Vastuu",
    kappaleet: [
      "Kate vastaa palvelun toimivuudesta näiden ehtojen mukaisesti. Emme vastaa vahingosta, joka aiheutuu yrityksen omasta virheellisestä aineistosta, viranomaisilmoituksen laiminlyönnistä tai siitä, että palvelun tuottamaa arviota on käytetty ilman tarkistusta.",
      "Emme vastaa välillisestä vahingosta.",
    ],
  },
  {
    otsikko: "Ehtojen muutokset ja sovellettava laki",
    kappaleet: [
      "Muutamme ehtoja tarvittaessa ja kerromme olennaisista muutoksista etukäteen. Muutettu versio näkyy tällä sivulla päivämäärineen.",
      "Sopimukseen sovelletaan Suomen lakia. Erimielisyydet pyritään ratkaisemaan neuvottelemalla.",
    ],
  },
];

export default function EhdotPage() {
  return (
    <Legal
      title="Käyttöehdot"
      intro="Nämä ehdot kertovat, mitä Kate tekee, mitä se maksaa ja miten vastuu jakautuu. Teksti on tarkoituksella lyhyt ja selvällä kielellä."
      updated="27.9.2026"
      sections={OSAT}
    />
  );
}

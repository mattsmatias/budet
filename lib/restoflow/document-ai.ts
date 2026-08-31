/**
 * Asiakirjan tunnistuksen kehote ja muoto.
 *
 * Erillään reitistä, jotta ne ovat testattavissa. Sama jako kuin
 * kuiteilla ja laskuilla: moottori tässä, HTTP reitissä.
 *
 * ---------------------------------------------------------------------
 * ERI KYSYMYS KUIN LASKUN POIMINTA
 * ---------------------------------------------------------------------
 *
 * invoice-ai.ts kysyy "mitkä ovat maksutiedot": eräpäivä, summa, viite,
 * IBAN. Tämä kysyy "mikä tämä on ja minne se kuuluu": tyyppi, lähettäjä,
 * päiväys ja voimassaolo.
 *
 * Kysymykset ovat eri, joten kehotteet ovat eri. Yksi kehote joka
 * yrittäisi molempia olisi pidempi, epätarkempi ja kalliimpi kuin
 * kumpikaan erikseen — ja laskun maksutiedot ovat turhia tiedostolle
 * jota ei makseta.
 *
 * ---------------------------------------------------------------------
 * TÄMÄ EHDOTTAA, EI PÄÄTÄ
 * ---------------------------------------------------------------------
 *
 * Vastaus täyttää lomakkeen kentät, jotka käyttäjä näkee ja voi muuttaa
 * ennen tallennusta. Kate ei siirrä tiedostoja itsestään eikä luo
 * kansioita joita käyttäjä ei ole tehnyt: rakenne on ravintolan oma,
 * ja arkistointirobotti joka järjestelee kaappia oma-aloitteisesti on
 * juuri se mitä alkuperäisessä ohjeessa varoitettiin.
 */

import { z } from "zod";

const confidence = z.enum(["high", "medium", "low"]);
const kentta = <T extends z.ZodTypeAny>(arvo: T) =>
  z.object({ value: arvo.nullable(), confidence });

/**
 * Asiakirjan laji.
 *
 * Lista on lyhyt tarkoituksella. Jokainen laji vastaa yhtä Katen
 * lähtökansiota, ja laji jota ei osata sijoittaa ei auta ketään.
 * "other" on rehellinen vastaus eikä epäonnistuminen.
 */
export const DOCUMENT_KINDS = [
  "invoice",
  "receipt",
  "licence",
  "insurance",
  "lease",
  "contract",
  "report",
  "payroll",
  "tax",
  "other",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const documentSchema = z.object({
  kind: z.enum(DOCUMENT_KINDS),

  /*
   * Mitä asiakirja on, ravintoloitsijan sanoin.
   *
   * "Anniskelulupa" eikä "Alkoholijuomien anniskelua koskeva
   * lupapäätös". Tämä näytetään käyttäjälle sellaisenaan.
   */
  title: kentta(z.string()),

  /** Lähettäjä, myöntäjä tai vastapuoli. */
  issuer: kentta(z.string()),

  /** Asiakirjan päiväys. */
  date: kentta(z.string()),

  /** Voimassaolon päättyminen, jos asiakirjassa on sellainen. */
  validUntil: kentta(z.string()),

  imageQuality: z.enum(["good", "poor"]),
});

export type DocumentExtraction = z.infer<typeof documentSchema>;

export const DOCUMENT_PROMPT = `Katsot ravintolan asiakirjaa, jotta se osataan nimetä ja arkistoida oikeaan kansioon.

Säännöt, joista ei poiketa:

1. Älä keksi mitään. Jos arvoa ei näy, palauta null ja confidence "low".
   Tyhjä kenttä on parempi kuin arvattu: käyttäjä täydentää puuttuvan
   itse, mutta väärää hän ei huomaa.

2. kind on asiakirjan laji:
   - invoice   saapunut lasku, jossa on maksettavaa
   - receipt   kuitti tehdystä ostoksesta
   - licence   viranomaisen myöntämä lupa (anniskelu, elintarvikehuoneisto,
               terassi, ulkotarjoilu)
   - insurance vakuutuskirja tai -todistus
   - lease     vuokrasopimus toimitilasta tai laitteesta
   - contract  muu sopimus (toimitus, huolto, palvelu, työsopimus)
   - report    raportti tai yhteenveto (myynti, tilinpäätös, tarkastus)
   - payroll   palkkalaskelma tai palkkatodistus
   - tax       verottajan asiakirja tai veroilmoitus
   - other     kaikki muu, myös silloin kun et ole varma

3. title on lyhyt suomenkielinen nimi sille mikä asiakirja on:
   "Anniskelulupa", "Vuokrasopimus", "Palkkalaskelma". Enintään kolme
   sanaa. Älä toista lähettäjän nimeä siinä.

4. issuer on lähettäjä, myöntäjä tai vastapuoli — ei ravintola itse.
   Sopimuksessa on kaksi nimeä; issuer on se toinen. Viranomaisluvassa
   se on myöntävä viranomainen.

5. validUntil on voimassaolon päättymispäivä, jos asiakirjassa lukee
   sellainen: "voimassa", "gäller till", "valid until", "päättyy".
   Toistaiseksi voimassa oleva sopimus ei ole päättymispäivä — palauta
   silloin null.

   Eräpäivä EI ole voimassaolo. Laskun eräpäivä on maksupäivä, ei se
   päivä jolloin asiakirja lakkaa olemasta voimassa.

6. date on asiakirjan oma päiväys: allekirjoituspäivä, myöntämispäivä
   tai laskun päiväys.

7. Päivämäärät muodossa VVVV-KK-PP. Suomalainen 5.9.2026 on 2026-09-05.
   Älä sekoita päivää ja kuukautta.

8. confidence "high" vain kun teksti on selvästi luettavissa. Epäselvä
   käsiala, huono valo tai osittain peittynyt kohta on "low".

9. imageQuality "poor" jos kuva on epätarkka, vino tai osin rajattu pois.`;

/**
 * Laji Katen lähtökansion avaimeksi.
 *
 * Ehdotus osuu vain kansioon jonka Kate itse loi ja jota käyttäjä ei
 * ole nimennyt uudelleen. Jos hän on rakentanut oman rakenteensa, Kate
 * ei ala arvailla sitä nimien perusteella — se olisi juuri se
 * ylimääräinen älykkyys josta seuraa tiedostoja väärissä paikoissa.
 */
export function folderKeyFor(kind: DocumentKind): string | null {
  switch (kind) {
    case "invoice":
      return "invoices";
    case "receipt":
      return "receipts";
    case "licence":
    case "tax":
      return "authorities";
    case "lease":
    case "contract":
    case "insurance":
      return "contracts";
    case "report":
      return "sales_reports";
    case "payroll":
      return "staff";
    case "other":
      return null;
  }
}

/**
 * Laskun poiminnan kehote ja muoto.
 *
 * Erillään reitistä, jotta ne ovat testattavissa. Reittitiedosto saa
 * viedä vain Next.js:n tuntemat nimet, joten kehotetta ei voi lukea
 * sieltä — ja juuri kehote on se osa jonka toimivuus pitää todentaa
 * oikeaa mallia vasten (invoice-live.manual.test.ts).
 *
 * Sama jako kuin kuiteilla: receipt-ai.ts pitää moottorin, reitti
 * hoitaa HTTP:n.
 */

import { z } from "zod";

const confidence = z.enum(["high", "medium", "low"]);
const kentta = <T extends z.ZodTypeAny>(arvo: T) =>
  z.object({ value: arvo.nullable(), confidence });

/**
 * Poiminnan muoto.
 *
 * Rakenteinen ulostulo takaa että vastaus on tätä skeemaa. Mallin ei
 * tarvitse muistaa palauttaa JSONia eikä meidän varautua
 * jäsennysvirheeseen.
 */
export const invoiceSchema = z.object({
  /*
   * Onko kuvassa lasku lainkaan.
   *
   * Kamera osuu joskus kuittiin, ruokalistaan tai pöytään. Ilman tätä
   * malli keksisi eräpäivän mistä tahansa numerosta — ja väärä
   * eräpäivä tehtävässä on pahempi kuin puuttuva.
   */
  isInvoice: z.boolean(),
  supplier: kentta(z.string()),
  dueDate: kentta(z.string()),
  invoiceDate: kentta(z.string()),
  totalCents: kentta(z.number().int()),
  reference: kentta(z.string()),
  iban: kentta(z.string()),
  invoiceNumber: kentta(z.string()),
  imageQuality: z.enum(["good", "poor"]),
});

/**
 * Kehote.
 *
 * Kolme sääntöä kantaa loput: älä keksi, eräpäivä ei ole päiväys, ja
 * viite on saajan viite eikä laskun numero. Ne ovat ne kohdat joissa
 * lasku eroaa kuitista ja joissa väärä luku maksaa eniten.
 */
export const INVOICE_PROMPT = `Luet ravintolan saapuneita laskuja, jotta niiden maksamisesta voi tehdä muistutuksen.

Säännöt, joista ei poiketa:

1. Älä keksi mitään. Jos arvoa ei näy kuvassa, palauta null ja confidence "low".
   Tyhjä kenttä on parempi kuin arvattu.

2. isInvoice kertoo onko kuvassa lasku. Kuitti, ruokalista, kirje tai
   satunnainen kuva ei ole lasku: palauta silloin isInvoice false äläkä
   poimi kenttiä.

3. dueDate on ERÄPÄIVÄ, ei laskun päiväys eikä toimituspäivä. Suomeksi
   "Eräpäivä", "Maksettava viimeistään" tai "Due date". Jos laskussa on
   vain päiväys ja maksuehto ("14 pv netto"), laske eräpäivä niistä ja
   merkitse confidence "medium".

4. Päivämäärät muodossa VVVV-KK-PP. Suomalainen 5.9.2026 on 2026-09-05.
   Älä sekoita päivää ja kuukautta.

5. totalCents on MAKSETTAVA YHTEENSÄ sentteinä, arvonlisävero mukaan
   lukien. 1 240,50 € on 124050. Ei desimaaleja, ei valuuttamerkkiä.

6. reference on viitenumero sellaisena kuin se lukee: pelkät numerot tai
   RF-alkuinen. Älä poista tai lisää numeroita, älä korjaa sitä.
   Viitenumero ei ole sama kuin laskun numero.

7. iban on tilinumero IBAN-muodossa. Suomalainen alkaa FI. Älä täydennä
   puuttuvia merkkejä.

8. supplier on maksun saaja eli laskuttaja, ei ravintola joka maksaa.
   Laskussa on kaksi nimeä; saaja on se jonka tilille raha menee.

9. confidence "high" vain kun luku on selvästi luettavissa. Epäselvä
   käsiala, huono valo tai osittain peittynyt kohta on "low".

10. imageQuality "poor" jos kuva on epätarkka, vino tai osin rajattu pois.`;

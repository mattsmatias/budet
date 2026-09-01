/**
 * Verokortin lukeminen kuvasta tai PDF:stä.
 *
 * Verokortti tulee työntekijältä puhelimen kuvana tai OmaVerosta
 * ladattuna PDF:nä. Neljä lukua siitä pitäisi päätyä Kateen, ja
 * käsin naputeltuna yksikin väärä numero on väärä palkka koko
 * loppuvuodeksi.
 *
 * ---------------------------------------------------------------------
 * LUKEMINEN EI OLE HYVÄKSYNTÄ
 * ---------------------------------------------------------------------
 *
 * Mallin lukemia arvoja ei tallenneta suoraan. Ne näytetään
 * "Löydetyt tiedot" -listana, jonka käyttäjä hyväksyy tai muokkaa.
 *
 * Tämä ei ole varovaisuutta vaan mittasuhteita: veroprosentti
 * vaikuttaa jokaiseen palkkaan tämän vuoden loppuun asti, eikä
 * kukaan huomaisi kahdeksikon ja kuutosen eroa laskelmalta jonka
 * oletetaan olevan oikein.
 *
 * ---------------------------------------------------------------------
 * MITÄ EI LUETA
 * ---------------------------------------------------------------------
 *
 * Henkilötunnusta ei pyydetä eikä tallenneta. Kate ei tarvitse sitä
 * palkan laskemiseen, ja tarpeeton henkilötunnus kannassa on riski
 * ilman vastinetta.
 */

import { z } from "zod";

/**
 * Yksi kenttä arvoineen ja varmuuksineen.
 *
 * Sama muoto kuin muissa Katen lukijoissa: arvo ja tieto siitä
 * kuinka varma malli on. Matala varmuus näytetään toisin, ei
 * piiloteta — piilotettu epävarmuus on sama kuin varmuus.
 */
function field<T extends z.ZodTypeAny>(value: T) {
  return z.object({
    value: value.nullable(),
    sure: z.boolean(),
  });
}

export const taxCardSchema = z.object({
  /**
   * Onko tämä lainkaan verokortti.
   *
   * Käyttäjä voi lisätä väärän tiedoston. Silloin oikea vastaus on
   * "en tunnista tätä verokortiksi" eikä neljä keksittyä lukua.
   */
  isTaxCard: z.boolean(),

  /** Perusprosentti, tulorajaan asti. */
  basePercent: field(z.number()),

  /** Lisäprosentti, tulorajan ylittävältä osalta. */
  additionalPercent: field(z.number()),

  /** Vuositulorajа euroina. */
  incomeLimit: field(z.number()),

  /** Voimassaolo, ISO-muodossa. */
  validFrom: field(z.string()),
  validTo: field(z.string()),

  /** Kenen kortti. Näytetään tarkistusta varten, ei tallenneta. */
  holderName: field(z.string()),
});

export type TaxCardExtraction = z.infer<typeof taxCardSchema>;

export const TAX_CARD_PROMPT = `Luet suomalaista verokorttia, jotta palkanlaskentaan saadaan oikeat ennakonpidätystiedot.

Verokortissa on tyypillisesti:
- perusprosentti (myös "ennakonpidätysprosentti" tai "veroprosentti")
- lisäprosentti (pidätys tulorajan ylittävältä osalta)
- tuloraja euroina (vuositulorajа)
- voimassaoloaika

Sääntöjä:

1. Lue vain se mitä kortissa lukee. Älä laske, päättele tai täydennä.
   Jos kenttää ei näy, palauta null ja sure=false.

2. Prosentit ovat lukuja väliltä 0-100. "17,5 %" on 17.5.

3. Tuloraja on euroina ilman senttejä, esimerkiksi "25000". Jos
   kortissa lukee "25 000,00 €", palauta 25000.

4. Päivämäärät ISO-muodossa YYYY-MM-DD. Suomalainen "1.2.2026" on
   "2026-02-01".

5. Jos kuva ei ole verokortti, palauta isTaxCard=false ja kaikki
   kentät nullina. Älä arvaa.

6. sure=true vain silloin kun luku on selvästi luettavissa. Epäselvä
   käsiala, huono valaistus tai osittain rajautunut kenttä on
   sure=false.

Älä lue henkilötunnusta. Sitä ei kysytä eikä tallenneta.`;

/**
 * Luettu kortti lomakkeen kentiksi.
 *
 * Prosentit ja päivät tarkistetaan tässä, ei vasta tallennuksessa:
 * lomakkeeseen ei kirjoiteta arvoa jonka tiedetään olevan mahdoton.
 * Mahdoton arvo kentässä näyttäisi siltä että Kate luki sen, ja
 * käyttäjä korjaisi sitä sen sijaan että syöttäisi oikean.
 */
export interface TaxCardProposal {
  basePercent: number | null;
  additionalPercent: number | null;
  /** Sentteinä, kuten kannassa. */
  incomeLimitCents: number | null;
  validFrom: string | null;
  validTo: string | null;
  holderName: string | null;
  /** Kaikki luetut kentät olivat selviä. */
  sure: boolean;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function percentOrNull(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return value >= 0 && value <= 100 ? Math.round(value * 100) / 100 : null;
}

function dayOrNull(value: string | null): string | null {
  if (!value) return null;
  const day = value.trim().slice(0, 10);
  return ISO_DATE.test(day) ? day : null;
}

export function proposalFrom(
  parsed: TaxCardExtraction | null,
): TaxCardProposal | null {
  if (!parsed || !parsed.isTaxCard) return null;

  const euros = parsed.incomeLimit.value;

  return {
    basePercent: percentOrNull(parsed.basePercent.value),
    additionalPercent: percentOrNull(parsed.additionalPercent.value),
    incomeLimitCents:
      euros !== null && Number.isFinite(euros) && euros >= 0
        ? Math.round(euros * 100)
        : null,
    validFrom: dayOrNull(parsed.validFrom.value),
    validTo: dayOrNull(parsed.validTo.value),
    holderName: parsed.holderName.value?.trim() || null,

    /*
     * Varmuus on kaikkien luettujen kenttien varmuus.
     *
     * Yksikin epävarma luku tekee koko ehdotuksesta tarkistettavan:
     * käyttäjä ei tiedä mikä kentistä oli se epävarma, ellei sitä
     * sanota, ja rivikohtainen merkintä olisi enemmän kuin lomake
     * kestää.
     */
    sure:
      parsed.basePercent.sure &&
      parsed.additionalPercent.sure &&
      parsed.incomeLimit.sure,
  };
}

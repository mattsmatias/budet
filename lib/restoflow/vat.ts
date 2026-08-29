/**
 * ALV:n tarkistus.
 *
 * Kate EI aseta verokantaa käyttäjän puolesta eikä korjaa poimittua
 * arvoa. Se vertaa poimittua ALV:tä kategorian odotettuun kantaan ja
 * merkitsee ristiriidan tarkistettavaksi. Ero on olennainen: automaattinen
 * "korjaus" tuottaisi hiljaa väärän kirjauksen, kun taas merkintä pyytää
 * ihmistä katsomaan.
 *
 * Odotetut kannat ovat demo-arvoja eikä niitä ole validoitu virallista
 * lähdettä vasten.
 */

import { vatFromGross } from "@/lib/money";
import {
  EXPECTED_VAT_RATES,
  type ExpenseCategory,
  type Receipt,
  type ReceiptItem,
} from "./types";

/** Sallittu heitto ALV-kannan päättelyssä — pyöristys tositteella. */
const RATE_TOLERANCE = 0.004;

/** Sentin heitto rivien ja loppusumman vertailussa. */
const SUM_TOLERANCE_CENTS = 2;

/**
 * Päättelee ALV-kannan summista.
 *
 * Palauttaa null jos nettoa ei voi laskea — nollalla jakaminen tuottaisi
 * Infinityn, joka näyttäisi käyttöliittymässä verokannalta.
 */
export function inferVatRate(
  totalCents: number,
  vatCents: number,
): number | null {
  const netCents = totalCents - vatCents;
  if (netCents <= 0) return null;
  return vatCents / netCents;
}

/** Vastaako kanta jotain kategorian odotetuista kannoista? */
export function rateMatchesCategory(
  rate: number,
  category: ExpenseCategory,
): boolean {
  return EXPECTED_VAT_RATES[category].some(
    (expected) => Math.abs(rate - expected) <= RATE_TOLERANCE,
  );
}

export interface VatCheck {
  /** Poimitusta summasta päätelty kanta. */
  inferredRate: number | null;
  expectedRates: number[];
  matches: boolean;
  /** Ihmisluettava selitys kun ei täsmää. */
  explanation: string | null;
  /**
   * Riveillä esiintyvät verokannat, suurin ensin.
   *
   * Tyhjä kun rivejä ei ole tai niissä ei ole kantoja. Useampi kuin yksi
   * tarkoittaa että kuitti on sekakuitti eikä sillä ole yhtä kantaa.
   */
  rates: number[];
}

/** Rivi sellaisena kuin ALV-tarkistus sen tarvitsee. */
export interface RatedLine {
  totalCents: number;
  vatRate: number | null;
}

/**
 * Riveiltä laskettu ALV, tai null jos rivit eivät kelpaa tarkistukseen.
 *
 * Kaksi ehtoa. Jokaisella rivillä on oltava kanta — muuten osa verosta
 * jäisi laskematta ja tulos näyttäisi virheeltä. Rivien on myös
 * summauduttava loppusummaan, sillä muuten ne eivät kuvaa koko kuittia
 * eivätkä voi todistaa siitä mitään.
 *
 * Rivihinnat ovat verollisia, joten vero irrotetaan brutosta.
 * Pyöristys tulee lib/money.ts:stä — sama sääntö kuin myynnin
 * puolella, jottei kahden näkymän välille synny senttieroa jota ei
 * voi selittää.
 */
function vatFromLines(
  lines: RatedLine[],
  totalCents: number,
): { cents: number; rates: number[] } | null {
  if (lines.length === 0) return null;
  if (lines.some((line) => line.vatRate === null)) return null;

  const sum = lines.reduce((s, line) => s + line.totalCents, 0);
  if (Math.abs(sum - totalCents) > SUM_TOLERANCE_CENTS) return null;

  const cents = lines.reduce(
    (s, line) => s + vatFromGross(line.totalCents, line.vatRate!),
    0,
  );

  const rates = [...new Set(lines.map((line) => line.vatRate!))].sort(
    (a, b) => b - a,
  );

  return { cents, rates };
}

export function checkVat(
  totalCents: number,
  vatCents: number | null,
  category: ExpenseCategory,
  lines: RatedLine[] = [],
): VatCheck {
  const expectedRates = EXPECTED_VAT_RATES[category];

  if (vatCents === null) {
    return {
      inferredRate: null,
      expectedRates,
      matches: false,
      explanation: "ALV-tietoa ei tunnistettu kuitista.",
      rates: [],
    };
  }

  const inferredRate = inferVatRate(totalCents, vatCents);

  if (inferredRate !== null && inferredRate < 0) {
    return {
      inferredRate,
      expectedRates,
      matches: false,
      explanation: "ALV on negatiivinen.",
      rates: [],
    };
  }

  if (inferredRate === null) {
    return {
      inferredRate: null,
      expectedRates,
      matches: false,
      explanation: "ALV on suurempi tai yhtä suuri kuin loppusumma.",
      rates: [],
    };
  }

  /*
   * Rivit voittavat kategorian odotuksen.
   *
   * Kuitilla voi olla monta verokantaa: Gigantin kuitilla laite 25,5 %
   * ja lahjakortti 0 %. Näiden keskiarvo on 19,6 %, joka ei ole mikään
   * verokanta — ja juuri sitä tämä tarkistus vertasi kategorian
   * odotukseen. Oikea kuitti merkittiin virheelliseksi ikuisesti.
   *
   * Kun rivit kertovat kantansa ja summautuvat loppusummaan, ne ovat
   * parempi todiste kuin kategoriasta arvattu odotus. Silloin
   * kysytään vain: täsmääkö riveiltä laskettu vero kuitin veroon.
   */
  const fromLines = vatFromLines(lines, totalCents);

  if (fromLines !== null) {
    // Senttien pyöristys tapahtuu riveittäin, joten heitto kasvaa
    // rivimäärän mukana. Todellinen lukuvirhe on euroja, ei senttejä.
    const tolerance = SUM_TOLERANCE_CENTS + lines.length;
    const matches = Math.abs(fromLines.cents - vatCents) <= tolerance;

    return {
      inferredRate,
      expectedRates,
      matches,
      explanation: matches
        ? null
        : `Riveiltä laskettu ALV on ${(fromLines.cents / 100).toFixed(2)} € ` +
          `mutta kuittiin on merkitty ${(vatCents / 100).toFixed(2)} €.`,
      rates: fromLines.rates,
    };
  }

  const matches = rateMatchesCategory(inferredRate, category);

  return {
    inferredRate,
    expectedRates,
    matches,
    explanation: matches
      ? null
      : `Tunnistettu ${formatRate(inferredRate)} ei vastaa odotettua ` +
        `${expectedRates.map(formatRate).join(" tai ")}.`,
    rates: [],
  };
}

export function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1).replace(".", ",")} %`;
}

/**
 * Täsmäävätkö rivit loppusummaan?
 *
 * Jos rivejä on mutta ne eivät summaudu, poiminta on menettänyt jotain ja
 * rivikohtainen kulujako olisi väärä. Parempi merkitä kuin näyttää
 * uskottavan näköinen mutta virheellinen erittely.
 */
export function itemsSumMatches(receipt: Receipt): boolean {
  if (receipt.items.length === 0) return true;
  const sum = receipt.items.reduce((s, i) => s + i.totalCents, 0);
  return Math.abs(sum - receipt.totalCents) <= SUM_TOLERANCE_CENTS;
}

export function itemsTotalCents(items: ReceiptItem[]): number {
  return items.reduce((s, i) => s + i.totalCents, 0);
}

/**
 * Dokumenttitason kategoria riveiltä: se kategoria johon menee eniten rahaa.
 *
 * Sekakuitilla tämä on aina epätarkka, minkä takia rivikohtainen erittely
 * on olemassa. Dokumenttitason kategoriaa käytetään vain listauksissa.
 */
export function dominantCategory(
  items: ReceiptItem[],
  fallback: ExpenseCategory,
): ExpenseCategory {
  if (items.length === 0) return fallback;

  const totals = new Map<ExpenseCategory, number>();
  for (const item of items) {
    totals.set(
      item.category,
      (totals.get(item.category) ?? 0) + item.totalCents,
    );
  }

  let best: ExpenseCategory = fallback;
  let bestCents = -1;
  for (const [category, cents] of totals) {
    if (cents > bestCents) {
      best = category;
      bestCents = cents;
    }
  }
  return best;
}

/** Onko kuitti sekakuitti — useampi kategoria riveillä? */
export function isMixedReceipt(items: ReceiptItem[]): boolean {
  return new Set(items.map((i) => i.category)).size > 1;
}

// ---------------------------------------------------------------------------

export interface VatRateTotal {
  /** Verokanta osuutena. Null = rivillä ei ole kantaa. */
  rate: number | null;
  grossCents: number;
  vatCents: number;
  netCents: number;
}

/**
 * Kuitin ALV verokannoittain.
 *
 * SEKAKUITTIA EI PAKOTETA YHTEEN KANTAAN.
 *
 * Tukkukuitilla on ruokaa 13,5 %:lla ja siivousainetta 25,5 %:lla. Näiden
 * keskiarvo ei ole mikään verokanta, eikä kuitin kokonais-ALV kerro
 * kirjanpitäjälle sitä mitä hän tarvitsee: paljonko vähennettävää
 * veroa kummallakin kannalla on.
 *
 * RIVI ILMAN KANTAA ON OMA RYHMÄNSÄ.
 *
 * Sitä ei jaeta muille kannoille eikä oleteta yleiseen kantaan.
 * Tuntematon on tulos sekin, ja sen näkeminen on ainoa tapa korjata
 * se.
 *
 * Vero irrotetaan brutosta lib/money.ts:n keskitetyllä säännöllä.
 */
export function vatByRate(lines: RatedLine[]): VatRateTotal[] {
  const totals = new Map<number | null, VatRateTotal>();

  for (const line of lines) {
    const current = totals.get(line.vatRate) ?? {
      rate: line.vatRate,
      grossCents: 0,
      vatCents: 0,
      netCents: 0,
    };

    const vat =
      line.vatRate === null ? 0 : vatFromGross(line.totalCents, line.vatRate);

    current.grossCents += line.totalCents;
    current.vatCents += vat;
    // Erotuksena: näin brutto = vero + veroton pitää joka ryhmässä.
    current.netCents += line.totalCents - vat;

    totals.set(line.vatRate, current);
  }

  return [...totals.values()].sort((a, b) => {
    // Kannaton viimeiseksi: se on puute eikä kanta.
    if (a.rate === null) return 1;
    if (b.rate === null) return -1;
    return b.rate - a.rate;
  });
}

/**
 * Rivin ALV sentteinä.
 *
 * Lasketaan eikä poimita: brutto kertaa kanta on tarkka laskutoimitus,
 * eikä mallilta kannata kysyä lukua jonka voi johtaa. Poimittu luku
 * voisi lisäksi olla ristiriidassa rivin oman kannan kanssa.
 *
 * Pyöristys tulee lib/money.ts:stä. Sama kaava oli hetken neljässä
 * paikassa, ja neljä kopiota yhdestä säännöstä on kolme mahdollisuutta
 * eriytyä.
 */
export function lineVatCents(
  totalCents: number,
  vatRate: number | null,
): number | null {
  if (vatRate === null) return null;
  return vatFromGross(totalCents, vatRate);
}

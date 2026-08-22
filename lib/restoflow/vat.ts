/**
 * ALV:n tarkistus.
 *
 * Budet EI aseta verokantaa käyttäjän puolesta eikä korjaa poimittua
 * arvoa. Se vertaa poimittua ALV:tä kategorian odotettuun kantaan ja
 * merkitsee ristiriidan tarkistettavaksi. Ero on olennainen: automaattinen
 * "korjaus" tuottaisi hiljaa väärän kirjauksen, kun taas merkintä pyytää
 * ihmistä katsomaan.
 *
 * Odotetut kannat ovat demo-arvoja eikä niitä ole validoitu virallista
 * lähdettä vasten.
 */

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
export function inferVatRate(totalCents: number, vatCents: number): number | null {
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
}

export function checkVat(
  totalCents: number,
  vatCents: number | null,
  category: ExpenseCategory,
): VatCheck {
  const expectedRates = EXPECTED_VAT_RATES[category];

  if (vatCents === null) {
    return {
      inferredRate: null,
      expectedRates,
      matches: false,
      explanation: "ALV-tietoa ei tunnistettu kuitista.",
    };
  }

  const inferredRate = inferVatRate(totalCents, vatCents);

  if (inferredRate === null) {
    return {
      inferredRate: null,
      expectedRates,
      matches: false,
      explanation: "ALV on suurempi tai yhtä suuri kuin loppusumma.",
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
    totals.set(item.category, (totals.get(item.category) ?? 0) + item.totalCents);
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

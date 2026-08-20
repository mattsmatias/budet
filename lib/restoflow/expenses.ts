/**
 * Kulujen koonti.
 *
 * TÄRKEÄ RAJAUS: RestoFlow ei näe pankkitiliä eikä kassaa. Kaikki luvut
 * tarkoittavat *kirjattuja kuluja* — järjestelmään lisättyjen kuittien
 * summaa. Käyttöliittymän on sanottava tämä ääneen, jottei kukaan lue
 * lukua ravintolan taloudellisena tuloksena.
 *
 * Siksi tässä tiedostossa ei ole sanaa "liikevaihto", "tulos" eikä "kate",
 * eikä tietomallissa ole kenttää myynnille.
 */

import type { ExpenseCategory, Receipt, ReviewReason } from "./types";

export interface CategoryTotal {
  category: ExpenseCategory;
  totalCents: number;
  receiptCount: number;
  /** Osuus kaikista kirjatuista kuluista, 0–1. */
  share: number;
}

export interface PeriodTotals {
  /** Kuukausi muodossa "2026-08". */
  month: string;
  totalCents: number;
  receiptCount: number;
  vatCents: number;
  needsReviewCount: number;
}

/** Kuukausi kuitin päivästä. */
export function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function receiptsInMonth(receipts: Receipt[], month: string): Receipt[] {
  return receipts.filter((r) => monthOf(r.date) === month);
}

/**
 * Kulut kategorioittain, suurin ensin.
 *
 * Kategoriat joissa ei ole kuitteja jätetään pois: nollarivi bar chartissa
 * on visuaalista kohinaa, ei tietoa.
 */
export function totalsByCategory(receipts: Receipt[]): CategoryTotal[] {
  const totals = new Map<ExpenseCategory, { cents: number; count: number }>();

  for (const receipt of receipts) {
    const entry = totals.get(receipt.category) ?? { cents: 0, count: 0 };
    entry.cents += receipt.totalCents;
    entry.count += 1;
    totals.set(receipt.category, entry);
  }

  const grand = [...totals.values()].reduce((sum, e) => sum + e.cents, 0);

  return [...totals.entries()]
    .map(([category, entry]) => ({
      category,
      totalCents: entry.cents,
      receiptCount: entry.count,
      share: grand === 0 ? 0 : entry.cents / grand,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

export function periodTotals(receipts: Receipt[], month: string): PeriodTotals {
  const inMonth = receiptsInMonth(receipts, month);

  return {
    month,
    totalCents: inMonth.reduce((s, r) => s + r.totalCents, 0),
    receiptCount: inMonth.length,
    vatCents: inMonth.reduce((s, r) => s + (r.vatCents ?? 0), 0),
    needsReviewCount: inMonth.filter((r) => r.status === "needs_review").length,
  };
}

/**
 * Suhteellinen muutos edelliseen jaksoon, 0–1 desimaalina.
 *
 * Palauttaa null kun vertailukohtaa ei ole. Nollasta kasvaminen ei ole
 * "+100 %" vaan mittaamaton — prosenttiluvun näyttäminen siinä tapauksessa
 * olisi keksittyä tarkkuutta.
 */
export function relativeChange(
  currentCents: number,
  previousCents: number,
): number | null {
  if (previousCents === 0) return null;
  return (currentCents - previousCents) / previousCents;
}

/** "+8,4 %" tai "−4,2 %". */
export function formatChange(change: number | null): string {
  if (change === null) return "ei vertailukohtaa";
  const pct = Math.abs(change * 100).toFixed(1).replace(".", ",");
  const sign = change > 0 ? "+" : change < 0 ? "−" : "";
  return `${sign}${pct} %`;
}

export type ChangeTone = "up" | "down" | "flat" | "none";

/**
 * Kulujen kasvu ei ole "hyvä" eikä "huono" ilman kontekstia — kasvava
 * ravintola ostaa enemmän. Siksi sävy kertoo vain suunnan, ei arvostelua,
 * eikä nuolta väritetä vihreäksi tai punaiseksi.
 */
export function changeTone(change: number | null): ChangeTone {
  if (change === null) return "none";
  if (Math.abs(change) < 0.001) return "flat";
  return change > 0 ? "up" : "down";
}

export function previousMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1, 1));
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}

export function nextMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 7);
}

const MONTH_NAMES = [
  "Tammikuu", "Helmikuu", "Maaliskuu", "Huhtikuu", "Toukokuu", "Kesäkuu",
  "Heinäkuu", "Elokuu", "Syyskuu", "Lokakuu", "Marraskuu", "Joulukuu",
];

export function formatMonth(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${year}`;
}

export function formatMonthShort(month: string): string {
  const [, m] = month.split("-").map(Number);
  return MONTH_NAMES[m - 1];
}

/** Kuukausisarja kehitysgraafiin, vanhin ensin. */
export function monthlySeries(
  receipts: Receipt[],
  endMonth: string,
  count: number,
): PeriodTotals[] {
  const months: string[] = [];
  let cursor = endMonth;

  for (let i = 0; i < count; i += 1) {
    months.unshift(cursor);
    cursor = previousMonth(cursor);
  }

  return months.map((month) => periodTotals(receipts, month));
}

// ---------------------------------------------------------------------------
// Tarkistettavat
// ---------------------------------------------------------------------------

export function needsReview(receipts: Receipt[]): Receipt[] {
  return receipts
    .filter((r) => r.status === "needs_review")
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Yhteenveto syistä. Käytetään kun halutaan kertoa mitä puuttuu ilman
 * että jokainen kuitti listataan erikseen.
 */
export function reviewReasonCounts(
  receipts: Receipt[],
): { reason: ReviewReason; count: number }[] {
  const counts = new Map<ReviewReason, number>();

  for (const receipt of needsReview(receipts)) {
    for (const reason of receipt.reviewReasons) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Haku
// ---------------------------------------------------------------------------

/**
 * Kuittihaku. Kattaa toimittajan, kuittinumeron, muistiinpanon ja summan.
 *
 * Summahaku sallii sentin heiton, koska käyttäjä kirjoittaa "186,90" eikä
 * muista sitä oliko se 186,90 vai 186,91.
 */
export function searchReceipts(receipts: Receipt[], query: string): Receipt[] {
  const q = query.trim().toLowerCase();
  if (!q) return receipts;

  const asNumber = Number.parseFloat(q.replace(",", "."));
  const cents = Number.isFinite(asNumber) ? Math.round(asNumber * 100) : null;

  return receipts.filter((receipt) => {
    if (receipt.supplier.toLowerCase().includes(q)) return true;
    if (receipt.receiptNumber?.toLowerCase().includes(q)) return true;
    if (receipt.note?.toLowerCase().includes(q)) return true;
    if (receipt.date.includes(q)) return true;
    if (cents !== null && Math.abs(receipt.totalCents - cents) <= 1) return true;
    return false;
  });
}

export type ReceiptFilter = "all" | "needs_review" | ExpenseCategory;

export function filterReceipts(
  receipts: Receipt[],
  filter: ReceiptFilter,
): Receipt[] {
  if (filter === "all") return receipts;
  if (filter === "needs_review") {
    return receipts.filter((r) => r.status === "needs_review");
  }
  return receipts.filter((r) => r.category === filter);
}

export function sortByDateDesc(receipts: Receipt[]): Receipt[] {
  return [...receipts].sort(
    (a, b) => b.date.localeCompare(a.date) || b.addedAt.localeCompare(a.addedAt),
  );
}

/**
 * Suomen monikko kuiteille. "1 kuittia" on kielioppivirhe joka pistää
 * silmään heti, ja se toistuisi joka kortissa ilman tätä.
 */
export function receiptCountLabel(count: number): string {
  return count === 1 ? "1 kuitti" : `${count} kuittia`;
}

/** Sama vuoroille. */
export function shiftCountLabel(count: number): string {
  return count === 1 ? "1 vuoro" : `${count} vuoroa`;
}

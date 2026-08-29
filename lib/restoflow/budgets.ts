/**
 * Kulubudjetit.
 *
 * Budjetti tekee graafista toimintakelpoisen: "ruokakulut 21 430 €" ei
 * kerro onko se paljon, mutta "82 % budjetista, 11 päivää jäljellä" kertoo.
 *
 * Kaikki laskenta on suhteessa kuukauden budjettiin. Kulutusvauhtia ei
 * ekstrapoloida päiväkohtaisesti — ravintolan ostot eivät jakaudu tasaisesti
 * kuukaudelle, ja tasaiseen tahtiin perustuva ennuste hälyttäisi turhaan
 * heti ison tukkulaskun jälkeen.
 */

import { receiptsInMonth } from "./expenses";
import { itemsTotalCents } from "./vat";
import type { Budget, BudgetStatus, ExpenseCategory, Receipt } from "./types";

/** Osuus jonka jälkeen budjetti varoittaa. */
export const WARNING_THRESHOLD = 0.8;

export interface BudgetProgress {
  category: ExpenseCategory;
  budgetCents: number | null;
  spentCents: number;
  /** Osuus budjetista, 0–n. Null kun budjettia ei ole asetettu. */
  ratio: number | null;
  remainingCents: number | null;
  status: BudgetStatus;
}

/**
 * Kulut kategorioittain riveiltä.
 *
 * Käyttää rivikohtaista kategoriaa kun rivejä on. Sekakuitti jakautuu
 * oikein useaan budjettiin sen sijaan että koko summa osuisi yhteen.
 */
export function spendByCategory(
  receipts: Receipt[],
): Map<ExpenseCategory, number> {
  const totals = new Map<ExpenseCategory, number>();

  for (const receipt of receipts) {
    if (receipt.items.length > 0 && itemsTotalCents(receipt.items) > 0) {
      for (const item of receipt.items) {
        totals.set(
          item.category,
          (totals.get(item.category) ?? 0) + item.totalCents,
        );
      }
    } else {
      totals.set(
        receipt.category,
        (totals.get(receipt.category) ?? 0) + receipt.totalCents,
      );
    }
  }

  return totals;
}

export function budgetFor(
  budgets: Budget[],
  category: ExpenseCategory,
  month: string,
): Budget | undefined {
  // Kuukausikohtainen budjetti voittaa toistuvan.
  return (
    budgets.find((b) => b.category === category && b.month === month) ??
    budgets.find((b) => b.category === category && b.month === null)
  );
}

export function budgetStatus(ratio: number | null): BudgetStatus {
  if (ratio === null) return "none";
  if (ratio > 1) return "exceeded";
  if (ratio >= WARNING_THRESHOLD) return "warning";
  return "ok";
}

/**
 * Budjettien tilanne kuukaudelta.
 *
 * Palauttaa rivin jokaiselle budjetoidulle kategorialle sekä jokaiselle
 * kategorialle jossa on kuluja. Budjetoimaton kulu ei katoa näkyvistä.
 */
export function budgetProgress(
  receipts: Receipt[],
  budgets: Budget[],
  month: string,
): BudgetProgress[] {
  const spend = spendByCategory(receiptsInMonth(receipts, month));

  const categories = new Set<ExpenseCategory>([
    ...spend.keys(),
    ...budgets
      .filter((b) => b.month === month || b.month === null)
      .map((b) => b.category),
  ]);

  return [...categories]
    .map((category) => {
      const budget = budgetFor(budgets, category, month);
      const spentCents = spend.get(category) ?? 0;
      const budgetCents = budget?.amountCents ?? null;
      const ratio =
        budgetCents === null || budgetCents === 0
          ? null
          : spentCents / budgetCents;

      return {
        category,
        budgetCents,
        spentCents,
        ratio,
        remainingCents: budgetCents === null ? null : budgetCents - spentCents,
        status: budgetStatus(ratio),
      };
    })
    .sort((a, b) => {
      // Ylitykset ensin, sitten varoitukset, sitten suurin kulu.
      const rank = (s: BudgetStatus) =>
        s === "exceeded" ? 0 : s === "warning" ? 1 : 2;
      return rank(a.status) - rank(b.status) || b.spentCents - a.spentCents;
    });
}

export function formatRatio(ratio: number | null): string {
  if (ratio === null) return "—";
  return `${Math.round(ratio * 100)} %`;
}

export interface BudgetSummary {
  totalBudgetCents: number;
  totalSpentCents: number;
  exceededCount: number;
  warningCount: number;
  unbudgetedCents: number;
}

export function budgetSummary(progress: BudgetProgress[]): BudgetSummary {
  return {
    totalBudgetCents: progress.reduce((s, p) => s + (p.budgetCents ?? 0), 0),
    totalSpentCents: progress.reduce((s, p) => s + p.spentCents, 0),
    exceededCount: progress.filter((p) => p.status === "exceeded").length,
    warningCount: progress.filter((p) => p.status === "warning").length,
    unbudgetedCents: progress
      .filter((p) => p.budgetCents === null)
      .reduce((s, p) => s + p.spentCents, 0),
  };
}

/**
 * Toimittajakohtainen kuluseuranta.
 *
 * Vastaa kysymykseen "kenelle rahamme menevät". Kategoriajakauma kertoo
 * mihin, toimittajajakauma kenelle — ne ovat eri kysymyksiä, ja
 * neuvotteluvoima syntyy jälkimmäisestä.
 */

import { monthOf, previousMonth, receiptsInMonth } from "./expenses";
import type { ExpenseCategory, Receipt, Supplier } from "./types";

export interface SupplierTotals {
  supplierId: string;
  name: string;
  totalCents: number;
  receiptCount: number;
  averageCents: number;
  share: number;
  /** Kategoriat joihin tämän toimittajan rahat menevät, suurin ensin. */
  categories: { category: ExpenseCategory; cents: number }[];
  lastReceiptDate: string | null;
}

/** Toimittajat kulun mukaan, suurin ensin. */
export function totalsBySupplier(receipts: Receipt[]): SupplierTotals[] {
  const map = new Map<
    string,
    {
      name: string;
      cents: number;
      count: number;
      categories: Map<ExpenseCategory, number>;
      last: string | null;
    }
  >();

  for (const receipt of receipts) {
    const entry = map.get(receipt.supplierId) ?? {
      name: receipt.supplierName,
      cents: 0,
      count: 0,
      categories: new Map<ExpenseCategory, number>(),
      last: null,
    };

    entry.cents += receipt.totalCents;
    entry.count += 1;
    if (!entry.last || receipt.date > entry.last) entry.last = receipt.date;

    // Rivikohtainen jako kun rivejä on — muuten koko summa dokumentin
    // kategoriaan. Sekakuitti jakautuisi muuten väärin.
    if (receipt.items.length > 0) {
      for (const item of receipt.items) {
        entry.categories.set(
          item.category,
          (entry.categories.get(item.category) ?? 0) + item.totalCents,
        );
      }
    } else {
      entry.categories.set(
        receipt.category,
        (entry.categories.get(receipt.category) ?? 0) + receipt.totalCents,
      );
    }

    map.set(receipt.supplierId, entry);
  }

  const grand = [...map.values()].reduce((s, e) => s + e.cents, 0);

  return [...map.entries()]
    .map(([supplierId, entry]) => ({
      supplierId,
      name: entry.name,
      totalCents: entry.cents,
      receiptCount: entry.count,
      averageCents:
        entry.count === 0 ? 0 : Math.round(entry.cents / entry.count),
      share: grand === 0 ? 0 : entry.cents / grand,
      categories: [...entry.categories.entries()]
        .map(([category, cents]) => ({ category, cents }))
        .sort((a, b) => b.cents - a.cents),
      lastReceiptDate: entry.last,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

export function supplierTotalsInMonth(
  receipts: Receipt[],
  month: string,
): SupplierTotals[] {
  return totalsBySupplier(receiptsInMonth(receipts, month));
}

export interface SupplierTrend {
  supplierId: string;
  name: string;
  currentCents: number;
  previousCents: number;
  /** null kun vertailukohtaa ei ole — nollasta kasvua ei mitata. */
  change: number | null;
}

/**
 * Toimittajan kulumuutos edelliseen kuukauteen.
 *
 * Käytetään poikkeamahälytyksiin: äkillinen nousu yhdellä toimittajalla on
 * juuri se mitä manageri ei huomaa kokonaissummasta.
 */
export function supplierTrends(
  receipts: Receipt[],
  month: string,
): SupplierTrend[] {
  const current = new Map(
    supplierTotalsInMonth(receipts, month).map((s) => [s.supplierId, s]),
  );
  const prev = new Map(
    supplierTotalsInMonth(receipts, previousMonth(month)).map((s) => [
      s.supplierId,
      s,
    ]),
  );

  const ids = new Set([...current.keys(), ...prev.keys()]);

  return [...ids]
    .map((id) => {
      const c = current.get(id);
      const p = prev.get(id);
      const currentCents = c?.totalCents ?? 0;
      const previousCents = p?.totalCents ?? 0;

      return {
        supplierId: id,
        name: c?.name ?? p?.name ?? "Tuntematon",
        currentCents,
        previousCents,
        change:
          previousCents === 0
            ? null
            : (currentCents - previousCents) / previousCents,
      };
    })
    .sort((a, b) => b.currentCents - a.currentCents);
}

/** Yhden toimittajan kuukausisarja. */
export function supplierMonthlySeries(
  receipts: Receipt[],
  supplierId: string,
  endMonth: string,
  count: number,
): { month: string; totalCents: number; receiptCount: number }[] {
  const months: string[] = [];
  let cursor = endMonth;
  for (let i = 0; i < count; i += 1) {
    months.unshift(cursor);
    cursor = previousMonth(cursor);
  }

  return months.map((month) => {
    const inMonth = receipts.filter(
      (r) => r.supplierId === supplierId && monthOf(r.date) === month,
    );
    return {
      month,
      totalCents: inMonth.reduce((s, r) => s + r.totalCents, 0),
      receiptCount: inMonth.length,
    };
  });
}

export function receiptsForSupplier(
  receipts: Receipt[],
  supplierId: string,
): Receipt[] {
  return receipts
    .filter((r) => r.supplierId === supplierId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Ehdottaako toimittajan historia toista kategoriaa?
 *
 * Kun manageri on toistuvasti korjannut saman toimittajan kategorian,
 * ehdotetaan korjattua. Tämä on sääntö korjaushistoriasta, ei mallin
 * koulutusta — ja se on nähtävissä ja kumottavissa.
 */
export function suggestedCategory(
  supplier: Supplier,
  proposed: ExpenseCategory,
): { category: ExpenseCategory; reason: string } | null {
  const override = supplier.categoryOverrides
    .filter((o) => o.from === proposed && o.count >= 2)
    .sort((a, b) => b.count - a.count)[0];

  if (!override) return null;

  return {
    category: override.to,
    reason: `Olet korjannut tämän ${override.count} kertaa aiemmin.`,
  };
}

import { describe, expect, it } from "vitest";
import { buildInsights, sortInsights, type InsightContext } from "../insights";
import type { Budget, ExpenseCategory, Receipt } from "../types";

// ---------------------------------------------------------------------------
// Apurit
// ---------------------------------------------------------------------------

let n = 0;

function receipt(
  partial: Partial<Receipt> & { totalCents: number; date: string },
): Receipt {
  n += 1;
  return {
    id: `r${n}`,
    restaurantId: "rest-1",
    supplierId: "s-1",
    supplierName: "Toimittaja",
    vatCents: null,
    category: "food",
    paymentMethod: "card",
    receiptNumber: null,
    note: null,
    status: "confirmed",
    reviewReasons: [],
    items: [],
    addedByUserId: "u1",
    addedAt: `${partial.date}T12:00:00.000Z`,
    hasImage: true,
    imagePath: null,
    categoryId: null,
    imageQuality: "good",
    ...partial,
  };
}

function budget(category: ExpenseCategory, cents: number, month: string): Budget {
  n += 1;
  return {
    id: `b${n}`,
    restaurantId: "rest-1",
    category,
    month,
    amountCents: cents,
  };
}

function context(partial: Partial<InsightContext> = {}): InsightContext {
  return {
    receipts: [],
    budgets: [],
    shifts: [],
    users: [],
    clockEvents: [],
    month: "2026-08",
    today: "2026-08-15",
    now: "2026-08-15T12:00:00.000Z",
    timezone: "Europe/Helsinki",
    ...partial,
  };
}

function ids(ctx: InsightContext): string[] {
  return buildInsights(ctx).map((insight) => insight.id);
}

// ---------------------------------------------------------------------------

describe("havainnot", () => {
  /**
   * Yhden kuukauden aineistosta ei voi päätellä suuntaa. Havainto joka
   * väittää muuta olisi keksitty.
   */
  it("vaikenee kun vertailukuukautta ei ole", () => {
    const ctx = context({
      receipts: [receipt({ totalCents: 50000, date: "2026-08-03" })],
    });

    expect(ids(ctx)).not.toContain("spend-trend");
    expect(ids(ctx)).not.toContain("spend-flat");
  });

  it("tunnistaa kulujen nousun ja perustelee sen euroina", () => {
    const ctx = context({
      receipts: [
        receipt({ totalCents: 10000, date: "2026-07-05" }),
        receipt({ totalCents: 10000, date: "2026-07-12" }),
        receipt({ totalCents: 10000, date: "2026-07-20" }),
        receipt({ totalCents: 60000, date: "2026-08-04" }),
      ],
    });

    const trend = buildInsights(ctx).find((i) => i.id === "spend-trend");

    expect(trend?.tone).toBe("watch");
    expect(trend?.detail).toContain("+");
    // Perustelu ilman euromäärää olisi mielipide.
    expect(trend?.detail).toMatch(/\d/);
  });

  it("pitää pientä muutosta muuttumattomana", () => {
    const ctx = context({
      receipts: [
        receipt({ totalCents: 10000, date: "2026-07-05" }),
        receipt({ totalCents: 10000, date: "2026-07-12" }),
        receipt({ totalCents: 10000, date: "2026-07-20" }),
        receipt({ totalCents: 30100, date: "2026-08-04" }),
      ],
    });

    const flat = buildInsights(ctx).find((i) => i.id === "spend-flat");
    expect(flat?.tone).toBe("good");
  });

  /**
   * Yksi toimittaja yli puolella kuluista on neuvotteluasema, ei vika —
   * mutta se on syytä tietää.
   */
  it("huomaa toimittajakeskittymän", () => {
    const ctx = context({
      receipts: [
        receipt({ totalCents: 80000, date: "2026-08-02", supplierId: "iso", supplierName: "Iso Tukku" }),
        receipt({ totalCents: 10000, date: "2026-08-03", supplierId: "pieni", supplierName: "Pieni" }),
      ],
    });

    const insight = buildInsights(ctx).find((i) => i.id === "supplier-concentration");
    expect(insight?.detail).toContain("Iso Tukku");
  });

  it("ei näe keskittymää yhden toimittajan aineistossa", () => {
    const ctx = context({
      receipts: [receipt({ totalCents: 80000, date: "2026-08-02" })],
    });

    expect(ids(ctx)).not.toContain("supplier-concentration");
  });

  /**
   * Budjetin käyttöaste on merkityksetön ilman kuukauden kulumista:
   * 60 % kolmantena päivänä ja 60 % viimeisenä ovat eri asioita.
   */
  it("suhteuttaa budjetin kuukauden kulumiseen", () => {
    const early = context({
      today: "2026-08-03",
      receipts: [receipt({ totalCents: 70000, date: "2026-08-02" })],
      budgets: [budget("food", 100000, "2026-08")],
    });

    expect(ids(early)).toContain("budget-pace-food");

    const late = context({
      today: "2026-08-28",
      receipts: [receipt({ totalCents: 70000, date: "2026-08-02" })],
      budgets: [budget("food", 100000, "2026-08")],
    });

    expect(ids(late)).not.toContain("budget-pace-food");
    expect(ids(late)).toContain("budget-pace-ok");
  });

  it("kehuu kun kaikki kuitit on tarkistettu", () => {
    const ctx = context({
      receipts: [
        receipt({ totalCents: 1000, date: "2026-08-01" }),
        receipt({ totalCents: 1000, date: "2026-08-02" }),
        receipt({ totalCents: 1000, date: "2026-08-03" }),
      ],
    });

    const insight = buildInsights(ctx).find((i) => i.id === "review-clean");
    expect(insight?.tone).toBe("good");
  });

  it("nostaa tarkistusjonon kun neljännes odottaa", () => {
    const ctx = context({
      receipts: [
        receipt({ totalCents: 1000, date: "2026-08-01", status: "needs_review" }),
        receipt({ totalCents: 1000, date: "2026-08-02", status: "needs_review" }),
        receipt({ totalCents: 1000, date: "2026-08-03" }),
        receipt({ totalCents: 1000, date: "2026-08-04" }),
      ],
    });

    const insight = buildInsights(ctx).find((i) => i.id === "review-backlog");
    expect(insight?.tone).toBe("watch");
    expect(insight?.detail).toContain("2 / 4");
  });

  it("järjestää seurattavat ensin", () => {
    const sorted = sortInsights([
      { id: "a", tone: "good", title: "", detail: "" },
      { id: "b", tone: "watch", title: "", detail: "" },
      { id: "c", tone: "neutral", title: "", detail: "" },
    ]);

    expect(sorted.map((i) => i.id)).toEqual(["b", "c", "a"]);
  });

  /** Jokainen havainto vie jonnekin missä asialle voi tehdä jotain. */
  it("antaa jokaiselle havainnolle kohteen", () => {
    const ctx = context({
      receipts: [
        receipt({ totalCents: 10000, date: "2026-07-05" }),
        receipt({ totalCents: 10000, date: "2026-07-12" }),
        receipt({ totalCents: 10000, date: "2026-07-20" }),
        receipt({ totalCents: 90000, date: "2026-08-04" }),
      ],
      budgets: [budget("food", 100000, "2026-08")],
    });

    for (const insight of buildInsights(ctx)) {
      expect(insight.href).toBeTruthy();
      expect(insight.detail.length).toBeGreaterThan(10);
    }
  });
});

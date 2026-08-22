import { describe, expect, it } from "vitest";
import {
  attention,
  budgetLines,
  budgetTone,
  compareHours,
  compareToPreviousMonth,
  evaluability,
  focusItems,
  hasChartHistory,
  receiptSplit,
  staffCostShare,
  type DashboardInput,
} from "../dashboard";
import type { Budget, ExpenseCategory, Receipt } from "../types";

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
    vatCents: 1000,
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
  return { id: `b${n}`, restaurantId: "rest-1", category, month, amountCents: cents };
}

function input(partial: Partial<DashboardInput> = {}): DashboardInput {
  return {
    receipts: [],
    budgets: [],
    shifts: [],
    users: [],
    clockEvents: [],
    absences: [],
    month: "2026-08",
    today: "2026-08-15",
    ...partial,
  };
}

// ---------------------------------------------------------------------------

describe("arvioitavuus", () => {
  /**
   * Tämä on koko moduulin syy olla olemassa. Tyhjä tietokanta ei ole
   * hyvä uutinen: se on tieto siitä ettei arviota voi tehdä.
   */
  it("ei väitä kaiken olevan kunnossa tyhjällä aineistolla", () => {
    expect(attention(input()).state).toBe("no-data");
  });

  it("ei arvioi kuukautta jossa ei ole kuitteja eikä budjetteja", () => {
    const ctx = input({
      receipts: [receipt({ totalCents: 5000, date: "2026-05-04" })],
    });

    // Kuitti on toukokuulta, tarkastellaan elokuuta.
    expect(evaluability(ctx).canJudge).toBe(false);
    expect(attention(ctx).state).toBe("no-data");
  });

  it("sanoo kaiken olevan kunnossa vasta kun jotain on tarkastettu", () => {
    const ctx = input({
      // ALV on oltava odotetun mukainen, muuten kuitti nostaa itse
      // hälytyksen eikä testi mittaa sitä mitä pitäisi. 5725 sis. 14,5 % = 725.
      receipts: [receipt({ totalCents: 5725, vatCents: 725, date: "2026-08-04" })],
    });

    expect(evaluability(ctx).canJudge).toBe(true);
    expect(attention(ctx).state).toBe("clear");
  });

  it("nostaa huomiot kun niitä on", () => {
    const ctx = input({
      receipts: [
        receipt({ totalCents: 5000, date: "2026-08-04", status: "needs_review", reviewReasons: ["vat_missing"], vatCents: null }),
      ],
    });

    const result = attention(ctx);
    expect(result.state).toBe("attention");
    expect(result.alerts.length).toBeGreaterThan(0);
  });

  it("kertoo mitkä tarkastukset aineisto mahdollisti", () => {
    const ctx = input({
      receipts: [
        receipt({ totalCents: 5000, date: "2026-07-04" }),
        receipt({ totalCents: 6000, date: "2026-08-04" }),
        receipt({ totalCents: 7000, date: "2026-08-05" }),
      ],
      budgets: [budget("food", 100000, "2026-08")],
    });

    const { performed } = evaluability(ctx);
    expect(performed).toContain("receipts");
    expect(performed).toContain("duplicates");
    expect(performed).toContain("budgets");
    expect(performed).toContain("trend");
  });
});

describe("vertailu", () => {
  /** Keksitty vertailuluku on pahempi kuin puuttuva: sen perusteella toimitaan. */
  it("ei anna prosenttia ilman vertailukuukautta", () => {
    const result = compareToPreviousMonth(
      [receipt({ totalCents: 50000, date: "2026-08-04" })],
      "2026-08",
    );

    expect(result.change).toBeNull();
    expect(result.baseMonth).toBeNull();
  });

  it("laskee muutoksen kun vertailukuukaudessa on aineistoa", () => {
    const result = compareToPreviousMonth(
      [
        receipt({ totalCents: 10000, date: "2026-07-04" }),
        receipt({ totalCents: 15000, date: "2026-08-04" }),
      ],
      "2026-08",
    );

    expect(result.baseMonth).toBe("2026-07");
    expect(result.change).toBeCloseTo(0.5);
  });

  it("ei vertaa tunteja nollaan", () => {
    expect(compareHours(100, 0)).toBeNull();
    expect(compareHours(100, null)).toBeNull();
    expect(compareHours(120, 100)).toBeCloseTo(0.2);
  });
});

describe("kuittien tila", () => {
  it("sanoo kun kuitteja ei ole", () => {
    expect(receiptSplit([], "2026-08").label).toBe("Ei vielä kuitteja");
  });

  it("erittelee tarkistetut ja odottavat", () => {
    const split = receiptSplit(
      [
        receipt({ totalCents: 1000, date: "2026-08-01" }),
        receipt({ totalCents: 1000, date: "2026-08-02" }),
        receipt({ totalCents: 1000, date: "2026-08-03", status: "needs_review" }),
      ],
      "2026-08",
    );

    expect(split.label).toBe("2 tarkistettu · 1 odottaa");
  });

  it("sanoo kun kaikki on tarkistettu", () => {
    const split = receiptSplit(
      [receipt({ totalCents: 1000, date: "2026-08-01" })],
      "2026-08",
    );

    expect(split.label).toBe("Kaikki tarkistettu");
  });
});

describe("henkilöstökulun osuus", () => {
  /** Nollalla jakaminen antaisi luvun joka näyttäisi tiedolta. */
  it("ei laske osuutta ilman kuluja", () => {
    expect(staffCostShare(50000, 0)).toBeNull();
  });

  it("ei laske osuutta kun tuntipalkkoja ei ole asetettu", () => {
    expect(staffCostShare(0, 100000)).toBeNull();
  });

  it("laskee osuuden kun molemmat ovat tiedossa", () => {
    expect(staffCostShare(20000, 100000)).toBeCloseTo(0.2);
  });
});

describe("budjettien tila", () => {
  it("porrastaa tilan käyttöasteen mukaan", () => {
    expect(budgetTone(0.5)).toBe("normal");
    expect(budgetTone(0.75)).toBe("warning");
    expect(budgetTone(0.95)).toBe("critical");
    expect(budgetTone(1.2)).toBe("over");
  });

  /** Väri yksin ei riitä: tila on luettava myös sanoina. */
  it("antaa jokaiselle riville tekstimuotoisen tilan", () => {
    const lines = budgetLines(
      [receipt({ totalCents: 90000, date: "2026-08-04" })],
      [budget("food", 100000, "2026-08")],
      "2026-08",
    );

    expect(lines).toHaveLength(1);
    expect(lines[0].percent).toBe(90);
    expect(lines[0].tone).toBe("critical");
    expect(lines[0].label).toBe("Kriittinen");
  });

  it("järjestää kireimmän ensin", () => {
    const lines = budgetLines(
      [
        receipt({ totalCents: 20000, date: "2026-08-04", category: "food" }),
        receipt({ totalCents: 9000, date: "2026-08-05", category: "cleaning" }),
      ],
      [budget("food", 100000, "2026-08"), budget("cleaning", 10000, "2026-08")],
      "2026-08",
    );

    expect(lines[0].category).toBe("cleaning");
  });
});

describe("kaavion historia", () => {
  /** Yhden pylvään kaavio ei ole kaavio. */
  it("vaatii kolme kuukautta", () => {
    const two = [
      receipt({ totalCents: 1000, date: "2026-07-01" }),
      receipt({ totalCents: 1000, date: "2026-08-01" }),
    ];
    expect(hasChartHistory(two, "2026-08")).toBe(false);

    expect(
      hasChartHistory([...two, receipt({ totalCents: 1000, date: "2026-06-01" })], "2026-08"),
    ).toBe(true);
  });

  it("ei laske tulevia kuukausia historiaksi", () => {
    const withFuture = [
      receipt({ totalCents: 1000, date: "2026-08-01" }),
      receipt({ totalCents: 1000, date: "2026-09-01" }),
      receipt({ totalCents: 1000, date: "2026-10-01" }),
    ];

    expect(hasChartHistory(withFuture, "2026-08")).toBe(false);
  });
});

describe("yhdistetty huomiolista", () => {
  /** Hyvä uutinen ei kuulu listaan jonka otsikko on "vaatii huomiota". */
  it("ottaa mukaan vain seurattavat havainnot", () => {
    const items = focusItems(input(), [
      { id: "hyva", tone: "good", title: "Hienoa", detail: "x", href: "/admin" },
      { id: "seuraa", tone: "watch", title: "Kulut nousivat", detail: "y", href: "/admin/kulut" },
      { id: "neutraali", tone: "neutral", title: "Tasan", detail: "z", href: "/admin" },
    ]);

    expect(items.map((i) => i.id)).toEqual(["seuraa"]);
  });

  /** Todettu puute on kiireellisempi kuin suunta. */
  it("järjestää hälytykset havaintojen edelle", () => {
    const ctx = input({
      receipts: [
        receipt({
          totalCents: 5000,
          date: "2026-08-04",
          status: "needs_review",
          reviewReasons: ["vat_missing"],
          vatCents: null,
        }),
      ],
    });

    const items = focusItems(ctx, [
      { id: "havainto", tone: "watch", title: "Suunta", detail: "x", href: "/admin/kulut" },
    ]);

    expect(items.length).toBeGreaterThan(1);
    expect(items[items.length - 1].id).toBe("havainto");
    expect(items[0].severity).not.toBe("info");
  });

  it("antaa jokaiselle kohteelle polun", () => {
    const items = focusItems(input(), [
      { id: "ilman", tone: "watch", title: "Ei polkua", detail: "x" },
    ]);

    expect(items[0].href).toBe("/admin/kulut");
  });
});

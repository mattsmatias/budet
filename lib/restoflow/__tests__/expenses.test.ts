import { describe, expect, it } from "vitest";
import {
  changeTone,
  filterReceipts,
  formatChange,
  formatMonth,
  monthlySeries,
  needsReview,
  nextMonth,
  periodTotals,
  previousMonth,
  relativeChange,
  reviewReasonCounts,
  searchReceipts,
  sortByDateDesc,
  totalsByCategory,
} from "../expenses";
import type { ExpenseCategory, Receipt, ReviewReason } from "../types";

let n = 0;
function receipt(
  partial: Partial<Receipt> & { totalCents: number; date: string },
): Receipt {
  n += 1;
  return {
    id: `r${n}`,
    restaurantId: "rest-1",
    supplierId: `s-${n}`,
    supplierName: `Toimittaja ${n}`,
    items: [],
    imageQuality: "good" as const,
    vatCents: null,
    category: "food" as ExpenseCategory,
    paymentMethod: "card",
    receiptNumber: null,
    note: null,
    status: "confirmed",
    reviewReasons: [],
        addedByUserId: "u1",
    addedAt: `${partial.date}T12:00:00.000Z`,
    hasImage: true,
    imagePath: null,
    categoryId: null,
    ...partial,
  };
}

describe("totalsByCategory", () => {
  it("summaa kategorioittain ja järjestää suurin ensin", () => {
    const totals = totalsByCategory([
      receipt({ date: "2026-08-01", totalCents: 1000, category: "food" }),
      receipt({ date: "2026-08-02", totalCents: 3000, category: "alcohol" }),
      receipt({ date: "2026-08-03", totalCents: 2000, category: "food" }),
    ]);

    expect(totals[0]).toMatchObject({ category: "food", totalCents: 3000, receiptCount: 2 });
    expect(totals[1]).toMatchObject({ category: "alcohol", totalCents: 3000 });
    expect(totals).toHaveLength(2);
  });

  it("laskee osuudet jotka summautuvat ykköseen", () => {
    const totals = totalsByCategory([
      receipt({ date: "2026-08-01", totalCents: 2500, category: "food" }),
      receipt({ date: "2026-08-02", totalCents: 7500, category: "alcohol" }),
    ]);
    expect(totals.reduce((s, t) => s + t.share, 0)).toBeCloseTo(1);
    expect(totals[0].share).toBeCloseTo(0.75);
  });

  it("ei tuota nollarivejä kategorioille joissa ei ole kuitteja", () => {
    const totals = totalsByCategory([
      receipt({ date: "2026-08-01", totalCents: 100, category: "cleaning" }),
    ]);
    expect(totals).toHaveLength(1);
  });

  it("kestää tyhjän listan jakamatta nollalla", () => {
    expect(totalsByCategory([])).toEqual([]);
  });
});

describe("periodTotals", () => {
  const receipts = [
    receipt({ date: "2026-08-01", totalCents: 1000, vatCents: 135 }),
    receipt({ date: "2026-08-31", totalCents: 2000, vatCents: 270, status: "needs_review", reviewReasons: ["vat_uncertain"] }),
    receipt({ date: "2026-07-15", totalCents: 5000, vatCents: 675 }),
  ];

  it("laskee vain valitun kuukauden", () => {
    const t = periodTotals(receipts, "2026-08");
    expect(t.totalCents).toBe(3000);
    expect(t.receiptCount).toBe(2);
    expect(t.vatCents).toBe(405);
    expect(t.needsReviewCount).toBe(1);
  });

  it("käsittelee puuttuvan ALV:n nollana summassa", () => {
    const t = periodTotals([receipt({ date: "2026-08-01", totalCents: 1000 })], "2026-08");
    expect(t.vatCents).toBe(0);
  });

  it("palauttaa nollat kuukaudelta jossa ei ole kuitteja", () => {
    expect(periodTotals(receipts, "2026-01").totalCents).toBe(0);
  });
});

describe("relativeChange", () => {
  it("laskee kasvun", () => {
    expect(relativeChange(10840, 10000)).toBeCloseTo(0.084);
  });

  it("laskee laskun", () => {
    expect(relativeChange(9580, 10000)).toBeCloseTo(-0.042);
  });

  it("ei keksi prosenttia nollasta kasvamiselle", () => {
    expect(relativeChange(5000, 0)).toBeNull();
    expect(formatChange(null)).toBe("ei vertailukohtaa");
    expect(changeTone(null)).toBe("none");
  });

  it("muotoilee etumerkin oikein", () => {
    expect(formatChange(0.084)).toBe("+8,4 %");
    expect(formatChange(-0.042)).toBe("−4,2 %");
  });

  it("tulkitsee erittäin pienen muutoksen tasaiseksi", () => {
    expect(changeTone(0.0002)).toBe("flat");
    expect(changeTone(0.05)).toBe("up");
    expect(changeTone(-0.05)).toBe("down");
  });
});

describe("kuukausiaritmetiikka", () => {
  it("siirtyy vuoden yli oikein", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
    expect(nextMonth("2026-12")).toBe("2027-01");
  });

  it("muotoilee kuukauden suomeksi", () => {
    expect(formatMonth("2026-08")).toBe("Elokuu 2026");
  });

  it("tuottaa sarjan vanhin ensin", () => {
    const series = monthlySeries([], "2026-08", 4);
    expect(series.map((s) => s.month)).toEqual([
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
  });
});

describe("tarkistettavat", () => {
  const receipts = [
    receipt({ date: "2026-08-01", totalCents: 100, status: "needs_review", reviewReasons: ["vat_missing"] }),
    receipt({ date: "2026-08-05", totalCents: 200, status: "needs_review", reviewReasons: ["vat_missing", "category_missing"] }),
    receipt({ date: "2026-08-03", totalCents: 300 }),
  ];

  it("poimii vain tarkistusta odottavat, uusin ensin", () => {
    const list = needsReview(receipts);
    expect(list).toHaveLength(2);
    expect(list[0].date).toBe("2026-08-05");
  });

  it("laskee syyt yleisyysjärjestyksessä", () => {
    const counts = reviewReasonCounts(receipts);
    expect(counts[0]).toEqual({ reason: "vat_missing" as ReviewReason, count: 2 });
    expect(counts[1]).toEqual({ reason: "category_missing" as ReviewReason, count: 1 });
  });
});

describe("searchReceipts", () => {
  const receipts = [
    receipt({ date: "2026-08-20", totalCents: 18690, supplierName: "Metro Tukku", receiptNumber: "A-1234" }),
    receipt({ date: "2026-08-19", totalCents: 31250, supplierName: "Kespro", note: "Viikonlopun tilaus" }),
  ];

  it("löytää toimittajan nimellä isoista ja pienistä kirjaimista riippumatta", () => {
    expect(searchReceipts(receipts, "metro")).toHaveLength(1);
    expect(searchReceipts(receipts, "KESPRO")).toHaveLength(1);
  });

  it("löytää kuittinumerolla ja muistiinpanolla", () => {
    expect(searchReceipts(receipts, "A-1234")[0].supplierName).toBe("Metro Tukku");
    expect(searchReceipts(receipts, "viikonlopun")[0].supplierName).toBe("Kespro");
  });

  it("löytää summalla pilkulla kirjoitettuna", () => {
    expect(searchReceipts(receipts, "186,90")).toHaveLength(1);
    expect(searchReceipts(receipts, "312.50")).toHaveLength(1);
  });

  it("palauttaa kaiken tyhjällä haulla", () => {
    expect(searchReceipts(receipts, "   ")).toHaveLength(2);
  });

  it("palauttaa tyhjän kun mikään ei täsmää", () => {
    expect(searchReceipts(receipts, "xyzzy")).toHaveLength(0);
  });
});

describe("filterReceipts", () => {
  const receipts = [
    receipt({ date: "2026-08-20", totalCents: 100, category: "food" }),
    receipt({ date: "2026-08-19", totalCents: 200, category: "kitchen_supplies", status: "needs_review", reviewReasons: ["vat_missing"] }),
  ];

  it("suodattaa kategorialla", () => {
    expect(filterReceipts(receipts, "food")).toHaveLength(1);
  });

  it("suodattaa tarkistettavat", () => {
    expect(filterReceipts(receipts, "needs_review")).toHaveLength(1);
  });

  it("palauttaa kaikki all-suodattimella", () => {
    expect(filterReceipts(receipts, "all")).toHaveLength(2);
  });
});

describe("sortByDateDesc", () => {
  it("järjestää uusin ensin eikä muuta alkuperäistä", () => {
    const input = [
      receipt({ date: "2026-08-01", totalCents: 100 }),
      receipt({ date: "2026-08-20", totalCents: 200 }),
    ];
    const sorted = sortByDateDesc(input);
    expect(sorted[0].date).toBe("2026-08-20");
    expect(input[0].date).toBe("2026-08-01");
  });
});

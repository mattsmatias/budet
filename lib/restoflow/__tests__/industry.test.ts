import { describe, expect, it } from "vitest";
import type { ExpenseCategory, Receipt, ReceiptItem } from "../types";
import type { DailySales } from "../sales";
import {
  breakEven,
  keyRatios,
  netCostsByCategory,
  priceChanges,
  weekdayOf,
  weekdayPattern,
} from "../industry";

const TODAY = "2026-09-22";

function sale(date: string, netCents: number, transactions: number | null = null): DailySales {
  return {
    date,
    netCents,
    targetCents: null,
    note: null,
    grossCents: null,
    vatCents: null,
    transactions,
    source: "manual",
    posGrossCents: null,
    posVatCents: null,
  };
}

let seq = 0;
function receipt(
  date: string,
  totalCents: number,
  category: ExpenseCategory,
  opts: { vatCents?: number | null; items?: Partial<ReceiptItem>[]; supplierId?: string } = {},
): Receipt {
  seq += 1;
  return {
    id: `r-${seq}`,
    restaurantId: "rest-1",
    date,
    totalCents,
    supplierId: opts.supplierId ?? "s-1",
    supplierName: "Tukku",
    vatCents: opts.vatCents ?? null,
    category,
    paymentMethod: "card",
    receiptNumber: null,
    note: null,
    status: "confirmed",
    reviewReasons: [],
    items: (opts.items ?? []).map((item, i) => ({
      id: `i-${seq}-${i}`,
      lineNumber: i + 1,
      description: "Tuote",
      quantity: null,
      unit: null,
      totalCents: 0,
      category,
      vatRate: null,
      vatCents: null,
      productGroup: null,
      ...item,
    })),
    addedByUserId: "u1",
    addedAt: `${date}T10:00:00.000Z`,
    hasImage: false,
    imagePath: null,
    pages: [],
    categoryId: null,
    imageQuality: "good",
  } as Receipt;
}

describe("verottomat kulut", () => {
  it("vähentää ALV:n kuitilta ja riviltä", () => {
    const costs = netCostsByCategory([
      receipt("2026-09-01", 12550, "food", { vatCents: 2550 }),
      receipt("2026-09-02", 0, "food", {
        items: [
          { totalCents: 11400, vatRate: 0.14, category: "food" },
          { totalCents: 1255, vatCents: 255, category: "cleaning" },
        ],
      }),
    ]);
    expect(costs.get("food")).toBe(10000 + 10000);
    expect(costs.get("cleaning")).toBe(1000);
  });
});

describe("tunnusluvut", () => {
  it("laskee ravintolan raaka-aineprosentin verottomasta myynnistä", () => {
    const result = keyRatios({
      type: "restaurant",
      receipts: [
        receipt("2026-08-05", 30000, "food"),
        receipt("2026-08-10", 25000, "staff"),
      ],
      sales: [sale("2026-08-05", 60000), sale("2026-08-06", 40000)],
      month: "2026-08",
      today: TODAY,
    });
    const goods = result.ratios.find((r) => r.key === "goods")!;
    const prime = result.ratios.find((r) => r.key === "prime")!;
    expect(result.partial).toBe(false);
    expect(goods.share).toBeCloseTo(0.3);
    expect(goods.position).toBe("within");
    expect(prime.share).toBeCloseTo(0.55);
  });

  it("laskee kahvilan pakkaukset tuotekatteeseen", () => {
    const result = keyRatios({
      type: "cafe",
      receipts: [
        receipt("2026-08-05", 20000, "food"),
        receipt("2026-08-06", 10000, "packaging"),
      ],
      sales: [sale("2026-08-05", 75000)],
      month: "2026-08",
      today: TODAY,
    });
    expect(result.ratios[0].key).toBe("goods");
    expect(result.ratios[0].share).toBeCloseTo(0.4);
    expect(result.ratios[0].position).toBe("above");
  });

  it("antaa parturille tuotteet, henkilöstön ja vuokran ilman nyrkkisääntöä", () => {
    const result = keyRatios({
      type: "barber",
      receipts: [receipt("2026-08-01", 120000, "rent")],
      sales: [sale("2026-08-03", 600000)],
      month: "2026-08",
      today: TODAY,
    });
    expect(result.ratios.map((r) => r.key)).toEqual(["products", "staff", "rent"]);
    expect(result.ratios.every((r) => r.rule === null && r.position === null)).toBe(true);
    expect(result.ratios[2].share).toBeCloseTo(0.2);
  });

  it("ei laske osuutta ilman myyntiä", () => {
    const result = keyRatios({
      type: "restaurant",
      receipts: [receipt("2026-08-05", 30000, "food")],
      sales: [],
      month: "2026-08",
      today: TODAY,
    });
    expect(result.ratios[0].share).toBeNull();
  });

  it("merkitsee kuluvan kuukauden keskeneräiseksi", () => {
    const result = keyRatios({
      type: "restaurant",
      receipts: [],
      sales: [sale("2026-09-20", 1000), sale("2026-09-25", 999999)],
      month: "2026-09",
      today: TODAY,
    });
    expect(result.partial).toBe(true);
    // Tulevaa päivää ei lasketa mukaan.
    expect(result.netSalesCents).toBe(1000);
  });
});

describe("viikonpäivät", () => {
  it("numeroi maanantain nollaksi", () => {
    expect(weekdayOf("2026-09-21")).toBe(0);
    expect(weekdayOf("2026-09-27")).toBe(6);
  });

  it("löytää parhaan ja hiljaisimman päivän ja keskiostoksen", () => {
    const result = weekdayPattern(
      [
        sale("2026-09-14", 50000, 50),
        sale("2026-09-21", 70000, 70),
        sale("2026-09-19", 150000, 100),
        sale("2026-09-12", 130000, 100),
      ],
      TODAY,
    );
    expect(result.best).toBe(5); // lauantai
    expect(result.worst).toBe(0); // maanantai
    expect(result.averageTicketCents).toBe(Math.round(400000 / 320));
    expect(result.weekdays[5].averageTransactions).toBe(100);
  });

  it("ei nimeä parasta päivää yhdestä havainnosta", () => {
    const result = weekdayPattern(
      [sale("2026-09-14", 50000), sale("2026-09-19", 150000)],
      TODAY,
    );
    expect(result.best).toBeNull();
    expect(result.averageTicketCents).toBeNull();
  });
});

describe("ostohintojen nousut", () => {
  it("löytää saman tuotteen kallistumisen", () => {
    const result = priceChanges(
      [
        receipt("2026-07-01", 0, "food", {
          items: [{ description: "Maito 1 l", quantity: 10, totalCents: 1200 }],
        }),
        receipt("2026-09-01", 0, "food", {
          items: [{ description: "maito  1 L", quantity: 10, totalCents: 1500 }],
        }),
      ],
      TODAY,
    );
    expect(result.compared).toBe(1);
    expect(result.increases).toHaveLength(1);
    expect(result.increases[0].previousUnitCents).toBe(120);
    expect(result.increases[0].latestUnitCents).toBe(150);
    expect(result.increases[0].change).toBeCloseTo(0.25);
  });

  it("ei vertaa eri toimittajien tuotteita eikä pieniä muutoksia", () => {
    const result = priceChanges(
      [
        receipt("2026-07-01", 0, "food", {
          items: [{ description: "Kahvi", quantity: 1, totalCents: 1000 }],
        }),
        receipt("2026-08-01", 0, "food", {
          supplierId: "s-2",
          items: [{ description: "Kahvi", quantity: 1, totalCents: 2000 }],
        }),
        receipt("2026-09-01", 0, "food", {
          items: [{ description: "Kahvi", quantity: 1, totalCents: 1020 }],
        }),
      ],
      TODAY,
    );
    expect(result.compared).toBe(1);
    expect(result.increases).toHaveLength(0);
  });

  it("ohittaa rivin jossa on yksikkö mutta ei määrää", () => {
    const result = priceChanges(
      [
        receipt("2026-07-01", 0, "food", {
          items: [{ description: "Jauheliha", unit: "kg", totalCents: 1000 }],
        }),
        receipt("2026-09-01", 0, "food", {
          items: [{ description: "Jauheliha", unit: "kg", totalCents: 3000 }],
        }),
      ],
      TODAY,
    );
    expect(result.compared).toBe(0);
  });
});

describe("nollaraja", () => {
  it("laskee päivämyynnin ja asiakasmäärän kokonaisista kuukausista", () => {
    const result = breakEven({
      receipts: [
        receipt("2026-08-01", 300000, "rent"),
        // Kuluva kuukausi ei ole mukana.
        receipt("2026-09-01", 999999, "rent"),
      ],
      sales: [
        ...Array.from({ length: 20 }, (_, i) =>
          sale(`2026-08-${String(i + 1).padStart(2, "0")}`, 20000, 5),
        ),
        sale("2026-09-02", 1, 1),
      ],
      today: TODAY,
    });
    expect(result).not.toBeNull();
    expect(result!.months).toEqual(["2026-08"]);
    expect(result!.requiredDailyNetCents).toBe(15000);
    expect(result!.actualDailyNetCents).toBe(20000);
    expect(result!.averageTicketCents).toBe(4000);
    expect(result!.requiredCustomersPerDay).toBeCloseTo(3.75);
    expect(result!.actualCustomersPerDay).toBe(5);
  });

  it("palauttaa nullin ilman kokonaista kuukautta", () => {
    expect(breakEven({ receipts: [], sales: [], today: TODAY })).toBeNull();
  });
});

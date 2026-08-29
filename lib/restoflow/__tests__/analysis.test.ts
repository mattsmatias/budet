import { describe, expect, it } from "vitest";
import {
  checkVat,
  dominantCategory,
  inferVatRate,
  isMixedReceipt,
  itemsSumMatches,
  rateMatchesCategory,
} from "../vat";
import { quantityOf, reviewReasonsForSave, vatRateOf } from "../receipt-ai";
import { daysApart, duplicateIds, findDuplicates } from "../duplicates";
import {
  supplierTrends,
  totalsBySupplier,
  suggestedCategory,
} from "../suppliers";
import { budgetProgress, budgetStatus, spendByCategory } from "../budgets";
import {
  compareShift,
  formatVariance,
  shiftDurationMinutes,
  timeToMinutes,
  variancePatterns,
} from "../shifts";
import {
  moreNavFor,
  primaryNavFor,
  adminNavFor,
  adminNavSectionsFor,
  can,
  canAddReceipts,
  capabilityForPath,
  landingFor,
  seesPayRates,
} from "../permissions";
import { buildAlerts, type AlertContext } from "../alerts";
import {
  MockReceiptExtractor,
  emptyResult,
  reviewReasonsFor,
} from "../receipt-ai";
import type {
  Budget,
  ClockEvent,
  ExpenseCategory,
  Receipt,
  ReceiptItem,
  Shift,
  Supplier,
  User,
} from "../types";

// ---------------------------------------------------------------------------
// Apurit
// ---------------------------------------------------------------------------

let n = 0;
function item(
  partial: Partial<ReceiptItem> & {
    totalCents: number;
    category: ExpenseCategory;
  },
): ReceiptItem {
  n += 1;
  return {
    id: `i${n}`,
    lineNumber: n,
    description: `Rivi ${n}`,
    quantity: null,
    unit: null,
    vatRate: null,
    vatCents: null,
    productGroup: null,
    ...partial,
  };
}

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
    pages: [],
    categoryId: null,
    imageQuality: "good",
    ...partial,
  };
}

// ---------------------------------------------------------------------------

describe("ALV-tarkistus", () => {
  it("päättelee kannan summista", () => {
    // 100,00 netto + 14,00 ALV = 114,00
    expect(inferVatRate(11400, 1400)).toBeCloseTo(0.14);
  });

  it("ei jaa nollalla kun ALV on koko summa", () => {
    expect(inferVatRate(1000, 1000)).toBeNull();
    expect(inferVatRate(1000, 1200)).toBeNull();
  });

  it("hyväksyy kannan pienellä pyöristysheitolla", () => {
    expect(rateMatchesCategory(0.1402, "food")).toBe(true);
    expect(rateMatchesCategory(0.2, "food")).toBe(false);
  });

  it("merkitsee ristiriidan kun kanta ei vastaa kategoriaa", () => {
    // Alkoholi 14 %:n kannalla — pitäisi olla 25,5 %
    const check = checkVat(11400, 1400, "alcohol");
    expect(check.matches).toBe(false);
    expect(check.explanation).toContain("14,0 %");
  });

  it("hyväksyy oikean kannan", () => {
    expect(checkVat(12550, 2550, "alcohol").matches).toBe(true);
  });

  it("kertoo kun ALV puuttuu kokonaan", () => {
    const check = checkVat(10000, null, "food");
    expect(check.matches).toBe(false);
    expect(check.explanation).toContain("ei tunnistettu");
  });

  it("ei koskaan palauta korjattua arvoa", () => {
    // Tarkistus kertoo ristiriidasta mutta ei ehdota uutta summaa —
    // hiljainen korjaus tuottaisi väärän kirjauksen.
    const check = checkVat(11400, 1400, "alcohol");
    expect(Object.keys(check)).not.toContain("correctedVatCents");
  });
});

describe("poiminnan lukujen rajaus", () => {
  it("hyväksyy kannan murtolukuna", () => {
    expect(vatRateOf(0.14)).toBe(0.14);
    expect(vatRateOf(0.255)).toBe(0.255);
    expect(vatRateOf(0)).toBe(0);
  });

  // Malli lukee kuitista "ALV 14 %" ja palauttaa 14. Sarakkeeseen
  // numeric(5,4) mahtuu 9,9999, joten se kaatoi tallennuksen.
  it("tulkitsee prosenttiluvun murtoluvuksi", () => {
    expect(vatRateOf(14)).toBe(0.14);
    expect(vatRateOf(25.5)).toBe(0.255);
  });

  it("pudottaa mahdottoman kannan tyhjäksi", () => {
    expect(vatRateOf(101)).toBeNull();
    expect(vatRateOf(1)).toBeNull();
    expect(vatRateOf(-1)).toBeNull();
    expect(vatRateOf(Number.NaN)).toBeNull();
    expect(vatRateOf(null)).toBeNull();
  });

  it("rajaa määrän sarakkeen mittoihin", () => {
    expect(quantityOf(4)).toBe(4);
    expect(quantityOf(2.5678)).toBe(2.568);
    expect(quantityOf(-1)).toBeNull();
    expect(quantityOf(1e12)).toBeNull();
    expect(quantityOf(null)).toBeNull();
  });
});

describe("tallennettavan kuitin tarkistussyyt", () => {
  const gigantti = {
    supplier: "Gigantti Oy",
    date: "2025-06-02",
    totalCents: 25900,
    vatCents: 4247,
    category: "other" as const,
    payment: "card" as const,
    receiptNumber: "9236564502",
  };

  const rivit = [
    {
      description: "Ecoflow River 2",
      quantity: 1,
      unit: null,
      totalCents: 20900,
      category: "other" as const,
      vatRate: 0.255,
      productGroup: null,
    },
    {
      description: "SONY PSN (FIN) 50 EUR",
      quantity: 1,
      unit: null,
      totalCents: 5000,
      category: "other" as const,
      vatRate: 0,
      productGroup: null,
    },
  ];

  /*
   * Tämä on se testi jota ei ollut.
   *
   * ALV-tarkistus osasi lukea rivien kannat, mutta tallennuspolku
   * rakensi tarkistukselle syötteen jossa rivit olivat tyhjä lista.
   * Oikea sekakuitti merkittiin virheelliseksi joka kerta, eikä
   * yksikään testi huomannut sitä — koska päättely asui
   * palvelintoiminnossa jota testi ei voinut kutsua.
   */
  it("ei merkitse sekakuittia virheelliseksi", () => {
    const reasons = reviewReasonsForSave({ ...gigantti, items: rivit });
    expect(reasons).not.toContain("vat_mismatch");
    expect(reasons).toEqual([]);
  });

  it("merkitsee yhä kun ALV ei täsmää riveihin", () => {
    const reasons = reviewReasonsForSave({
      ...gigantti,
      vatCents: 5300,
      items: rivit,
    });
    expect(reasons).toContain("vat_mismatch");
  });

  it("merkitsee kun rivit eivät summaudu", () => {
    const reasons = reviewReasonsForSave({
      ...gigantti,
      items: [rivit[0]],
    });
    expect(reasons).toContain("items_dont_sum");
  });

  it("merkitsee puuttuvan ALV:n", () => {
    const reasons = reviewReasonsForSave({
      ...gigantti,
      vatCents: null,
      items: [],
    });
    expect(reasons).toContain("vat_missing");
  });
});

describe("sekakuitin ALV", () => {
  // Oikea Gigantin kuitti: laite 209,00 e kannalla 25,5 % ja lahjakortti
  // 50,00 e kannalla 0 %. Yhteensä 259,00 e, ALV 42,47 e.
  //
  // Koko kuitin keskiarvokanta on 19,6 %, joka ei ole mikään verokanta.
  // Sitä verrattiin kategorian odotukseen, joten tasan oikein luettu
  // kuitti merkittiin virheelliseksi.
  const gigantti = [
    { totalCents: 20900, vatRate: 0.255 },
    { totalCents: 5000, vatRate: 0 },
  ];

  it("hyväksyy kahden verokannan kuitin", () => {
    const check = checkVat(25900, 4247, "other", gigantti);
    expect(check.matches).toBe(true);
    expect(check.explanation).toBeNull();
    expect(check.rates).toEqual([0.255, 0]);
  });

  it("merkitsee kun rivit eivät tue merkittyä ALV:tä", () => {
    const check = checkVat(25900, 5300, "other", gigantti);
    expect(check.matches).toBe(false);
    expect(check.explanation).toContain("42.47");
  });

  // Rivit jotka eivät summaudu loppusummaan eivät kuvaa koko kuittia,
  // joten ne eivät voi todistaa siitä mitään suuntaan tai toiseen.
  it("ei luota rivehin jotka eivät summaudu", () => {
    const check = checkVat(25900, 4247, "other", [
      { totalCents: 20900, vatRate: 0.255 },
    ]);
    expect(check.rates).toEqual([]);
  });

  it("ei luota riveihin joilta puuttuu kanta", () => {
    const check = checkVat(25900, 4247, "other", [
      { totalCents: 20900, vatRate: 0.255 },
      { totalCents: 5000, vatRate: null },
    ]);
    expect(check.rates).toEqual([]);
  });

  // Ilman rivejä vanha tarkistus on yhä voimassa.
  it("vertaa yhä kategoriaan kun rivejä ei ole", () => {
    expect(checkVat(11400, 1400, "food").matches).toBe(true);
    expect(checkVat(11400, 1400, "alcohol").matches).toBe(false);
  });
});

describe("rivien summautuminen", () => {
  it("hyväksyy täsmäävät rivit", () => {
    const r = receipt({
      date: "2026-08-01",
      totalCents: 3000,
      items: [
        item({ totalCents: 1000, category: "food" }),
        item({ totalCents: 2000, category: "food" }),
      ],
    });
    expect(itemsSumMatches(r)).toBe(true);
  });

  it("merkitsee epätäsmäävät rivit", () => {
    const r = receipt({
      date: "2026-08-01",
      totalCents: 3000,
      items: [item({ totalCents: 1000, category: "food" })],
    });
    expect(itemsSumMatches(r)).toBe(false);
  });

  it("hyväksyy kuitin ilman rivejä", () => {
    expect(
      itemsSumMatches(receipt({ date: "2026-08-01", totalCents: 3000 })),
    ).toBe(true);
  });
});

describe("sekakuitti", () => {
  const items = [
    item({ totalCents: 14200, category: "food" }),
    item({ totalCents: 8650, category: "soft_drinks" }),
    item({ totalCents: 8400, category: "cleaning" }),
  ];

  it("tunnistaa useamman kategorian", () => {
    expect(isMixedReceipt(items)).toBe(true);
    expect(isMixedReceipt([items[0]])).toBe(false);
  });

  it("valitsee dominoivaksi sen johon menee eniten rahaa", () => {
    expect(dominantCategory(items, "other")).toBe("food");
  });

  it("käyttää varakategoriaa kun rivejä ei ole", () => {
    expect(dominantCategory([], "packaging")).toBe("packaging");
  });
});

describe("kaksoiskappaleet", () => {
  const base = {
    date: "2026-08-18",
    totalCents: 8720,
    supplierId: "s-kcity",
    supplierName: "K-Citymarket",
  };

  it("löytää saman toimittajan saman summan samana päivänä", () => {
    const groups = findDuplicates([receipt(base), receipt(base)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].receipts).toHaveLength(2);
  });

  it("sallii sentin heiton", () => {
    const groups = findDuplicates([
      receipt(base),
      receipt({ ...base, totalCents: 8721 }),
    ]);
    expect(groups).toHaveLength(1);
  });

  it("ei epäile eri toimittajaa", () => {
    expect(
      findDuplicates([
        receipt(base),
        receipt({ ...base, supplierId: "s-muu" }),
      ]),
    ).toHaveLength(0);
  });

  it("ei epäile eri summaa", () => {
    expect(
      findDuplicates([receipt(base), receipt({ ...base, totalCents: 9999 })]),
    ).toHaveLength(0);
  });

  it("hyväksyy peräkkäiset päivät mutta ei kaukaisempia", () => {
    expect(
      findDuplicates([receipt(base), receipt({ ...base, date: "2026-08-19" })]),
    ).toHaveLength(1);
    expect(
      findDuplicates([receipt(base), receipt({ ...base, date: "2026-08-25" })]),
    ).toHaveLength(0);
  });

  it("kumoaa epäilyn kun kuittinumerot eroavat", () => {
    const groups = findDuplicates([
      receipt({ ...base, receiptNumber: "A-1" }),
      receipt({ ...base, receiptNumber: "A-2" }),
    ]);
    expect(groups).toHaveLength(0);
  });

  it("ei ehdota poistoa vaan palauttaa molemmat", () => {
    const groups = findDuplicates([receipt(base), receipt(base)]);
    // Ryhmä sisältää molemmat — päätös jää käyttäjälle.
    expect(groups[0].receipts.length).toBe(2);
  });

  it("laskee päivien etäisyyden", () => {
    expect(daysApart("2026-08-18", "2026-08-20")).toBe(2);
    expect(daysApart("2026-08-18", "ei-pvm")).toBe(Number.POSITIVE_INFINITY);
  });

  it("kokoaa tunnisteet korostusta varten", () => {
    const ids = duplicateIds([
      receipt(base),
      receipt(base),
      receipt({ ...base, supplierId: "s-x" }),
    ]);
    expect(ids.size).toBe(2);
  });
});

describe("toimittajat", () => {
  const receipts = [
    receipt({
      date: "2026-08-01",
      totalCents: 10000,
      supplierId: "s-a",
      supplierName: "A",
    }),
    receipt({
      date: "2026-08-02",
      totalCents: 30000,
      supplierId: "s-a",
      supplierName: "A",
    }),
    receipt({
      date: "2026-08-03",
      totalCents: 20000,
      supplierId: "s-b",
      supplierName: "B",
    }),
    receipt({
      date: "2026-07-05",
      totalCents: 20000,
      supplierId: "s-a",
      supplierName: "A",
    }),
  ];

  it("summaa toimittajittain, suurin ensin", () => {
    const totals = totalsBySupplier(
      receipts.filter((r) => r.date.startsWith("2026-08")),
    );
    expect(totals[0].supplierId).toBe("s-a");
    expect(totals[0].totalCents).toBe(40000);
    expect(totals[0].receiptCount).toBe(2);
    expect(totals[0].averageCents).toBe(20000);
  });

  it("jakaa sekakuitin rivikategorioihin", () => {
    const mixed = receipt({
      date: "2026-08-01",
      totalCents: 3000,
      supplierId: "s-mix",
      items: [
        item({ totalCents: 1000, category: "food" }),
        item({ totalCents: 2000, category: "cleaning" }),
      ],
    });
    const totals = totalsBySupplier([mixed]);
    expect(totals[0].categories).toEqual([
      { category: "cleaning", cents: 2000 },
      { category: "food", cents: 1000 },
    ]);
  });

  it("laskee muutoksen edelliseen kuukauteen", () => {
    const trends = supplierTrends(receipts, "2026-08");
    const a = trends.find((t) => t.supplierId === "s-a")!;
    expect(a.previousCents).toBe(20000);
    expect(a.currentCents).toBe(40000);
    expect(a.change).toBeCloseTo(1);
  });

  it("ei keksi muutosprosenttia uudelle toimittajalle", () => {
    const trends = supplierTrends(receipts, "2026-08");
    expect(trends.find((t) => t.supplierId === "s-b")!.change).toBeNull();
  });

  it("ehdottaa kategoriaa vasta toistuvan korjauksen jälkeen", () => {
    const supplier: Supplier = {
      id: "s-1",
      restaurantId: "rest-1",
      name: "Lyreco",
      defaultCategory: "packaging",
      categoryOverrides: [{ from: "other", to: "kitchen_supplies", count: 4 }],
      merchantId: null,
      merchantConfidence: null,
      merchantConfirmed: false,
    };
    expect(suggestedCategory(supplier, "other")?.category).toBe(
      "kitchen_supplies",
    );
    expect(suggestedCategory(supplier, "food")).toBeNull();

    const once: Supplier = {
      ...supplier,
      categoryOverrides: [{ from: "other", to: "cleaning", count: 1 }],
    };
    expect(suggestedCategory(once, "other")).toBeNull();
  });
});

describe("budjetit", () => {
  const budgets: Budget[] = [
    {
      id: "b1",
      restaurantId: "rest-1",
      category: "food",
      month: null,
      amountCents: 100000,
    },
    {
      id: "b2",
      restaurantId: "rest-1",
      category: "cleaning",
      month: null,
      amountCents: 10000,
    },
  ];

  it("jakaa sekakuitin useaan budjettiin", () => {
    const spend = spendByCategory([
      receipt({
        date: "2026-08-01",
        totalCents: 3000,
        items: [
          item({ totalCents: 1000, category: "food" }),
          item({ totalCents: 2000, category: "cleaning" }),
        ],
      }),
    ]);
    expect(spend.get("food")).toBe(1000);
    expect(spend.get("cleaning")).toBe(2000);
  });

  it("luokittelee tilan kynnysten mukaan", () => {
    expect(budgetStatus(0.5)).toBe("ok");
    expect(budgetStatus(0.8)).toBe("warning");
    expect(budgetStatus(0.95)).toBe("warning");
    expect(budgetStatus(1.01)).toBe("exceeded");
    expect(budgetStatus(null)).toBe("none");
  });

  it("nostaa ylitykset ja varoitukset listan kärkeen", () => {
    const progress = budgetProgress(
      [
        receipt({
          date: "2026-08-01",
          totalCents: 12000,
          category: "cleaning",
        }),
        receipt({ date: "2026-08-02", totalCents: 10000, category: "food" }),
      ],
      budgets,
      "2026-08",
    );
    expect(progress[0].category).toBe("cleaning");
    expect(progress[0].status).toBe("exceeded");
  });

  it("näyttää budjetoimattoman kulun eikä piilota sitä", () => {
    const progress = budgetProgress(
      [
        receipt({
          date: "2026-08-01",
          totalCents: 5000,
          category: "transport",
        }),
      ],
      budgets,
      "2026-08",
    );
    const transport = progress.find((p) => p.category === "transport")!;
    expect(transport.budgetCents).toBeNull();
    expect(transport.spentCents).toBe(5000);
    expect(transport.status).toBe("none");
  });
});

describe("työvuoro vs. toteutunut", () => {
  const users: User[] = [
    {
      id: "u1",
      restaurantId: "rest-1",
      name: "Ali",
      role: "employee",
      position: "waiter",
      hourlyRateCents: 1500,
      initials: "A",
      active: true,
    },
  ];

  const shift: Shift = {
    id: "sh1",
    restaurantId: "rest-1",
    userId: "u1",
    date: "2026-08-20",
    startTime: "14:00",
    endTime: "22:00",
    location: "Sali",
    status: "accepted",
    breakMinutes: 0,
    note: null,
    publishedAt: "2026-08-01T00:00:00.000Z",
    createdAt: "2026-08-01T00:00:00.000Z",
    cancelledAt: null,
  };

  const ZONE = "Europe/Helsinki";

  /*
   * Aikaleimat ovat UTC:tä, vuoron kellonajat paikallisia.
   *
   * Vuoro 14:00-22:00 Helsingissä on 11:00-19:00 UTC. Aiemmin tässä luki
   * 14:04Z ja 22:17Z, mikä Helsingissä tarkoittaa 17:04 ja seuraavan
   * päivän 01:17. Testi meni läpi vain koska päivä poimittiin
   * merkkijonosta UTC:nä.
   */
  const events: ClockEvent[] = [
    { id: "e1", userId: "u1", type: "in", at: "2026-08-20T11:04:00.000Z" },
    { id: "e2", userId: "u1", type: "out", at: "2026-08-20T19:17:00.000Z" },
  ];

  it("laskee vuoron keston", () => {
    expect(shiftDurationMinutes(shift)).toBe(480);
    expect(timeToMinutes("14:30")).toBe(870);
  });

  it("käsittelee yön yli menevän vuoron", () => {
    expect(
      shiftDurationMinutes({ ...shift, startTime: "22:00", endTime: "02:00" }),
    ).toBe(240);
  });

  it("laskee eron suunnitellun ja toteutuneen välillä", () => {
    const c = compareShift(
      shift,
      users,
      events,
      "2026-08-21T00:00:00.000Z",
      ZONE,
    );
    expect(c.plannedMs).toBe(480 * 60000);
    expect(c.actualMs).toBe(493 * 60000);
    expect(c.varianceMs).toBe(13 * 60000);
  });

  it("laskee kustannuseron tuntipalkasta", () => {
    const c = compareShift(
      shift,
      users,
      events,
      "2026-08-21T00:00:00.000Z",
      ZONE,
    );
    expect(c.plannedCostCents).toBe(12000); // 8 h × 15 €
    expect(c.actualCostCents).toBeGreaterThan(c.plannedCostCents);
  });

  it("ei arvaa toteutunutta kun leimauksia ei ole", () => {
    const c = compareShift(shift, users, [], "2026-08-21T00:00:00.000Z", ZONE);
    expect(c.actualMs).toBe(0);
    expect(c.actualStart).toBeNull();
  });

  it("muotoilee eron luettavasti", () => {
    expect(formatVariance(13 * 60000)).toBe("+13 min");
    expect(formatVariance(-22 * 60000)).toBe("−22 min");
    expect(formatVariance(0)).toBe("tasan");
    expect(formatVariance(90 * 60000)).toBe("+1 h 30 min");
  });

  it("tunnistaa toistuvan ylityksen mutta ohittaa tekemättömät vuorot", () => {
    const day2 = { ...shift, id: "sh2", date: "2026-08-19" };
    const day3 = { ...shift, id: "sh3", date: "2026-08-18" };
    const more: ClockEvent[] = [
      ...events,
      { id: "e3", userId: "u1", type: "in", at: "2026-08-19T14:05:00.000Z" },
      { id: "e4", userId: "u1", type: "out", at: "2026-08-19T22:20:00.000Z" },
    ];

    const patterns = variancePatterns(
      [
        compareShift(shift, users, more, "2026-08-21T00:00:00.000Z", ZONE),
        compareShift(day2, users, more, "2026-08-21T00:00:00.000Z", ZONE),
        compareShift(day3, users, more, "2026-08-21T00:00:00.000Z", ZONE),
      ],
      2,
    );

    expect(patterns).toHaveLength(1);
    // Vain kaksi vuoroa toteutui — kolmas ei kerro kuviosta.
    expect(patterns[0].shiftCount).toBe(2);
    expect(patterns[0].averageVarianceMs).toBeGreaterThan(0);
  });
});

describe("oikeudet", () => {
  it("antaa omistajalle täydet oikeudet", () => {
    expect(can("owner", "budgets.edit")).toBe(true);
    expect(can("owner", "staff.manage")).toBe(true);
  });

  it("estää manageria muokkaamasta budjetteja", () => {
    expect(can("manager", "budgets.view")).toBe(true);
    expect(can("manager", "budgets.edit")).toBe(false);
  });

  it("rajaa työntekijän omiin tietoihinsa", () => {
    expect(can("employee", "receipts.view")).toBe(false);
    expect(can("employee", "expenses.view")).toBe(false);
    expect(can("employee", "time.track.own")).toBe(true);
    expect(can("employee", "shifts.view.own")).toBe(true);
  });

  /**
   * Kuitti on ravintolan kirjanpitoaineistoa, ei työntekijän ilmoitus:
   * kulukirjauksen saa synnyttää vain se joka vastaa sen oikeellisuudesta.
   * Kirjanpitäjä lukee kuitit muttei luo niitä.
   */
  it("antaa kuitin lisäyksen vain ravintolan esihenkilölle", () => {
    expect(canAddReceipts("owner")).toBe(true);
    expect(canAddReceipts("manager")).toBe(true);
    expect(canAddReceipts("employee")).toBe(false);
    expect(canAddReceipts("accountant")).toBe(false);
    expect(can("accountant", "receipts.view")).toBe(true);
  });

  it("antaa kirjanpitäjälle talouden muttei tuntipalkkoja", () => {
    expect(can("accountant", "expenses.view")).toBe(true);
    expect(can("accountant", "reports.export")).toBe(true);
    expect(can("accountant", "staff.rates.view")).toBe(false);
    expect(seesPayRates("accountant")).toBe(false);
    expect(seesPayRates("manager")).toBe(true);
  });

  it("suodattaa navigaation rooleittain", () => {
    const accountantNav = adminNavFor("accountant").map((e) => e.href);
    expect(accountantNav).toContain("/admin/kulut");
    expect(accountantNav).not.toContain("/admin/tyovuorot");
    expect(adminNavFor("owner").length).toBeGreaterThan(accountantNav.length);
  });

  /**
   * Piilotettu linkki ei ole pääsynhallintaa: osoitteen voi kirjoittaa
   * itse. Vaatimus on luettava samasta taulukosta josta valikkokin,
   * jotta ne eivät voi erota toisistaan.
   */
  it("johtaa polusta saman oikeuden kuin navigaatio", () => {
    expect(capabilityForPath("/admin/kulut")).toBe("expenses.view");
    expect(capabilityForPath("/admin/tyontekijat")).toBe("staff.view");
    expect(capabilityForPath("/admin/budjetit")).toBe("budgets.view");
  });

  it("perii alipolun vaatimuksen pisimmästä osumasta", () => {
    // Ei saa osua /admin-juureen, jonka vaatimus on löyhempi.
    expect(capabilityForPath("/admin/toimittajat/abc-123")).toBe(
      "suppliers.view",
    );
    expect(capabilityForPath("/admin/kuitit/xyz")).toBe("receipts.view");
  });

  /**
   * Tuntematon hallintapolku perii juuren vaatimuksen. Se on tahallista:
   * uusi sivu on suljettu kunnes se lisätään taulukkoon, eikä auki
   * siihen asti kun joku muistaa.
   */
  it("sulkeutuu tuntemattomalla hallintapolulla", () => {
    expect(capabilityForPath("/admin/tuntematon")).toBe("expenses.view");
    expect(can("employee", capabilityForPath("/admin/tuntematon")!)).toBe(
      false,
    );
  });

  it("ei vaadi mitään hallinnan ulkopuolelta", () => {
    expect(capabilityForPath("/app/vuorot")).toBeNull();
    expect(capabilityForPath("/kirjaudu")).toBeNull();
  });

  it("estää työntekijältä hallintanäkymät ja ohjaa omaan näkymään", () => {
    const required = capabilityForPath("/admin/tyontekijat");
    expect(required).not.toBeNull();
    expect(can("employee", required!)).toBe(false);
    expect(landingFor("employee")).toBe("/app");
  });

  it("ohjaa kirjanpitäjän ensimmäiseen näkymään johon oikeus riittää", () => {
    const landing = landingFor("accountant");
    const required = capabilityForPath(landing);
    expect(required).not.toBeNull();
    expect(can("accountant", required!)).toBe(true);
  });

  /**
   * Tämä on koko ROUTE_ACCESS-jaon syy. Valikosta piilotettu reitti on
   * yhä olemassa ja osoitteen voi kirjoittaa itse — jos vaatimus
   * luettaisiin valikosta, piilottaminen avaisi reitin kaikille.
   */
  it("säilyttää pääsytarkistuksen valikosta piilotetuilla reiteillä", () => {
    const hidden = [
      "/admin/havainnot",
      "/admin/ilmoitukset",
      // Asetukset on omana kohtanaan valikon pohjalla, ei osastoissa.
      "/admin/asetukset",
    ];

    const navHrefs = adminNavFor("owner").map((entry) => entry.href);

    for (const path of hidden) {
      expect(navHrefs).not.toContain(path);

      const required = capabilityForPath(path);
      expect(required).not.toBeNull();
      expect(can("employee", required!)).toBe(false);
    }
  });

  /*
   * Valikon koko on tuotepäätös, ei sattuma.
   *
   * Luku on tässä siksi, että uusi sivu ei valu valikkoon huomaamatta.
   * Kahdestoista kohta on Tehtävät: määräaika on päivittäinen asia, ja
   * juuri sen takia Kate avataan aamulla.
   *
   * Kolmastoista on Kirjanpito. Se on oma työtilansa eikä analyysiä
   * muusta, joten sitä ei voi tavoittaa toisen sivun osiosta niin
   * kuin Toimittajia tai Havaintoja.
   */
  it("pitää päävalikon kolmessatoista kohdassa", () => {
    expect(adminNavFor("owner")).toHaveLength(13);
    expect(primaryNavFor("owner")).toHaveLength(4);
  });

  /**
   * Sivupalkin kasvu ei saa muuttaa alapalkkia.
   *
   * Alapalkki otti aiemmin sivupalkin neljä ensimmäistä kohtaa. Kun
   * Budjetit lisättiin Kulut-kohdan perään, Työvuorot olisi tipahtanut
   * ylivuotovalikkoon ilman että kukaan päätti niin.
   */
  it("pitää työvuorot puhelimen alapalkissa", () => {
    const bar = primaryNavFor("owner").map((entry) => entry.href);
    expect(bar).toEqual([
      "/admin",
      "/admin/kuitit",
      "/admin/kulut",
      "/admin/tyovuorot",
    ]);
  });

  it("pitää budjetit tavoitettavana molemmissa", () => {
    const sidebar = adminNavFor("owner").map((entry) => entry.href);
    const overflow = moreNavFor("owner").map((entry) => entry.href);

    expect(sidebar).toContain("/admin/budjetit");
    expect(overflow).toContain("/admin/budjetit");
  });

  it("ryhmittelee valikon osastoihin", () => {
    const sections = adminNavSectionsFor("owner");

    expect(sections.map((s) => s.id)).toEqual([
      "main",
      "finance",
      "staff",
      "restaurant",
    ]);

    const finance = sections.find((s) => s.id === "finance")!;
    expect(finance.items.map((i) => i.href)).toEqual([
      // Myynti ensin: paljonko tuli, sitten paljonko meni.
      "/admin/myynti",
      "/admin/kuitit",
      "/admin/kulut",
      "/admin/budjetit",
      "/admin/toimittajat",
      // Kirjanpito viimeisenä: se on se mihin kaikki edellinen päätyy.
      "/admin/kirjanpito",
    ]);
  });

  /*
   * Tyhjä osastootsikko lupaa kohtia joita ei ole. Kirjanpitäjä ei näe
   * henkilöstöä lainkaan, joten hänelle ei saa jäädä HENKILÖSTÖ-otsikkoa
   * ilman yhtään riviä sen alla.
   */
  it("ei jätä tyhjää osastoa", () => {
    for (const role of ["owner", "manager", "accountant"] as const) {
      for (const section of adminNavSectionsFor(role)) {
        expect(section.items.length).toBeGreaterThan(0);
      }
    }

    const accountant = adminNavSectionsFor("accountant").map((s) => s.id);
    expect(accountant).not.toContain("staff");

    /*
     * Kirjanpitäjä näkee Raportoinnin muttei Lounasta, ja molemmat
     * ovat samassa "Muut"-ryhmässä. Ryhmä siis jää mutta kutistuu
     * yhteen riviin — se on eri asia kuin tyhjä ryhmä.
     */
    const muut = adminNavSectionsFor("accountant").find(
      (x) => x.id === "restaurant",
    );
    expect(muut?.items.map((i) => i.href)).toEqual(["/admin/raportit"]);
  });

  /*
   * Asetukset ei ole valikossa lainkaan — se on tunnusvalikossa.
   *
   * Reitti on silti suojattu. Tämä on koko ROUTE_ACCESS-jaon syy:
   * valikosta puuttuva reitti ei saa olla suojaamaton, koska osoitteen
   * voi kirjoittaa itse.
   */
  it("pitää asetukset valikon ulkopuolella mutta suojattuna", () => {
    const inSections = adminNavSectionsFor("owner").flatMap((s) =>
      s.items.map((i) => i.href),
    );

    expect(inSections).not.toContain("/admin/asetukset");
    expect(adminNavFor("owner").map((e) => e.href)).not.toContain(
      "/admin/asetukset",
    );

    const required = capabilityForPath("/admin/asetukset");
    expect(required).toBe("settings.view");
    expect(can("employee", required!)).toBe(false);
    expect(can("owner", required!)).toBe(true);
  });

  /** Ylivuotovalikkoon ei saa jäädä kahdesti samaa kohtaa. */
  it("ei toista kohtaa ylivuotovalikossa", () => {
    const hrefs = moreNavFor("owner").map((entry) => entry.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("suodattaa ylivuotovalikon rooleittain", () => {
    const accountant = moreNavFor("accountant").map((entry) => entry.href);
    expect(accountant).toContain("/admin/budjetit");
    expect(accountant).not.toContain("/admin/tyontekijat");
  });

  it("estää kirjanpitäjältä työvuorot", () => {
    expect(can("accountant", capabilityForPath("/admin/tyovuorot")!)).toBe(
      false,
    );
  });
});

describe("poikkeamat", () => {
  const users: User[] = [
    {
      id: "u1",
      restaurantId: "rest-1",
      name: "Ali",
      role: "employee",
      position: "waiter",
      hourlyRateCents: 1500,
      initials: "A",
      active: true,
    },
  ];

  /*
   * Nykyhetki ja vyöhyke ovat pakollisia, mutta useimmat poikkeamat
   * eivät riipu niistä. Apuri antaa niille kiinteän arvon, jotta
   * jokainen testi kertoo vain siitä mitä se tutkii.
   */
  const alertsOf = (
    input: Partial<AlertContext> & Pick<AlertContext, "month" | "today">,
  ) =>
    buildAlerts({
      receipts: [],
      budgets: [],
      shifts: [],
      users,
      clockEvents: [],
      absences: [],
      openShifts: [],
      sales: [],
      now: `${input.today}T12:00:00Z`,
      timezone: "Europe/Helsinki",
      locale: "fi" as const,
      ...input,
    });

  it("nostaa kaksoiskappaleen kriittiseksi", () => {
    const dup = {
      date: "2026-08-18",
      totalCents: 8720,
      supplierId: "s-x",
      supplierName: "X",
    };
    const alerts = alertsOf({
      receipts: [receipt(dup), receipt(dup)],
      budgets: [],
      shifts: [],
      users,
      clockEvents: [],
      absences: [],
      month: "2026-08",
      today: "2026-08-20",
    });
    const d = alerts.find((a) => a.kind === "duplicate_receipt");
    expect(d?.severity).toBe("critical");
  });

  it("nostaa budjetin ylityksen ja varoituksen", () => {
    const budgets: Budget[] = [
      {
        id: "b1",
        restaurantId: "rest-1",
        category: "cleaning",
        month: null,
        amountCents: 10000,
      },
    ];
    const alerts = alertsOf({
      receipts: [
        receipt({
          date: "2026-08-01",
          totalCents: 12000,
          category: "cleaning",
        }),
      ],
      budgets,
      shifts: [],
      users,
      clockEvents: [],
      absences: [],
      month: "2026-08",
      today: "2026-08-20",
    });
    expect(alerts.some((a) => a.kind === "budget_exceeded")).toBe(true);
  });

  it("huomaa sulkematta jääneen työajan", () => {
    const alerts = alertsOf({
      receipts: [],
      budgets: [],
      shifts: [],
      users,
      clockEvents: [
        { id: "e1", userId: "u1", type: "in", at: "2026-08-18T16:00:00.000Z" },
      ],
      absences: [],
      month: "2026-08",
      today: "2026-08-20",
    });
    expect(alerts.some((a) => a.kind === "unclosed_shift")).toBe(true);
  });

  it("ei hälytä tänään käynnissä olevasta vuorosta", () => {
    const alerts = alertsOf({
      receipts: [],
      budgets: [],
      shifts: [],
      users,
      clockEvents: [
        { id: "e1", userId: "u1", type: "in", at: "2026-08-20T09:00:00.000Z" },
      ],
      absences: [],
      month: "2026-08",
      today: "2026-08-20",
    });
    expect(alerts.some((a) => a.kind === "unclosed_shift")).toBe(false);
  });

  it("järjestää vakavimmat ensin", () => {
    const dup = {
      date: "2026-08-18",
      totalCents: 8720,
      supplierId: "s-x",
      supplierName: "X",
    };
    const alerts = alertsOf({
      receipts: [receipt(dup), receipt(dup)],
      budgets: [],
      shifts: [
        {
          id: "sh1",
          restaurantId: "rest-1",
          userId: "u1",
          date: "2026-08-25",
          startTime: "14:00",
          endTime: "22:00",
          location: "Sali",
          status: "pending",
          breakMinutes: 0,
          note: null,
          publishedAt: "2026-08-01T00:00:00.000Z",
          createdAt: "2026-08-01T00:00:00.000Z",
          cancelledAt: null,
        },
      ],
      users,
      clockEvents: [],
      absences: [],
      month: "2026-08",
      today: "2026-08-20",
    });
    expect(alerts[0].severity).toBe("critical");
  });

  it("nostaa poissaoloilmoituksen kriittiseksi", () => {
    const alerts = alertsOf({
      receipts: [],
      budgets: [],
      shifts: [],
      users,
      clockEvents: [],
      absences: [
        {
          id: "a1",
          userId: "u1",
          date: "2026-08-22",
          endDate: "2026-08-22",
          kind: "sick",
          note: null,
          reportedAt: "2026-08-22T06:00:00.000Z",
          certificateSeenAt: null,
        },
      ],
      month: "2026-08",
      today: "2026-08-20",
    });
    const absence = alerts.find((a) => a.kind === "absence_reported");
    expect(absence?.severity).toBe("critical");
  });

  // Sairausloma kestää yli päivän. Jos suodatus osuisi alkupäivään, kesken
  // oleva jakso katoaisi huomioista heti seuraavana aamuna — juuri silloin
  // kun tekijää vielä etsitään.
  it("pitää kesken olevan jakson näkyvissä", () => {
    const alerts = alertsOf({
      receipts: [],
      budgets: [],
      shifts: [],
      users,
      clockEvents: [],
      absences: [
        {
          id: "a1",
          userId: "u1",
          date: "2026-08-18",
          endDate: "2026-08-24",
          kind: "sick",
          note: null,
          reportedAt: "2026-08-18T06:00:00.000Z",
          certificateSeenAt: null,
        },
      ],
      month: "2026-08",
      today: "2026-08-20",
    });
    expect(alerts.some((a) => a.kind === "absence_reported")).toBe(true);
  });

  it("unohtaa päättyneen jakson", () => {
    const alerts = alertsOf({
      receipts: [],
      budgets: [],
      shifts: [],
      users,
      clockEvents: [],
      absences: [
        {
          id: "a1",
          userId: "u1",
          date: "2026-08-10",
          endDate: "2026-08-14",
          kind: "sick",
          note: null,
          reportedAt: "2026-08-10T06:00:00.000Z",
          certificateSeenAt: null,
        },
      ],
      month: "2026-08",
      today: "2026-08-20",
    });
    expect(alerts.some((a) => a.kind === "absence_reported")).toBe(false);
  });

  it("ei tuota hälytyksiä puhtaasta aineistosta", () => {
    const alerts = alertsOf({
      receipts: [
        receipt({
          date: "2026-08-01",
          totalCents: 11400,
          vatCents: 1400,
          category: "food",
        }),
      ],
      budgets: [],
      shifts: [],
      users,
      clockEvents: [],
      absences: [],
      month: "2026-08",
      today: "2026-08-20",
    });
    expect(alerts).toHaveLength(0);
  });
});

describe("kuittien poiminta", () => {
  /**
   * Jäljitelmä ei ole nähnyt kuvaa. Väite "kuittikuva epäselvä" saisi
   * käyttäjän kuvaamaan kuitin uudelleen ratkaistakseen ongelman jota
   * ei ole — se on sama virhe kuin keksitty summa.
   */
  it("ei arvioi kuvan laatua tuntemattomasta tiedostosta", async () => {
    const result = await new MockReceiptExtractor().extract({
      fileName: "IMG_4821.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 120000,
    });

    expect(result.imageQuality).toBe("good");
    expect(reviewReasonsFor(result)).not.toContain("poor_image");
  });

  it("jättää tuntemattomat kentät tyhjiksi eikä arvaa", async () => {
    const result = await new MockReceiptExtractor().extract({
      fileName: "IMG_4821.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 120000,
    });

    expect(result.supplier.value).toBeNull();
    expect(result.totalCents.value).toBeNull();
    expect(result.category.value).toBeNull();
  });

  /** Tyhjä tulos on lähtökohta käsin täytettävälle lomakkeelle. */
  it("antaa tyhjän tuloksen jossa mitään ei ole keksitty", () => {
    const empty = emptyResult();

    expect(empty.supplier.value).toBeNull();
    expect(empty.totalCents.value).toBeNull();
    expect(empty.items).toEqual([]);
    expect(empty.imageQuality).toBe("good");
  });
});

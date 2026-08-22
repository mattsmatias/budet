import { describe, expect, it } from "vitest";
import { checkVat, dominantCategory, inferVatRate, isMixedReceipt, itemsSumMatches, rateMatchesCategory } from "../vat";
import { daysApart, duplicateIds, findDuplicates } from "../duplicates";
import { supplierTrends, totalsBySupplier, suggestedCategory } from "../suppliers";
import { budgetProgress, budgetStatus, spendByCategory } from "../budgets";
import { compareShift, formatVariance, shiftDurationMinutes, timeToMinutes, variancePatterns } from "../shifts";
import {
  moreNavFor,
  primaryNavFor,
  adminNavFor,
  can,
  canAddReceipts,
  capabilityForPath,
  landingFor,
  seesPayRates,
} from "../permissions";
import { buildAlerts } from "../alerts";
import {
  MockReceiptExtractor,
  emptyResult,
  reviewReasonsFor,
} from "../receipt-ai";
import type { Budget, ClockEvent, ExpenseCategory, Receipt, ReceiptItem, Shift, Supplier, User } from "../types";

// ---------------------------------------------------------------------------
// Apurit
// ---------------------------------------------------------------------------

let n = 0;
function item(partial: Partial<ReceiptItem> & { totalCents: number; category: ExpenseCategory }): ReceiptItem {
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

function receipt(partial: Partial<Receipt> & { totalCents: number; date: string }): Receipt {
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

// ---------------------------------------------------------------------------

describe("ALV-tarkistus", () => {
  it("päättelee kannan summista", () => {
    // 100,00 netto + 14,50 ALV = 114,50
    expect(inferVatRate(11450, 1450)).toBeCloseTo(0.145);
  });

  it("ei jaa nollalla kun ALV on koko summa", () => {
    expect(inferVatRate(1000, 1000)).toBeNull();
    expect(inferVatRate(1000, 1200)).toBeNull();
  });

  it("hyväksyy kannan pienellä pyöristysheitolla", () => {
    expect(rateMatchesCategory(0.1452, "food")).toBe(true);
    expect(rateMatchesCategory(0.2, "food")).toBe(false);
  });

  it("merkitsee ristiriidan kun kanta ei vastaa kategoriaa", () => {
    // Alkoholi 14,5 %:n kannalla — pitäisi olla 25,5 %
    const check = checkVat(11450, 1450, "alcohol");
    expect(check.matches).toBe(false);
    expect(check.explanation).toContain("14,5 %");
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
    const check = checkVat(11450, 1450, "alcohol");
    expect(Object.keys(check)).not.toContain("correctedVatCents");
  });
});

describe("rivien summautuminen", () => {
  it("hyväksyy täsmäävät rivit", () => {
    const r = receipt({
      date: "2026-08-01",
      totalCents: 3000,
      items: [item({ totalCents: 1000, category: "food" }), item({ totalCents: 2000, category: "food" })],
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
    expect(itemsSumMatches(receipt({ date: "2026-08-01", totalCents: 3000 }))).toBe(true);
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
  const base = { date: "2026-08-18", totalCents: 8720, supplierId: "s-kcity", supplierName: "K-Citymarket" };

  it("löytää saman toimittajan saman summan samana päivänä", () => {
    const groups = findDuplicates([receipt(base), receipt(base)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].receipts).toHaveLength(2);
  });

  it("sallii sentin heiton", () => {
    const groups = findDuplicates([receipt(base), receipt({ ...base, totalCents: 8721 })]);
    expect(groups).toHaveLength(1);
  });

  it("ei epäile eri toimittajaa", () => {
    expect(findDuplicates([receipt(base), receipt({ ...base, supplierId: "s-muu" })])).toHaveLength(0);
  });

  it("ei epäile eri summaa", () => {
    expect(findDuplicates([receipt(base), receipt({ ...base, totalCents: 9999 })])).toHaveLength(0);
  });

  it("hyväksyy peräkkäiset päivät mutta ei kaukaisempia", () => {
    expect(findDuplicates([receipt(base), receipt({ ...base, date: "2026-08-19" })])).toHaveLength(1);
    expect(findDuplicates([receipt(base), receipt({ ...base, date: "2026-08-25" })])).toHaveLength(0);
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
    const ids = duplicateIds([receipt(base), receipt(base), receipt({ ...base, supplierId: "s-x" })]);
    expect(ids.size).toBe(2);
  });
});

describe("toimittajat", () => {
  const receipts = [
    receipt({ date: "2026-08-01", totalCents: 10000, supplierId: "s-a", supplierName: "A" }),
    receipt({ date: "2026-08-02", totalCents: 30000, supplierId: "s-a", supplierName: "A" }),
    receipt({ date: "2026-08-03", totalCents: 20000, supplierId: "s-b", supplierName: "B" }),
    receipt({ date: "2026-07-05", totalCents: 20000, supplierId: "s-a", supplierName: "A" }),
  ];

  it("summaa toimittajittain, suurin ensin", () => {
    const totals = totalsBySupplier(receipts.filter((r) => r.date.startsWith("2026-08")));
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
      items: [item({ totalCents: 1000, category: "food" }), item({ totalCents: 2000, category: "cleaning" })],
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
      id: "s-1", restaurantId: "rest-1", name: "Lyreco", defaultCategory: "packaging",
      categoryOverrides: [{ from: "other", to: "kitchen_supplies", count: 4 }],
    };
    expect(suggestedCategory(supplier, "other")?.category).toBe("kitchen_supplies");
    expect(suggestedCategory(supplier, "food")).toBeNull();

    const once: Supplier = { ...supplier, categoryOverrides: [{ from: "other", to: "cleaning", count: 1 }] };
    expect(suggestedCategory(once, "other")).toBeNull();
  });
});

describe("budjetit", () => {
  const budgets: Budget[] = [
    { id: "b1", restaurantId: "rest-1", category: "food", month: null, amountCents: 100000 },
    { id: "b2", restaurantId: "rest-1", category: "cleaning", month: null, amountCents: 10000 },
  ];

  it("jakaa sekakuitin useaan budjettiin", () => {
    const spend = spendByCategory([
      receipt({
        date: "2026-08-01",
        totalCents: 3000,
        items: [item({ totalCents: 1000, category: "food" }), item({ totalCents: 2000, category: "cleaning" })],
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
        receipt({ date: "2026-08-01", totalCents: 12000, category: "cleaning" }),
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
      [receipt({ date: "2026-08-01", totalCents: 5000, category: "transport" })],
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
    { id: "u1", restaurantId: "rest-1", name: "Ali", role: "employee", position: "waiter", hourlyRateCents: 1500, initials: "A", active: true },
  ];

  const shift: Shift = {
    id: "sh1", restaurantId: "rest-1", userId: "u1", date: "2026-08-20",
    startTime: "14:00", endTime: "22:00", location: "Sali", status: "accepted",
  };

  const events: ClockEvent[] = [
    { id: "e1", userId: "u1", type: "in", at: "2026-08-20T14:04:00.000Z" },
    { id: "e2", userId: "u1", type: "out", at: "2026-08-20T22:17:00.000Z" },
  ];

  it("laskee vuoron keston", () => {
    expect(shiftDurationMinutes(shift)).toBe(480);
    expect(timeToMinutes("14:30")).toBe(870);
  });

  it("käsittelee yön yli menevän vuoron", () => {
    expect(shiftDurationMinutes({ ...shift, startTime: "22:00", endTime: "02:00" })).toBe(240);
  });

  it("laskee eron suunnitellun ja toteutuneen välillä", () => {
    const c = compareShift(shift, users, events, "2026-08-21T00:00:00.000Z");
    expect(c.plannedMs).toBe(480 * 60000);
    expect(c.actualMs).toBe(493 * 60000);
    expect(c.varianceMs).toBe(13 * 60000);
  });

  it("laskee kustannuseron tuntipalkasta", () => {
    const c = compareShift(shift, users, events, "2026-08-21T00:00:00.000Z");
    expect(c.plannedCostCents).toBe(12000); // 8 h × 15 €
    expect(c.actualCostCents).toBeGreaterThan(c.plannedCostCents);
  });

  it("ei arvaa toteutunutta kun leimauksia ei ole", () => {
    const c = compareShift(shift, users, [], "2026-08-21T00:00:00.000Z");
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
        compareShift(shift, users, more, "2026-08-21T00:00:00.000Z"),
        compareShift(day2, users, more, "2026-08-21T00:00:00.000Z"),
        compareShift(day3, users, more, "2026-08-21T00:00:00.000Z"),
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
    expect(capabilityForPath("/admin/toimittajat/abc-123")).toBe("suppliers.view");
    expect(capabilityForPath("/admin/kuitit/xyz")).toBe("receipts.view");
  });

  /**
   * Tuntematon hallintapolku perii juuren vaatimuksen. Se on tahallista:
   * uusi sivu on suljettu kunnes se lisätään taulukkoon, eikä auki
   * siihen asti kun joku muistaa.
   */
  it("sulkeutuu tuntemattomalla hallintapolulla", () => {
    expect(capabilityForPath("/admin/tuntematon")).toBe("expenses.view");
    expect(can("employee", capabilityForPath("/admin/tuntematon")!)).toBe(false);
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
      "/admin/toimittajat",
      "/admin/budjetit",
      "/admin/havainnot",
      "/admin/ilmoitukset",
      // Asetukset löytyy tunnusvalikosta, ei navigaatiosta.
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

  it("pitää päävalikon kuudessa kohdassa", () => {
    expect(adminNavFor("owner")).toHaveLength(6);
    expect(primaryNavFor("owner")).toHaveLength(4);
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
    expect(can("accountant", capabilityForPath("/admin/tyovuorot")!)).toBe(false);
  });
});

describe("poikkeamat", () => {
  const users: User[] = [
    { id: "u1", restaurantId: "rest-1", name: "Ali", role: "employee", position: "waiter", hourlyRateCents: 1500, initials: "A", active: true },
  ];

  it("nostaa kaksoiskappaleen kriittiseksi", () => {
    const dup = { date: "2026-08-18", totalCents: 8720, supplierId: "s-x", supplierName: "X" };
    const alerts = buildAlerts({
      receipts: [receipt(dup), receipt(dup)],
      budgets: [], shifts: [], users, clockEvents: [],
      month: "2026-08", today: "2026-08-20",
    });
    const d = alerts.find((a) => a.kind === "duplicate_receipt");
    expect(d?.severity).toBe("critical");
  });

  it("nostaa budjetin ylityksen ja varoituksen", () => {
    const budgets: Budget[] = [
      { id: "b1", restaurantId: "rest-1", category: "cleaning", month: null, amountCents: 10000 },
    ];
    const alerts = buildAlerts({
      receipts: [receipt({ date: "2026-08-01", totalCents: 12000, category: "cleaning" })],
      budgets, shifts: [], users, clockEvents: [],
      month: "2026-08", today: "2026-08-20",
    });
    expect(alerts.some((a) => a.kind === "budget_exceeded")).toBe(true);
  });

  it("huomaa sulkematta jääneen työajan", () => {
    const alerts = buildAlerts({
      receipts: [], budgets: [], shifts: [], users,
      clockEvents: [{ id: "e1", userId: "u1", type: "in", at: "2026-08-18T16:00:00.000Z" }],
      month: "2026-08", today: "2026-08-20",
    });
    expect(alerts.some((a) => a.kind === "unclosed_shift")).toBe(true);
  });

  it("ei hälytä tänään käynnissä olevasta vuorosta", () => {
    const alerts = buildAlerts({
      receipts: [], budgets: [], shifts: [], users,
      clockEvents: [{ id: "e1", userId: "u1", type: "in", at: "2026-08-20T09:00:00.000Z" }],
      month: "2026-08", today: "2026-08-20",
    });
    expect(alerts.some((a) => a.kind === "unclosed_shift")).toBe(false);
  });

  it("järjestää vakavimmat ensin", () => {
    const dup = { date: "2026-08-18", totalCents: 8720, supplierId: "s-x", supplierName: "X" };
    const alerts = buildAlerts({
      receipts: [receipt(dup), receipt(dup)],
      budgets: [],
      shifts: [{ id: "sh1", restaurantId: "rest-1", userId: "u1", date: "2026-08-25", startTime: "14:00", endTime: "22:00", location: "Sali", status: "pending" }],
      users, clockEvents: [],
      month: "2026-08", today: "2026-08-20",
    });
    expect(alerts[0].severity).toBe("critical");
  });

  it("ei tuota hälytyksiä puhtaasta aineistosta", () => {
    const alerts = buildAlerts({
      receipts: [receipt({ date: "2026-08-01", totalCents: 11450, vatCents: 1450, category: "food" })],
      budgets: [], shifts: [], users, clockEvents: [],
      month: "2026-08", today: "2026-08-20",
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

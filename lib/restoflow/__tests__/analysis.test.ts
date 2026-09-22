import { describe, expect, it } from "vitest";
import { adminText } from "@/lib/i18n/admin-text";
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
  moreNavFor,
  primaryNavFor,
  adminNavFor,
  adminNavSectionsFor,
  can,
  canAddReceipts,
  capabilityForPath,
  landingFor,
} from "../permissions";
import { buildAlerts, type AlertContext } from "../alerts";
import type { DailySales } from "../sales";
import type { Task } from "../tasks";
import {
  MockReceiptExtractor,
  emptyResult,
  reviewReasonsFor,
} from "../receipt-ai";
import type {
  Budget,
  ExpenseCategory,
  Receipt,
  ReceiptItem,
  Supplier,
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

/** Testit lukevat suomenkielisen tekstin, joten kieli on kiinnitetty. */
const suomi = adminText("fi");

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
    const groups = findDuplicates([receipt(base), receipt(base)], suomi);
    expect(groups).toHaveLength(1);
    expect(groups[0].receipts).toHaveLength(2);
  });

  it("sallii sentin heiton", () => {
    const groups = findDuplicates(
      [receipt(base), receipt({ ...base, totalCents: 8721 })],
      suomi,
    );
    expect(groups).toHaveLength(1);
  });

  it("ei epäile eri toimittajaa", () => {
    expect(
      findDuplicates(
        [receipt(base), receipt({ ...base, supplierId: "s-muu" })],
        suomi,
      ),
    ).toHaveLength(0);
  });

  it("ei epäile eri summaa", () => {
    expect(
      findDuplicates(
        [receipt(base), receipt({ ...base, totalCents: 9999 })],
        suomi,
      ),
    ).toHaveLength(0);
  });

  it("hyväksyy peräkkäiset päivät mutta ei kaukaisempia", () => {
    expect(
      findDuplicates(
        [receipt(base), receipt({ ...base, date: "2026-08-19" })],
        suomi,
      ),
    ).toHaveLength(1);
    expect(
      findDuplicates(
        [receipt(base), receipt({ ...base, date: "2026-08-25" })],
        suomi,
      ),
    ).toHaveLength(0);
  });

  it("kumoaa epäilyn kun kuittinumerot eroavat", () => {
    const groups = findDuplicates(
      [
        receipt({ ...base, receiptNumber: "A-1" }),
        receipt({ ...base, receiptNumber: "A-2" }),
      ],
      suomi,
    );
    expect(groups).toHaveLength(0);
  });

  it("ei ehdota poistoa vaan palauttaa molemmat", () => {
    const groups = findDuplicates([receipt(base), receipt(base)], suomi);
    // Ryhmä sisältää molemmat — päätös jää käyttäjälle.
    expect(groups[0].receipts.length).toBe(2);
  });

  it("laskee päivien etäisyyden", () => {
    expect(daysApart("2026-08-18", "2026-08-20")).toBe(2);
    expect(daysApart("2026-08-18", "ei-pvm")).toBe(Number.POSITIVE_INFINITY);
  });

  it("kokoaa tunnisteet korostusta varten", () => {
    const ids = duplicateIds(
      [receipt(base), receipt(base), receipt({ ...base, supplierId: "s-x" })],
      suomi,
    );
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

describe("oikeudet", () => {
  it("antaa omistajalle täydet oikeudet", () => {
    expect(can("owner", "budgets.edit")).toBe(true);
    expect(can("owner", "settings.edit")).toBe(true);
  });

/*
   * Esihenkilö ja työntekijä poistettiin. Arvot voivat esiintyä vanhassa
   * datassa, eikä poistettu rooli saa avata mitään.
   */
  it("ei anna poistetuille rooleille mitään oikeuksia", () => {
    for (const rooli of ["manager", "employee"] as const) {
      expect(can(rooli, "receipts.view")).toBe(false);
      expect(can(rooli, "expenses.view")).toBe(false);
      expect(can(rooli, "budgets.view")).toBe(false);
      expect(can(rooli, "tasks.view")).toBe(false);
      expect(can(rooli, "settings.view")).toBe(false);
      expect(canAddReceipts(rooli)).toBe(false);
    }
  });

  /**
   * Kuitti on yrityksen kirjanpitoaineistoa: kulukirjauksen saa
   * synnyttää vain se joka vastaa sen oikeellisuudesta. Kirjanpitäjä
   * lukee kuitit muttei luo niitä.
   */
  it("antaa kuitin lisäyksen vain omistajalle", () => {
    expect(canAddReceipts("owner")).toBe(true);
    expect(canAddReceipts("accountant")).toBe(false);
    expect(can("accountant", "receipts.view")).toBe(true);
  });

  it("antaa kirjanpitäjälle talouden muttei muokkausta", () => {
    expect(can("accountant", "expenses.view")).toBe(true);
    expect(can("accountant", "reports.export")).toBe(true);
    expect(can("accountant", "accounting.view")).toBe(true);
    expect(can("accountant", "accounting.manage")).toBe(false);
    expect(can("accountant", "settings.view")).toBe(false);
  });

  it("suodattaa navigaation rooleittain", () => {
    const accountantNav = adminNavFor("accountant").map((e) => e.href);
    expect(accountantNav).toContain("/admin/kulut");
    expect(accountantNav).not.toContain("/admin/tehtavat");
    expect(adminNavFor("owner").length).toBeGreaterThan(accountantNav.length);
  });

  /**
   * Piilotettu linkki ei ole pääsynhallintaa: osoitteen voi kirjoittaa
   * itse. Vaatimus on luettava samasta taulukosta josta valikkokin,
   * jotta ne eivät voi erota toisistaan.
   */
  it("johtaa polusta saman oikeuden kuin navigaatio", () => {
    expect(capabilityForPath("/admin/kulut")).toBe("expenses.view");
    expect(capabilityForPath("/admin/tehtavat")).toBe("tasks.view");
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
   *
   * Tämä koskee myös poistettuja sivuja. Vanha kirjanmerkki
   * /admin/tyovuorot ei avaa mitään, vaan perii juuren vaatimuksen.
   */
  it("sulkeutuu tuntemattomalla hallintapolulla", () => {
    expect(capabilityForPath("/admin/tuntematon")).toBe("expenses.view");
    expect(capabilityForPath("/admin/tyovuorot")).toBe("expenses.view");
    expect(can("employee", capabilityForPath("/admin/tuntematon")!)).toBe(
      false,
    );
  });

  it("ei vaadi mitään hallinnan ulkopuolelta", () => {
    expect(capabilityForPath("/kirjaudu")).toBeNull();
  });

  it("ohjaa poistetun roolin aloitussivulle", () => {
    expect(landingFor("employee")).toBe("/aloitus");
    expect(landingFor("manager")).toBe("/aloitus");
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
   * Kate näyttää ravintolan rahan: paljonko tuli, mihin se meni ja
   * miten se jakautui. Kymmenen kohtaa kattaa sen, ja jokainen uusi
   * kohta on päätös siitä kuuluuko se siihen kysymykseen.
   */
  it("pitää päävalikon kymmenessä kohdassa", () => {
    expect(adminNavFor("owner")).toHaveLength(10);
    expect(primaryNavFor("owner")).toHaveLength(4);
  });

  /**
   * Sivupalkin kasvu ei saa muuttaa alapalkkia.
   *
   * Alapalkki luetellaan nimeltä eikä oteta sivupalkin neljästä
   * ensimmäisestä. Myynti on alapalkissa, koska kassan päiväraportti
   * kirjataan joka ilta — useimmiten puhelimella.
   */
  it("pitää myynnin puhelimen alapalkissa", () => {
    const bar = primaryNavFor("owner").map((entry) => entry.href);
    expect(bar).toEqual([
      "/admin",
      "/admin/myynti",
      "/admin/kuitit",
      "/admin/kulut",
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
   * Tyhjä osastootsikko lupaa kohtia joita ei ole.
   */
  it("ei jätä tyhjää osastoa", () => {
    for (const role of [
      "owner",
      "manager",
      "accountant",
      "employee",
    ] as const) {
      for (const section of adminNavSectionsFor(role)) {
        expect(section.items.length).toBeGreaterThan(0);
      }
    }

    /*
     * Tiedostot on kirjanpitäjälle nimenomaan kuuluva kohta:
     * sopimukset ja verodokumentit ovat juuri sitä mitä hän työssään
     * tarvitsee. Lukuoikeus riittää — kaapin järjestys on ravintolan
     * oma asia.
     */
    const muut = adminNavSectionsFor("accountant").find(
      (x) => x.id === "restaurant",
    );
    expect(muut?.items.map((i) => i.href)).toEqual([
      "/admin/tiedostot",
      "/admin/raportit",
    ]);
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
    expect(accountant).not.toContain("/admin/tehtavat");
  });
});

describe("poikkeamat", () => {
  /*
   * Apuri antaa tyhjät oletukset, jotta jokainen testi kertoo vain
   * siitä mitä se tutkii.
   */
  const alertsOf = (
    input: Partial<AlertContext> & Pick<AlertContext, "month" | "today">,
  ) =>
    buildAlerts({
      receipts: [],
      budgets: [],
      sales: [],
      locale: "fi" as const,
      ...input,
    });

  function sale(
    date: string,
    netCents: number,
    targetCents: number | null = null,
  ): DailySales {
    return {
      date,
      netCents,
      targetCents,
      note: null,
      grossCents: null,
      vatCents: null,
      transactions: null,
      source: "manual",
      posGrossCents: null,
      posVatCents: null,
    };
  }

  function task(partial: Partial<Task> = {}): Task {
    return {
      id: "t1",
      restaurantId: "rest-1",
      title: "Maksa vuokra",
      description: null,
      dueOn: "2026-08-20",
      dueTime: null,
      priority: "normal",
      visibility: "managers",
      assignedTo: null,
      completedAt: null,
      completedBy: null,
      cancelledAt: null,
      cancelledBy: null,
      recurrence: "none",
      parentTaskId: null,
      remindDaysBefore: [1],
      remindOnDue: true,
      remindWhenOverdue: true,
      createdBy: "u1",
      createdAt: "2026-08-01T10:00:00.000Z",
      ...partial,
    };
  }

  const kinds = (
    input: Partial<AlertContext> & Pick<AlertContext, "month" | "today">,
  ) => alertsOf(input).map((a) => a.kind);

  it("nostaa kaksoiskappaleen kriittiseksi", () => {
    const dup = {
      date: "2026-08-18",
      totalCents: 8720,
      supplierId: "s-x",
      supplierName: "X",
    };
    const alerts = alertsOf({
      receipts: [receipt(dup), receipt(dup)],
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
      month: "2026-08",
      today: "2026-08-20",
    });
    expect(alerts.some((a) => a.kind === "budget_exceeded")).toBe(true);
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
      /* Tänään erääntyvä tavallinen tehtävä on varoitus, ei kriittinen. */
      tasks: [task({ dueOn: "2026-08-20" })],
      month: "2026-08",
      today: "2026-08-20",
    });
    expect(alerts[0].severity).toBe("critical");
    expect(alerts.some((a) => a.severity === "warning")).toBe(true);
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
      month: "2026-08",
      today: "2026-08-20",
    });
    expect(alerts).toHaveLength(0);
  });

  describe("myynti alle vertailukohdan", () => {
    const today = "2026-08-24";
    const yesterday = "2026-08-23";

    it("huomauttaa tavoitteesta jäämisestä", () => {
      const alerts = alertsOf({
        sales: [sale(yesterday, 80_000, 100_000)],
        month: "2026-08",
        today,
      });

      expect(alerts).toHaveLength(1);
      expect(alerts[0].kind).toBe("sales_shortfall");
      expect(alerts[0].title).toContain("20 %");
    });

    it("vaikenee kun tavoite lähes täyttyi", () => {
      // 95 % tavoitteesta on tavallista vaihtelua, ei poikkeama.
      expect(
        kinds({
          sales: [sale(yesterday, 95_000, 100_000)],
          month: "2026-08",
          today,
        }),
      ).toEqual([]);
    });

    /*
     * Ilman vertailukohtaa ei ole mistä jäädä. Pelkkä pieni luku ei ole
     * poikkeama: hiljainen sunnuntai on hiljainen sunnuntai.
     */
    it("vaikenee ilman tavoitetta ja ilman historiaa", () => {
      expect(
        kinds({ sales: [sale(yesterday, 10_000)], month: "2026-08", today }),
      ).toEqual([]);
    });

    it("käyttää saman viikonpäivän historiaa kun tavoitetta ei ole", () => {
      // 23.8.2026 on sunnuntai; 16.8. ja 9.8. ovat sunnuntaita.
      const alerts = alertsOf({
        sales: [
          sale(yesterday, 50_000),
          sale("2026-08-16", 100_000),
          sale("2026-08-09", 100_000),
        ],
        month: "2026-08",
        today,
      });

      expect(alerts).toHaveLength(1);
      expect(alerts[0].detail).toContain("viikonpäivän");
    });

    it("ei arvioi kesken olevaa päivää", () => {
      // Tämän päivän myynti on vasta puolessa välissä; vertailu koko
      // päivän tavoitteeseen antaisi aina hälytyksen.
      expect(
        kinds({
          sales: [sale(today, 10_000, 100_000)],
          month: "2026-08",
          today,
        }),
      ).toEqual([]);
    });
  });

  describe("kuittitauko", () => {
    const today = "2026-08-24";

    it("huomauttaa kun kuitteja ei ole kirjattu mutta myyntiä on", () => {
      const alerts = alertsOf({
        receipts: [receipt({ date: "2026-08-01", totalCents: 5000 })],
        sales: [sale("2026-08-20", 100_000)],
        month: "2026-08",
        today,
      });

      const gap = alerts.find((a) => a.kind === "receipt_gap");
      expect(gap).toBeDefined();
      expect(gap?.title).toContain("23");
    });

    /*
     * Suljettu ravintola ei osta mitään. Ilman tätä ehtoa lomaviikko
     * tuottaisi hälytyksen joka kerta. Myynti on merkki siitä että
     * ravintola on auki — ja juuri se raha jonka rinnalla kulut puuttuvat.
     */
    it("vaikenee kun tauon aikana ei ole myyty", () => {
      expect(
        kinds({
          receipts: [receipt({ date: "2026-08-01", totalCents: 5000 })],
          month: "2026-08",
          today,
        }),
      ).not.toContain("receipt_gap");
    });

    it("vaikenee kun myynti on ennen viimeistä kuittia", () => {
      expect(
        kinds({
          receipts: [receipt({ date: "2026-08-01", totalCents: 5000 })],
          sales: [sale("2026-07-30", 100_000)],
          month: "2026-08",
          today,
        }),
      ).not.toContain("receipt_gap");
    });

    it("vaikenee tuoreesta kuitista", () => {
      expect(
        kinds({
          receipts: [receipt({ date: "2026-08-20", totalCents: 5000 })],
          sales: [sale("2026-08-22", 100_000)],
          month: "2026-08",
          today,
        }),
      ).not.toContain("receipt_gap");
    });

    it("vaikenee kun kuitteja ei ole lainkaan", () => {
      // Uusi ravintola ei ole myöhässä mistään.
      expect(
        kinds({ sales: [sale("2026-08-20", 100_000)], month: "2026-08", today }),
      ).not.toContain("receipt_gap");
    });
  });

  describe("tehtävien määräajat", () => {
    const today = "2026-08-20";

    it("nostaa myöhässä olevan kriittiseksi", () => {
      const alerts = alertsOf({
        tasks: [task({ dueOn: "2026-08-18" })],
        month: "2026-08",
        today,
      });
      const late = alerts.find((a) => a.kind === "task_overdue");
      expect(late?.severity).toBe("critical");
    });

    it("huomauttaa tänään erääntyvästä", () => {
      const alerts = alertsOf({
        tasks: [task({ dueOn: today })],
        month: "2026-08",
        today,
      });
      const due = alerts.find((a) => a.kind === "task_due");
      expect(due?.severity).toBe("warning");
    });

    it("ei hälytä tulevasta tehtävästä", () => {
      expect(
        kinds({ tasks: [task({ dueOn: "2026-08-27" })], month: "2026-08", today }),
      ).toEqual([]);
    });

    it("ei hälytä tehdystä tehtävästä", () => {
      expect(
        kinds({
          tasks: [
            task({
              dueOn: "2026-08-18",
              completedAt: "2026-08-18T12:00:00.000Z",
            }),
          ],
          month: "2026-08",
          today,
        }),
      ).toEqual([]);
    });
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

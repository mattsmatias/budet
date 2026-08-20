/**
 * Suomen sääntöjen regressiotestit (§49).
 *
 * Jokaiselle säännölle: normaalitapaus, rajatapaus, virheellinen syöte.
 * Nämä testit ovat se turvaverkko joka estää sääntömuutosta rikkomasta
 * aiemmin oikein mennyttä luokittelua.
 *
 * Huom: kaikki FI-säännöt ovat demo-statuksella, joten moottori merkitsee
 * ne tarkistettaviksi. Testit tarkistavat että OIKEA sääntö osuu ja oikea
 * verokanta lasketaan — eivät sitä että päätös menisi automaattisesti läpi.
 */

import { describe, expect, it } from "vitest";
import { evaluate } from "../engine";
import { FI_RULES } from "../rules/fi";
import { classifyDocument } from "../document";
import type { TaxFacts } from "../types";

const DATE = "2026-06-01";

function fi(overrides: Partial<TaxFacts> = {}): TaxFacts {
  return {
    jurisdiction: "FI",
    transactionDate: DATE,
    supplyType: "goods",
    netAmountCents: 10000,
    ...overrides,
  };
}

const run = (facts: TaxFacts) => evaluate(facts, FI_RULES);

describe("vat-fi-food", () => {
  it("normaali: ravintolaruoka saa alennetun kannan", () => {
    const d = run(fi({ category: "restaurant_food", netAmountCents: 453630 }));
    expect(d.ruleId).toBe("vat-fi-food");
    expect(d.vatCode).toBe("FI-RED1");
    expect(d.vatRate).toBe(0.135);
    expect(d.vatAmountCents).toBe(61240);
  });

  it("normaali: päivittäistavara saa saman kannan", () => {
    expect(run(fi({ category: "groceries" })).ruleId).toBe("vat-fi-food");
  });

  it("rajatapaus: ei sovellu rajat ylittävään myyntiin", () => {
    const d = run(fi({ category: "food", buyerCountry: "DE", buyerType: "consumer" }));
    expect(d.ruleId).not.toBe("vat-fi-food");
  });
});

describe("vat-fi-alcohol", () => {
  it("normaali: alkoholi saa yleisen kannan", () => {
    const d = run(fi({ category: "alcohol", netAmountCents: 72235 }));
    expect(d.ruleId).toBe("vat-fi-alcohol");
    expect(d.vatRate).toBe(0.255);
    expect(d.vatAmountCents).toBe(18420);
  });

  it("rajatapaus: alkoholi voittaa ruoan prioriteetilla", () => {
    // Alkoholilla on pienempi prioriteettiluku kuin ruoalla, joten se
    // arvioidaan ensin. Tämä on koko erottelun ydin ravintolakuiteilla.
    const alcohol = FI_RULES.find((r) => r.ruleId === "vat-fi-alcohol")!;
    const food = FI_RULES.find((r) => r.ruleId === "vat-fi-food")!;
    expect(alcohol.priority).toBeLessThan(food.priority);
  });
});

describe("vat-fi-rc-eu-b2b", () => {
  it("normaali: vahvistettu EU-yritysostaja johtaa käännettyyn", () => {
    const d = run(
      fi({
        supplyType: "service",
        buyerCountry: "DE",
        buyerType: "business",
        buyerVatId: "DE123456789",
        buyerVatIdValid: true,
      }),
    );
    expect(d.ruleId).toBe("vat-fi-rc-eu-b2b");
    expect(d.reverseCharge).toBe(true);
    expect(d.vatRate).toBe(0);
  });

  it("rajatapaus: vahvistamaton tunniste ei riitä", () => {
    const d = run(
      fi({
        supplyType: "service",
        buyerCountry: "DE",
        buyerType: "business",
        buyerVatId: "DE123456789",
        buyerVatIdValid: false,
      }),
    );
    expect(d.ruleId).not.toBe("vat-fi-rc-eu-b2b");
    expect(d.reviewReasons).toContain("unverified_vat_id");
  });

  it("rajatapaus: tarkistamatta jättäminen ei ole sama kuin kelvollinen", () => {
    const d = run(
      fi({
        supplyType: "service",
        buyerCountry: "DE",
        buyerType: "business",
        buyerVatId: "DE123456789",
        // buyerVatIdValid puuttuu kokonaan
      }),
    );
    expect(d.reverseCharge).toBe(false);
    expect(d.reviewReasons).toContain("unverified_vat_id");
  });
});

describe("vat-fi-export-non-eu", () => {
  it("normaali: myynti EU:n ulkopuolelle on nollakantaista", () => {
    const d = run(fi({ buyerCountry: "US", buyerType: "business" }));
    expect(d.ruleId).toBe("vat-fi-export-non-eu");
    expect(d.vatRate).toBe(0);
  });

  it("rajatapaus: Norja on EU:n ulkopuolella vaikka onkin Euroopassa", () => {
    expect(run(fi({ buyerCountry: "NO", buyerType: "consumer" })).ruleId).toBe(
      "vat-fi-export-non-eu",
    );
  });
});

describe("vat-fi-oss-distance", () => {
  it("normaali: EU-kuluttajamyynti vaatii aina tarkistuksen", () => {
    const d = run(fi({ buyerCountry: "ES", buyerType: "consumer" }));
    expect(d.ruleId).toBe("vat-fi-oss-distance");
    expect(d.outcome).toBe("needs_review");
    expect(d.reviewReasons).toContain("rule_requires_review");
  });
});

describe("erityistapaukset", () => {
  it.each([
    ["tip", "vat-fi-tips"],
    ["gift_card", "vat-fi-giftcard"],
    ["deposit", "vat-fi-deposit"],
    ["business_entertainment", "ded-fi-entertainment"],
    ["employee_meal", "ded-fi-employee-meal"],
    ["packaging", "vat-fi-packaging"],
  ])("luokka %s osuu sääntöön %s", (category, ruleId) => {
    expect(run(fi({ category })).ruleId).toBe(ruleId);
  });

  it("edustuskulu ei ole vähennyskelpoinen", () => {
    const d = run(fi({ category: "business_entertainment" }));
    expect(d.deductible).toBe(false);
  });

  it("jokainen erityistapaus vaatii tarkistuksen", () => {
    for (const category of ["tip", "gift_card", "deposit", "packaging"]) {
      expect(run(fi({ category })).outcome).toBe("needs_review");
    }
  });
});

describe("virheelliset syötteet", () => {
  it("tuntematon luokka putoaa yleiseen tavarasääntöön", () => {
    const d = run(fi({ category: "täysin-tuntematon" }));
    expect(d.ruleId).toBe("vat-fi-goods");
  });

  it("tuntematon suoritetyyppi ilman luokkaa ei osu mihinkään", () => {
    const d = run(fi({ supplyType: "unknown" }));
    expect(d.outcome).toBe("needs_review");
    expect(d.reviewReasons).toContain("no_matching_rule");
  });

  it("tuntematon jurisdiktio ei tuota päätöstä", () => {
    const d = evaluate(
      { jurisdiction: "XX", transactionDate: DATE, category: "food" },
      FI_RULES,
    );
    expect(d.outcome).toBe("needs_review");
  });
});

describe("monta ALV-käsittelyä samalla dokumentilla (§11)", () => {
  it("ravintolan päiväraportti tuottaa kolme eri käsittelyä", () => {
    const result = classifyDocument({
      jurisdiction: "FI",
      transactionDate: DATE,
      supplyType: "goods",
      lines: [
        { lineNumber: 1, description: "Ruoka", category: "restaurant_food", netAmountCents: 453630 },
        { lineNumber: 2, description: "Alkoholi", category: "alcohol", netAmountCents: 72235 },
        { lineNumber: 3, description: "Palvelumaksu", category: "packaging", netAmountCents: 32000 },
      ],
    });

    expect(result.lines).toHaveLength(3);
    expect(result.treatmentCount).toBe(2); // FI-RED1 13,5 % ja FI-STD 25,5 % (palvelumaksu jakaa STD:n)
    expect(result.lines[0].decision.vatAmountCents).toBe(61240);
    expect(result.lines[1].decision.vatAmountCents).toBe(18420);
    expect(result.lines[2].decision.vatAmountCents).toBe(8160);
  });

  it("ei niputa koko dokumenttia yhteen verokantaan", () => {
    const result = classifyDocument({
      jurisdiction: "FI",
      transactionDate: DATE,
      supplyType: "goods",
      lines: [
        { lineNumber: 1, category: "restaurant_food", netAmountCents: 10000 },
        { lineNumber: 2, category: "alcohol", netAmountCents: 10000 },
      ],
    });
    const rates = result.lines.map((l) => l.decision.vatRate);
    expect(new Set(rates).size).toBe(2);
  });

  it("kokoaa tarkistussyyt duplikaatittomasti", () => {
    const result = classifyDocument({
      jurisdiction: "FI",
      transactionDate: DATE,
      supplyType: "goods",
      lines: [
        { lineNumber: 1, category: "restaurant_food", netAmountCents: 100 },
        { lineNumber: 2, category: "restaurant_food", netAmountCents: 200 },
      ],
    });
    expect(result.reviewReasons).toEqual(["demo_rule"]);
    expect(result.needsReview).toBe(true);
  });
});

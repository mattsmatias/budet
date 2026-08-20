/**
 * Moottorin yleiset takeet: determinismi, voimassaolo, ristiriidat.
 * Sääntökohtaiset tapaukset ovat tiedostossa rules-fi.test.ts.
 */

import { describe, expect, it } from "vitest";
import { ENGINE_VERSION, evaluate, normalizeFacts } from "../engine";
import type { RuleVersion, TaxFacts } from "../types";

const facts: TaxFacts = {
  jurisdiction: "FI",
  transactionDate: "2026-06-01",
  category: "food",
  supplyType: "goods",
  netAmountCents: 10000,
};

function rule(overrides: Partial<RuleVersion> = {}): RuleVersion {
  return {
    ruleId: "test-rule",
    version: "1.0",
    status: "active",
    priority: 50,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    jurisdiction: "FI",
    name: "Testisääntö",
    conditions: { jurisdiction: "FI", category: ["food"] },
    actions: { vatCode: "FI-RED1", vatRate: 0.135, deductible: true },
    ...overrides,
  };
}

describe("determinismi", () => {
  it("tuottaa saman päätöksen samasta syötteestä", () => {
    const rules = [rule()];
    const a = evaluate(facts, rules);
    const b = evaluate(facts, rules);
    expect(a).toEqual(b);
  });

  it("ei riipu sääntöjen syötejärjestyksestä", () => {
    const r1 = rule({ ruleId: "a", priority: 10 });
    const r2 = rule({ ruleId: "b", priority: 20 });
    const forward = evaluate(facts, [r1, r2]);
    const reversed = evaluate(facts, [r2, r1]);
    expect(forward.ruleId).toBe(reversed.ruleId);
    expect(forward.ruleId).toBe("a");
  });

  it("kirjaa moottoriversion päätökseen", () => {
    expect(evaluate(facts, [rule()]).engineVersion).toBe(ENGINE_VERSION);
  });

  it("säilyttää käytetyt faktat päätöksessä uudelleenajoa varten", () => {
    const decision = evaluate(facts, [rule()]);
    expect(decision.inputFacts.category).toBe("food");
    expect(decision.inputFacts.transactionDate).toBe("2026-06-01");
  });
});

describe("voimassaolo", () => {
  it("ei sovella sääntöä ennen voimaantuloa", () => {
    const decision = evaluate(
      { ...facts, transactionDate: "2025-12-31" },
      [rule({ effectiveFrom: "2026-01-01" })],
    );
    expect(decision.outcome).toBe("needs_review");
    expect(decision.reviewReasons).toContain("no_matching_rule");
  });

  it("ei sovella sääntöä voimassaolon päätyttyä", () => {
    const decision = evaluate(
      { ...facts, transactionDate: "2026-07-01" },
      [rule({ effectiveTo: "2026-06-30" })],
    );
    expect(decision.outcome).toBe("needs_review");
  });

  it("soveltaa sääntöä voimaantulopäivänä", () => {
    const decision = evaluate(
      { ...facts, transactionDate: "2026-01-01" },
      [rule({ effectiveFrom: "2026-01-01" })],
    );
    expect(decision.outcome).toBe("determined");
  });
});

describe("ristiriidat ja puuttuvat säännöt", () => {
  it("siirtää tarkistukseen kun kaksi sääntöä osuu samalla prioriteetilla", () => {
    const decision = evaluate(facts, [
      rule({ ruleId: "a", priority: 10 }),
      rule({ ruleId: "b", priority: 10 }),
    ]);
    expect(decision.outcome).toBe("needs_review");
    expect(decision.reviewReasons).toContain("rule_conflict");
    expect(decision.reason).toContain("Sääntöristiriita");
  });

  it("ei arvaa kun mikään sääntö ei osu", () => {
    const decision = evaluate({ ...facts, category: "tuntematon" }, [rule()]);
    expect(decision.outcome).toBe("needs_review");
    expect(decision.vatCode).toBeUndefined();
    expect(decision.confidence).toBe("low");
  });

  it("ei sovella toisen jurisdiktion sääntöä", () => {
    const decision = evaluate(facts, [rule({ jurisdiction: "SE" })]);
    expect(decision.outcome).toBe("needs_review");
  });
});

describe("sääntöstatus", () => {
  it("merkitsee demo-säännöllä tehdyn päätöksen tarkistettavaksi", () => {
    const decision = evaluate(facts, [rule({ status: "demo" })]);
    expect(decision.outcome).toBe("needs_review");
    expect(decision.reviewReasons).toContain("demo_rule");
    expect(decision.reason).toContain("demo-tasoinen");
  });

  it("ei käytä luonnosversiota oletuksena", () => {
    const decision = evaluate(facts, [rule({ status: "draft" })]);
    expect(decision.outcome).toBe("needs_review");
    expect(decision.reviewReasons).toContain("no_matching_rule");
  });
});

describe("normalizeFacts", () => {
  it("johtaa rajat ylittävyyden maista", () => {
    const n = normalizeFacts({
      jurisdiction: "FI",
      transactionDate: "2026-06-01",
      buyerCountry: "DE",
    });
    expect(n.crossBorder).toBe(true);
    expect(n.buyerInEu).toBe(true);
  });

  it("tunnistaa EU:n ulkopuolisen ostajan", () => {
    const n = normalizeFacts({
      jurisdiction: "FI",
      transactionDate: "2026-06-01",
      buyerCountry: "US",
    });
    expect(n.buyerInEu).toBe(false);
  });

  it("ei koskaan päättele ALV-tunnisteen kelpoisuutta muodosta", () => {
    const n = normalizeFacts({
      jurisdiction: "FI",
      transactionDate: "2026-06-01",
      buyerVatId: "DE123456789",
    });
    expect(n.buyerVatIdValid).toBeUndefined();
  });
});

describe("luottamus", () => {
  it("laskee luottamusta heikon poiminnan takia", () => {
    const strong = evaluate({ ...facts, extractionConfidence: 0.98 }, [rule()]);
    const weak = evaluate({ ...facts, extractionConfidence: 0.4 }, [rule()]);
    expect(weak.confidenceScore).toBeLessThan(strong.confidenceScore);
    expect(weak.reviewReasons).toContain("low_extraction_confidence");
  });

  it("merkitsee puuttuvan summan", () => {
    const decision = evaluate(
      { ...facts, netAmountCents: undefined, grossAmountCents: undefined },
      [rule()],
    );
    expect(decision.reviewReasons).toContain("missing_amount");
    expect(decision.vatAmountCents).toBeUndefined();
  });
});

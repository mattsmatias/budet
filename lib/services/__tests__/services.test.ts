import { describe, expect, it } from "vitest";
import { MockViesProvider, validateVatIdFormat } from "../vies";
import { planExport, toCsv } from "../export";
import { buildEntitlements, checkLimit, hasFeature, requireFeature, EntitlementError } from "../entitlements";
import { MockOcrProvider } from "../ocr/mock";
import type { TaxDecision } from "../../tax/types";

// ---------------------------------------------------------------------------
// VIES
// ---------------------------------------------------------------------------

describe("validateVatIdFormat", () => {
  it("hyväksyy oikean muotoisen saksalaisen tunnisteen", () => {
    const r = validateVatIdFormat("DE 811205325");
    expect(r.valid).toBe(true);
    expect(r.country).toBe("DE");
    expect(r.normalized).toBe("DE811205325");
  });

  it("hylkää väärän pituuden", () => {
    expect(validateVatIdFormat("DE12345").valid).toBe(false);
  });

  it("hylkää tuntemattoman maakoodin", () => {
    expect(validateVatIdFormat("XX123456789").valid).toBe(false);
  });

  it("hylkää roskan", () => {
    expect(validateVatIdFormat("ei ole tunniste").valid).toBe(false);
  });
});

describe("MockViesProvider", () => {
  const provider = new MockViesProvider();

  it("vahvistaa tunnetun demo-tunnisteen", async () => {
    const r = await provider.check("DE811205325");
    expect(r.status).toBe("valid");
    expect(r.companyName).toBe("Bauhaus AG");
    expect(r.consultationNumber).toBeDefined();
  });

  it("palauttaa format_error virheellisestä muodosta", async () => {
    expect((await provider.check("DE1")).status).toBe("format_error");
  });

  it("ei väitä tuntematonta tunnistetta kelvolliseksi", async () => {
    const r = await provider.check("FI12345678");
    expect(r.status).toBe("unavailable");
    expect(r.status).not.toBe("valid");
  });

  it("on deterministinen", async () => {
    const a = await provider.check("DE811205325");
    const b = await provider.check("DE811205325");
    expect(a.status).toBe(b.status);
    expect(a.companyName).toBe(b.companyName);
  });
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

function decision(overrides: Partial<TaxDecision> = {}): TaxDecision {
  return {
    outcome: "determined",
    ruleId: "vat-fi-food",
    ruleVersion: "2026.1",
    vatCode: "FI-RED1",
    vatRate: 0.135,
    vatAmountCents: 1350,
    reverseCharge: false,
    inputFacts: { jurisdiction: "FI", transactionDate: "2026-06-01" },
    reason: "Testipäätös",
    confidence: "high",
    confidenceScore: 0.95,
    engineVersion: "1.0.0",
    reviewReasons: [],
    ...overrides,
  };
}

const approvedDoc = {
  id: "doc-1",
  status: "approved",
  supplierName: "Ravintola Linnea",
  documentNumber: "PR-1",
  documentDate: "2026-06-14",
  currency: "EUR",
  netAmountCents: 10000,
  vatAmountCents: 1350,
  grossAmountCents: 11350,
  accountCode: "4000",
  decisions: [decision()],
};

describe("planExport", () => {
  it("sallii viennin kun kaikki on kunnossa", () => {
    const plan = planExport([approvedDoc]);
    expect(plan.ready).toBe(true);
    expect(plan.blocks).toHaveLength(0);
    expect(plan.rows).toHaveLength(1);
  });

  it("estää viennin kun dokumentti odottaa tarkistusta", () => {
    const plan = planExport([{ ...approvedDoc, status: "needs_review" }]);
    expect(plan.ready).toBe(false);
    expect(plan.blocks.map((b) => b.code)).toContain("needs_review");
  });

  it("kertoo täsmällisen syyn, ei yleistä virhettä", () => {
    const plan = planExport([{ ...approvedDoc, documentDate: null, supplierName: null }]);
    const codes = plan.blocks.map((b) => b.code);
    expect(codes).toContain("missing_date");
    expect(codes).toContain("missing_supplier");
    for (const block of plan.blocks) {
      expect(block.message).not.toMatch(/^Error/);
      expect(block.message.length).toBeGreaterThan(5);
    }
  });

  it("estää viennin kun verokohtelu on ratkaisematta", () => {
    const plan = planExport([
      { ...approvedDoc, decisions: [decision({ outcome: "needs_review" })] },
    ]);
    expect(plan.blocks.map((b) => b.code)).toContain("undetermined_decision");
  });

  it("vaatii kurssin muulle kuin eurolle", () => {
    const plan = planExport([{ ...approvedDoc, currency: "SEK", exchangeRate: null }]);
    expect(plan.blocks.map((b) => b.code)).toContain("missing_exchange_rate");
  });

  it("sallii nimenomaisen ohituksen", () => {
    const plan = planExport([{ ...approvedDoc, status: "needs_review" }], {
      overridden: true,
    });
    expect(plan.ready).toBe(true);
    // Este säilyy näkyvissä vaikka ohitus annettiin.
    expect(plan.blocks.length).toBeGreaterThan(0);
  });
});

describe("toCsv", () => {
  it("käyttää puolipistettä ja suomenkielisiä otsikoita", () => {
    const csv = toCsv(planExport([approvedDoc]).rows);
    const [header] = csv.split("\r\n");
    expect(header).toContain("ALV-koodi");
    expect(header.split(";")).toHaveLength(17);
  });

  it("suojaa erottimen sisältävän kentän", () => {
    const rows = planExport([
      { ...approvedDoc, decisions: [decision({ reason: "Sisältää; puolipisteen" })] },
    ]).rows;
    expect(toCsv(rows)).toContain('"Sisältää; puolipisteen"');
  });

  it("muuntaa sentit desimaaleiksi ilman liukulukuvirhettä", () => {
    const rows = planExport([
      { ...approvedDoc, grossAmountCents: 10, netAmountCents: 5 },
    ]).rows;
    expect(rows[0].grossAmount).toBe("0.10");
    expect(rows[0].netAmount).toBe("0.05");
  });
});

// ---------------------------------------------------------------------------
// Entitlements
// ---------------------------------------------------------------------------

const soloPlan = buildEntitlements("solo", "Solo", [
  { key: "documents_per_month", limit_value: 150, bool_value: null },
  { key: "timo", limit_value: null, bool_value: true },
  { key: "api", limit_value: null, bool_value: false },
]);

const firmPlan = buildEntitlements("firm", "Tilitoimisto", [
  { key: "documents_per_month", limit_value: null, bool_value: null },
]);

const usage = (documents: number) => ({
  used: { documents },
  periodStart: "2026-06-01",
  periodEnd: "2026-06-30",
});

describe("checkLimit", () => {
  it("sallii rajan sisällä", () => {
    const v = checkLimit(soloPlan, usage(10), "documents");
    expect(v.allowed).toBe(true);
    expect(v.allowed && v.remaining).toBe(140);
  });

  it("varoittaa 80 %:n kohdalla", () => {
    expect(checkLimit(soloPlan, usage(120), "documents")).toMatchObject({
      allowed: true,
      warn: true,
    });
  });

  it("estää rajan ylittyessä ja kertoo syyn", () => {
    const v = checkLimit(soloPlan, usage(150), "documents");
    expect(v.allowed).toBe(false);
    expect(!v.allowed && v.reason).toContain("150");
  });

  it("kohtelee null-rajaa rajattomana", () => {
    expect(checkLimit(firmPlan, usage(99999), "documents").allowed).toBe(true);
  });

  it("sallii tuntemattoman mittarin rajattomana", () => {
    expect(checkLimit(soloPlan, usage(0), "tuntematon").allowed).toBe(true);
  });
});

describe("features", () => {
  it("lukee ominaisuusliput", () => {
    expect(hasFeature(soloPlan, "timo")).toBe(true);
    expect(hasFeature(soloPlan, "api")).toBe(false);
  });

  it("requireFeature heittää kun ominaisuus puuttuu", () => {
    expect(() => requireFeature(soloPlan, "api")).toThrow(EntitlementError);
    expect(() => requireFeature(soloPlan, "timo")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// OCR
// ---------------------------------------------------------------------------

describe("MockOcrProvider", () => {
  const provider = new MockOcrProvider();
  const input = (fileName: string) => ({
    fileName,
    mimeType: "image/jpeg",
    bytes: new Uint8Array(),
  });

  it("tuottaa monirivisen päiväraportin", async () => {
    const r = await provider.extract(input("paivaraportti-linnea.pdf"));
    expect(r.lineItems).toHaveLength(3);
    expect(r.supplierName.value).toBe("Ravintola Linnea");
  });

  it("merkitsee heikon kuvan matalalla luottamuksella", async () => {
    const r = await provider.extract(input("IMG_2931.HEIC"));
    expect(r.overallConfidence).toBeLessThan(0.7);
  });

  it("on deterministinen", async () => {
    const a = await provider.extract(input("bauhaus.pdf"));
    const b = await provider.extract(input("bauhaus.pdf"));
    expect(a.supplierVatId.value).toBe(b.supplierVatId.value);
    expect(a.lineItems).toEqual(b.lineItems);
  });

  it("palauttaa yleiskuitin tuntemattomalle tiedostolle", async () => {
    const r = await provider.extract(input("satunnainen.jpg"));
    expect(r.lineItems.length).toBeGreaterThan(0);
  });
});

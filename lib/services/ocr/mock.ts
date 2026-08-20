/**
 * Deterministinen mock-poimija.
 *
 * Ei kutsu verkkoa. Tuottaa uskottavan mutta selvästi demoksi merkityn
 * poiminnan tiedostonimen perusteella, jotta koko putki upload → poiminta →
 * luokittelu → review → export on ajettavissa ja testattavissa ilman
 * API-avaimia (§74, §80).
 *
 * OIKEAN TARJOAJAN LIITTÄMINEN: toteuta OcrProvider-rajapinta uudessa
 * tiedostossa (esim. anthropic.ts), rekisteröi se index.ts:n listaan ja
 * aseta ympäristömuuttuja. Muuta sovellusta ei tarvitse koskea.
 */

import {
  field,
  missing,
  type ExtractionInput,
  type ExtractionResult,
  type ExtractedLineItem,
  type OcrProvider,
} from "./types";

interface Fixture {
  match: RegExp;
  build: () => Omit<ExtractionResult, "provider" | "processingMs">;
}

function line(
  lineNumber: number,
  description: string,
  category: string,
  netCents: number,
  rate: number,
  confidence = 0.95,
): ExtractedLineItem {
  const vat = Math.round(netCents * rate);
  return {
    lineNumber,
    description: field(description, confidence),
    quantity: field(1, confidence),
    unitPriceCents: field(netCents, confidence),
    netAmountCents: field(netCents, confidence),
    vatRate: field(rate, confidence),
    vatAmountCents: field(vat, confidence),
    grossAmountCents: field(netCents + vat, confidence),
    suggestedCategory: field(category, confidence, "llm"),
  };
}

const FIXTURES: Fixture[] = [
  {
    // Ravintolan päiväraportti: monta ALV-käsittelyä yhdellä dokumentilla.
    match: /paivaraportti|päiväraportti|daily|linnea/i,
    build: () => {
      const lines = [
        line(1, "Ruokamyynti", "restaurant_food", 453630, 0.135),
        line(2, "Alkoholimyynti", "alcohol", 72235, 0.255),
        line(3, "Palvelumaksu", "packaging", 32000, 0.255, 0.72),
      ];
      return {
        documentKind: field("daily_report", 0.97),
        supplierName: field("Ravintola Linnea", 0.98),
        supplierAddress: field("Hämeenkatu 12, 33100 Tampere", 0.9),
        supplierCountry: field("FI", 0.99),
        supplierVatId: field("FI28765432", 0.94),
        documentNumber: field("PR-2026-0614", 0.93),
        documentDate: field("2026-06-14", 0.97),
        dueDate: missing(),
        currency: field("EUR", 0.99),
        ...totals(lines),
        paymentMethod: field("card", 0.85),
        lineItems: lines,
        overallConfidence: 0.93,
      };
    },
  },
  {
    // Saksalainen B2B-lasku: rajat ylittävä, vaatii VIES-tarkistuksen.
    match: /bauhaus|germany|de-/i,
    build: () => {
      const lines = [line(1, "Werkzeug-Set", "tools", 128000, 0)];
      return {
        documentKind: field("invoice", 0.96),
        supplierName: field("Bauhaus AG", 0.97),
        supplierAddress: field("Gutenbergstraße 4, 68167 Mannheim", 0.88),
        supplierCountry: field("DE", 0.98),
        supplierVatId: field("DE811205325", 0.95),
        documentNumber: field("RE-884213", 0.94),
        documentDate: field("2026-05-14", 0.96),
        dueDate: field("2026-06-13", 0.9),
        currency: field("EUR", 0.99),
        ...totals(lines),
        paymentMethod: field("invoice", 0.8),
        lineItems: lines,
        overallConfidence: 0.91,
      };
    },
  },
  {
    // Heikkolaatuinen kuittikuva: matala luottamus → tarkistukseen.
    match: /bolt|taksi|blurry|img_/i,
    build: () => {
      const lines = [line(1, "Matka Helsinki", "passenger_transport", 2350, 0.1, 0.55)];
      return {
        documentKind: field("receipt", 0.72),
        supplierName: field("Bolt Operations OÜ", 0.61),
        supplierAddress: missing(),
        supplierCountry: field("EE", 0.58),
        supplierVatId: missing(),
        documentNumber: field("BOLT-99213", 0.6),
        documentDate: field("2026-06-02", 0.71),
        dueDate: missing(),
        currency: field("EUR", 0.93),
        ...totals(lines),
        paymentMethod: field("card", 0.66),
        lineItems: lines,
        overallConfidence: 0.62,
      };
    },
  },
];

function totals(lines: ExtractedLineItem[]) {
  const net = lines.reduce((s, l) => s + (l.netAmountCents.value ?? 0), 0);
  const vat = lines.reduce((s, l) => s + (l.vatAmountCents.value ?? 0), 0);
  return {
    netAmountCents: field(net, 0.96),
    vatAmountCents: field(vat, 0.96),
    grossAmountCents: field(net + vat, 0.96),
  };
}

/** Yleiskuitti kun mikään fixture ei osu. */
function fallback(fileName: string): Omit<ExtractionResult, "provider" | "processingMs"> {
  const lines = [line(1, "Ostos", "groceries", 1290, 0.135, 0.8)];
  return {
    documentKind: field("receipt", 0.8),
    supplierName: field("K-Market", 0.82),
    supplierAddress: missing(),
    supplierCountry: field("FI", 0.9),
    supplierVatId: missing(),
    documentNumber: field(fileName.replace(/\.[^.]+$/, ""), 0.5),
    documentDate: field("2026-06-10", 0.85),
    dueDate: missing(),
    currency: field("EUR", 0.98),
    ...totals(lines),
    paymentMethod: field("card", 0.75),
    lineItems: lines,
    overallConfidence: 0.81,
  };
}

export class MockOcrProvider implements OcrProvider {
  readonly name = "mock";

  isConfigured(): boolean {
    return true;
  }

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const started = Date.now();
    const fixture = FIXTURES.find((f) => f.match.test(input.fileName));
    const result = fixture ? fixture.build() : fallback(input.fileName);
    return {
      ...result,
      provider: this.name,
      modelVersion: "fixture-2026.1",
      processingMs: Date.now() - started,
    };
  }
}

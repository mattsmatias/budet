/**
 * Dokumenttitason luokittelu.
 *
 * Yksi dokumentti voi tuottaa monta erilaista ALV-käsittelyä (§11).
 * Tämä moduuli ajaa moottorin jokaiselle riville erikseen ja kokoaa
 * dokumenttitason yhteenvedon. Riviä ei koskaan niputeta yhteen
 * verokantaan jos rivitieto sallii tarkemman käsittelyn.
 */

import { evaluate } from "./engine";
import { rulesFor } from "./rules/fi";
import type { EngineOptions, TaxDecision, TaxFacts } from "./types";

export interface LineInput {
  lineNumber: number;
  description?: string;
  category?: string;
  netAmountCents?: number;
  grossAmountCents?: number;
  extractionConfidence?: number;
}

export interface DocumentInput {
  jurisdiction: string;
  transactionDate: string;
  supplierCountry?: string;
  buyerCountry?: string;
  buyerType?: TaxFacts["buyerType"];
  buyerVatId?: string;
  buyerVatIdValid?: boolean;
  supplyType?: TaxFacts["supplyType"];
  currency?: string;
  lines: LineInput[];
}

export interface LineDecision {
  lineNumber: number;
  description?: string;
  decision: TaxDecision;
}

export interface DocumentClassification {
  lines: LineDecision[];
  /** Erilliset ALV-käsittelyt: montako eri (vatCode, vatRate) -paria. */
  treatmentCount: number;
  totalVatCents: number;
  totalNetCents: number;
  needsReview: boolean;
  reviewReasons: string[];
}

export function classifyDocument(
  input: DocumentInput,
  options: EngineOptions = {},
): DocumentClassification {
  const rules = rulesFor(input.jurisdiction);

  const lines: LineDecision[] = input.lines.map((line) => {
    const facts: TaxFacts = {
      jurisdiction: input.jurisdiction,
      transactionDate: input.transactionDate,
      supplierCountry: input.supplierCountry,
      buyerCountry: input.buyerCountry,
      buyerType: input.buyerType,
      buyerVatId: input.buyerVatId,
      buyerVatIdValid: input.buyerVatIdValid,
      supplyType: input.supplyType,
      category: line.category,
      netAmountCents: line.netAmountCents,
      grossAmountCents: line.grossAmountCents,
      currency: input.currency,
      extractionConfidence: line.extractionConfidence,
    };

    return {
      lineNumber: line.lineNumber,
      description: line.description,
      decision: evaluate(facts, rules, options),
    };
  });

  const treatments = new Set(
    lines.map((l) => `${l.decision.vatCode ?? "?"}:${l.decision.vatRate ?? "?"}`),
  );

  const totalVatCents = lines.reduce(
    (sum, l) => sum + (l.decision.vatAmountCents ?? 0),
    0,
  );
  const totalNetCents = input.lines.reduce(
    (sum, l) => sum + (l.netAmountCents ?? 0),
    0,
  );

  // Järjestetty ja duplikaatiton, jotta yhteenveto on toistettava.
  const reviewReasons = [
    ...new Set(lines.flatMap((l) => l.decision.reviewReasons)),
  ].sort();

  return {
    lines,
    treatmentCount: treatments.size,
    totalVatCents,
    totalNetCents,
    needsReview: reviewReasons.length > 0,
    reviewReasons,
  };
}

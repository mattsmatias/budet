/**
 * Demo-aineisto (§47).
 *
 * Kaikki tämä on selvästi merkittävä demoksi käyttöliittymässä. Luvut ovat
 * havainnollistavia — ne EIVÄT ole oikeudellinen kannanotto. Päätökset
 * lasketaan oikealla sääntömoottorilla, joten demo näyttää saman logiikan
 * kuin tuotanto, mukaan lukien tarkistusmerkinnät.
 */

import { classifyDocument, type DocumentClassification } from "../tax/document";

export interface DemoDocument {
  id: string;
  supplier: string;
  supplierVatId?: string;
  country: string;
  documentNumber: string;
  date: string;
  kind: "receipt" | "invoice" | "daily_report";
  status:
    | "received"
    | "processing"
    | "processed"
    | "needs_review"
    | "approved"
    | "exported"
    | "error";
  currency: string;
  crossBorder: boolean;
  viesStatus?: "valid" | "unavailable" | "not_checked";
  assignedTo?: string;
  classification: DocumentClassification;
}

const DATE = "2026-06-14";

function build(
  meta: Omit<DemoDocument, "classification">,
  lines: {
    lineNumber: number;
    description: string;
    category: string;
    netAmountCents: number;
    extractionConfidence?: number;
  }[],
  overrides: Partial<Parameters<typeof classifyDocument>[0]> = {},
): DemoDocument {
  return {
    ...meta,
    classification: classifyDocument({
      jurisdiction: "FI",
      transactionDate: meta.date,
      supplyType: "goods",
      currency: meta.currency,
      lines,
      ...overrides,
    }),
  };
}

export const DEMO_DOCUMENTS: DemoDocument[] = [
  build(
    {
      id: "doc-linnea-0614",
      supplier: "Ravintola Linnea",
      supplierVatId: "FI28765432",
      country: "FI",
      documentNumber: "PR-2026-0614",
      date: DATE,
      kind: "daily_report",
      status: "needs_review",
      currency: "EUR",
      crossBorder: false,
      assignedTo: "Anna Lehtinen",
    },
    [
      { lineNumber: 1, description: "Ruokamyynti", category: "restaurant_food", netAmountCents: 453630 },
      { lineNumber: 2, description: "Alkoholimyynti", category: "alcohol", netAmountCents: 72235 },
      { lineNumber: 3, description: "Palvelumaksu", category: "packaging", netAmountCents: 32000, extractionConfidence: 0.72 },
    ],
  ),
  build(
    {
      id: "doc-bauhaus-0514",
      supplier: "Bauhaus AG",
      supplierVatId: "DE811205325",
      country: "DE",
      documentNumber: "RE-884213",
      date: "2026-05-14",
      kind: "invoice",
      status: "needs_review",
      currency: "EUR",
      crossBorder: true,
      viesStatus: "valid",
    },
    [{ lineNumber: 1, description: "Werkzeug-Set", category: "tools", netAmountCents: 128000 }],
    {
      buyerCountry: "FI",
      supplierCountry: "DE",
      buyerType: "business",
      buyerVatIdValid: true,
      supplyType: "goods",
    },
  ),
  build(
    {
      id: "doc-bolt-0602",
      supplier: "Bolt Operations OÜ",
      country: "EE",
      documentNumber: "BOLT-99213",
      date: "2026-06-02",
      kind: "receipt",
      status: "needs_review",
      currency: "EUR",
      crossBorder: true,
      viesStatus: "not_checked",
    },
    [
      {
        lineNumber: 1,
        description: "Matka Helsinki",
        category: "passenger_transport",
        netAmountCents: 2350,
        extractionConfidence: 0.55,
      },
    ],
    { buyerCountry: "FI", supplierCountry: "EE", buyerType: "business" },
  ),
  build(
    {
      id: "doc-kmarket-0610",
      supplier: "K-Market Kaleva",
      supplierVatId: "FI19283746",
      country: "FI",
      documentNumber: "4471",
      date: "2026-06-10",
      kind: "receipt",
      status: "approved",
      currency: "EUR",
      crossBorder: false,
    },
    [
      { lineNumber: 1, description: "Kahvi 500 g", category: "groceries", netAmountCents: 1290 },
      { lineNumber: 2, description: "Maito 1 l", category: "groceries", netAmountCents: 149 },
    ],
  ),
  build(
    {
      id: "doc-dna-0601",
      supplier: "DNA Oyj",
      supplierVatId: "FI16230187",
      country: "FI",
      documentNumber: "LN-77120043",
      date: "2026-06-01",
      kind: "invoice",
      status: "exported",
      currency: "EUR",
      crossBorder: false,
    },
    [{ lineNumber: 1, description: "Yritysliittymä 06/2026", category: "telecom", netAmountCents: 3900 }],
    { supplyType: "service" },
  ),
];

export function getDemoDocument(id: string): DemoDocument | undefined {
  return DEMO_DOCUMENTS.find((d) => d.id === id);
}

/** Dashboardin tunnusluvut lasketaan samasta aineistosta, ei kovakoodata. */
export function demoMetrics() {
  const docs = DEMO_DOCUMENTS;
  const vatCents = docs.reduce((s, d) => s + d.classification.totalVatCents, 0);
  const deductibleCents = docs.reduce(
    (s, d) =>
      s +
      d.classification.lines
        .filter((l) => l.decision.deductible === true)
        .reduce((t, l) => t + (l.decision.vatAmountCents ?? 0), 0),
    0,
  );

  return {
    received: docs.length,
    processed: docs.filter((d) => d.status !== "received" && d.status !== "processing").length,
    needsReview: docs.filter((d) => d.status === "needs_review").length,
    approved: docs.filter((d) => d.status === "approved").length,
    exported: docs.filter((d) => d.status === "exported").length,
    vatCents,
    deductibleCents,
    nonDeductibleCents: vatCents - deductibleCents,
    crossBorder: docs.filter((d) => d.crossBorder).length,
    viesChecks: docs.filter((d) => d.viesStatus && d.viesStatus !== "not_checked").length,
  };
}

/** Tilitoimiston asiakasnäkymä (§21). */
export const DEMO_CLIENTS = [
  { id: "c1", name: "Pizzeria Linnea Oy", pending: 3, review: 2, deadline: "2026-07-12", status: "review" },
  { id: "c2", name: "Kampaamo Solmu", pending: 0, review: 0, deadline: "2026-07-12", status: "delivered" },
  { id: "c3", name: "Rakennus Virtanen Oy", pending: 8, review: 1, deadline: "2026-07-12", status: "collecting" },
  { id: "c4", name: "Studio Meri", pending: 1, review: 4, deadline: "2026-07-12", status: "review" },
] as const;

/**
 * Silta dokumenttinäkymän ja vientipalvelun välillä.
 *
 * Vientipalvelu ei tunne käyttöliittymän tyyppejä eikä päinvastoin; tämä
 * on ainoa paikka jossa muunnos tehdään.
 */

import type { ExportableDocument } from "@/lib/services/export";
import type { DocumentView } from "./documents";

/** Tilat joista dokumentti voi ylipäätään edetä vientiin. */
export const EXPORT_CANDIDATE_STATUSES = ["processed", "needs_review", "approved"];

export function toExportable(doc: DocumentView): ExportableDocument {
  const net = doc.classification.totalNetCents;
  const vat = doc.classification.totalVatCents;

  return {
    id: doc.id,
    status: doc.status,
    supplierName: doc.supplier,
    supplierVatId: doc.supplierVatId ?? null,
    documentNumber: doc.documentNumber,
    documentDate: doc.date === "—" ? null : doc.date,
    currency: doc.currency,
    // Euromääräinen ei tarvitse kurssia; muille se on pakollinen ja
    // puuttuessaan estää viennin.
    exchangeRate: doc.currency === "EUR" ? 1 : null,
    netAmountCents: net,
    vatAmountCents: vat,
    grossAmountCents: net + vat,
    accountCode: null,
    decisions: doc.classification.lines.map((l) => l.decision),
  };
}

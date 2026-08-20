/**
 * Kirjanpidon vientipalvelu (§20, §51).
 *
 * Keskeinen sääntö: dokumenttia jolta puuttuu vaadittu tieto tai joka odottaa
 * tarkistusta EI viedä. Este kerrotaan täsmällisesti, ei yleisenä virheenä.
 * Käyttäjä voi ohittaa eston vain nimenomaisella perustellulla päätöksellä,
 * ja ohitus kirjataan audit trailiin.
 */

import type { TaxDecision } from "../../tax/types";

export type ExportFormat =
  | "csv"
  | "excel_csv"
  | "saft"
  | "procountor"
  | "netvisor"
  | "economic";

export interface ExportableDocument {
  id: string;
  status: string;
  supplierName?: string | null;
  supplierVatId?: string | null;
  documentNumber?: string | null;
  documentDate?: string | null;
  currency?: string | null;
  exchangeRate?: number | null;
  netAmountCents?: number | null;
  vatAmountCents?: number | null;
  grossAmountCents?: number | null;
  accountCode?: string | null;
  costCenter?: string | null;
  project?: string | null;
  decisions: TaxDecision[];
}

export interface ExportBlock {
  documentId: string;
  code: string;
  message: string;
}

export interface ExportRow {
  documentId: string;
  documentDate: string;
  supplier: string;
  account: string;
  vatCode: string;
  vatRate: string;
  vatAmount: string;
  netAmount: string;
  grossAmount: string;
  currency: string;
  exchangeRate: string;
  costCenter: string;
  project: string;
  description: string;
  ruleId: string;
  ruleVersion: string;
  approvalStatus: string;
}

export interface ExportPlan {
  rows: ExportRow[];
  blocks: ExportBlock[];
  /** Vienti on sallittu vasta kun blocks on tyhjä tai ohitus on annettu. */
  ready: boolean;
}

const BLOCK_MESSAGES: Record<string, string> = {
  not_approved: "Dokumenttia ei ole hyväksytty.",
  needs_review: "Dokumentti odottaa tarkistusta.",
  missing_date: "Tositepäivä puuttuu.",
  missing_supplier: "Toimittajan nimi puuttuu.",
  missing_amount: "Summa puuttuu.",
  missing_currency: "Valuutta puuttuu.",
  missing_exchange_rate: "Muun kuin euromääräisen tositteen kurssi puuttuu.",
  no_decision: "Verotuspäätöstä ei ole tehty.",
  undetermined_decision: "Verokohtelu on ratkaisematta.",
  missing_vat_code: "ALV-koodi puuttuu.",
  missing_account: "Kirjanpitotili puuttuu.",
};

/**
 * Rakentaa vientisuunnitelman. Ei kirjoita mitään — palauttaa rivit ja esteet,
 * jotta käyttöliittymä voi näyttää tarkalleen mikä estää viennin.
 */
export function planExport(
  documents: ExportableDocument[],
  options: { overridden?: boolean } = {},
): ExportPlan {
  const rows: ExportRow[] = [];
  const blocks: ExportBlock[] = [];

  for (const doc of documents) {
    const docBlocks = validateDocument(doc);
    blocks.push(...docBlocks);

    // Rivit rakennetaan silti, jotta käyttäjä näkee mitä olisi tulossa.
    for (const decision of doc.decisions) {
      rows.push(toRow(doc, decision));
    }
  }

  return {
    rows,
    blocks,
    ready: blocks.length === 0 || options.overridden === true,
  };
}

function validateDocument(doc: ExportableDocument): ExportBlock[] {
  const found: string[] = [];

  if (doc.status === "needs_review") found.push("needs_review");
  else if (doc.status !== "approved" && doc.status !== "exported") {
    found.push("not_approved");
  }

  if (!doc.documentDate) found.push("missing_date");
  if (!doc.supplierName) found.push("missing_supplier");
  if (doc.grossAmountCents === null || doc.grossAmountCents === undefined) {
    found.push("missing_amount");
  }
  if (!doc.currency) found.push("missing_currency");
  if (doc.currency && doc.currency !== "EUR" && !doc.exchangeRate) {
    found.push("missing_exchange_rate");
  }
  if (doc.decisions.length === 0) found.push("no_decision");

  for (const decision of doc.decisions) {
    if (decision.outcome !== "determined") {
      found.push("undetermined_decision");
      break;
    }
    if (!decision.vatCode) {
      found.push("missing_vat_code");
      break;
    }
  }

  return found.map((code) => ({
    documentId: doc.id,
    code,
    message: BLOCK_MESSAGES[code] ?? code,
  }));
}

function toRow(doc: ExportableDocument, decision: TaxDecision): ExportRow {
  return {
    documentId: doc.id,
    documentDate: doc.documentDate ?? "",
    supplier: doc.supplierName ?? "",
    account: doc.accountCode ?? "",
    vatCode: decision.vatCode ?? "",
    vatRate: decision.vatRate !== undefined ? String(decision.vatRate) : "",
    vatAmount: centsToDecimal(decision.vatAmountCents),
    netAmount: centsToDecimal(doc.netAmountCents),
    grossAmount: centsToDecimal(doc.grossAmountCents),
    currency: doc.currency ?? "",
    exchangeRate: doc.exchangeRate !== null && doc.exchangeRate !== undefined
      ? String(doc.exchangeRate)
      : "",
    costCenter: doc.costCenter ?? "",
    project: doc.project ?? "",
    description: decision.reason,
    ruleId: decision.ruleId ?? "",
    ruleVersion: decision.ruleVersion ?? "",
    approvalStatus: doc.status,
  };
}

function centsToDecimal(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

const CSV_COLUMNS: (keyof ExportRow)[] = [
  "documentId", "documentDate", "supplier", "account", "vatCode", "vatRate",
  "vatAmount", "netAmount", "grossAmount", "currency", "exchangeRate",
  "costCenter", "project", "description", "ruleId", "ruleVersion", "approvalStatus",
];

const CSV_HEADERS = [
  "Tosite", "Päivä", "Toimittaja", "Tili", "ALV-koodi", "ALV-kanta",
  "ALV", "Veroton", "Verollinen", "Valuutta", "Kurssi",
  "Kustannuspaikka", "Projekti", "Selite", "Sääntö", "Sääntöversio", "Tila",
];

/** Muodostaa CSV:n. Erotin on puolipiste, koska suomalainen Excel odottaa sitä. */
export function toCsv(rows: ExportRow[], delimiter = ";"): string {
  const lines = [CSV_HEADERS.join(delimiter)];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((c) => escapeCsv(row[c], delimiter)).join(delimiter));
  }
  return lines.join("\r\n");
}

function escapeCsv(value: string, delimiter: string): string {
  if (value.includes(delimiter) || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

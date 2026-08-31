/**
 * Raportti tiedostoksi.
 *
 * Yksi rakentaja, kolme käyttöpaikkaa: CSV-lataus, Excel-lataus ja
 * tallennus Tiedostoihin. Aiemmin lataukset rakensivat tiedostot
 * kumpikin omassa reitissään, ja tallennus olisi ollut kolmas kopio.
 *
 * Kolme rakentajaa antaisi ennen pitkää saman raportin kolmena eri
 * lukuna — ja ero löytyisi vasta kun joku vertaa ladattua ja
 * tallennettua tiedostoa keskenään.
 *
 * ---------------------------------------------------------------------
 * KIRJANPITO ON OMA OIKEUTENSA
 * ---------------------------------------------------------------------
 *
 * reports.export riittää kuluraporttiin, mutta kirjanpito sisältää
 * tilikartan ja tositteet. Sääntö on tässä eikä kutsupaikoissa: jos se
 * olisi kolmessa paikassa, kolmas unohtuisi.
 *
 * Nimenomaan kirjanpitoa pyytänyt saa tietää ettei oikeus riitä. Koko
 * kuukauden työkirjaa pyytänyt saa kirjan ilman niitä välilehtiä — se
 * ei ollut pyyntö kirjanpidosta.
 */

import type { AdminText } from "@/lib/i18n/admin-text";
import type { AppLocale } from "@/lib/i18n/app-locales";
import { can } from "./permissions";
import {
  ACCOUNTING_KINDS,
  buildReportRows,
  REPORT_KINDS,
  type ReportKind,
} from "./report-rows";
import type { Role } from "./types";
import { buildXlsx, type CellValue } from "@/lib/xlsx";

export type ReportFormat = "csv" | "xlsx";

export interface ReportRequest {
  restaurantId: string;
  role: Role;
  timezone: string;
  locale: AppLocale;
  t: AdminText;
  /** null = koko kuukausi yhtenä työkirjana. Vain xlsx tukee sitä. */
  kind: ReportKind | null;
  month: string;
  format: ReportFormat;
}

export interface ReportFile {
  fileName: string;
  mime: string;
  bytes: Uint8Array;
  text?: string;
}

export type ReportProblem = "kind" | "accounting" | "format";

export function isReportProblem(
  value: ReportFile | ReportProblem,
): value is ReportProblem {
  return typeof value === "string";
}

const MIME: Record<ReportFormat, string> = {
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function reportSheetNames(t: AdminText): Record<ReportKind, string> {
  return {
    kulut: t.raportti.expensesWord,
    kategoriat: t.raportti.sheetCategories,
    kuitit: t.raportti.receiptsWord,
    toimittajat: t.raportti.suppliersWord,
    budjetit: t.raportti.budgetsWord,
    tyoaika: t.raportti.sheetHours,
    henkilostokulut: t.raportti.staffCosts,
    alv: "ALV",
    paivakirja: t.raportti.sheetJournal,
    paakirja: t.raportti.sheetLedger,
    tuloslaskelma: t.raportti.sheetIncome,
    tase: t.raportti.sheetBalance,
  };
}

export async function buildReportFile(
  request: ReportRequest,
): Promise<ReportFile | ReportProblem> {
  const { kind, format, role } = request;

  if (kind !== null && !REPORT_KINDS.includes(kind)) return "kind";

  /* CSV on yksi taulukko. Koko kuukausi tarvitsee välilehdet. */
  if (kind === null && format === "csv") return "format";

  const showAccounting = can(role, "accounting.view");

  if (kind !== null && ACCOUNTING_KINDS.includes(kind) && !showAccounting) {
    return "accounting";
  }

  const kinds = kind === null ? REPORT_KINDS : [kind];
  const allowed = showAccounting
    ? kinds
    : kinds.filter((k) => !ACCOUNTING_KINDS.includes(k));

  if (format === "csv") {
    const rows = await buildReportRows(
      allowed[0],
      request.restaurantId,
      request.month,
      role,
      request.timezone,
      request.locale,
    );

    /*
     * Puolipiste erottimena ja UTF-8 BOM alkuun.
     *
     * Suomalainen Excel avaa tiedoston silloin suoraan oikein. Pilkku
     * erottimena rikkoisi desimaalipilkulliset summat.
     */
    const text = "﻿" + rows.map((r) => r.map(escapeCell).join(";")).join("\r\n");

    return {
      fileName: `restoflow-${allowed[0]}-${request.month}.csv`,
      mime: MIME.csv,
      bytes: new TextEncoder().encode(text),
      text,
    };
  }

  const names = reportSheetNames(request.t);
  const sheets = [];

  for (const each of allowed) {
    const rows = await buildReportRows(
      each,
      request.restaurantId,
      request.month,
      role,
      request.timezone,
      request.locale,
    );
    sheets.push({ name: names[each], rows: rows.map(toCells) });
  }

  return {
    fileName: `restoflow-${kind ?? "raportit"}-${request.month}.xlsx`,
    mime: MIME.xlsx,
    bytes: buildXlsx(sheets),
  };
}

// ---------------------------------------------------------------------------
// Solut
// ---------------------------------------------------------------------------

/** Lainausmerkit kahdennetaan ja kenttä lainataan jos siinä on erottimia. */
function escapeCell(value: string): string {
  const text = String(value ?? "");
  if (/[";\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/**
 * Muuntaa raportin tekstirivin solutyypeiksi.
 *
 * Suomalainen desimaalipilkku ja euromerkki tunnistetaan luvuksi, jotta
 * Excelissä voi summata. Kaikki muu jää tekstiksi — esimerkiksi
 * kuittinumero "0012" muuttuisi lukuna muotoon 12.
 */
function toCells(row: string[]): CellValue[] {
  return row.map((value) => {
    const text = String(value ?? "").trim();
    if (text === "") return null;

    const numeric = parseFinnishNumber(text);
    return numeric === null ? text : numeric;
  });
}

function parseFinnishNumber(text: string): number | null {
  /* Alkunollat ovat tunniste, ei luku. */
  if (/^0\d/.test(text)) return null;

  const cleaned = text.replace(/\s| /g, "").replace(/€/g, "").replace(/%$/, "");

  if (cleaned === "" || !/^-?\d+(?:,\d+)?$/.test(cleaned)) return null;

  const parsed = Number.parseFloat(cleaned.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

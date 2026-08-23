/**
 * Raporttien Excel-vienti.
 *
 * Ero CSV:hen: luvut kirjoitetaan lukuina, joten Excelissä voi laskea
 * niillä heti. CSV:ssä kaikki on tekstiä, ja "1 234,50 €" on Excelille
 * merkkijono jota ei voi summata.
 *
 * Rivit tulevat samasta lähteestä kuin CSV. Kaksi erillistä rakentajaa
 * antaisi ennen pitkää saman raportin kahtena eri lukuna.
 */

import { NextResponse, type NextRequest } from "next/server";
import { ISO_MONTH } from "@/lib/restoflow/dates";
import { getActiveRestaurant, getUser } from "@/lib/restoflow/session";
import { can } from "@/lib/restoflow/permissions";
import { monthIn } from "@/lib/restoflow/clock-context";
import {
  buildReportRows,
  REPORT_KINDS,
  type ReportKind,
} from "@/lib/restoflow/report-rows";
import { buildXlsx, type CellValue } from "@/lib/xlsx";

const SHEET_NAMES: Record<ReportKind, string> = {
  kulut: "Kulut",
  kategoriat: "Kategoriat",
  kuitit: "Kuitit",
  toimittajat: "Toimittajat",
  budjetit: "Budjetit",
  tyoaika: "Työaika",
  henkilostokulut: "Henkilöstökulut",
};

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Kirjautuminen vaaditaan." }, { status: 401 });
  }

  const restaurant = await getActiveRestaurant();
  if (!restaurant) {
    return NextResponse.json({ error: "Ravintolaa ei löytynyt." }, { status: 404 });
  }

  if (!can(restaurant.role, "reports.export")) {
    return NextResponse.json(
      { error: "Sinulla ei ole oikeutta viedä raportteja." },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const requested = searchParams.get("kuukausi");
  const month =
    requested && ISO_MONTH.test(requested)
      ? requested
      : monthIn(restaurant.timezone);

  const single = searchParams.get("tyyppi") as ReportKind | null;

  // Ilman tyyppiä koko kuukausi yhtenä työkirjana: kirjanpitäjä saa
  // kaiken yhdellä latauksella eikä seitsemää tiedostoa.
  const kinds =
    single === null
      ? REPORT_KINDS
      : REPORT_KINDS.includes(single)
        ? [single]
        : null;

  if (kinds === null) {
    return NextResponse.json(
      { error: "Tuntematon raporttityyppi.", allowed: REPORT_KINDS },
      { status: 400 },
    );
  }

  const sheets = [];
  for (const kind of kinds) {
    const rows = await buildReportRows(kind, restaurant.id, month, restaurant.role, restaurant.timezone);
    sheets.push({ name: SHEET_NAMES[kind], rows: rows.map(toCells) });
  }

  const file = buildXlsx(sheets);
  const name = single ?? "raportit";

  return new NextResponse(file as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="restoflow-${name}-${month}.xlsx"`,
      "Content-Length": String(file.length),
      "Cache-Control": "no-store",
    },
  });
}

// ---------------------------------------------------------------------------

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
  // Alkunollat ovat tunniste, ei luku.
  if (/^0\d/.test(text)) return null;

  const cleaned = text
    .replace(/\s| /g, "")
    .replace(/€/g, "")
    .replace(/%$/, "");

  if (cleaned === "" || !/^-?\d+(?:,\d+)?$/.test(cleaned)) return null;

  const parsed = Number.parseFloat(cleaned.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

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
import { adminText } from "@/lib/i18n/admin-text";
import type { AdminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { ISO_MONTH } from "@/lib/restoflow/dates";
import { getActiveRestaurant, getUser } from "@/lib/restoflow/session";
import { can } from "@/lib/restoflow/permissions";
import { monthIn } from "@/lib/restoflow/clock-context";
import {
  buildReportRows,
  ACCOUNTING_KINDS,
  REPORT_KINDS,
  type ReportKind,
} from "@/lib/restoflow/report-rows";
import { buildXlsx, type CellValue } from "@/lib/xlsx";

const arkkiNimet = (t: AdminText): Record<ReportKind, string> => ({
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
});

export async function GET(request: NextRequest) {
  const locale = await resolveLocale();
  const t = adminText(locale);
  const user = await getUser();
  if (!user) {
    return NextResponse.json(
      { error: t.raportti.signInRequired },
      { status: 401 },
    );
  }

  const restaurant = await getActiveRestaurant();
  if (!restaurant) {
    return NextResponse.json(
      { error: t.raportti.restaurantNotFound },
      { status: 404 },
    );
  }

  if (!can(restaurant.role, "reports.export")) {
    return NextResponse.json(
      { error: t.raportti.noRightExport },
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
      { error: t.raportti.unknownReportKind, allowed: REPORT_KINDS },
      { status: 400 },
    );
  }

  /*
   * Kirjanpito vaatii oman oikeutensa.
   *
   * reports.export riittää kuluraporttiin, mutta kirjanpito on eri
   * asia: se sisältää tilikartan ja tositteet.
   *
   * PYYDETTY KIRJANPITO ON VIRHE, KOKO KUUKAUSI EI.
   *
   * Ilman tyyppiä pyydetään koko kuukauden työkirja. Se ei ole pyyntö
   * kirjanpidosta, joten oikea vastaus on jättää ne välilehdet pois
   * eikä hylätä koko latausta. Nimenomaan kirjanpitoa pyytänyt sen
   * sijaan saa tietää ettei häneltä riitä oikeus.
   */
  const naytaKirjanpito = can(restaurant.role, "accounting.view");

  if (
    single !== null &&
    ACCOUNTING_KINDS.includes(single) &&
    !naytaKirjanpito
  ) {
    return NextResponse.json(
      { error: t.raportti.noRightAccounting },
      { status: 403 },
    );
  }

  const sallitut = naytaKirjanpito
    ? kinds
    : kinds.filter((k) => !ACCOUNTING_KINDS.includes(k));

  const sheets = [];
  for (const kind of sallitut) {
    const rows = await buildReportRows(
      kind,
      restaurant.id,
      month,
      restaurant.role,
      restaurant.timezone,
      locale,
    );
    sheets.push({ name: arkkiNimet(t)[kind], rows: rows.map(toCells) });
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

  const cleaned = text.replace(/\s| /g, "").replace(/€/g, "").replace(/%$/, "");

  if (cleaned === "" || !/^-?\d+(?:,\d+)?$/.test(cleaned)) return null;

  const parsed = Number.parseFloat(cleaned.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

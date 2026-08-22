/**
 * Raporttien CSV-vienti.
 *
 * Puolipiste erottimena ja UTF-8 BOM alkuun: suomalainen Excel avaa
 * tiedoston silloin suoraan oikein. Pilkku erottimena rikkoisi
 * desimaalipilkulliset summat.
 *
 * Vienti vaatii kirjautumisen ja reports.export-oikeuden. Ilman
 * tarkistusta osoitteen arvaaminen antaisi koko kuukauden aineiston.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getActiveRestaurant, getUser } from "@/lib/restoflow/session";
import { can } from "@/lib/restoflow/permissions";
import { monthIn } from "@/lib/restoflow/clock-context";
import {
  buildReportRows,
  REPORT_KINDS,
  type ReportKind,
} from "@/lib/restoflow/report-rows";

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
  const kind = searchParams.get("tyyppi") as ReportKind | null;
  const requested = searchParams.get("kuukausi");
  const month =
    requested && /^\d{4}-\d{2}$/.test(requested)
      ? requested
      : monthIn(restaurant.timezone);

  if (!kind || !REPORT_KINDS.includes(kind)) {
    return NextResponse.json(
      { error: "Tuntematon raporttityyppi.", allowed: REPORT_KINDS },
      { status: 400 },
    );
  }

  const rows = await buildReportRows(kind, restaurant.id, month, restaurant.role);
  const csv = "﻿" + rows.map((r) => r.map(escapeCell).join(";")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="restoflow-${kind}-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Lainausmerkit kahdennetaan ja kenttä lainataan jos siinä on erottimia. */
function escapeCell(value: string): string {
  const text = String(value ?? "");
  if (/[";\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

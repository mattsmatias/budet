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
import { adminText } from "@/lib/i18n/admin-text";
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
  const kind = searchParams.get("tyyppi") as ReportKind | null;
  const requested = searchParams.get("kuukausi");
  const month =
    requested && ISO_MONTH.test(requested)
      ? requested
      : monthIn(restaurant.timezone);

  if (!kind || !REPORT_KINDS.includes(kind)) {
    return NextResponse.json(
      { error: t.raportti.unknownReportKind, allowed: REPORT_KINDS },
      { status: 400 },
    );
  }

  /*
   * Kirjanpito vaatii oman oikeutensa.
   *
   * reports.export riittää kuluraporttiin, mutta kirjanpito on eri
   * asia: se sisältää tilikartan ja tositteet. Ilman tätä
   * osoitteen arvaaminen antaisi ne kenelle tahansa jolla on
   * raporttien vienti-oikeus.
   */
  if (
    ACCOUNTING_KINDS.includes(kind) &&
    !can(restaurant.role, "accounting.view")
  ) {
    return NextResponse.json(
      { error: t.raportti.noRightAccounting },
      { status: 403 },
    );
  }

  const rows = await buildReportRows(
    kind,
    restaurant.id,
    month,
    restaurant.role,
    restaurant.timezone,
    locale,
  );
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

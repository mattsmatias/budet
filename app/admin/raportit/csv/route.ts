/**
 * Raporttien CSV-vienti.
 *
 * Tiedoston rakentaminen on lib/restoflow/report-file.ts:ssä, jotta
 * lataus ja Tiedostoihin tallennus tuottavat varmasti saman tiedoston.
 * Tämä reitti on HTTP-kerros sen ympärillä: tunnistus, parametrit ja
 * otsakkeet.
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
import { REPORT_KINDS, type ReportKind } from "@/lib/restoflow/report-rows";
import { buildReportFile, isReportProblem } from "@/lib/restoflow/report-file";

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

  const result = await buildReportFile({
    restaurantId: restaurant.id,
    role: restaurant.role,
    timezone: restaurant.timezone,
    locale,
    t,
    kind,
    month,
    format: "csv",
  });

  if (isReportProblem(result)) {
    return result === "accounting"
      ? NextResponse.json({ error: t.raportti.noRightAccounting }, { status: 403 })
      : NextResponse.json(
          { error: t.raportti.unknownReportKind, allowed: REPORT_KINDS },
          { status: 400 },
        );
  }

  return new NextResponse(result.text ?? "", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

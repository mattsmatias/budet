/**
 * Raporttien Excel-vienti.
 *
 * Ero CSV:hen: luvut kirjoitetaan lukuina, joten Excelissä voi laskea
 * niillä heti. CSV:ssä kaikki on tekstiä, ja "1 234,50 €" on Excelille
 * merkkijono jota ei voi summata.
 *
 * Tiedoston rakentaminen on lib/restoflow/report-file.ts:ssä, jotta
 * lataus ja Tiedostoihin tallennus tuottavat varmasti saman tiedoston.
 * Ilman tyyppiä pyydetään koko kuukausi yhtenä työkirjana: kirjanpitäjä
 * saa kaiken yhdellä latauksella eikä seitsemää tiedostoa.
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
    kind: searchParams.get("tyyppi") as ReportKind | null,
    month,
    format: "xlsx",
  });

  if (isReportProblem(result)) {
    return result === "accounting"
      ? NextResponse.json({ error: t.raportti.noRightAccounting }, { status: 403 })
      : NextResponse.json(
          { error: t.raportti.unknownReportKind, allowed: REPORT_KINDS },
          { status: 400 },
        );
  }

  return new NextResponse(result.bytes as BodyInit, {
    headers: {
      "Content-Type": result.mime,
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Content-Length": String(result.bytes.length),
      "Cache-Control": "no-store",
    },
  });
}

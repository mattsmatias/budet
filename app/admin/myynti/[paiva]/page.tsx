import Link from "next/link";
import { formatDayIn, weekdayLongIn } from "@/lib/i18n/labels";
import type { AppLocale } from "@/lib/i18n/app-locales";
import { resolveLocale } from "@/lib/i18n/resolve";
import { adminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { notFound } from "next/navigation";
import { adminContext } from "@/lib/restoflow/page-context";
import { can } from "@/lib/restoflow/permissions";
import { ISO_DATE } from "@/lib/restoflow/dates";
import { formatMoney, formatRate } from "@/lib/money";
import {
  fetchDailySales,
  fetchSalesGroups,
  fetchPosVatRates,
  fetchSalesLines,
} from "@/lib/restoflow/queries";
import { averageCheckCents } from "@/lib/restoflow/sales-report";
import { reconcile, summarise } from "@/lib/restoflow/sales-vat";
import { Card } from "@/components/restoflow/ui";
import { RfIcon } from "@/components/restoflow/icons";
import { ReconciliationPanel } from "../reconciliation";

export async function generateMetadata() {
  const locale = await resolveLocale();
  const t = adminText(locale);
  return { title: t.myynti.daySales };
}

/**
 * Yhden päivän myynti ja täsmäytys.
 *
 * Oma sivu eikä rivin avautuva osa: täsmäytys on se näkymä johon
 * palataan kun kirjanpitäjä kysyy, ja siihen on voitava linkittää.
 * Yleiskuvan "Katso ero" osoittaa tänne.
 *
 * BRUTTO → ALV → NETTO, YHDESSÄ JÄRJESTYKSESSÄ.
 *
 * Sama ketju joka näkymässä. Jos yhdessä paikassa myynti tarkoittaa
 * verollista ja toisessa verotonta, luvut näyttävät ristiriitaisilta
 * vaikka molemmat olisivat oikein.
 */
export default async function SalesDayPage({
  params,
}: {
  params: Promise<{ paiva: string }>;
}) {
  const locale = await resolveLocale();
  const t = adminText(locale);
  const { paiva } = await params;
  if (!ISO_DATE.test(paiva)) notFound();

  const { restaurant, role } = await adminContext("/admin/myynti");
  if (!can(role, "sales.view")) notFound();

  const [sales, lines, groups, posVatRates] = await Promise.all([
    fetchDailySales(restaurant.id),
    fetchSalesLines(restaurant.id, paiva),
    fetchSalesGroups(restaurant.id),
    fetchPosVatRates(restaurant.id, paiva),
  ]);

  const day = sales.find((s) => s.date === paiva);
  if (!day) notFound();

  const summary = summarise(lines);
  const check = reconcile({
    posGrossCents: day.posGrossCents,
    posVatCents: day.posVatCents,
    posVatRates,
    lines,
  });

  const average = averageCheckCents(day.grossCents, day.transactions);
  const nameOf = (id: string) =>
    groups.find((g) => g.id === id)?.name ?? t.myynti.unknownGroup;

  return (
    <div className="rf-enter space-y-4">
      <Link
        href="/admin/myynti"
        className="rf-press inline-flex items-center gap-1.5 text-[13px] font-bold"
        style={{ color: "var(--rf-text-2)" }}
      >
        <RfIcon name="back" size={14} />
        {t.myynti.salesWord}
      </Link>

      {/*
        Kolme lukua samassa järjestyksessä kuin ne syntyvät.

        Verollinen on se minkä asiakas maksoi, ALV se mikä siitä menee
        verottajalle, ja veroton se mikä jää ravintolalle. Järjestys on
        sama joka näkymässä, jottei lukija joudu joka kerta
        päättelemään kumpaa lukua katsoo.
      */}
      <Card>
        <h2 className="text-[15px] font-bold tracking-[-0.0075em]">
          {formatDay(paiva, locale)}
        </h2>
        <p
          className="mt-[3px] text-[12.5px]"
          style={{ color: "var(--rf-text-2)" }}
        >
          {day.source === "report"
            ? t.myynti.readFromRegister
            : t.myynti.enteredByHand}
          {day.transactions !== null ? ` · ${day.transactions} kuittia` : ""}
          {average !== null
            ? fill(t.myynti.averageSuffix, { summa: formatMoney(average) })
            : ""}
        </p>

        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <Figure
            label={t.myynti.taxedSales}
            value={day.grossCents ?? summary.grossCents}
            hint={t.myynti.whatCustomerPaid}
          />
          <Figure
            label="ALV"
            value={day.vatCents ?? summary.vatCents}
            hint={t.myynti.goesToTax}
          />
          <Figure
            label={t.myynti.netSales}
            value={day.netCents}
            hint={t.myynti.labourShareBase}
            strong
          />
        </dl>
      </Card>

      {lines.length > 0 ? (
        <Card>
          <h2 className="text-[15px] font-bold tracking-[-0.0075em]">
            {t.myynti.salesByGroup}
          </h2>
          <p
            className="mt-[3px] text-[12.5px]"
            style={{ color: "var(--rf-text-2)" }}
          >
            {t.myynti.rateWhenRecorded}
          </p>

          <div className="-mx-[18px] -mb-4 mt-[14px] overflow-x-auto rounded-b-[var(--rf-r-card)]">
            <table className="rf-table w-full">
              <caption className="sr-only">{t.myynti.salesByGroup}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.myynti.group}</th>
                  <th scope="col">{t.myynti.registerName}</th>
                  <th scope="col" className="text-right">
                    ALV %
                  </th>
                  <th scope="col" className="text-right">
                    {t.myynti.withTax}
                  </th>
                  <th scope="col" className="text-right">
                    ALV
                  </th>
                  <th scope="col" className="text-right">
                    {t.myynti.withoutTax}
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.salesGroupId} className="rf-row">
                    <td className="font-semibold">
                      {nameOf(line.salesGroupId)}
                    </td>
                    <td style={{ color: "var(--rf-text-2)" }}>
                      {line.posName ?? "—"}
                    </td>
                    <td className="rf-tabular text-right">
                      {formatRate(line.vatRate)}
                    </td>
                    <td className="rf-tabular text-right font-semibold">
                      {formatMoney(line.grossCents)}
                    </td>
                    <td
                      className="rf-tabular text-right"
                      style={{ color: "var(--rf-text-2)" }}
                    >
                      {formatMoney(line.vatCents)}
                    </td>
                    <td
                      className="rf-tabular text-right"
                      style={{ color: "var(--rf-text-2)" }}
                    >
                      {formatMoney(line.netCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-[15px] font-bold tracking-[-0.0075em]">
          {t.myynti.reconciliation}
        </h2>
        <p
          className="mt-[3px] text-[12.5px]"
          style={{ color: "var(--rf-text-2)" }}
        >
          {t.myynti.registerLeftKateRight}
        </p>

        <div className="mt-3.5">
          <ReconciliationPanel t={t} result={check} />
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Figure({
  label,
  value,
  hint,
  strong,
}: {
  label: string;
  value: number;
  hint: string;
  strong?: boolean;
}) {
  return (
    <div
      className="px-3.5 py-3"
      style={{
        background: "var(--rf-inset)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <dt
        className="text-[12px] font-medium"
        style={{ color: "var(--rf-text-2)" }}
      >
        {label}
      </dt>
      <dd
        className="rf-tabular mt-[3px] text-[20px] leading-[1.4] tracking-[-0.02em]"
        style={{ fontWeight: strong ? 700 : 600 }}
      >
        {formatMoney(value)}
      </dd>
      <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--rf-text-3)" }}>
        {hint}
      </p>
    </div>
  );
}

function formatDay(isoDate: string, locale: AppLocale): string {
  return `${weekdayLongIn(isoDate, locale)} ${formatDayIn(isoDate, locale)}`;
}

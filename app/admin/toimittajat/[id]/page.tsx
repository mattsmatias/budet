import Link from "next/link";
import { LOCALE_INFO } from "@/lib/i18n/app-locales";
import { can } from "@/lib/restoflow/permissions";
import { loadLinkedFiles } from "@/lib/restoflow/file-queries";
import { LinkedFiles } from "@/components/restoflow/linked-files";
import { adminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { labels } from "@/lib/i18n/labels";
import { monthFromParams } from "@/lib/restoflow/dates";
import { RfIcon } from "@/components/restoflow/icons";
import { CountUp } from "@/components/restoflow/count-up";
import { notFound } from "next/navigation";
import { adminContext } from "@/lib/restoflow/page-context";
import {
  formatChange,
  formatMonth,
  receiptCountLabel,
  receiptsInMonth,
} from "@/lib/restoflow/expenses";
import {
  receiptsForSupplier,
  supplierMonthlySeries,
  supplierTotalsInMonth,
  supplierTrends,
} from "@/lib/restoflow/suppliers";
import { CategoryIcon } from "@/components/restoflow/icons";
import { formatMoney } from "@/lib/money";
import {
  Card,
  CardHeader,
  MetricCard,
  SeverityDot,
} from "@/components/restoflow/ui";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.loput.supplier };
}

export default async function SupplierDetailPage({
  params,
  searchParams,
}: PageProps<"/admin/toimittajat/[id]">) {
  const t = adminText(await resolveLocale());
  const locale = await resolveLocale();
  const nimet = labels(locale);
  const { id } = await params;
  const {
    restaurant,
    role,
    receipts,
    suppliers,
    month: nykyinen,
  } = await adminContext("/admin/toimittajat");

  const month = monthFromParams(await searchParams, nykyinen);

  const supplier = suppliers.find((s) => s.id === id);
  if (!supplier) notFound();
  const all = receiptsForSupplier(receipts, id);
  const inMonth = receiptsInMonth(all, month);

  const totals = supplierTotalsInMonth(receipts, month).find(
    (s) => s.supplierId === id,
  );
  const trend = supplierTrends(receipts, month).find(
    (t) => t.supplierId === id,
  );
  const series = supplierMonthlySeries(receipts, id, month, 4);

  const maxCents = Math.max(...series.map((s) => s.totalCents), 1);
  const monthTotal = inMonth.reduce((s, r) => s + r.totalCents, 0);
  const average =
    inMonth.length === 0 ? 0 : Math.round(monthTotal / inMonth.length);

  /*
   * Toimittajaan liitetyt tiedostot.
   *
   * Sopimus, hinnasto tai reklamaatio kuuluu tähän eikä pelkästään
   * kaappiin: kaapista etsiminen edellyttää muistamista, ja juuri
   * siitä kaapin oli tarkoitus päästää eroon.
   */
  const linked = can(role, "files.view")
    ? await loadLinkedFiles(restaurant.id, { supplierId: id })
    : [];

  return (
    <div className="rf-enter space-y-5 md:space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/toimittajat"
          aria-label={t.loput.back}
          className="rf-press -ml-1.5 p-1.5"
          style={{ color: "var(--rf-text-2)" }}
        >
          <RfIcon name="back" size={22} />
        </Link>
        <div>
          <h2 className="text-[20px] font-bold tracking-[-0.02em]">
            {supplier.name}
          </h2>
          <p
            className="mt-0.5 text-[15px]"
            style={{ color: "var(--rf-text-2)" }}
          >
            <span className="inline-flex items-center gap-1.5 align-middle">
              <CategoryIcon category={supplier.defaultCategory} size={15} />
              {nimet.categories[supplier.defaultCategory]}
            </span>{" "}
            · {formatMonth(month, locale)}
          </p>
        </div>
      </div>

      {/* Sama kokoonpano kuin yleiskuvan avainluvuissa. */}
      <section
        aria-label={t.loput.keyFigures}
        className="grid auto-rows-fr grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          label={t.loput.receiptCount}
          value={<CountUp to={inMonth.length} format="integer" />}
          icon={<RfIcon name="receipt" size={17} />}
          tileTone="brand"
          tone="muted"
          conclusion={formatMonth(month, locale)}
        />
        <MetricCard
          label={t.loput.total}
          value={<CountUp to={monthTotal} format="money" />}
          icon={<RfIcon name="expenses" size={17} />}
          tileTone="green"
          tone="muted"
          conclusion={t.loput.receiptSumThisMonth}
        />
        <MetricCard
          label={t.loput.averageReceipt}
          value={<CountUp to={average} format="money" />}
          icon={<RfIcon name="budget" size={17} />}
          tileTone="violet"
          tone="muted"
          conclusion={t.loput.totalDividedByCount}
        />
        <MetricCard
          label={t.loput.change}
          icon={<RfIcon name="trend" size={17} />}
          tileTone="blue"
          /*
           * Prosenttiluku ei nouse paikalleen: CountUp osaa euroja,
           * kokonaislukuja ja tunteja, ei prosentteja.
           */
          value={
            trend?.change === null || !trend ? "—" : formatChange(trend.change)
          }
          tone="muted"
          conclusion={
            trend && trend.change !== null
              ? fill(t.loput.trendArrow, {
                  ennen: formatMoney(trend.previousCents),
                  nyt: formatMoney(trend.currentCents),
                })
              : t.loput.noComparisonPrev
          }
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t.loput.expensesByMonth}
            subtitle={t.loput.lastFourMonths}
          />
          <ul className="space-y-3">
            {series.map((point) => (
              <li key={point.month}>
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className="text-[14px]"
                    style={{ color: "var(--rf-text-2)" }}
                  >
                    {formatMonth(point.month, locale)}
                  </span>
                  <span className="rf-tabular text-[14px] font-semibold">
                    {formatMoney(point.totalCents)}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 w-full overflow-hidden"
                  style={{ background: "var(--rf-inset)", borderRadius: 999 }}
                  role="img"
                  aria-label={fill(t.loput.monthAmount, {
                    kuukausi: formatMonth(point.month, locale),
                    summa: formatMoney(point.totalCents),
                  })}
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.max(2, (point.totalCents / maxCents) * 100)}%`,
                      background:
                        point.month === month
                          ? "var(--rf-text)"
                          : "var(--rf-line-strong)",
                      borderRadius: 999,
                    }}
                  />
                </div>
                <p
                  className="rf-tabular mt-1 text-[12px]"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  {receiptCountLabel(point.receiptCount, locale)}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title={t.loput.whereMoneyGoes} subtitle={t.loput.byRow} />
          {totals && totals.categories.length > 0 ? (
            <ul className="space-y-3">
              {totals.categories.map((c) => (
                <li
                  key={c.category}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="text-[14px]">
                    <span className="inline-flex items-center gap-2">
                      <span style={{ color: "var(--rf-text-2)" }}>
                        <CategoryIcon category={c.category} size={16} />
                      </span>
                      {nimet.categories[c.category]}
                    </span>
                  </span>
                  <span className="rf-tabular text-[14px] font-semibold">
                    {formatMoney(c.cents)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px]" style={{ color: "var(--rf-text-2)" }}>
              {t.loput.noExpensesThisMonth}
            </p>
          )}

          {supplier.categoryOverrides.length > 0 ? (
            <div
              className="mt-4 px-3.5 py-3 text-[13px] leading-relaxed"
              style={{
                background: "var(--rf-blue-bg)",
                color: "var(--rf-blue-text)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              Olet korjannut tämän toimittajan kategorian{" "}
              {supplier.categoryOverrides[0].count} kertaa muotoon{" "}
              <strong>
                {nimet.categories[supplier.categoryOverrides[0].to]}
              </strong>
              {t.loput.kateSuggestsAhead}
            </div>
          ) : null}
        </Card>
      </div>

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader
            title={t.loput.receiptsWord}
            subtitle={`${all.length} kaikkiaan`}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="rf-table w-full min-w-[40rem] text-[14px]">
            <caption className="sr-only">{t.loput.supplierReceipts}</caption>
            <thead>
              <tr>
                <th scope="col">{t.loput.dayWord}</th>
                <th scope="col">{t.loput.receiptNumber}</th>
                <th scope="col">{t.loput.paymentMethod}</th>
                <th scope="col" className="text-right">
                  {t.loput.rows}
                </th>
                <th scope="col" className="text-right">
                  {t.loput.total}
                </th>
              </tr>
            </thead>
            <tbody>
              {all.slice(0, 25).map((r) => (
                <tr key={r.id}>
                  <td className="rf-tabular">{formatDate(r.date)}</td>
                  <td
                    className="px-5 py-3 font-mono text-[12px]"
                    style={{ color: "var(--rf-text-2)" }}
                  >
                    {r.receiptNumber ?? "—"}
                  </td>
                  <td
                    className="px-5 py-3"
                    style={{ color: "var(--rf-text-2)" }}
                  >
                    {nimet.payments[r.paymentMethod]}
                  </td>
                  <td
                    className="rf-tabular px-5 py-3 text-right"
                    style={{ color: "var(--rf-text-2)" }}
                  >
                    {r.items.length || "—"}
                  </td>
                  <td className="num">
                    <span className="inline-flex items-center gap-2">
                      {r.status === "needs_review" ? (
                        <SeverityDot severity="warning" />
                      ) : null}
                      <span className="rf-tabular font-semibold">
                        {formatMoney(r.totalCents)}
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {all.length > 25 ? (
          <p
            className="px-5 pb-4 text-[12px]"
            style={{ color: "var(--rf-text-3)" }}
          >
            Näytetään 25 uusinta {all.length} kuitista.
          </p>
        ) : null}
      </Card>

      <LinkedFiles t={t} tag={LOCALE_INFO[locale].tag} files={linked} />
    </div>
  );
}

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

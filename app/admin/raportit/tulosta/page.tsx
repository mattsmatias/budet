import { adminContext } from "@/lib/restoflow/page-context";
import { adminText } from "@/lib/i18n/admin-text";
import type { AdminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { labels } from "@/lib/i18n/labels";
import { ISO_MONTH } from "@/lib/restoflow/dates";
import { can } from "@/lib/restoflow/permissions";
import { redirect } from "next/navigation";
import {
  formatMonth,
  periodTotals,
  previousMonth,
  receiptsInMonth,
  relativeChange,
  sortByDateDesc,
  totalsByCategory,
} from "@/lib/restoflow/expenses";
import { supplierTotalsInMonth } from "@/lib/restoflow/suppliers";
import { budgetProgress } from "@/lib/restoflow/budgets";
import { formatMoney } from "@/lib/money";
import {} from "@/lib/restoflow/types";
import { PrintButton } from "./print-button";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.raportti.monthlyReport };
}

/**
 * Tulostettava kuukausiraportti.
 *
 * PDF syntyy selaimen omasta tulostuksesta. Erillinen PDF-kirjasto
 * tarkoittaisi toisen asettelumoottorin ylläpitoa, ja tulos olisi
 * huonompi kuin se minkä selain jo osaa. "Tallenna PDF:nä" on
 * tulostusikkunassa jokaisella alustalla.
 */
export default async function PrintableReportPage({
  searchParams,
}: PageProps<"/admin/raportit/tulosta">) {
  const t = adminText(await resolveLocale());
  const locale = await resolveLocale();
  const nimet = labels(locale);
  const params = await searchParams;
  const { restaurant, role, receipts, budgets, closedMonths, month } =
    await adminContext("/admin/raportit/tulosta");

  if (!can(role, "reports.export")) redirect("/admin");

  const requested =
    typeof params.kuukausi === "string" ? params.kuukausi : month;
  const viewMonth = ISO_MONTH.test(requested) ? requested : month;

  const inMonth = sortByDateDesc(receiptsInMonth(receipts, viewMonth));
  const totals = periodTotals(receipts, viewMonth);
  const previous = periodTotals(receipts, previousMonth(viewMonth));
  const change = relativeChange(totals.totalCents, previous.totalCents);

  const categories = totalsByCategory(inMonth);
  const suppliers = supplierTotalsInMonth(receipts, viewMonth);
  const budgetRows = budgetProgress(receipts, budgets, viewMonth).filter(
    (row) => row.budgetCents !== null,
  );
  const isClosed = closedMonths.includes(viewMonth);

  return (
    <div className="rf-print mx-auto max-w-3xl">
      <div className="rf-no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {t.raportti.printHint}
        </p>
        <PrintButton t={t} />
      </div>

      <header
        className="border-b pb-4"
        style={{ borderColor: "var(--rf-line-strong)" }}
      >
        <h1 className="text-[24px] font-semibold tracking-tight">
          Kuukausiraportti · {formatMonth(viewMonth, locale)}
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
          {restaurant.name} ·{" "}
          {isClosed ? "kuukausi suljettu" : "kuukausi avoinna"}
        </p>
        <p
          className="mt-3 text-[12px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          {t.raportti.scopeNote}
        </p>
      </header>

      <Section title={t.raportti.summary}>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[14px] sm:grid-cols-4">
          <Figure
            label={t.raportti.expensesWord}
            value={formatMoney(totals.totalCents)}
          />
          <Figure
            label={t.raportti.receiptCount}
            value={String(totals.receiptCount)}
          />
          <Figure label="ALV" value={formatMoney(totals.vatCents)} />
          <Figure
            label={t.raportti.changeToPrevious}
            value={
              change === null
                ? "—"
                : `${change > 0 ? "+" : ""}${Math.round(change * 100)} %`
            }
          />
        </dl>
        {totals.needsReviewCount > 0 ? (
          <p
            className="mt-3 text-[13px]"
            style={{ color: "var(--rf-amber-text)" }}
          >
            {totals.needsReviewCount} kuittia on yhä tarkistusjonossa. Ne ovat
            mukana summissa.
          </p>
        ) : null}
      </Section>

      <Section title={t.raportti.byCategory}>
        <Table
          t={t}
          head={[
            t.raportti.categoryWord,
            t.raportti.receiptCount,
            t.raportti.share,
            t.raportti.total,
          ]}
          rows={categories.map((c) => [
            nimet.categories[c.category],
            String(c.receiptCount),
            `${Math.round(c.share * 100)} %`,
            formatMoney(c.totalCents),
          ])}
          total={[
            t.raportti.total,
            String(totals.receiptCount),
            "",
            formatMoney(totals.totalCents),
          ]}
        />
      </Section>

      {budgetRows.length > 0 ? (
        <Section title={t.raportti.budgetsWord}>
          <Table
            t={t}
            head={[
              t.raportti.categoryWord,
              t.raportti.budgetWord,
              t.raportti.actual,
              t.raportti.used,
            ]}
            rows={budgetRows.map((row) => [
              nimet.categories[row.category],
              formatMoney(row.budgetCents ?? 0),
              formatMoney(row.spentCents),
              row.ratio === null ? "—" : `${Math.round(row.ratio * 100)} %`,
            ])}
          />
        </Section>
      ) : null}

      <Section title={t.raportti.suppliersWord}>
        <Table
          t={t}
          head={[
            t.raportti.supplierWord,
            t.raportti.receiptCount,
            t.raportti.average,
            t.raportti.total,
          ]}
          rows={suppliers.map((s) => [
            s.name,
            String(s.receiptCount),
            formatMoney(s.averageCents),
            formatMoney(s.totalCents),
          ])}
        />
      </Section>

      <Section title={t.raportti.receiptsWord}>
        <Table
          t={t}
          head={[
            t.raportti.dayWord,
            t.raportti.supplierWord,
            t.raportti.categoryWord,
            t.raportti.paymentMethod,
            "ALV",
            t.raportti.total,
          ]}
          rows={inMonth.map((r) => [
            formatDate(r.date),
            r.supplierName,
            nimet.categories[r.category],
            nimet.payments[r.paymentMethod],
            r.vatCents === null ? "puuttuu" : formatMoney(r.vatCents),
            formatMoney(r.totalCents),
          ])}
          total={["", "", "", "", "", formatMoney(totals.totalCents)]}
        />

        {inMonth.some((r) => r.reviewReasons.length > 0) ? (
          <div className="mt-4">
            <p className="text-[13px] font-semibold">
              {t.raportti.reviewMarks}
            </p>
            <ul
              className="mt-1.5 space-y-1 text-[12px]"
              style={{ color: "var(--rf-text-2)" }}
            >
              {inMonth
                .filter((r) => r.reviewReasons.length > 0)
                .map((r) => (
                  <li key={r.id}>
                    {formatDate(r.date)} · {r.supplierName} ·{" "}
                    {r.reviewReasons
                      .map((reason) => nimet.reviewReasons[reason])
                      .join(", ")}
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </Section>

      <footer
        className="mt-8 border-t pt-4 text-[11px]"
        style={{ borderColor: "var(--rf-line)", color: "var(--rf-text-3)" }}
      >
        Kate · {restaurant.name} · {formatMonth(viewMonth, locale)} · luotu{" "}
        {formatDate(new Date().toISOString().slice(0, 10))}
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rf-print-section mt-7">
      <h2 className="text-[16px] font-semibold">{title}</h2>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
        {label}
      </dt>
      <dd className="rf-tabular text-[16px] font-semibold">{value}</dd>
    </div>
  );
}

function Table({
  t,
  head,
  rows,
  total,
}: {
  t: AdminText;
  head: string[];
  rows: string[][];
  total?: string[];
}) {
  if (rows.length === 0) {
    return (
      <p className="text-[13px]" style={{ color: "var(--rf-text-3)" }}>
        {t.raportti.noRowsThisMonth}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr
            className="border-b"
            style={{ borderColor: "var(--rf-line-strong)" }}
          >
            {head.map((cell, i) => (
              <th
                key={cell}
                scope="col"
                className={`py-1.5 font-medium ${i === 0 ? "text-left" : "text-right"}`}
                style={{ color: "var(--rf-text-3)" }}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              className="border-b"
              style={{ borderColor: "var(--rf-line)" }}
            >
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={`py-1.5 ${i === 0 ? "text-left" : "rf-tabular text-right"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {total ? (
          <tfoot>
            <tr className="font-semibold">
              {total.map((cell, i) => (
                <td
                  key={i}
                  className={`py-2 ${i === 0 ? "text-left" : "rf-tabular text-right"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

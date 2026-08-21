import Link from "next/link";
import { notFound } from "next/navigation";
import { DEMO_MONTH, RECEIPTS, SUPPLIERS, supplierById } from "@/lib/restoflow/data";
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
import { CATEGORY_LABELS, PAYMENT_LABELS } from "@/lib/restoflow/types";
import { CategoryIcon } from "@/components/restoflow/icons";
import { formatMoney } from "@/lib/money";
import {
  Card,
  CardHeader,
  DemoNotice,
  Icon,
  ICONS,
  MetricCard,
  SeverityDot,
} from "@/components/restoflow/ui";

export function generateStaticParams() {
  return SUPPLIERS.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/admin/toimittajat/[id]">) {
  const { id } = await params;
  return { title: supplierById(id)?.name ?? "Toimittaja" };
}

export default async function SupplierDetailPage({
  params,
}: PageProps<"/admin/toimittajat/[id]">) {
  const { id } = await params;
  const supplier = supplierById(id);
  if (!supplier) notFound();

  const month = DEMO_MONTH;
  const all = receiptsForSupplier(RECEIPTS, id);
  const inMonth = receiptsInMonth(all, month);

  const totals = supplierTotalsInMonth(RECEIPTS, month).find((s) => s.supplierId === id);
  const trend = supplierTrends(RECEIPTS, month).find((t) => t.supplierId === id);
  const series = supplierMonthlySeries(RECEIPTS, id, month, 4);

  const maxCents = Math.max(...series.map((s) => s.totalCents), 1);
  const monthTotal = inMonth.reduce((s, r) => s + r.totalCents, 0);
  const average = inMonth.length === 0 ? 0 : Math.round(monthTotal / inMonth.length);

  return (
    <div className="rf-enter space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/admin/toimittajat"
          aria-label="Takaisin"
          className="rf-press -ml-1.5 p-1.5"
          style={{ color: "var(--rf-text-2)" }}
        >
          <Icon path={ICONS.back} size={22} />
        </Link>
        <div>
          <h1 className="text-[30px] font-semibold tracking-tight">{supplier.name}</h1>
          <p className="mt-0.5 text-[15px]" style={{ color: "var(--rf-text-2)" }}>
            <span className="inline-flex items-center gap-1.5 align-middle">
              <CategoryIcon category={supplier.defaultCategory} size={15} />
              {CATEGORY_LABELS[supplier.defaultCategory]}
            </span>{" "}
            · {formatMonth(month)}
          </p>
        </div>
      </div>

      <DemoNotice />

      <section aria-label="Yhteenveto" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Kuitteja" value={String(inMonth.length)} hint={formatMonth(month)} />
        <MetricCard label="Yhteensä" value={formatMoney(monthTotal)} />
        <MetricCard label="Keskimääräinen kuitti" value={formatMoney(average)} />
        <MetricCard
          label="Muutos"
          value={trend?.change === null || !trend ? "—" : formatChange(trend.change)}
          hint={
            trend && trend.change !== null
              ? `${formatMoney(trend.previousCents)} → ${formatMoney(trend.currentCents)}`
              : "Ei vertailukohtaa edelliseltä kuukaudelta"
          }
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Kulut kuukausittain" subtitle="Neljä viimeisintä kuukautta" />
          <ul className="space-y-3">
            {series.map((point) => (
              <li key={point.month}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px]" style={{ color: "var(--rf-text-2)" }}>
                    {formatMonth(point.month)}
                  </span>
                  <span className="rf-tabular text-[14px] font-semibold">
                    {formatMoney(point.totalCents)}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 w-full overflow-hidden"
                  style={{ background: "var(--rf-inset)", borderRadius: 999 }}
                  role="img"
                  aria-label={`${formatMonth(point.month)}: ${formatMoney(point.totalCents)}`}
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.max(2, (point.totalCents / maxCents) * 100)}%`,
                      background:
                        point.month === month ? "var(--rf-text)" : "var(--rf-line-strong)",
                      borderRadius: 999,
                    }}
                  />
                </div>
                <p className="rf-tabular mt-1 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                  {receiptCountLabel(point.receiptCount)}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Mihin tämän toimittajan rahat menevät" subtitle="Rivikohtaisesti" />
          {totals && totals.categories.length > 0 ? (
            <ul className="space-y-3">
              {totals.categories.map((c) => (
                <li key={c.category} className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px]">
                    <span className="inline-flex items-center gap-2">
                      <span style={{ color: "var(--rf-text-2)" }}>
                        <CategoryIcon category={c.category} size={16} />
                      </span>
                      {CATEGORY_LABELS[c.category]}
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
              Ei kuluja tältä kuukaudelta.
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
              <strong>{CATEGORY_LABELS[supplier.categoryOverrides[0].to]}</strong>.
              RestoFlow ehdottaa sitä jatkossa automaattisesti.
            </div>
          ) : null}
        </Card>
      </div>

      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader title="Kuitit" subtitle={`${all.length} kaikkiaan`} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-[14px]">
            <caption className="sr-only">Toimittajan kuitit</caption>
            <thead>
              <tr
                className="border-b text-left text-[12px] uppercase tracking-[0.04em]"
                style={{ borderColor: "var(--rf-line)", color: "var(--rf-text-3)" }}
              >
                <th scope="col" className="px-5 py-3 font-medium">Päivä</th>
                <th scope="col" className="px-5 py-3 font-medium">Kuittinumero</th>
                <th scope="col" className="px-5 py-3 font-medium">Maksutapa</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Rivejä</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Yhteensä</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
              {all.slice(0, 25).map((r) => (
                <tr key={r.id}>
                  <td className="rf-tabular px-5 py-3">{formatDate(r.date)}</td>
                  <td className="px-5 py-3 font-mono text-[12px]" style={{ color: "var(--rf-text-2)" }}>
                    {r.receiptNumber ?? "—"}
                  </td>
                  <td className="px-5 py-3" style={{ color: "var(--rf-text-2)" }}>
                    {PAYMENT_LABELS[r.paymentMethod]}
                  </td>
                  <td className="rf-tabular px-5 py-3 text-right" style={{ color: "var(--rf-text-2)" }}>
                    {r.items.length || "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="inline-flex items-center gap-2">
                      {r.status === "needs_review" ? <SeverityDot severity="warning" /> : null}
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
          <p className="px-5 pb-4 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
            Näytetään 25 uusinta {all.length} kuitista.
          </p>
        ) : null}
      </Card>
    </div>
  );
}

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

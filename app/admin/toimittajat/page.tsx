import Link from "next/link";
import { DEMO_MONTH, RECEIPTS } from "@/lib/restoflow/data";
import {
  formatChange,
  formatMonth,
  receiptCountLabel,
  receiptsInMonth,
} from "@/lib/restoflow/expenses";
import { supplierTotalsInMonth, supplierTrends } from "@/lib/restoflow/suppliers";
import { CATEGORY_LABELS } from "@/lib/restoflow/types";
import { CategoryIcon } from "@/components/restoflow/icons";
import { formatMoney } from "@/lib/money";
import {
  Card,
  CardHeader,
  DemoNotice,
  EmptyState,
  Icon,
  ICONS,
  MetricCard,
  Pill,
} from "@/components/restoflow/ui";

export const metadata = { title: "Toimittajat" };

/**
 * Toimittajanäkymä.
 *
 * Kategoriajakauma kertoo mihin rahat menevät, tämä kenelle. Ne ovat eri
 * kysymyksiä — ja neuvotteluvoima syntyy jälkimmäisestä.
 */
export default function SuppliersPage() {
  const month = DEMO_MONTH;
  const totals = supplierTotalsInMonth(RECEIPTS, month);
  const trends = new Map(supplierTrends(RECEIPTS, month).map((t) => [t.supplierId, t]));

  const grandTotal = totals.reduce((s, t) => s + t.totalCents, 0);
  const inMonth = receiptsInMonth(RECEIPTS, month);
  const biggest = totals[0];

  return (
    <div className="rf-enter space-y-6">
      <div>
        <h1 className="text-[30px] font-semibold tracking-tight">Toimittajat</h1>
        <p className="mt-1 text-[15px]" style={{ color: "var(--rf-text-2)" }}>
          Kenelle rahamme menevät? · {formatMonth(month)}
        </p>
      </div>

      <DemoNotice />

      <section aria-label="Yhteenveto" className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Toimittajia" value={String(totals.length)} />
        <MetricCard
          label="Kirjatut kulut"
          value={formatMoney(grandTotal)}
          hint={receiptCountLabel(inMonth.length)}
        />
        <MetricCard
          label="Suurin toimittaja"
          value={biggest?.name ?? "—"}
          hint={
            biggest
              ? `${formatMoney(biggest.totalCents)} · ${Math.round(biggest.share * 100)} % kaikista kuluista`
              : undefined
          }
        />
      </section>

      {totals.length === 0 ? (
        <EmptyState
          title="Ei toimittajia"
          description="Toimittajat syntyvät kuiteista. Lisää kuitteja niin näkymä täyttyy."
        />
      ) : (
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Kaikki toimittajat"
              subtitle="Suurin ensin · muutos edelliseen kuukauteen"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-[14px]">
              <caption className="sr-only">Toimittajat ja kulut</caption>
              <thead>
                <tr
                  className="border-b text-left text-[12px] uppercase tracking-[0.04em]"
                  style={{ borderColor: "var(--rf-line)", color: "var(--rf-text-3)" }}
                >
                  <th scope="col" className="px-5 py-3 font-medium">Toimittaja</th>
                  <th scope="col" className="px-5 py-3 font-medium">Kategoriat</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Kuitteja</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Keskiarvo</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Muutos</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Yhteensä</th>
                  <th scope="col" className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
                {totals.map((s) => {
                  const trend = trends.get(s.supplierId);
                  const spike = trend?.change !== null && (trend?.change ?? 0) >= 0.25;

                  return (
                    <tr key={s.supplierId}>
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/toimittajat/${s.supplierId}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {s.name}
                        </Link>
                        <p className="rf-tabular text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                          {Math.round(s.share * 100)} % kaikista kuluista
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="flex flex-wrap gap-1.5">
                          {s.categories.slice(0, 3).map((c) => (
                            <span
                              key={c.category}
                              className="text-[12px]"
                              style={{ color: "var(--rf-text-2)" }}
                              title={CATEGORY_LABELS[c.category]}
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <CategoryIcon category={c.category} size={14} />
                                {CATEGORY_LABELS[c.category]}
                              </span>
                            </span>
                          ))}
                        </span>
                      </td>
                      <td className="rf-tabular px-5 py-3 text-right">{s.receiptCount}</td>
                      <td
                        className="rf-tabular px-5 py-3 text-right"
                        style={{ color: "var(--rf-text-2)" }}
                      >
                        {formatMoney(s.averageCents)}
                      </td>
                      <td className="rf-tabular px-5 py-3 text-right">
                        {trend?.change === null || trend === undefined ? (
                          <span style={{ color: "var(--rf-text-3)" }}>uusi</span>
                        ) : spike ? (
                          <Pill tone="warn" dot>
                            {formatChange(trend.change)}
                          </Pill>
                        ) : (
                          <span style={{ color: "var(--rf-text-2)" }}>
                            {formatChange(trend.change)}
                          </span>
                        )}
                      </td>
                      <td className="rf-tabular px-5 py-3 text-right font-semibold">
                        {formatMoney(s.totalCents)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/admin/toimittajat/${s.supplierId}`}
                          aria-label={`Avaa ${s.name}`}
                          style={{ color: "var(--rf-text-3)" }}
                        >
                          <Icon path={ICONS.chevron} size={16} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr
                  className="border-t-2 font-semibold"
                  style={{ borderColor: "var(--rf-line-strong)" }}
                >
                  <td className="px-5 py-3">Yhteensä</td>
                  <td />
                  <td className="rf-tabular px-5 py-3 text-right">{inMonth.length}</td>
                  <td />
                  <td />
                  <td className="rf-tabular px-5 py-3 text-right">{formatMoney(grandTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

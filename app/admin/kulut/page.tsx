import { adminContext } from "@/lib/restoflow/page-context";
import Link from "next/link";
import {
  changeTone,
  formatChange,
  formatMonth,
  monthlySeries,
  nextMonth,
  periodTotals,
  previousMonth,
  receiptCountLabel,
  receiptsInMonth,
  relativeChange,
  totalsByCategory,
} from "@/lib/restoflow/expenses";
import { CATEGORY_LABELS } from "@/lib/restoflow/types";
import { formatMoney } from "@/lib/money";
import {
  BarRow,
  Card,
  CardHeader,
  ScopeNotice,
  Icon,
  ICONS,
  MetricCard,
  TrendBadge,
} from "@/components/restoflow/ui";

export const metadata = { title: "Kulut" };


export default async function ExpensesPage({
  searchParams,
}: PageProps<"/admin/kulut">) {
  const {
    receipts, month,
  } = await adminContext("/admin/kulut");

  const params = await searchParams;
  const requested = typeof params.kuukausi === "string" ? params.kuukausi : month;
  const viewMonth = /^\d{4}-\d{2}$/.test(requested) ? requested : month;

  const current = periodTotals(receipts, viewMonth);
  const previous = periodTotals(receipts, previousMonth(viewMonth));
  const change = relativeChange(current.totalCents, previous.totalCents);

  const categories = totalsByCategory(receiptsInMonth(receipts, viewMonth));
  const series = monthlySeries(receipts, viewMonth, 4);

  // Taaksepäin voi aina selata; eteenpäin vain kuluvaan kuukauteen asti,
  // koska tulevaisuudessa ei ole kuluja.
  const canGoBack = true;
  const canGoForward = nextMonth(viewMonth) <= month;

  return (
    <div className="rf-enter space-y-5 md:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight md:text-[30px]">Kulut</h1>
          <p className="mt-1 text-[14px] md:text-[15px]" style={{ color: "var(--rf-text-2)" }}>
            Mihin rahat menevät?
          </p>
        </div>

        <nav aria-label="Kuukausi" className="flex items-center gap-1">
          <MonthButton
            href={`/admin/kulut?kuukausi=${previousMonth(viewMonth)}`}
            disabled={!canGoBack}
            label="Edellinen kuukausi"
            icon={ICONS.back}
          />
          <span
            className="min-w-[10rem] px-3 py-2 text-center text-[14px] font-medium"
            style={{
              background: "var(--rf-card)",
              borderRadius: "var(--rf-r-control)",
              boxShadow: "var(--rf-shadow-sm)",
            }}
          >
            {formatMonth(viewMonth)}
          </span>
          <MonthButton
            href={`/admin/kulut?kuukausi=${nextMonth(viewMonth)}`}
            disabled={!canGoForward}
            label="Seuraava kuukausi"
            icon={ICONS.chevron}
          />
        </nav>
      </div>

      <ScopeNotice />

      <section aria-label="Yhteenveto" className="grid gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-4">
        <MetricCard
          label="Kirjatut kulut"
          value={formatMoney(current.totalCents)}
          trend={
            <TrendBadge
              text={`${formatChange(change)} edelliseen`}
              direction={changeTone(change)}
            />
          }
          hint="Kuittien summa, ei pankkitili"
        />
        <MetricCard label="Kuitteja" value={String(current.receiptCount)} />
        <MetricCard
          label="ALV yhteensä"
          value={formatMoney(current.vatCents)}
          hint="Vain kuitit joissa ALV on tiedossa"
        />
        <MetricCard
          label="Tarkistettavia"
          value={String(current.needsReviewCount)}
          hint={current.needsReviewCount > 0 ? "Puuttuvia tai epävarmoja tietoja" : undefined}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Kategorioittain"
            subtitle={`${formatMonth(viewMonth)} · ${categories.length} kategoriaa`}
          />
          {categories.length === 0 ? (
            <p className="text-[14px]" style={{ color: "var(--rf-text-2)" }}>
              Ei kuitteja tältä kuukaudelta.
            </p>
          ) : (
            <div className="space-y-4">
              {categories.map((c) => (
                <BarRow
                  key={c.category}
                  label={CATEGORY_LABELS[c.category]}
                  valueCents={c.totalCents}
                  share={c.share}
                  meta={receiptCountLabel(c.receiptCount)}
                />
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Kulujen kehitys"
            subtitle="Neljä kuukautta · kirjatut kulut"
          />
          <table className="w-full text-[14px]">
            <caption className="sr-only">Kirjatut kulut kuukausittain</caption>
            <tbody className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
              {series.map((point) => {
                const isCurrent = point.month === viewMonth;
                return (
                  <tr key={point.month}>
                    <td
                      className="py-3 font-medium"
                      style={{ color: isCurrent ? "var(--rf-text)" : "var(--rf-text-2)" }}
                    >
                      {formatMonth(point.month)}
                    </td>
                    <td
                      className="rf-tabular py-3 text-right"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      {receiptCountLabel(point.receiptCount)}
                    </td>
                    <td className="rf-tabular py-3 text-right font-semibold">
                      {formatMoney(point.totalCents)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-4 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
            Tämä ei ole myyntigraafi. Se kertoo vain kuinka paljon kuluja on
            kirjattu järjestelmään.
          </p>
        </Card>
      </div>
    </div>
  );
}

function MonthButton({
  href,
  disabled,
  label,
  icon,
}: {
  href: string;
  disabled: boolean;
  label: string;
  icon: string;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className="flex h-9 w-9 items-center justify-center opacity-30"
        style={{ color: "var(--rf-text-2)" }}
      >
        <Icon path={icon} size={18} />
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className="rf-press flex h-9 w-9 items-center justify-center"
      style={{
        background: "var(--rf-card)",
        borderRadius: "var(--rf-r-control)",
        boxShadow: "var(--rf-shadow-sm)",
        color: "var(--rf-text-2)",
      }}
    >
      <Icon path={icon} size={18} />
    </Link>
  );
}

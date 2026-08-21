import Link from "next/link";
import {
  DEMO_MONTH,
  EMPLOYEES,
  MONTHLY_HOURS,
  OPEN_SHIFTS,
  RECEIPTS,
  SHIFTS,
  employeeById,
} from "@/lib/restoflow/data";
import {
  changeTone,
  formatChange,
  formatMonth,
  monthlySeries,
  needsReview,
  periodTotals,
  previousMonth,
  receiptCountLabel,
  receiptsInMonth,
  relativeChange,
  sortByDateDesc,
  totalsByCategory,
} from "@/lib/restoflow/expenses";
import { staffCostCents } from "@/lib/restoflow/timeclock";
import {
  CATEGORY_LABELS,
  REVIEW_REASON_LABELS,
} from "@/lib/restoflow/types";
import { formatMoney } from "@/lib/money";
import {
  Avatar,
  BarRow,
  Card,
  CardHeader,
  DemoNotice,
  Icon,
  ICONS,
  MetricCard,
  Pill,
  TrendBadge,
} from "@/components/restoflow/ui";

export const metadata = { title: "Dashboard" };

/**
 * Managerin yleiskuva.
 *
 * Järjestys on tarkoituksellinen: kirjatut kulut, jakauma, tarkistettavat,
 * työtunnit, tulevat vuorot, viimeisimmät kuitit. Näkymän pitää olla
 * ymmärrettävissä alle viidessä sekunnissa, joten kortteja on rajattu määrä
 * eikä mitään ole lisätty vain siksi että se mahtuisi.
 *
 * Myyntiä, liikevaihtoa tai kassavirtaa ei näytetä — RestoFlow ei näe niitä.
 */
export default function AdminDashboard() {
  const month = DEMO_MONTH;
  const prev = previousMonth(month);

  const current = periodTotals(RECEIPTS, month);
  const previous = periodTotals(RECEIPTS, prev);

  const expenseChange = relativeChange(current.totalCents, previous.totalCents);
  const categories = totalsByCategory(receiptsInMonth(RECEIPTS, month));
  const series = monthlySeries(RECEIPTS, month, 4);
  const review = needsReview(RECEIPTS);
  const recent = sortByDateDesc(RECEIPTS).slice(0, 5);

  const totalHours = Object.values(MONTHLY_HOURS).reduce((s, h) => s + h, 0);
  const previousHours = 451; // demo-vertailu
  const hoursChange = relativeChange(totalHours, previousHours);

  const staffCost = EMPLOYEES.reduce((sum, e) => {
    const hours = MONTHLY_HOURS[e.id] ?? 0;
    return sum + staffCostCents(hours * 3600000, e.hourlyRateCents);
  }, 0);

  const upcomingShifts = SHIFTS.filter((s) => s.date >= "2026-08-20")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const topStaff = [...EMPLOYEES]
    .map((e) => ({ employee: e, hours: MONTHLY_HOURS[e.id] ?? 0 }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 3);

  return (
    <div className="rf-enter space-y-6">
      {/* Otsikko */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-[15px]" style={{ color: "var(--rf-text-2)" }}>
            Tässä ravintolan kirjatut kulut ja työajat.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span
            className="px-3.5 py-2 text-[14px] font-medium"
            style={{
              background: "var(--rf-card)",
              borderRadius: "var(--rf-r-control)",
              boxShadow: "var(--rf-shadow-sm)",
            }}
          >
            {formatMonth(month)}
          </span>
          <Link
            href="/admin/raportit"
            className="rf-press flex items-center gap-2 px-3.5 py-2 text-[14px] font-semibold"
            style={{
              background: "var(--rf-text)",
              color: "#fff",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            <Icon path={ICONS.download} size={16} />
            Vie raportti
          </Link>
        </div>
      </div>

      <DemoNotice />

      {/* KPI:t */}
      <section aria-label="Avainluvut" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Kirjatut kulut"
          value={formatMoney(current.totalCents)}
          trend={
            <TrendBadge
              text={`${formatChange(expenseChange)} edelliseen kuukauteen`}
              direction={changeTone(expenseChange)}
            />
          }
          hint="Järjestelmään lisättyjen kuittien summa"
        />
        <MetricCard
          label="Kuitteja"
          value={String(current.receiptCount)}
          trend={
            <TrendBadge
              text={`${current.receiptCount - previous.receiptCount >= 0 ? "+" : "−"}${Math.abs(current.receiptCount - previous.receiptCount)} tässä kuussa`}
              direction={current.receiptCount >= previous.receiptCount ? "up" : "down"}
            />
          }
        />
        <MetricCard
          label="Työtunnit"
          value={`${totalHours} h`}
          trend={
            <TrendBadge
              text={`${formatChange(hoursChange)} edelliseen kuukauteen`}
              direction={changeTone(hoursChange)}
            />
          }
        />
        <MetricCard
          label="Henkilöstökulut"
          value={formatMoney(staffCost)}
          hint="Laskettu työtunneista ja tuntipalkoista"
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Mihin rahat menevät */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Mihin rahat menevät?"
            subtitle={`${formatMonth(month)} · kirjatut kulut kategorioittain`}
            action={
              <Link
                href="/admin/kulut"
                className="text-[13px] font-medium"
                style={{ color: "var(--rf-blue)" }}
              >
                Kaikki
              </Link>
            }
          />
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
        </Card>

        {/* Tarkistettavat */}
        <Card>
          <CardHeader
            title="Tarkistettavat kuitit"
            subtitle={
              review.length === 0
                ? "Ei tarkistettavia"
                : `${review.length} kuittia odottaa tarkistusta`
            }
          />
          {review.length === 0 ? (
            <p className="text-[14px]" style={{ color: "var(--rf-text-2)" }}>
              Kaikki kuitit on tarkistettu.
            </p>
          ) : (
            <>
              <ol className="space-y-3">
                {review.slice(0, 3).map((receipt) => (
                  <li key={receipt.id}>
                    <Link
                      href={`/admin/kuitit?korosta=${receipt.id}`}
                      className="block"
                    >
                      <p className="text-[14px] font-medium">{receipt.supplier}</p>
                      <p className="mt-1">
                        <Pill tone="warn" dot>
                          {REVIEW_REASON_LABELS[receipt.reviewReasons[0]]}
                        </Pill>
                      </p>
                    </Link>
                  </li>
                ))}
              </ol>
              <Link
                href="/admin/kuitit?suodatin=needs_review"
                className="rf-press mt-5 block py-2.5 text-center text-[14px] font-semibold"
                style={{
                  background: "var(--rf-inset)",
                  color: "var(--rf-text)",
                  borderRadius: "var(--rf-r-control)",
                }}
              >
                Tarkista kuitit
              </Link>
            </>
          )}
        </Card>

        {/* Kulujen kehitys */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Kulujen kehitys"
            subtitle="Kirjatut kulut kuukausittain — ei myyntiä eikä tulosta"
          />
          <TrendChart series={series} />
        </Card>

        {/* Työtunnit */}
        <Card>
          <CardHeader title="Työtunnit tässä kuussa" subtitle={`${totalHours} h yhteensä`} />
          <ul className="space-y-3">
            {topStaff.map(({ employee, hours }) => (
              <li key={employee.id} className="flex items-center gap-3">
                <Avatar initials={employee.initials} size={32} />
                <span className="flex-1 text-[14px] font-medium">
                  {employee.name.split(" ")[0]}
                </span>
                <span className="rf-tabular text-[14px] font-semibold">{hours} h</span>
              </li>
            ))}
          </ul>
          <Link
            href="/admin/tyontekijat"
            className="mt-4 block text-[13px] font-medium"
            style={{ color: "var(--rf-blue)" }}
          >
            Näytä kaikki
          </Link>
        </Card>

        {/* Tulevat vuorot */}
        <Card>
          <CardHeader
            title="Tulevat työvuorot"
            subtitle={`${OPEN_SHIFTS.length} avointa vuoroa`}
          />
          <ul className="space-y-3">
            {upcomingShifts.map((shift) => {
              const employee = employeeById(shift.employeeId);
              return (
                <li key={shift.id} className="flex items-center gap-3">
                  <Avatar initials={employee?.initials ?? "?"} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">
                      {employee?.name.split(" ")[0] ?? "—"}
                    </p>
                    <p className="rf-tabular text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                      {formatShortDate(shift.date)}
                    </p>
                  </div>
                  <span className="rf-tabular text-[13px]">
                    {shift.startTime}–{shift.endTime}
                  </span>
                </li>
              );
            })}
          </ul>
          <Link
            href="/admin/tyovuorot"
            className="rf-press mt-4 block py-2.5 text-center text-[14px] font-semibold"
            style={{
              background: "var(--rf-inset)",
              color: "var(--rf-text)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            Hallinnoi työvuoroja
          </Link>
        </Card>

        {/* Viimeisimmät kuitit */}
        <Card className="lg:col-span-2" padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Viimeisimmät kuitit"
              action={
                <Link
                  href="/admin/kuitit"
                  className="text-[13px] font-medium"
                  style={{ color: "var(--rf-blue)" }}
                >
                  Kaikki
                </Link>
              }
            />
          </div>
          <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
            {recent.map((receipt) => (
              <li key={receipt.id}>
                <Link
                  href={`/admin/kuitit?korosta=${receipt.id}`}
                  className="flex items-center gap-4 px-5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{receipt.supplier}</p>
                    <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                      {CATEGORY_LABELS[receipt.category]}
                    </p>
                  </div>
                  {receipt.status === "needs_review" ? (
                    <Pill tone="warn">tarkista</Pill>
                  ) : null}
                  <span className="rf-tabular w-24 text-right text-[14px] font-semibold">
                    {formatMoney(receipt.totalCents)}
                  </span>
                  <span
                    className="rf-tabular w-12 text-right text-[13px]"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    {formatShortDate(receipt.date)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/**
 * Kulukehitys pylväinä.
 *
 * Harmaa, ei värillinen: tämä on kulujen määrä, ei suorituskyvyn mittari.
 * Värillinen graafi houkuttelisi lukemaan sen menestyksenä tai epäonnistumisena.
 */
function TrendChart({
  series,
}: {
  series: { month: string; totalCents: number }[];
}) {
  const max = Math.max(...series.map((s) => s.totalCents), 1);

  return (
    <div className="flex items-end gap-3" style={{ height: 168 }}>
      {series.map((point, i) => {
        const heightPct = (point.totalCents / max) * 100;
        const isLast = i === series.length - 1;

        return (
          <div key={point.month} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <span className="rf-tabular text-[12px]" style={{ color: "var(--rf-text-2)" }}>
              {formatCompact(point.totalCents)}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full"
                style={{
                  height: `${Math.max(4, heightPct)}%`,
                  background: isLast ? "var(--rf-text)" : "var(--rf-line-strong)",
                  borderRadius: "6px 6px 2px 2px",
                }}
                role="img"
                aria-label={`${formatMonth(point.month)}: ${formatMoney(point.totalCents)}`}
              />
            </div>
            <span
              className="truncate text-[12px]"
              style={{ color: isLast ? "var(--rf-text)" : "var(--rf-text-3)" }}
            >
              {formatMonth(point.month).split(" ")[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function formatCompact(cents: number): string {
  const euros = cents / 100;
  if (euros >= 1000) return `${(euros / 1000).toFixed(1).replace(".", ",")} k€`;
  return `${Math.round(euros)} €`;
}

function formatShortDate(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(d)}.${Number(m)}.`;
}


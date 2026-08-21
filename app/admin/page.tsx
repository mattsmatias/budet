import Link from "next/link";
import {
  BUDGETS,
  CLOCK_EVENTS,
  DEMO_MONTH,
  DEMO_NOW,
  DEMO_TODAY,
  MONTHLY_HOURS,
  RECEIPTS,
  SHIFTS,
  STAFF,
} from "@/lib/restoflow/data";
import { alertCounts, buildAlerts } from "@/lib/restoflow/alerts";
import { budgetProgress } from "@/lib/restoflow/budgets";
import {
  changeTone,
  formatChange,
  formatMonth,
  periodTotals,
  previousMonth,
  receiptCountLabel,
  receiptsInMonth,
  relativeChange,
  sortByDateDesc,
  totalsByCategory,
} from "@/lib/restoflow/expenses";
import { supplierTotalsInMonth } from "@/lib/restoflow/suppliers";
import { staffCostCents, workedOnDate } from "@/lib/restoflow/timeclock";
import { formatDuration } from "@/lib/restoflow/timeclock";
import { CATEGORY_EMOJI, CATEGORY_LABELS } from "@/lib/restoflow/types";
import { formatMoney } from "@/lib/money";
import {
  Avatar,
  BarRow,
  Card,
  CardHeader,
  CategoryBubble,
  DemoNotice,
  Icon,
  ICONS,
  MetricCard,
  SeverityDot,
  TrendBadge,
} from "@/components/restoflow/ui";

export const metadata = { title: "Yleiskuva" };

/**
 * Managerin yleiskuva.
 *
 * Järjestys on tarkoituksellinen: kirjatut kulut, jakauma, huomiot,
 * työaika, viimeisimmät kuitit. Näkymän pitää olla ymmärrettävissä alle
 * viidessä sekunnissa, joten kortteja on rajattu määrä eikä mitään ole
 * lisätty vain siksi että se mahtuisi.
 *
 * Myyntiä, liikevaihtoa tai kassavirtaa ei näytetä — RestoFlow ei näe niitä.
 */
export default function AdminDashboard() {
  const month = DEMO_MONTH;

  const current = periodTotals(RECEIPTS, month);
  const previous = periodTotals(RECEIPTS, previousMonth(month));
  const expenseChange = relativeChange(current.totalCents, previous.totalCents);

  const categories = totalsByCategory(receiptsInMonth(RECEIPTS, month));
  const suppliers = supplierTotalsInMonth(RECEIPTS, month).slice(0, 5);
  const recent = sortByDateDesc(RECEIPTS).slice(0, 5);

  const alerts = buildAlerts({
    receipts: RECEIPTS,
    budgets: BUDGETS,
    shifts: SHIFTS,
    users: STAFF,
    clockEvents: CLOCK_EVENTS,
    month,
    today: DEMO_TODAY,
  });
  const counts = alertCounts(alerts);

  const budgets = budgetProgress(RECEIPTS, BUDGETS, month).filter(
    (b) => b.budgetCents !== null,
  );

  const totalHours = Object.values(MONTHLY_HOURS).reduce((s, h) => s + h, 0);
  const hoursChange = relativeChange(totalHours, 603);

  const staffCost = STAFF.reduce(
    (sum, u) =>
      sum + staffCostCents((MONTHLY_HOURS[u.id] ?? 0) * 3600000, u.hourlyRateCents ?? 0),
    0,
  );

  // Tänään töissä olleet, pisin aika ensin.
  const todayHours = STAFF.map((user) => ({
    user,
    worked: workedOnDate(
      CLOCK_EVENTS.filter((e) => e.userId === user.id),
      DEMO_TODAY,
      DEMO_NOW,
    ),
  }))
    .filter((row) => row.worked.workedMs > 0)
    .sort((a, b) => b.worked.workedMs - a.worked.workedMs);

  return (
    <div className="rf-enter space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold tracking-tight">Yleiskuva</h1>
          <p className="mt-1 text-[15px]" style={{ color: "var(--rf-text-2)" }}>
            Ravintola Linnea · {formatMonth(month)}
          </p>
        </div>
        <Link
          href="/admin/raportit"
          className="rf-press flex items-center gap-2 px-3.5 py-2 text-[14px] font-semibold"
          style={{ background: "var(--rf-text)", color: "#fff", borderRadius: "var(--rf-r-control)" }}
        >
          <Icon path={ICONS.download} size={16} />
          Vie raportti
        </Link>
      </div>

      <DemoNotice />

      {/* KPI:t */}
      <section aria-label="Avainluvut" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="💶 Kirjatut kulut"
          value={formatMoney(current.totalCents)}
          trend={
            <TrendBadge
              text={`${formatChange(expenseChange)} vs. ${formatMonth(previousMonth(month)).split(" ")[0].toLowerCase()}`}
              direction={changeTone(expenseChange)}
            />
          }
          hint="Järjestelmään lisättyjen kuittien summa"
        />
        <MetricCard
          label="🧾 Kuitit"
          value={String(current.receiptCount)}
          trend={
            <TrendBadge
              text={
                current.needsReviewCount > 0
                  ? `${current.needsReviewCount} tarkistettavaa`
                  : "kaikki tarkistettu"
              }
              direction="none"
            />
          }
        />
        <MetricCard
          label="⏱️ Työtunnit"
          value={`${totalHours} h`}
          trend={
            <TrendBadge
              text={`${formatChange(hoursChange)} edelliseen`}
              direction={changeTone(hoursChange)}
            />
          }
        />
        <MetricCard
          label="👥 Henkilöstökulut"
          value={formatMoney(staffCost)}
          hint="Tunnit × tuntipalkka, ei palkkalaskelma"
        />
      </section>

      {/* Huomiot — heti KPI:iden jälkeen, koska ne vaativat toimenpiteitä */}
      <Card>
        <CardHeader
          title={
            counts.total === 0
              ? "✅ Ei huomioita"
              : `⚠️ ${counts.total} asiaa vaatii huomiota`
          }
          subtitle={
            counts.total === 0
              ? "Kaikki näyttää olevan kunnossa."
              : [
                  counts.critical > 0 ? `${counts.critical} kriittistä` : null,
                  counts.warning > 0 ? `${counts.warning} varoitusta` : null,
                  counts.info > 0 ? `${counts.info} tiedoksi` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
          }
          action={
            counts.total > 3 ? (
              <Link
                href="/admin/ilmoitukset"
                className="text-[13px] font-medium"
                style={{ color: "var(--rf-blue)" }}
              >
                Kaikki
              </Link>
            ) : undefined
          }
        />

        {alerts.length === 0 ? (
          <p className="text-[14px]" style={{ color: "var(--rf-text-2)" }}>
            Ei kaksoiskappaleita, budjettiylityksiä eikä tarkistettavia kuitteja.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {alerts.slice(0, 4).map((alert) => (
              <li key={alert.id}>
                <Link href={alert.href} className="flex items-start gap-3">
                  <span className="mt-1.5">
                    <SeverityDot severity={alert.severity} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-medium">{alert.title}</span>
                    <span className="block text-[13px]" style={{ color: "var(--rf-text-2)" }}>
                      {alert.detail}
                    </span>
                  </span>
                  <span className="mt-1 shrink-0" style={{ color: "var(--rf-text-3)" }}>
                    <Icon path={ICONS.chevron} size={15} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Mihin rahat menevät */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Mihin rahat menevät?"
            subtitle="Kirjatut kulut kategorioittain · rivikohtaisesti jaettuna"
            action={
              <Link href="/admin/kulut" className="text-[13px] font-medium" style={{ color: "var(--rf-blue)" }}>
                Kaikki
              </Link>
            }
          />
          <div className="space-y-4">
            {categories.slice(0, 6).map((c) => (
              <BarRow
                key={c.category}
                label={`${CATEGORY_EMOJI[c.category]} ${CATEGORY_LABELS[c.category]}`}
                valueCents={c.totalCents}
                share={c.share}
                meta={receiptCountLabel(c.receiptCount)}
              />
            ))}
          </div>
        </Card>

        {/* Kenelle rahat menevät */}
        <Card>
          <CardHeader
            title="Kenelle rahat menevät?"
            subtitle="Suurimmat toimittajat"
            action={
              <Link href="/admin/toimittajat" className="text-[13px] font-medium" style={{ color: "var(--rf-blue)" }}>
                Kaikki
              </Link>
            }
          />
          <ul className="space-y-3">
            {suppliers.map((s) => (
              <li key={s.supplierId}>
                <Link href={`/admin/toimittajat/${s.supplierId}`} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[14px] font-medium">{s.name}</span>
                  <span className="rf-tabular shrink-0 text-[14px] font-semibold">
                    {formatMoney(s.totalCents)}
                  </span>
                </Link>
                <p className="rf-tabular text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                  {receiptCountLabel(s.receiptCount)} · ka {formatMoney(s.averageCents)}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        {/* Budjetit */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="🎯 Budjetit"
            subtitle={`${formatMonth(month)} · ${budgets.length} kategoriaa`}
            action={
              <Link href="/admin/budjetit" className="text-[13px] font-medium" style={{ color: "var(--rf-blue)" }}>
                Hallinnoi
              </Link>
            }
          />
          <ul className="grid gap-4 sm:grid-cols-2">
            {budgets.slice(0, 6).map((b) => {
              const pct = Math.round((b.ratio ?? 0) * 100);
              const color =
                b.status === "exceeded"
                  ? "var(--rf-red-text)"
                  : b.status === "warning"
                    ? "var(--rf-amber-text)"
                    : "var(--rf-text-2)";

              return (
                <li key={b.category}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-medium">
                      {CATEGORY_EMOJI[b.category]} {CATEGORY_LABELS[b.category]}
                    </span>
                    <span className="rf-tabular text-[13px] font-semibold" style={{ color }}>
                      {pct} %
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <BudgetLine ratio={b.ratio} status={b.status} />
                  </div>
                  <p className="rf-tabular mt-1 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                    {formatMoney(b.spentCents)} / {formatMoney(b.budgetCents ?? 0)}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Työaika tänään */}
        <Card>
          <CardHeader title="⏱️ Työaika tänään" subtitle={`${todayHours.length} työntekijää`} />
          {todayHours.length === 0 ? (
            <p className="text-[14px]" style={{ color: "var(--rf-text-2)" }}>
              Kukaan ei ole vielä leimannut sisään.
            </p>
          ) : (
            <ul className="space-y-3">
              {todayHours.map(({ user, worked }) => (
                <li key={user.id} className="flex items-center gap-3">
                  <Avatar initials={user.initials} size={32} />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                    {user.name.split(" ")[0]}
                  </span>
                  {worked.runningSince ? (
                    <span
                      aria-label="töissä nyt"
                      className="rf-pulse-dot h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: "var(--rf-green)" }}
                    />
                  ) : null}
                  <span className="rf-tabular shrink-0 text-[14px] font-semibold">
                    {formatDuration(worked.workedMs)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/tyontekijat"
            className="mt-4 block text-[13px] font-medium"
            style={{ color: "var(--rf-blue)" }}
          >
            Kaikki työntekijät
          </Link>
        </Card>

        {/* Viimeisimmät kuitit */}
        <Card className="lg:col-span-3" padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="🧾 Viimeisimmät kuitit"
              action={
                <Link href="/admin/kuitit" className="text-[13px] font-medium" style={{ color: "var(--rf-blue)" }}>
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
                  <CategoryBubble category={receipt.category} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{receipt.supplierName}</p>
                    <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                      {CATEGORY_LABELS[receipt.category]}
                      {receipt.items.length > 1 ? ` · ${receipt.items.length} riviä` : ""}
                    </p>
                  </div>
                  {receipt.status === "needs_review" ? (
                    <span aria-label="tarkistettava" title="tarkistettava">
                      <SeverityDot severity="warning" />
                    </span>
                  ) : null}
                  <span className="rf-tabular w-28 text-right text-[14px] font-semibold">
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

function BudgetLine({
  ratio,
  status,
}: {
  ratio: number | null;
  status: "ok" | "warning" | "exceeded" | "none";
}) {
  const color =
    status === "exceeded"
      ? "var(--rf-red)"
      : status === "warning"
        ? "var(--rf-amber)"
        : "var(--rf-green)";

  return (
    <div
      className="h-1.5 w-full overflow-hidden"
      style={{ background: "var(--rf-inset)", borderRadius: 999 }}
      role="img"
      aria-label={`${Math.round((ratio ?? 0) * 100)} prosenttia budjetista`}
    >
      <div
        className="h-full"
        style={{
          width: `${Math.min(100, Math.max(2, (ratio ?? 0) * 100))}%`,
          background: color,
          borderRadius: 999,
        }}
      />
    </div>
  );
}

function formatShortDate(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(d)}.${Number(m)}.`;
}

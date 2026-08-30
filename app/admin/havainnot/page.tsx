import Link from "next/link";
import { adminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { monthFromParams } from "@/lib/restoflow/dates";
import { adminContext } from "@/lib/restoflow/page-context";
import {
  buildInsights,
  insightSeries,
  sortInsights,
  type Insight,
} from "@/lib/restoflow/insights";
import { formatMonth } from "@/lib/restoflow/expenses";
import { RfIcon } from "@/components/restoflow/icons";
import {
  BarRow,
  Card,
  CardHeader,
  EmptyState,
  ScopeNotice,
} from "@/components/restoflow/ui";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.loput.insights };
}

/**
 * Havainnot.
 *
 * Hälytykset kertovat mikä on rikki. Tämä kertoo mihin suuntaan asiat
 * menevät — myös silloin kun mikään ei ole rikki. Jokainen havainto
 * sanoo mihin lukuun se perustuu, koska ilman lukua se on mielipide
 * eikä sen perusteella muuteta mitään.
 */
export default async function InsightsPage({
  searchParams,
}: PageProps<"/admin/havainnot">) {
  const t = adminText(await resolveLocale());
  const locale = await resolveLocale();
  const {
    receipts,
    budgets,
    shifts,
    users,
    clockEvents,
    month: nykyinen,
    today,
    now,
    restaurant,
  } = await adminContext("/admin/havainnot");

  const month = monthFromParams(await searchParams, nykyinen);

  const insights = sortInsights(
    buildInsights({
      receipts,
      budgets,
      shifts,
      users,
      clockEvents,
      month,
      today,
      now,
      timezone: restaurant.timezone,
      locale,
    }),
  );

  const series = insightSeries(receipts, month);
  const peak = Math.max(...series.map((point) => point.totalCents), 1);

  const watch = insights.filter((i) => i.tone === "watch");

  return (
    <div className="rf-enter space-y-5 md:space-y-6">
      <div>
        <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {formatMonth(month, locale)} ·{" "}
          {watch.length === 0
            ? "ei seurattavaa"
            : `${watch.length} asiaa seurattavana`}
        </p>
      </div>

      <ScopeNotice>{t.loput.insightsIntro}</ScopeNotice>

      {insights.length === 0 ? (
        <EmptyState
          title={t.loput.noInsightsYet}
          description={t.loput.insightsNeedTwoMonths}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 md:gap-4">
          {insights.map((insight) => (
            <li key={insight.id}>
              <InsightCard insight={insight} />
            </li>
          ))}
        </ul>
      )}

      {series.length > 1 ? (
        <Card>
          <CardHeader
            title={t.loput.sixMonthExpenses}
            subtitle={t.loput.sameSourceAsExpenses}
          />
          <div className="space-y-4">
            {series.map((point) => (
              <BarRow
                key={point.month}
                label={formatMonth(point.month, locale)}
                valueCents={point.totalCents}
                share={point.totalCents / peak}
                meta={fill(t.loput.receiptsCountShort, {
                  maara: String(point.receiptCount),
                })}
                muted={point.month !== month}
                shareLabel="kuuden kuukauden suurimmasta"
              />
            ))}
          </div>
          <p
            className="mt-4 text-[12px] leading-relaxed"
            style={{ color: "var(--rf-text-3)" }}
          >
            {t.loput.barIsRelative}
          </p>
        </Card>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function InsightCard({ insight }: { insight: Insight }) {
  const tone =
    insight.tone === "watch"
      ? {
          bg: "var(--rf-amber-bg)",
          fg: "var(--rf-amber-text)",
          icon: "alert" as const,
        }
      : insight.tone === "good"
        ? {
            bg: "var(--rf-green-bg)",
            fg: "var(--rf-green-text)",
            icon: "check" as const,
          }
        : {
            bg: "var(--rf-blue-bg)",
            fg: "var(--rf-blue-text)",
            icon: "info" as const,
          };

  const body = (
    <Card className="h-full">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center"
          style={{ background: tone.bg, color: tone.fg, borderRadius: "50%" }}
        >
          <RfIcon name={tone.icon} size={18} />
        </span>

        <div className="min-w-0">
          <p className="text-[15px] font-semibold">{insight.title}</p>
          <p
            className="mt-1 text-[13px] leading-relaxed"
            style={{ color: "var(--rf-text-2)" }}
          >
            {insight.detail}
          </p>
        </div>
      </div>
    </Card>
  );

  if (!insight.href) return body;

  return (
    <Link href={insight.href} className="rf-press block h-full">
      {body}
    </Link>
  );
}

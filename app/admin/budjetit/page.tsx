import Link from "next/link";
import { labels } from "@/lib/i18n/labels";
import { resolveLocale } from "@/lib/i18n/resolve";
import { adminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { monthFromParams } from "@/lib/restoflow/dates";
import { RfIcon } from "@/components/restoflow/icons";
import { CountUp } from "@/components/restoflow/count-up";
import { adminContext } from "@/lib/restoflow/page-context";
import {
  budgetProgress,
  budgetSummary,
  spendByCategory,
  WARNING_THRESHOLD,
} from "@/lib/restoflow/budgets";
import { formatMonth, receiptsInMonth } from "@/lib/restoflow/expenses";
import { can } from "@/lib/restoflow/permissions";
import { CATEGORY_ORDER, type ExpenseCategory } from "@/lib/restoflow/types";
import { formatMoney } from "@/lib/money";
import { CategoryIcon } from "@/components/restoflow/icons";
import {
  BudgetBar,
  Card,
  CardHeader,
  EmptyState,
  MetricCard,
  Pill,
} from "@/components/restoflow/ui";
import { AddBudget, BudgetEditor } from "./editor";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.loput.budgetsTitle };
}

/**
 * Budjettinäkymä.
 *
 * Budjetti tekee kuluista toimintakelpoisia: "21 430 €" ei kerro onko se
 * paljon, mutta "82 % budjetista" kertoo.
 *
 * Kulutusvauhtia ei ekstrapoloida päiväkohtaisesti — ravintolan ostot eivät
 * jakaudu tasaisesti kuukaudelle, ja tasaiseen tahtiin perustuva ennuste
 * hälyttäisi turhaan heti ison tukkulaskun jälkeen.
 */
export default async function BudgetsPage({
  searchParams,
}: PageProps<"/admin/budjetit">) {
  const {
    receipts,
    budgets,
    month: nykyinen,
    role,
  } = await adminContext("/admin/budjetit");
  const locale = await resolveLocale();
  const t = adminText(locale);
  const nimet = labels(locale);

  const month = monthFromParams(await searchParams, nykyinen);

  const progress = budgetProgress(receipts, budgets, month);
  const summary = budgetSummary(progress);
  const canEdit = can(role, "budgets.edit");

  const budgeted = progress.filter((p) => p.budgetCents !== null);
  const unbudgeted = progress.filter((p) => p.budgetCents === null);

  const spendMap = spendByCategory(receiptsInMonth(receipts, month));
  const spend: Record<string, number> = {};
  for (const [category, cents] of spendMap) spend[category] = cents;

  const available = CATEGORY_ORDER.filter(
    (c) => !budgeted.some((p) => p.category === c),
  );

  return (
    <div className="rf-enter space-y-5">
      <div>
        <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {formatMonth(month, locale)} · {budgeted.length} budjetoitua
          kategoriaa
        </p>
      </div>

      {/* Sama kokoonpano kuin yleiskuvan avainluvuissa. */}
      {budgeted.length > 0 ? (
        <section
          aria-label={t.sanat.keyFigures}
          className="grid auto-rows-fr grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4"
        >
          <MetricCard
            label={t.budjetit.budgeted}
            icon={<RfIcon name="budget" size={17} />}
            tileTone="brand"
            tone="muted"
            value={<CountUp to={summary.totalBudgetCents} format="money" />}
            conclusion={t.loput.monthlyBudgetsTotal}
          />
          <MetricCard
            label={t.budjetit.used}
            icon={<RfIcon name="expenses" size={17} />}
            tileTone="green"
            tone="muted"
            value={<CountUp to={summary.totalSpentCents} format="money" />}
            conclusion={
              summary.totalBudgetCents > 0
                ? fill(t.budjetit.shareOfTotal, {
                    osuus: String(
                      Math.round(
                        (summary.totalSpentCents / summary.totalBudgetCents) *
                          100,
                      ),
                    ),
                  })
                : t.loput.noBudgetsSet
            }
          />
          <MetricCard
            label={t.budjetit.exceeded}
            icon={<RfIcon name="alert" size={17} />}
            tileTone="violet"
            value={<CountUp to={summary.exceededCount} format="integer" />}
            tone={summary.exceededCount > 0 ? "bad" : "muted"}
            conclusion={
              summary.exceededCount > 0
                ? t.loput.categoriesOverLimit
                : t.loput.noOverruns
            }
          />
          <MetricCard
            label={t.budjetit.nearLimit}
            icon={<RfIcon name="trend" size={17} />}
            tileTone="blue"
            value={<CountUp to={summary.warningCount} format="integer" />}
            tone={summary.warningCount > 0 ? "warn" : "muted"}
            conclusion={fill(t.budjetit.overThreshold, {
              osuus: String(Math.round(WARNING_THRESHOLD * 100)),
            })}
          />
        </section>
      ) : null}

      {budgeted.length === 0 ? (
        <EmptyState
          title={t.budjetit.none}
          description={canEdit ? t.loput.setBudgetHint : t.loput.ownerHasNotSet}
        />
      ) : (
        <Card>
          <CardHeader
            title={t.toimittajat.categories}
            subtitle={t.budjetit.overFirst}
          />
          <ul className="space-y-5">
            {budgeted.map((p) => {
              const pct = Math.round((p.ratio ?? 0) * 100);
              const over = p.status === "exceeded";

              return (
                <li key={p.category}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[15px] font-medium">
                      <span style={{ color: "var(--rf-text-2)" }}>
                        <CategoryIcon category={p.category} size={17} />
                      </span>
                      {nimet.categories[p.category]}
                    </span>
                    <span className="flex items-center gap-2.5">
                      {p.status === "exceeded" ? (
                        <Pill tone="risk" dot>
                          ylitetty
                        </Pill>
                      ) : p.status === "warning" ? (
                        <Pill tone="warn" dot>
                          {t.budjetit.approaching}
                        </Pill>
                      ) : (
                        <Pill tone="ok" dot>
                          ok
                        </Pill>
                      )}
                      <span className="rf-tabular text-[15px] font-semibold">
                        {pct} %
                      </span>
                      {canEdit ? (
                        <BudgetEditor
                          t={t}
                          nimet={nimet}
                          category={p.category}
                          currentCents={p.budgetCents}
                          spentCents={p.spentCents}
                        />
                      ) : null}
                    </span>
                  </div>

                  <div className="mt-2">
                    <BudgetBar ratio={p.ratio} status={p.status} />
                  </div>

                  <div className="mt-1.5 flex flex-wrap justify-between gap-3 text-[13px]">
                    <span
                      className="rf-tabular"
                      style={{ color: "var(--rf-text-2)" }}
                    >
                      {formatMoney(p.spentCents)} /{" "}
                      {formatMoney(p.budgetCents ?? 0)}
                    </span>
                    <span
                      className="rf-tabular"
                      style={{
                        color: over ? "var(--rf-red-text)" : "var(--rf-text-3)",
                      }}
                    >
                      {over
                        ? fill(t.budjetit.overBy, {
                            summa: formatMoney(Math.abs(p.remainingCents ?? 0)),
                          })
                        : fill(t.budjetit.remaining, {
                            summa: formatMoney(p.remainingCents ?? 0),
                          })}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {canEdit ? (
        <Card>
          <AddBudget
            t={t}
            nimet={nimet}
            categories={available as ExpenseCategory[]}
            spend={spend}
          />
        </Card>
      ) : null}

      {unbudgeted.length > 0 ? (
        <Card>
          <CardHeader
            title={t.budjetit.withoutBudget}
            subtitle={fill(t.budjetit.unbudgetedAmount, {
              summa: formatMoney(summary.unbudgetedCents),
            })}
          />
          <ul className="space-y-2.5">
            {unbudgeted.map((p) => (
              <li
                key={p.category}
                className="flex items-center justify-between gap-3"
              >
                <span className="flex items-center gap-2 text-[14px]">
                  <span style={{ color: "var(--rf-text-2)" }}>
                    <CategoryIcon category={p.category} size={16} />
                  </span>
                  {nimet.categories[p.category]}
                </span>
                <span className="flex items-center gap-2.5">
                  <span className="rf-tabular text-[14px] font-semibold">
                    {formatMoney(p.spentCents)}
                  </span>
                  {canEdit ? (
                    <BudgetEditor
                      t={t}
                      nimet={nimet}
                      category={p.category}
                      currentCents={null}
                      spentCents={p.spentCents}
                    />
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <p
            className="mt-4 text-[12px] leading-relaxed"
            style={{ color: "var(--rf-text-3)" }}
          >
            {t.budjetit.unbudgetedNote}
          </p>
        </Card>
      ) : null}

      <Card>
        <CardHeader title={t.budjetit.howItWorks} />
        <ul
          className="space-y-2 text-[13px] leading-relaxed"
          style={{ color: "var(--rf-text-2)" }}
        >
          <li>
            <strong>ok</strong> — alle {Math.round(WARNING_THRESHOLD * 100)} %
            käytetty
          </li>
          <li>
            <strong>{t.budjetit.approaching}</strong> —{" "}
            {Math.round(WARNING_THRESHOLD * 100)} % tai enemmän
          </li>
          <li>
            <strong>ylitetty</strong>
            {t.budjetit.overNote}
          </li>
        </ul>
        <p
          className="mt-4 text-[12px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          Sekakuitti jakautuu rivikohtaisesti useaan budjettiin. Kuitti jolla on
          ruokaa ja pesuainetta ei kirjaudu kokonaan ruokabudjettiin.{" "}
          <Link href="/admin/kuitit" className="underline underline-offset-4">
            {t.budjetit.seeReceipts}
          </Link>
        </p>
      </Card>
    </div>
  );
}

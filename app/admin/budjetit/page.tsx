import Link from "next/link";
import { RfIcon } from "@/components/restoflow/icons";
import { adminContext } from "@/lib/restoflow/page-context";
import {
  budgetProgress,
  budgetSummary,
  spendByCategory,
  WARNING_THRESHOLD,
} from "@/lib/restoflow/budgets";
import { formatMonth, receiptsInMonth } from "@/lib/restoflow/expenses";
import { can } from "@/lib/restoflow/permissions";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type ExpenseCategory,
} from "@/lib/restoflow/types";
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

export const metadata = { title: "Budjetit" };

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
export default async function BudgetsPage() {
  const { receipts, budgets, month, role } = await adminContext("/admin/budjetit");

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
          {formatMonth(month)} · {budgeted.length} budjetoitua kategoriaa
        </p>
      </div>

      {budgeted.length > 0 ? (
        <section aria-label="Yhteenveto" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Budjetoitu"
            icon={<RfIcon name="budget" size={17} />}
            tileTone="brand"
            value={formatMoney(summary.totalBudgetCents)}
            hint="Kuukausibudjetit yhteensä"
          />
          <MetricCard
            label="Käytetty"
            icon={<RfIcon name="expenses" size={17} />}
            tileTone="green"
            value={formatMoney(summary.totalSpentCents)}
            hint={
              summary.totalBudgetCents > 0
                ? `${Math.round((summary.totalSpentCents / summary.totalBudgetCents) * 100)} % kokonaisbudjetista`
                : undefined
            }
          />
          <MetricCard
            label="Ylitetty"
            icon={<RfIcon name="alert" size={17} />}
            tileTone="violet"
            value={String(summary.exceededCount)}
            hint={summary.exceededCount > 0 ? "Kategoriaa yli rajan" : "Ei ylityksiä"}
          />
          <MetricCard
            label="Lähestyy rajaa"
            icon={<RfIcon name="trend" size={17} />}
            tileTone="blue"
            value={String(summary.warningCount)}
            hint={`Yli ${Math.round(WARNING_THRESHOLD * 100)} % käytetty`}
          />
        </section>
      ) : null}

      {budgeted.length === 0 ? (
        <EmptyState
          title="Ei budjetteja"
          description={
            canEdit
              ? "Aseta kuukausibudjetti kategorialle, niin näet miten kulut suhteutuvat siihen ja saat hälytyksen ennen kuin raja ylittyy."
              : "Omistaja ei ole vielä asettanut budjetteja."
          }
        />
      ) : (
        <Card>
          <CardHeader title="Kategoriat" subtitle="Ylitykset ja varoitukset ensin" />
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
                      {CATEGORY_LABELS[p.category]}
                    </span>
                    <span className="flex items-center gap-2.5">
                      {p.status === "exceeded" ? (
                        <Pill tone="risk" dot>ylitetty</Pill>
                      ) : p.status === "warning" ? (
                        <Pill tone="warn" dot>lähestyy</Pill>
                      ) : (
                        <Pill tone="ok" dot>ok</Pill>
                      )}
                      <span className="rf-tabular text-[15px] font-semibold">{pct} %</span>
                      {canEdit ? (
                        <BudgetEditor
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
                    <span className="rf-tabular" style={{ color: "var(--rf-text-2)" }}>
                      {formatMoney(p.spentCents)} / {formatMoney(p.budgetCents ?? 0)}
                    </span>
                    <span
                      className="rf-tabular"
                      style={{ color: over ? "var(--rf-red-text)" : "var(--rf-text-3)" }}
                    >
                      {over
                        ? `${formatMoney(Math.abs(p.remainingCents ?? 0))} yli`
                        : `${formatMoney(p.remainingCents ?? 0)} jäljellä`}
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
          <AddBudget categories={available as ExpenseCategory[]} spend={spend} />
        </Card>
      ) : null}

      {unbudgeted.length > 0 ? (
        <Card>
          <CardHeader
            title="Ilman budjettia"
            subtitle={`${formatMoney(summary.unbudgetedCents)} kuluja kategorioissa joille ei ole asetettu budjettia`}
          />
          <ul className="space-y-2.5">
            {unbudgeted.map((p) => (
              <li key={p.category} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[14px]">
                  <span style={{ color: "var(--rf-text-2)" }}>
                    <CategoryIcon category={p.category} size={16} />
                  </span>
                  {CATEGORY_LABELS[p.category]}
                </span>
                <span className="flex items-center gap-2.5">
                  <span className="rf-tabular text-[14px] font-semibold">
                    {formatMoney(p.spentCents)}
                  </span>
                  {canEdit ? (
                    <BudgetEditor
                      category={p.category}
                      currentCents={null}
                      spentCents={p.spentCents}
                    />
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
            Budjetoimaton kulu ei katoa näkyvistä. Se näytetään tässä, jotta
            kokonaiskuva pysyy täytenä.
          </p>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Miten budjetit toimivat" />
        <ul className="space-y-2 text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
          <li>
            <strong>ok</strong> — alle {Math.round(WARNING_THRESHOLD * 100)} % käytetty
          </li>
          <li>
            <strong>lähestyy</strong> — {Math.round(WARNING_THRESHOLD * 100)} % tai enemmän
          </li>
          <li>
            <strong>ylitetty</strong> — yli 100 %, hälytys nousee yleiskuvaan
          </li>
        </ul>
        <p className="mt-4 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
          Sekakuitti jakautuu rivikohtaisesti useaan budjettiin. Kuitti jolla on
          ruokaa ja pesuainetta ei kirjaudu kokonaan ruokabudjettiin.{" "}
          <Link href="/admin/kuitit" className="underline underline-offset-4">
            Katso kuitit
          </Link>
        </p>
      </Card>
    </div>
  );
}

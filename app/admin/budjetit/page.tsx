import Link from "next/link";
import { BUDGETS, DEMO_MONTH, RECEIPTS } from "@/lib/restoflow/data";
import {
  budgetProgress,
  budgetSummary,
  WARNING_THRESHOLD,
} from "@/lib/restoflow/budgets";
import { formatMonth } from "@/lib/restoflow/expenses";
import { CATEGORY_EMOJI, CATEGORY_LABELS } from "@/lib/restoflow/types";
import { formatMoney } from "@/lib/money";
import {
  BudgetBar,
  Card,
  CardHeader,
  DemoNotice,
  MetricCard,
  Pill,
} from "@/components/restoflow/ui";

export const metadata = { title: "Budjetit" };

/**
 * Budjettinäkymä.
 *
 * Budjetti tekee kuluista toimintakelpoisia: "21 430 €" ei kerro onko se
 * paljon, mutta "82 % budjetista" kertoo.
 *
 * Kulutusvauhtia ei ekstrapoloida päiväkohtaisesti — ravintolan ostot
 * eivät jakaudu tasaisesti kuukaudelle, ja tasaiseen tahtiin perustuva
 * ennuste hälyttäisi turhaan heti ison tukkulaskun jälkeen.
 */
export default function BudgetsPage() {
  const month = DEMO_MONTH;
  const progress = budgetProgress(RECEIPTS, BUDGETS, month);
  const summary = budgetSummary(progress);

  const budgeted = progress.filter((p) => p.budgetCents !== null);
  const unbudgeted = progress.filter((p) => p.budgetCents === null);

  return (
    <div className="rf-enter space-y-6">
      <div>
        <h1 className="text-[30px] font-semibold tracking-tight">Budjetit</h1>
        <p className="mt-1 text-[15px]" style={{ color: "var(--rf-text-2)" }}>
          {formatMonth(month)} · {budgeted.length} budjetoitua kategoriaa
        </p>
      </div>

      <DemoNotice>
        Demo-aineisto. Budjettien muokkaus vaatii tietokantayhteyden, jota ei
        ole vielä kytketty — alla näkyvät arvot ovat kiinteitä.
      </DemoNotice>

      <section aria-label="Yhteenveto" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="🎯 Budjetoitu"
          value={formatMoney(summary.totalBudgetCents)}
          hint="Kuukausibudjetit yhteensä"
        />
        <MetricCard
          label="💶 Käytetty"
          value={formatMoney(summary.totalSpentCents)}
          hint={
            summary.totalBudgetCents > 0
              ? `${Math.round((summary.totalSpentCents / summary.totalBudgetCents) * 100)} % kokonaisbudjetista`
              : undefined
          }
        />
        <MetricCard
          label="🔴 Ylitetty"
          value={String(summary.exceededCount)}
          hint={summary.exceededCount > 0 ? "Kategoriaa yli budjetin" : "Ei ylityksiä"}
        />
        <MetricCard
          label="🟡 Lähestyy rajaa"
          value={String(summary.warningCount)}
          hint={`Yli ${Math.round(WARNING_THRESHOLD * 100)} % käytetty`}
        />
      </section>

      <Card>
        <CardHeader
          title="Kategoriat"
          subtitle="Ylitykset ja varoitukset ensin"
        />
        <ul className="space-y-5">
          {budgeted.map((p) => {
            const pct = Math.round((p.ratio ?? 0) * 100);
            const over = p.status === "exceeded";

            return (
              <li key={p.category}>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span className="text-[15px] font-medium">
                    {CATEGORY_EMOJI[p.category]} {CATEGORY_LABELS[p.category]}
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
                    style={{
                      color: over ? "var(--rf-red-text)" : "var(--rf-text-3)",
                    }}
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

      {unbudgeted.length > 0 ? (
        <Card>
          <CardHeader
            title="Ilman budjettia"
            subtitle={`${formatMoney(summary.unbudgetedCents)} kuluja kategorioissa joille ei ole asetettu budjettia`}
          />
          <ul className="space-y-2.5">
            {unbudgeted.map((p) => (
              <li key={p.category} className="flex items-baseline justify-between gap-3">
                <span className="text-[14px]">
                  {CATEGORY_EMOJI[p.category]} {CATEGORY_LABELS[p.category]}
                </span>
                <span className="rf-tabular text-[14px] font-semibold">
                  {formatMoney(p.spentCents)}
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
        <ul
          className="space-y-2 text-[13px] leading-relaxed"
          style={{ color: "var(--rf-text-2)" }}
        >
          <li>
            🟢 <strong>ok</strong> — alle {Math.round(WARNING_THRESHOLD * 100)} % käytetty
          </li>
          <li>
            🟡 <strong>lähestyy</strong> — {Math.round(WARNING_THRESHOLD * 100)} % tai enemmän
          </li>
          <li>
            🔴 <strong>ylitetty</strong> — yli 100 %, hälytys nousee yleiskuvaan
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

import Link from "next/link";
import { CountUp } from "@/components/restoflow/count-up";
import { formatMoney } from "@/lib/money";
import { fill } from "@/lib/i18n/auth-text";
import type { AdminText } from "@/lib/i18n/admin-text";

/**
 * Kuukauden tulos yleiskatsauksen ylimpänä.
 *
 * KATEN YDINKYSYMYS ENSIN.
 *
 * Paljonko rahaa tuli ja paljonko siitä jäi käteen. Luku on sivun
 * suurin, ja sen vieressä jakopalkki näyttää mihin myynti meni:
 * kuluihin vai käteen. Palkki kasvaa sisään tultaessa, jotta osuudet
 * luetaan liikkeestä eikä vasta prosenteista.
 *
 * ILMAN MYYNTIÄ EI TULOSTA.
 *
 * Myynti miinus kulut ilman kirjattua myyntiä olisi suuri negatiivinen
 * luku, joka näyttäisi tappiolta mutta tarkoittaisi vain ettei myyntiä
 * ole syötetty. Silloin kortti kertoo mitä tehdä.
 */
export function ResultHero({
  t,
  monthLabel,
  salesCents,
  costCents,
  soFar,
  canAddSales,
}: {
  t: AdminText;
  monthLabel: string;
  /** Kuukauden verollinen myynti ilman ALV:tä. Null = ei kirjattu. */
  salesCents: number | null;
  costCents: number;
  /** Kuluva kuukausi: luku on tähänastinen, ei koko kuukauden. */
  soFar: boolean;
  canAddSales: boolean;
}) {
  const y = t.yleiskatsaus;
  const result = salesCents === null ? null : salesCents - costCents;
  const loss = result !== null && result < 0;

  const costShare =
    salesCents && salesCents > 0 ? Math.min(1, costCents / salesCents) : 1;
  const keptShare = 1 - costShare;

  return (
    <section className="rf-result-hero" aria-label={y.resultTitle}>
      <div className="rf-result-glow" aria-hidden="true" />

      <div className="relative grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-10">
        <div className="min-w-0">
          <p
            className="text-[12px] font-bold uppercase tracking-[0.08em]"
            style={{ color: "var(--rf-text-3)" }}
          >
            {y.resultTitle} · {monthLabel}
            {soFar ? ` · ${y.resultSoFar}` : ""}
          </p>

          {result === null ? (
            <>
              <p className="rf-tabular mt-2 text-[40px] font-extrabold leading-none tracking-[-0.04em]">
                —
              </p>
              <p
                className="mt-3 max-w-sm text-[13.5px] leading-relaxed"
                style={{ color: "var(--rf-text-2)" }}
              >
                {y.resultNoSales}
              </p>
              {canAddSales ? (
                <Link
                  href="/admin/myynti"
                  className="rf-press mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold"
                  style={{ color: "var(--rf-accent)" }}
                >
                  {y.resultAddSales} →
                </Link>
              ) : null}
            </>
          ) : (
            <>
              <p
                className="rf-tabular rf-result-number mt-2 text-[clamp(2.2rem,5vw,3rem)] font-extrabold leading-none tracking-[-0.04em]"
                style={{
                  color: loss ? "var(--rf-red-text)" : "var(--rf-green-text)",
                }}
              >
                {loss ? "−" : "+"}
                <CountUp to={Math.abs(result)} format="money" />
              </p>
              <p
                className="rf-tabular mt-3 text-[13px]"
                style={{ color: "var(--rf-text-2)" }}
              >
                {fill(y.resultFormula, {
                  myynti: formatMoney(salesCents ?? 0),
                  kulut: formatMoney(costCents),
                })}
              </p>
            </>
          )}
        </div>

        {result === null ? null : (
          <div className="min-w-0">
            {/* Jakopalkki: myynti jaettuna kuluihin ja siihen mitä jäi. */}
            <div className="rf-split" aria-hidden="true">
              <span
                className="rf-split-cost"
                style={{ width: `${costShare * 100}%` }}
              />
              {keptShare > 0 ? (
                <span
                  className="rf-split-kept"
                  style={{ width: `${keptShare * 100}%` }}
                />
              ) : null}
            </div>

            <ul className="mt-3.5 grid grid-cols-2 gap-3 text-[12.5px]">
              <li className="flex items-start gap-2">
                <i className="rf-split-dot" style={{ background: "#f0913a" }} />
                <span>
                  <span className="block font-semibold">{y.resultCosts}</span>
                  <span style={{ color: "var(--rf-text-3)" }}>
                    {fill(y.resultOfSales, {
                      osuus: String(Math.round(costShare * 100)),
                    })}
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <i
                  className="rf-split-dot"
                  style={{ background: loss ? "var(--rf-red)" : "var(--rf-green)" }}
                />
                <span>
                  <span className="block font-semibold">
                    {loss ? y.resultLoss : y.resultKept}
                  </span>
                  {loss ? null : (
                    <span style={{ color: "var(--rf-text-3)" }}>
                      {fill(y.resultOfSales, {
                        osuus: String(Math.round(keptShare * 100)),
                      })}
                    </span>
                  )}
                </span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { getAppMode } from "@/lib/auth";
import { loadDocuments } from "@/lib/data/page-data";
import { reportTotals, vatSummary } from "@/lib/data/queries";
import { formatMoney, formatRate } from "@/lib/money";
import { EmptyState, MetricCard, Notice, Panel } from "@/components/ui";
import { DataProblem, ModeNotice } from "@/components/mode-notice";

export const metadata: Metadata = { title: "ALV" };

/**
 * ALV-yhteenveto (§26).
 *
 * Lasketaan riveiltä, ei dokumenttitasolta. Monikantainen tosite kirjautuisi
 * muuten kokonaan yhteen koodiin, mikä on juuri se virhe jota Verra välttää.
 */
export default async function VatPage() {
  const mode = await getAppMode();
  const result = await loadDocuments(mode);
  const docs = result.ok ? result.data : [];

  const buckets = vatSummary(docs);
  const totals = reportTotals(docs);
  const unresolved = buckets.filter((b) => b.vatCode === "Ratkaisematta");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">ALV</h1>
        <p className="mt-1 text-sm text-muted">
          {totals.documents} dokumenttia · {totals.lines} riviä
        </p>
      </div>

      <ModeNotice mode={mode} />
      <DataProblem result={result} />

      {unresolved.length > 0 ? (
        <Notice tone="warn" title="Osa riveistä on ratkaisematta">
          {formatMoney(unresolved[0].vatCents)} ALV:sta on riveillä joiden
          verokohtelua ei ole vahvistettu. Ne eivät kelpaa ALV-ilmoituksen
          pohjaksi ennen tarkistusta.{" "}
          <Link href="/review" className="underline underline-offset-4">
            Avaa tarkistusjono
          </Link>
        </Notice>
      ) : null}

      <section aria-label="Yhteenveto" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Veroton yhteensä" value={formatMoney(totals.netCents)} />
        <MetricCard label="ALV yhteensä" value={formatMoney(totals.vatCents)} />
        <MetricCard
          label="Vähennyskelpoinen"
          value={formatMoney(totals.deductibleVatCents)}
          tone="ok"
        />
        <MetricCard
          label="Ratkaisematta"
          value={formatMoney(totals.unresolvedVatCents)}
          tone={totals.unresolvedVatCents > 0 ? "warn" : "neutral"}
        />
      </section>

      {buckets.length === 0 ? (
        <EmptyState
          title="Ei ALV-tietoja"
          description="Lähetä dokumentteja, niin yhteenveto rakentuu rivikohtaisista päätöksistä."
          action={
            <Link href="/inbox" className="text-sm text-navy-600 underline underline-offset-4">
              Saapuneet
            </Link>
          }
        />
      ) : (
        <Panel title="ALV-koodeittain">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">ALV-erittely koodeittain</caption>
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-3 font-medium">ALV-koodi</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Kanta</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Rivejä</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Veroton</th>
                  <th scope="col" className="py-2 text-right font-medium">ALV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular">
                {buckets.map((b) => (
                  <tr key={`${b.vatCode}-${b.vatRate}`}>
                    <td className="py-2.5 pr-3">
                      <span className="font-mono text-xs">{b.vatCode}</span>
                      {b.reverseCharge ? (
                        <span className="ml-2 text-xs text-gold-600">käännetty</span>
                      ) : null}
                      {b.deductible === false ? (
                        <span className="ml-2 text-xs text-risk-600">ei vähennettävä</span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-3 text-right">{formatRate(b.vatRate)}</td>
                    <td className="py-2.5 pr-3 text-right">{b.lineCount}</td>
                    <td className="py-2.5 pr-3 text-right">{formatMoney(b.netCents)}</td>
                    <td className="py-2.5 text-right font-medium">
                      {formatMoney(b.vatCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-line font-semibold tabular">
                  <td className="py-2.5 pr-3">Yhteensä</td>
                  <td />
                  <td className="py-2.5 pr-3 text-right">{totals.lines}</td>
                  <td className="py-2.5 pr-3 text-right">{formatMoney(totals.netCents)}</td>
                  <td className="py-2.5 text-right">{formatMoney(totals.vatCents)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

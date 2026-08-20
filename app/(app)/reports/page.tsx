import type { Metadata } from "next";
import Link from "next/link";
import { getAppMode } from "@/lib/auth";
import { loadDocuments } from "@/lib/data/page-data";
import { reportTotals, vatSummary } from "@/lib/data/queries";
import type { DocumentView } from "@/lib/data/documents";
import { formatMoney } from "@/lib/money";
import { reviewReasonLabel } from "@/lib/tax/engine";
import { EmptyState, MetricCard, Panel } from "@/components/ui";
import { DataProblem, ModeNotice } from "@/components/mode-notice";

export const metadata: Metadata = { title: "Raportit" };

/**
 * Raportit (§26).
 *
 * Kaikki lasketaan samoista rivikohtaisista päätöksistä kuin ALV-näkymä ja
 * vienti. Yksi laskentalähde tarkoittaa ettei raportti voi kertoa eri
 * tarinaa kuin kirjanpitoon menevä aineisto.
 */
export default async function ReportsPage() {
  const mode = await getAppMode();
  const result = await loadDocuments(mode);
  const docs = result.ok ? result.data : [];

  const totals = reportTotals(docs);
  const buckets = vatSummary(docs);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Raportit</h1>
        <p className="mt-1 text-sm text-muted">
          {totals.documents} dokumenttia · {totals.lines} riviä
        </p>
      </div>

      <ModeNotice mode={mode} />
      <DataProblem result={result} />

      {docs.length === 0 ? (
        <EmptyState
          title="Ei raportoitavaa"
          description="Raportit rakentuvat käsitellyistä dokumenteista."
          action={
            <Link href="/inbox" className="text-sm text-navy-600 underline underline-offset-4">
              Saapuneet
            </Link>
          }
        />
      ) : (
        <>
          <section aria-label="Yhteenveto" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Veroton" value={formatMoney(totals.netCents)} />
            <MetricCard label="ALV" value={formatMoney(totals.vatCents)} />
            <MetricCard
              label="Vähennyskelpoinen ALV"
              value={formatMoney(totals.deductibleVatCents)}
              tone="ok"
            />
            <MetricCard
              label="Vähennyskelvoton ALV"
              value={formatMoney(totals.nonDeductibleVatCents)}
            />
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel
              title="Vähennyskelpoisuus"
              action={
                <Link href="/vat" className="text-sm text-navy-600 underline underline-offset-4">
                  ALV-erittely
                </Link>
              }
            >
              <dl className="space-y-2 text-sm">
                <Row label="Vähennyskelpoinen" value={formatMoney(totals.deductibleVatCents)} />
                <Row label="Vähennyskelvoton" value={formatMoney(totals.nonDeductibleVatCents)} />
                <Row
                  label="Ratkaisematta"
                  value={formatMoney(totals.unresolvedVatCents)}
                  tone={totals.unresolvedVatCents > 0 ? "warn" : undefined}
                />
              </dl>
              {totals.unresolvedVatCents > 0 ? (
                <p className="mt-3 text-xs text-muted">
                  Ratkaisematon erä ei kuulu ALV-ilmoitukseen ennen kuin
                  verokohtelu on vahvistettu.
                </p>
              ) : null}
            </Panel>

            <Panel title="Rajat ylittävät">
              <dl className="space-y-2 text-sm">
                <Row label="Dokumentteja" value={String(totals.crossBorderDocs)} />
                <Row
                  label="Käännetty verovelvollisuus"
                  value={String(buckets.filter((b) => b.reverseCharge).length)}
                />
                <Row
                  label="ALV-tunniste puuttuu"
                  value={String(totals.missingSupplierVatId)}
                  tone={totals.missingSupplierVatId > 0 ? "warn" : undefined}
                />
              </dl>
            </Panel>

            <Panel
              title="Tarkistusta odottavat"
              action={
                <Link href="/review" className="text-sm text-navy-600 underline underline-offset-4">
                  Avaa jono
                </Link>
              }
            >
              {totals.needsReviewDocs === 0 ? (
                <p className="text-sm text-muted">Ei tarkistettavia.</p>
              ) : (
                <ReasonBreakdown docs={docs} />
              )}
            </Panel>

            <Panel title="Puuttuvat tiedot">
              <ul className="space-y-2 text-sm">
                <MissingRow
                  label="Toimittajan ALV-tunniste puuttuu"
                  count={totals.missingSupplierVatId}
                />
                <MissingRow
                  label="Tositepäivä puuttuu"
                  count={docs.filter((d) => d.date === "—").length}
                />
                <MissingRow
                  label="Verokohtelu ratkaisematta"
                  count={
                    docs.filter((d) =>
                      d.classification.lines.some((l) => l.decision.outcome !== "determined"),
                    ).length
                  }
                />
              </ul>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function ReasonBreakdown({ docs }: { docs: DocumentView[] }) {
  const counts = new Map<string, number>();
  for (const doc of docs) {
    if (doc.status !== "needs_review") continue;
    for (const reason of doc.classification.reviewReasons) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <ul className="space-y-2 text-sm">
      {sorted.map(([reason, count]) => (
        <li key={reason} className="flex items-baseline justify-between gap-4">
          <span>{reviewReasonLabel(reason)}</span>
          <span className="tabular font-medium">{count}</span>
        </li>
      ))}
    </ul>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={`tabular font-medium ${tone === "warn" ? "text-warn-600" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function MissingRow({ label, count }: { label: string; count: number }) {
  return (
    <li className="flex items-baseline justify-between gap-4">
      <span className={count > 0 ? "" : "text-muted"}>{label}</span>
      <span className={`tabular font-medium ${count > 0 ? "text-warn-600" : "text-muted"}`}>
        {count}
      </span>
    </li>
  );
}

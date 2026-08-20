import type { Metadata } from "next";
import Link from "next/link";
import { getAppMode } from "@/lib/auth";
import {
  demoDocuments,
  emptyDocuments,
  listDocuments,
  type DocumentView,
} from "@/lib/data/documents";
import { formatMoney } from "@/lib/money";
import { EmptyState, MetricCard, Panel, StatusBadge } from "@/components/ui";
import { DataProblem, ModeNotice } from "@/components/mode-notice";

export const metadata: Metadata = { title: "Yleiskuva" };

export default async function DashboardPage() {
  const mode = await getAppMode();
  // Kirjautunut käyttäjä ei koskaan näe demolukuja: ilman organisaatiota
  // näkymä on tyhjä, ei keksitty.
  const result =
    mode.kind === "live"
      ? await listDocuments(mode.org.id)
      : mode.kind === "demo"
        ? demoDocuments()
        : emptyDocuments();

  const docs = result.ok ? result.data : [];
  const m = summarise(docs);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Yleiskuva</h1>
          <p className="mt-1 text-sm text-muted">
            {mode.kind === "live"
              ? mode.org.name
              : mode.kind === "demo"
                ? "Demo-aineisto"
                : "Ei aineistoa"}
          </p>
        </div>
        <Link
          href="/inbox"
          className="rounded-md bg-gold-400 px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-gold-300"
        >
          Lähetä dokumentti
        </Link>
      </div>

      <ModeNotice mode={mode} />
      <DataProblem result={result} />

      <section aria-label="Tunnusluvut" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Vastaanotettu" value={String(m.received)} />
        <MetricCard label="Käsitelty" value={String(m.processed)} />
        <MetricCard
          label="Tarkistettavana"
          value={String(m.needsReview)}
          tone={m.needsReview > 0 ? "warn" : "neutral"}
          hint={m.needsReview > 0 ? "Vaatii ihmisen päätöksen" : undefined}
        />
        <MetricCard label="Hyväksytty" value={String(m.approved)} tone="ok" />
        <MetricCard label="ALV yhteensä" value={formatMoney(m.vatCents)} />
        <MetricCard label="Vähennyskelpoinen ALV" value={formatMoney(m.deductibleCents)} />
        <MetricCard
          label="Vähennyskelvoton"
          value={formatMoney(m.nonDeductibleCents)}
          hint="Sisältää ratkaisemattomat"
        />
        <MetricCard label="Rajat ylittävät" value={String(m.crossBorder)} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel
            title="Viimeisimmät dokumentit"
            action={
              <Link href="/inbox" className="text-sm text-navy-600 underline underline-offset-4">
                Kaikki
              </Link>
            }
          >
            {docs.length === 0 ? (
              <EmptyState
                title="Ei vielä dokumentteja"
                description="Lähetä ensimmäinen kuitti, niin näet rivikohtaisen ALV:n, sääntötunnuksen ja perustelun alle minuutissa."
                action={
                  <Link
                    href="/inbox"
                    className="rounded-md bg-gold-400 px-4 py-2 text-sm font-semibold text-navy-900"
                  >
                    Lähetä dokumentti
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {docs.slice(0, 5).map((doc) => (
                  <li key={doc.id}>
                    <Link
                      href={`/documents/${doc.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-surface"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{doc.supplier}</p>
                        <p className="text-xs text-muted">
                          {doc.documentNumber} · {doc.date} · {doc.country}
                          {doc.classification.treatmentCount > 1
                            ? ` · ${doc.classification.treatmentCount} ALV-käsittelyä`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm tabular">
                          {formatMoney(doc.classification.totalVatCents)}
                        </span>
                        <StatusBadge status={doc.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Pikatoiminnot">
            <ul className="space-y-2">
              <li>
                <Link
                  href="/inbox"
                  className="block rounded-md border border-line px-3 py-2 text-sm hover:border-navy-300"
                >
                  Lähetä kuitti tai lasku
                </Link>
              </li>
              <li>
                <Link
                  href="/inbox?suodatin=tarkistettava"
                  className="block rounded-md border border-line px-3 py-2 text-sm hover:border-navy-300"
                >
                  Tarkista merkityt
                </Link>
              </li>
              <li>
                <span className="block cursor-not-allowed rounded-md border border-dashed border-line px-3 py-2 text-sm text-muted">
                  Luo matka · pian
                </span>
              </li>
            </ul>
          </Panel>

          <Panel title="Määräajat">
            <div className="text-sm">
              <p className="font-medium">ALV-ilmoitus</p>
              <p className="text-muted">12.7.2026</p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function summarise(docs: DocumentView[]) {
  const vatCents = docs.reduce((s, d) => s + d.classification.totalVatCents, 0);
  const deductibleCents = docs.reduce(
    (s, d) =>
      s +
      d.classification.lines
        .filter((l) => l.decision.deductible === true)
        .reduce((t, l) => t + (l.decision.vatAmountCents ?? 0), 0),
    0,
  );

  return {
    received: docs.length,
    processed: docs.filter((d) => !["received", "processing"].includes(d.status)).length,
    needsReview: docs.filter((d) => d.status === "needs_review").length,
    approved: docs.filter((d) => d.status === "approved").length,
    vatCents,
    deductibleCents,
    nonDeductibleCents: vatCents - deductibleCents,
    crossBorder: docs.filter((d) => d.crossBorder).length,
  };
}

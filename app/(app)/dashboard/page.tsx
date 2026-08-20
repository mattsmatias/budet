import type { Metadata } from "next";
import Link from "next/link";
import { DEMO_DOCUMENTS, demoMetrics } from "@/lib/demo/data";
import { formatMoney } from "@/lib/money";
import { MetricCard, Notice, Panel, StatusBadge } from "@/components/ui";

export const metadata: Metadata = { title: "Yleiskuva" };

const QUICK_ACTIONS = [
  { label: "Lataa kuitti", href: "/inbox" },
  { label: "Lataa lasku", href: "/inbox" },
  { label: "Tarkista merkityt", href: "/inbox?suodatin=tarkistettava" },
];

export default function DashboardPage() {
  const m = demoMetrics();
  const recent = DEMO_DOCUMENTS.slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Yleiskuva</h1>
          <p className="mt-1 text-sm text-muted">Kesäkuu 2026 · demo-aineisto</p>
        </div>
        <Link
          href="/inbox"
          className="rounded-md bg-gold-400 px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-gold-300"
        >
          Lähetä dokumentti
        </Link>
      </div>

      <Notice tone="info" title="Tämä on demo-aineisto">
        Luvut on laskettu oikealla sääntömoottorilla demo-tasoisilla säännöillä.
        Ne havainnollistavat toimintaa eivätkä ole oikeudellinen kannanotto.
      </Notice>

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
        <MetricCard
          label="Rajat ylittävät"
          value={String(m.crossBorder)}
          hint={`${m.viesChecks} VIES-tarkistusta`}
        />
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
            <ul className="divide-y divide-line">
              {recent.map((doc) => (
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
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Pikatoiminnot">
            <ul className="space-y-2">
              {QUICK_ACTIONS.map((a) => (
                <li key={a.label}>
                  <Link
                    href={a.href}
                    className="block rounded-md border border-line px-3 py-2 text-sm hover:border-navy-300"
                  >
                    {a.label}
                  </Link>
                </li>
              ))}
              <li>
                <span
                  className="block cursor-not-allowed rounded-md border border-dashed border-line px-3 py-2 text-sm text-muted"
                  title="Ei vielä toteutettu"
                >
                  Luo matka · pian
                </span>
              </li>
            </ul>
          </Panel>

          <Panel title="Määräajat">
            <div className="text-sm">
              <p className="font-medium">ALV-ilmoitus</p>
              <p className="text-muted">12.7.2026 · 28 päivää</p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

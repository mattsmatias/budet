import type { Metadata } from "next";
import Link from "next/link";
import { getAppMode } from "@/lib/auth";
import { demoDocuments, emptyDocuments, listDocuments } from "@/lib/data/documents";
import { planExport } from "@/lib/services/export";
import { EXPORT_CANDIDATE_STATUSES, toExportable } from "@/lib/data/export-adapter";
import { formatMoney } from "@/lib/money";
import { EmptyState, Notice, Panel, StatusBadge } from "@/components/ui";
import { DataProblem, ModeNotice } from "@/components/mode-notice";

export const metadata: Metadata = { title: "Viennit" };

/**
 * Vientinäkymä (§20, §51).
 *
 * Näyttää mitä olisi tulossa JA mikä estää. Estetty dokumentti ei katoa
 * listalta — käyttäjän on nähtävä täsmällinen syy, ei vain että rivi
 * puuttuu tuloksesta.
 */
export default async function ExportsPage() {
  const mode = await getAppMode();
  const result =
    mode.kind === "live"
      ? await listDocuments(mode.org.id)
      : mode.kind === "demo"
        ? demoDocuments()
        : emptyDocuments();

  const docs = result.ok ? result.data : [];
  const candidates = docs.filter((d) => EXPORT_CANDIDATE_STATUSES.includes(d.status));

  const plan = planExport(candidates.map(toExportable));
  const blocksByDoc = new Map<string, string[]>();
  for (const block of plan.blocks) {
    blocksByDoc.set(block.documentId, [
      ...(blocksByDoc.get(block.documentId) ?? []),
      block.message,
    ]);
  }

  const ready = candidates.filter((d) => !blocksByDoc.has(d.id));
  const blocked = candidates.filter((d) => blocksByDoc.has(d.id));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Viennit</h1>
          <p className="mt-1 text-sm text-muted">
            {ready.length} valmista · {blocked.length} estettyä
          </p>
        </div>
        {ready.length > 0 && mode.kind === "live" ? (
          <a
            href="/api/exports/csv"
            className="rounded-md bg-gold-400 px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-gold-300"
          >
            Lataa CSV ({ready.length})
          </a>
        ) : null}
      </div>

      <ModeNotice mode={mode} />
      <DataProblem result={result} />

      {candidates.length === 0 ? (
        <EmptyState
          title="Ei vietävää"
          description="Vietäväksi kelpaa hyväksytty dokumentti, jolla on ratkaistu verokohtelu ja vaaditut kentät."
          action={
            <Link href="/inbox" className="text-sm text-navy-600 underline underline-offset-4">
              Saapuneet
            </Link>
          }
        />
      ) : (
        <>
          {blocked.length > 0 ? (
            <Notice tone="warn" title={`${blocked.length} dokumenttia on estetty`}>
              Estettyä dokumenttia ei viedä kirjanpitoon. Käsittele syyt tai
              hyväksy dokumentti nimenomaisella ohituksella.
            </Notice>
          ) : null}

          {blocked.length > 0 ? (
            <Panel title="Estetyt">
              <ul className="divide-y divide-line">
                {blocked.map((doc) => (
                  <li key={doc.id} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/documents/${doc.id}`}
                          className="text-sm font-medium underline-offset-4 hover:underline"
                        >
                          {doc.supplier}
                        </Link>
                        <p className="text-xs text-muted">
                          {doc.documentNumber} · {doc.date}
                        </p>
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {(blocksByDoc.get(doc.id) ?? []).map((msg) => (
                            <li
                              key={msg}
                              className="rounded border border-warn-500/30 bg-warn-100 px-2 py-0.5 text-xs text-warn-600"
                            >
                              {msg}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <StatusBadge status={doc.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {ready.length > 0 ? (
            <Panel title="Valmiina vietäväksi">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-sm">
                  <caption className="sr-only">Vientiin valmiit dokumentit</caption>
                  <thead className="text-left text-xs uppercase tracking-wide text-muted">
                    <tr className="border-b border-line">
                      <th scope="col" className="py-2 pr-3 font-medium">Toimittaja</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Päivä</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Rivejä</th>
                      <th scope="col" className="py-2 text-right font-medium">ALV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line tabular">
                    {ready.map((doc) => (
                      <tr key={doc.id}>
                        <td className="py-2.5 pr-3">
                          <Link
                            href={`/documents/${doc.id}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {doc.supplier}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-3">{doc.date}</td>
                        <td className="py-2.5 pr-3">{doc.classification.lines.length}</td>
                        <td className="py-2.5 text-right">
                          {formatMoney(doc.classification.totalVatCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}
        </>
      )}
    </div>
  );
}


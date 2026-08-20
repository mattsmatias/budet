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
import { reviewReasonLabel } from "@/lib/tax/engine";
import { ConfidenceBadge, EmptyState, Panel } from "@/components/ui";
import { DataProblem, ModeNotice } from "@/components/mode-notice";

export const metadata: Metadata = { title: "Tarkistus" };

/**
 * Tarkistusjono (§23).
 *
 * Jokainen merkitty dokumentti kertoo TÄSMÄLLEEN miksi se on merkitty.
 * Ilman syytä jono olisi vain lista töitä; syyn kanssa se on työkalu.
 */
export default async function ReviewPage() {
  const mode = await getAppMode();
  const result =
    mode.kind === "live"
      ? await listDocuments(mode.org.id)
      : mode.kind === "demo"
        ? demoDocuments()
        : emptyDocuments();

  const all = result.ok ? result.data : [];
  const flagged = all.filter((d) => d.status === "needs_review");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Tarkistus</h1>
        <p className="mt-1 text-sm text-muted">
          {flagged.length === 0
            ? "Ei tarkistettavia"
            : `${flagged.length} dokumenttia odottaa päätöstä`}
        </p>
      </div>

      <ModeNotice mode={mode} />
      <DataProblem result={result} />

      {flagged.length === 0 ? (
        <EmptyState
          title="Jono on tyhjä"
          description="Kun sääntömoottori ei pysty ratkaisemaan tapausta turvallisesti, se päätyy tänne perusteltuna."
          action={
            <Link href="/inbox" className="text-sm text-navy-600 underline underline-offset-4">
              Saapuneet
            </Link>
          }
        />
      ) : (
        <ul className="space-y-4">
          {flagged.map((doc) => (
            <li key={doc.id}>
              <ReviewCard doc={doc} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewCard({ doc }: { doc: DocumentView }) {
  const worst = doc.classification.lines.reduce(
    (acc, l) => (l.decision.confidenceScore < acc.confidenceScore ? l.decision : acc),
    doc.classification.lines[0]?.decision,
  );

  return (
    <Panel
      title={doc.supplier}
      action={
        <Link
          href={`/documents/${doc.id}`}
          className="text-sm text-navy-600 underline underline-offset-4"
        >
          Avaa
        </Link>
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted">
            {doc.documentNumber} · {doc.date} · {doc.country} ·{" "}
            {formatMoney(doc.classification.totalVatCents)} ALV
          </p>

          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted">
            Miksi merkitty
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {doc.classification.reviewReasons.map((r) => (
              <li
                key={r}
                className="rounded border border-warn-500/30 bg-warn-100 px-2 py-1 text-xs text-warn-600"
              >
                {reviewReasonLabel(r)}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col items-end gap-2">
          {worst ? <ConfidenceBadge band={worst.confidence} /> : null}
          <span className="text-xs text-muted">
            {doc.classification.treatmentCount} ALV-käsittelyä
          </span>
        </div>
      </div>

      <details className="mt-4 border-t border-line pt-3">
        <summary className="cursor-pointer text-sm font-medium">
          Rivit ja säännöt
        </summary>
        <ul className="mt-2 space-y-2">
          {doc.classification.lines.map((line) => (
            <li key={line.lineNumber} className="text-sm">
              <span className="font-medium">
                {line.description ?? `Rivi ${line.lineNumber}`}
              </span>
              <span className="text-muted">
                {" — "}
                {line.decision.vatCode ?? "ei koodia"} ·{" "}
                <span className="font-mono text-xs">
                  {line.decision.ruleId ?? "ei sääntöä"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </details>
    </Panel>
  );
}

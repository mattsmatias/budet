import type { Metadata } from "next";
import Link from "next/link";
import { getAppMode } from "@/lib/auth";
import { loadDocuments } from "@/lib/data/page-data";
import { formatMoney, formatRate } from "@/lib/money";
import { reviewReasonLabel } from "@/lib/tax/engine";
import { ConfidenceBadge, EmptyState, VatBadge } from "@/components/ui";
import { DataProblem, ModeNotice } from "@/components/mode-notice";

export const metadata: Metadata = { title: "Tapahtumat" };

/**
 * Rivitason näkymä kaikkien dokumenttien yli.
 *
 * Dokumenttinäkymä vastaa kysymykseen "mitä tällä tositteella on".
 * Tämä vastaa kysymykseen "missä kaikkialla tätä käsittelyä on sovellettu",
 * mikä on se näkökulma jota täsmäytys ja ALV-ilmoitus vaativat.
 */
export default async function TransactionsPage({
  searchParams,
}: PageProps<"/transactions">) {
  const params = await searchParams;
  const codeFilter = typeof params.koodi === "string" ? params.koodi : undefined;

  const mode = await getAppMode();
  const result = await loadDocuments(mode);
  const docs = result.ok ? result.data : [];

  const rows = docs.flatMap((doc) =>
    doc.classification.lines.map((line) => ({
      key: `${doc.id}-${line.lineNumber}`,
      documentId: doc.id,
      supplier: doc.supplier,
      date: doc.date,
      description: line.description ?? `Rivi ${line.lineNumber}`,
      decision: line.decision,
    })),
  );

  const filtered = codeFilter
    ? rows.filter((r) => (r.decision.vatCode ?? "Ratkaisematta") === codeFilter)
    : rows;

  const codes = [...new Set(rows.map((r) => r.decision.vatCode ?? "Ratkaisematta"))].sort();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Tapahtumat</h1>
        <p className="mt-1 text-sm text-muted">
          {filtered.length} riviä {docs.length} dokumentilta
          {codeFilter ? ` · suodatin: ${codeFilter}` : ""}
        </p>
      </div>

      <ModeNotice mode={mode} />
      <DataProblem result={result} />

      {codes.length > 1 ? (
        <nav aria-label="ALV-koodisuodattimet" className="flex flex-wrap gap-2">
          <Link href="/transactions" className={filterCls(!codeFilter)}>
            Kaikki
          </Link>
          {codes.map((code) => (
            <Link
              key={code}
              href={`/transactions?koodi=${encodeURIComponent(code)}`}
              aria-current={codeFilter === code ? "page" : undefined}
              className={filterCls(codeFilter === code)}
            >
              {code}
            </Link>
          ))}
        </nav>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          title="Ei tapahtumia"
          description="Rivit syntyvät kun dokumentteja käsitellään."
          action={
            <Link href="/inbox" className="text-sm text-navy-600 underline underline-offset-4">
              Saapuneet
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[56rem] text-sm">
            <caption className="sr-only">Rivitason tapahtumat</caption>
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Päivä</th>
                <th scope="col" className="px-4 py-3 font-medium">Toimittaja</th>
                <th scope="col" className="px-4 py-3 font-medium">Rivi</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Veroton</th>
                <th scope="col" className="px-4 py-3 font-medium">ALV-koodi</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Kanta</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">ALV</th>
                <th scope="col" className="px-4 py-3 font-medium">Sääntö</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((row) => (
                <tr key={row.key} className="hover:bg-surface">
                  <td className="px-4 py-3 tabular">{row.date}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/documents/${row.documentId}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {row.supplier}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {row.description}
                    {row.decision.reviewReasons.length > 0 ? (
                      <div className="mt-0.5 text-xs text-warn-600">
                        {row.decision.reviewReasons.map(reviewReasonLabel).join(", ")}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right tabular">
                    {formatMoney(row.decision.inputFacts.netAmountCents)}
                  </td>
                  <td className="px-4 py-3">
                    <VatBadge
                      code={row.decision.vatCode}
                      rate={row.decision.vatRate}
                      reverseCharge={row.decision.reverseCharge}
                    />
                  </td>
                  <td className="px-4 py-3 text-right tabular">
                    {formatRate(row.decision.vatRate)}
                  </td>
                  <td className="px-4 py-3 text-right tabular font-medium">
                    {formatMoney(row.decision.vatAmountCents)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-muted">
                      {row.decision.ruleId ?? "—"}
                    </div>
                    <ConfidenceBadge band={row.decision.confidence} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function filterCls(active: boolean): string {
  return [
    "rounded-md border px-3 py-1.5 text-sm",
    active
      ? "border-navy-900 bg-navy-900 text-navy-50"
      : "border-line hover:border-navy-300",
  ].join(" ");
}

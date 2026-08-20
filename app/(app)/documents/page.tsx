import type { Metadata } from "next";
import Link from "next/link";
import { getAppMode } from "@/lib/auth";
import { loadDocuments } from "@/lib/data/page-data";
import type { DocumentView } from "@/lib/data/documents";
import { formatMoney } from "@/lib/money";
import { EmptyState, StatusBadge } from "@/components/ui";
import { DataProblem, ModeNotice } from "@/components/mode-notice";

export const metadata: Metadata = { title: "Dokumentit" };

/**
 * Dokumenttiarkisto (§57).
 *
 * Saapuneet on työjono; tämä on arkisto haulla. Haku kattaa toimittajan,
 * tositenumeron, ALV-tunnisteen, maan ja summan.
 */
export default async function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  const params = await searchParams;
  const query = typeof params.haku === "string" ? params.haku.trim() : "";

  const mode = await getAppMode();
  const result = await loadDocuments(mode);
  const all = result.ok ? result.data : [];
  const docs = query ? search(all, query) : all;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Dokumentit</h1>
        <p className="mt-1 text-sm text-muted">
          {query ? `${docs.length} osumaa haulla "${query}"` : `${all.length} dokumenttia`}
        </p>
      </div>

      <ModeNotice mode={mode} />
      <DataProblem result={result} />

      <form action="/documents" className="flex flex-wrap gap-2">
        <label htmlFor="doc-search" className="sr-only">
          Hae dokumenteista
        </label>
        <input
          id="doc-search"
          type="search"
          name="haku"
          defaultValue={query}
          placeholder="Toimittaja, tositenumero, ALV-tunniste, maa tai summa"
          className="min-w-64 flex-1 rounded-md border border-line bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md border border-line px-4 py-2 text-sm font-semibold hover:border-navy-300"
        >
          Hae
        </button>
        {query ? (
          <Link
            href="/documents"
            className="rounded-md px-3 py-2 text-sm text-muted underline underline-offset-4"
          >
            Tyhjennä
          </Link>
        ) : null}
      </form>

      {docs.length === 0 ? (
        <EmptyState
          title={query ? "Ei osumia" : "Ei dokumentteja"}
          description={
            query
              ? "Kokeile toista hakusanaa tai tyhjennä haku."
              : "Lähetä ensimmäinen dokumentti saapuneiden kautta."
          }
          action={
            <Link href="/inbox" className="text-sm text-navy-600 underline underline-offset-4">
              Saapuneet
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[48rem] text-sm">
            <caption className="sr-only">Dokumenttiarkisto</caption>
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Toimittaja</th>
                <th scope="col" className="px-4 py-3 font-medium">Tosite</th>
                <th scope="col" className="px-4 py-3 font-medium">Päivä</th>
                <th scope="col" className="px-4 py-3 font-medium">ALV-tunniste</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">ALV</th>
                <th scope="col" className="px-4 py-3 font-medium">Tila</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {docs.map((doc) => (
                <tr key={doc.id} className="hover:bg-surface">
                  <td className="px-4 py-3">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {doc.supplier}
                    </Link>
                    <div className="text-xs text-muted">{doc.country}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{doc.documentNumber}</td>
                  <td className="px-4 py-3 tabular">{doc.date}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {doc.supplierVatId ?? <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular">
                    {formatMoney(doc.classification.totalVatCents)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={doc.status} />
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

/** Haku ilman tietokantaa: tulokset on jo rajattu organisaatioon RLS:llä. */
function search(docs: DocumentView[], query: string): DocumentView[] {
  const q = query.toLowerCase();
  const asNumber = Number.parseFloat(query.replace(",", "."));

  return docs.filter((doc) => {
    if (doc.supplier.toLowerCase().includes(q)) return true;
    if (doc.documentNumber.toLowerCase().includes(q)) return true;
    if (doc.supplierVatId?.toLowerCase().includes(q)) return true;
    if (doc.country.toLowerCase() === q) return true;
    if (doc.date.includes(query)) return true;

    if (Number.isFinite(asNumber)) {
      const cents = Math.round(asNumber * 100);
      const total = doc.classification.totalNetCents + doc.classification.totalVatCents;
      // Sallitaan sentin heitto pyöristysten varalta.
      if (Math.abs(total - cents) <= 1) return true;
      if (Math.abs(doc.classification.totalVatCents - cents) <= 1) return true;
    }

    return false;
  });
}

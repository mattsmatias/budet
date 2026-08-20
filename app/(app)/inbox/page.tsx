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
import { ConfidenceBadge, EmptyState, StatusBadge, VatBadge } from "@/components/ui";
import { DataProblem, ModeNotice } from "@/components/mode-notice";
import { UploadDropzone } from "./upload";

export const metadata: Metadata = { title: "Saapuneet" };

const FILTERS = [
  { key: "kaikki", label: "Kaikki" },
  { key: "tarkistettava", label: "Tarkistettava" },
  { key: "rajat-ylittava", label: "Rajat ylittävä" },
  { key: "matala-luottamus", label: "Matala luottamus" },
  { key: "hyvaksytty", label: "Hyväksytty" },
  { key: "viety", label: "Viety" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function applyFilter(docs: DocumentView[], filter: FilterKey): DocumentView[] {
  switch (filter) {
    case "tarkistettava":
      return docs.filter((d) => d.status === "needs_review");
    case "rajat-ylittava":
      return docs.filter((d) => d.crossBorder);
    case "matala-luottamus":
      return docs.filter((d) =>
        d.classification.lines.some((l) => l.decision.confidence === "low"),
      );
    case "hyvaksytty":
      return docs.filter((d) => d.status === "approved");
    case "viety":
      return docs.filter((d) => d.status === "exported");
    default:
      return docs;
  }
}

export default async function InboxPage({ searchParams }: PageProps<"/inbox">) {
  const params = await searchParams;
  const raw = typeof params.suodatin === "string" ? params.suodatin : "kaikki";
  const filter = (FILTERS.find((f) => f.key === raw)?.key ?? "kaikki") as FilterKey;

  const mode = await getAppMode();
  // Kirjautunut käyttäjä ei koskaan näe demolukuja: ilman organisaatiota
  // näkymä on tyhjä, ei keksitty.
  const result =
    mode.kind === "live"
      ? await listDocuments(mode.org.id)
      : mode.kind === "demo"
        ? demoDocuments()
        : emptyDocuments();

  const all = result.ok ? result.data : [];
  const docs = applyFilter(all, filter);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Saapuneet</h1>
        <p className="mt-1 text-sm text-muted">
          {docs.length} / {all.length} dokumenttia
        </p>
      </div>

      <ModeNotice mode={mode} />
      <DataProblem result={result} />

      <UploadDropzone enabled={mode.kind === "live"} />

      <nav aria-label="Suodattimet" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Link
              key={f.key}
              href={f.key === "kaikki" ? "/inbox" : `/inbox?suodatin=${f.key}`}
              aria-current={active ? "page" : undefined}
              className={[
                "rounded-md border px-3 py-1.5 text-sm",
                active
                  ? "border-navy-900 bg-navy-900 text-navy-50"
                  : "border-line hover:border-navy-300",
              ].join(" ")}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {docs.length === 0 ? (
        <EmptyState
          title={all.length === 0 ? "Ei vielä dokumentteja" : "Ei osumia tällä suodattimella"}
          description={
            all.length === 0
              ? "Lähetä ensimmäinen kuitti yllä olevalla lomakkeella."
              : "Kokeile toista suodatinta tai poista rajaus."
          }
          action={
            all.length > 0 ? (
              <Link href="/inbox" className="text-sm text-navy-600 underline underline-offset-4">
                Näytä kaikki
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[52rem] text-sm">
            <caption className="sr-only">Saapuneet dokumentit</caption>
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Toimittaja</th>
                <th scope="col" className="px-4 py-3 font-medium">Päivä</th>
                <th scope="col" className="px-4 py-3 font-medium">Maa</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">ALV</th>
                <th scope="col" className="px-4 py-3 font-medium">Käsittely</th>
                <th scope="col" className="px-4 py-3 font-medium">Luottamus</th>
                <th scope="col" className="px-4 py-3 font-medium">Tila</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {docs.map((doc) => {
                const lines = doc.classification.lines;
                const first = lines[0]?.decision;
                const worst = lines.reduce(
                  (acc, l) =>
                    l.decision.confidenceScore < acc.confidenceScore ? l.decision : acc,
                  lines[0]?.decision,
                );
                return (
                  <tr key={doc.id} className="hover:bg-surface">
                    <td className="px-4 py-3">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {doc.supplier}
                      </Link>
                      <div className="text-xs text-muted">{doc.documentNumber}</div>
                    </td>
                    <td className="px-4 py-3 tabular">{doc.date}</td>
                    <td className="px-4 py-3">{doc.country}</td>
                    <td className="px-4 py-3 text-right tabular">
                      {formatMoney(doc.classification.totalVatCents)}
                    </td>
                    <td className="px-4 py-3">
                      {doc.classification.treatmentCount > 1 ? (
                        <span className="text-xs text-muted">
                          {doc.classification.treatmentCount} käsittelyä
                        </span>
                      ) : (
                        <VatBadge
                          code={first?.vatCode}
                          rate={first?.vatRate}
                          reverseCharge={first?.reverseCharge}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {worst ? <ConfidenceBadge band={worst.confidence} /> : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={doc.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

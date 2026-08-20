/**
 * Dokumentin yksityiskohtasivu (§42).
 *
 * Kolme palstaa: esikatselu vasemmalla, poimitut kentät ja rivit keskellä,
 * Verran päätöspaneeli oikealla. Jokainen rivi kertoo minkä säännön nojalla
 * se on käsitelty ja miksi (§43).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DEMO_DOCUMENTS, getDemoDocument } from "@/lib/demo/data";
import { formatMoney, formatRate } from "@/lib/money";
import { ENGINE_VERSION, reviewReasonLabel } from "@/lib/tax/engine";
import {
  ConfidenceBadge,
  DemoBadge,
  Notice,
  Panel,
  RuleBadge,
  StatusBadge,
  VatBadge,
} from "@/components/ui";

export function generateStaticParams() {
  return DEMO_DOCUMENTS.map((d) => ({ id: d.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/documents/[id]">): Promise<Metadata> {
  const { id } = await params;
  const doc = getDemoDocument(id);
  return { title: doc ? doc.supplier : "Dokumentti" };
}

export default async function DocumentPage({ params }: PageProps<"/documents/[id]">) {
  const { id } = await params;
  const doc = getDemoDocument(id);
  if (!doc) notFound();

  const { classification } = doc;
  const netTotal = classification.totalNetCents;
  const vatTotal = classification.totalVatCents;

  return (
    <div className="space-y-5">
      <nav aria-label="Murupolku" className="text-sm text-muted">
        <Link href="/inbox" className="underline underline-offset-4 hover:text-foreground">
          Saapuneet
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{doc.supplier}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{doc.supplier}</h1>
            <StatusBadge status={doc.status} />
            <DemoBadge>Demo-aineisto</DemoBadge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {doc.documentNumber} · {doc.date} · {doc.country}
            {doc.supplierVatId ? ` · ${doc.supplierVatId}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton primary disabled={classification.needsReview}>
            Hyväksy
          </ActionButton>
          <ActionButton disabled>Muokkaa</ActionButton>
          <ActionButton disabled>Hylkää</ActionButton>
          <ActionButton disabled>Aja uudelleen</ActionButton>
        </div>
      </div>

      {classification.needsReview ? (
        <Notice tone="warn" title="Tämä dokumentti odottaa ihmisen tarkistusta">
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {classification.reviewReasons.map((r) => (
              <li key={r}>{reviewReasonLabel(r)}</li>
            ))}
          </ul>
          <p className="mt-2">
            Hyväksyntä on estetty kunnes syyt on käsitelty. Vientiin dokumentti ei
            päädy ennen hyväksyntää.
          </p>
        </Notice>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)_minmax(0,22rem)]">
        {/* Vasen: esikatselu */}
        <div className="space-y-4">
          <Panel title="Esikatselu">
            <div className="flex aspect-[3/4] items-center justify-center rounded border border-dashed border-line bg-surface text-center">
              <div className="px-4">
                <p className="text-sm font-medium">Ei tiedostoa</p>
                <p className="mt-1 text-xs text-muted">
                  Tallennus ja esikatselu kytketään kun tiedostojen lataus on
                  toiminnassa.
                </p>
              </div>
            </div>
          </Panel>

          <Panel title="Tiedot">
            <dl className="space-y-2.5 text-sm">
              <Field label="Tositelaji" value={kindLabel(doc.kind)} />
              <Field label="Valuutta" value={doc.currency} />
              <Field label="Rajat ylittävä" value={doc.crossBorder ? "Kyllä" : "Ei"} />
              <Field
                label="VIES"
                value={
                  doc.viesStatus === "valid"
                    ? "Vahvistettu"
                    : doc.viesStatus === "not_checked"
                      ? "Ei tarkistettu"
                      : "—"
                }
              />
              <Field label="Käsittelijä" value={doc.assignedTo ?? "—"} />
            </dl>
          </Panel>
        </div>

        {/* Keski: rivit */}
        <div className="space-y-4">
          <Panel title={`Rivit (${classification.lines.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <caption className="sr-only">Dokumentin rivit ja ALV-käsittelyt</caption>
                <thead className="text-left text-xs uppercase tracking-wide text-muted">
                  <tr className="border-b border-line">
                    <th scope="col" className="py-2 pr-3 font-medium">Selite</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Veroton</th>
                    <th scope="col" className="py-2 pr-3 font-medium">ALV-koodi</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Kanta</th>
                    <th scope="col" className="py-2 text-right font-medium">ALV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line tabular">
                  {classification.lines.map((line) => (
                    <tr key={line.lineNumber}>
                      <td className="py-2.5 pr-3">{line.description ?? `Rivi ${line.lineNumber}`}</td>
                      <td className="py-2.5 pr-3 text-right">
                        {formatMoney(line.decision.inputFacts.netAmountCents)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <VatBadge
                          code={line.decision.vatCode}
                          rate={line.decision.vatRate}
                          reverseCharge={line.decision.reverseCharge}
                        />
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        {formatRate(line.decision.vatRate)}
                      </td>
                      <td className="py-2.5 text-right font-medium">
                        {formatMoney(line.decision.vatAmountCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-line font-semibold tabular">
                    <td className="py-2.5 pr-3">Yhteensä</td>
                    <td className="py-2.5 pr-3 text-right">{formatMoney(netTotal)}</td>
                    <td className="py-2.5 pr-3 text-xs font-normal text-muted">
                      {classification.treatmentCount} käsittelyä
                    </td>
                    <td />
                    <td className="py-2.5 text-right">{formatMoney(vatTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Panel>

          {/* Sääntöselite jokaiselle riville (§43) */}
          <Panel title="Miksi näin?">
            <ul className="space-y-3">
              {classification.lines.map((line) => (
                <li key={line.lineNumber} className="rounded-md border border-line p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {line.description ?? `Rivi ${line.lineNumber}`}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <RuleBadge
                        ruleId={line.decision.ruleId}
                        version={line.decision.ruleVersion}
                      />
                      <ConfidenceBadge band={line.decision.confidence} />
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {line.decision.reason}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted sm:grid-cols-3">
                    <Meta label="Jurisdiktio" value={line.decision.jurisdiction ?? "—"} />
                    <Meta label="Voimassa" value={line.decision.effectiveFrom ?? "—"} />
                    <Meta label="Sääntöstatus" value={line.decision.ruleStatus ?? "—"} />
                    <Meta
                      label="Lähde"
                      value={line.decision.sourceReference ?? "ei validoitua lähdettä"}
                    />
                    <Meta label="Moottori" value={line.decision.engineVersion} />
                    <Meta label="Vähennyskelpoinen" value={deductibleLabel(line.decision.deductible)} />
                  </dl>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* Oikea: päätöspaneeli */}
        <div className="space-y-4">
          <Panel title="Verran päätös">
            <dl className="space-y-2.5 text-sm">
              <Field
                label="ALV-käsittelyjä"
                value={String(classification.treatmentCount)}
              />
              <Field label="ALV yhteensä" value={formatMoney(vatTotal)} />
              <Field
                label="Tarkistus"
                value={classification.needsReview ? "Vaaditaan" : "Ei vaadita"}
              />
              <Field label="Moottoriversio" value={ENGINE_VERSION} />
            </dl>

            {classification.needsReview ? (
              <div className="mt-4 rounded-md border border-warn-500/30 bg-warn-100 p-3 text-sm text-warn-600">
                <p className="font-medium">Miksi tarkistus</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {classification.reviewReasons.map((r) => (
                    <li key={r}>{reviewReasonLabel(r)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Panel>

          <Panel title="Vienti">
            <p className="text-sm text-muted">
              {classification.needsReview
                ? "Vienti on estetty: dokumentti odottaa tarkistusta."
                : "Dokumentti on valmis vietäväksi."}
            </p>
            <ActionButton disabled className="mt-3 w-full">
              Lisää vientiin
            </ActionButton>
          </Panel>

          <Panel title="Audit trail">
            <ol className="space-y-3 text-sm">
              {[
                ["Dokumentti vastaanotettu", doc.date],
                ["Poiminta valmis", doc.date],
                ["Sääntömoottori ajettu", doc.date],
                classification.needsReview
                  ? ["Merkitty tarkistettavaksi", doc.date]
                  : ["Päätös ratkaistu", doc.date],
              ].map(([label, when]) => (
                <li key={label} className="flex gap-3">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
                  <span>
                    <span className="block">{label}</span>
                    <span className="text-xs text-muted tabular">{when}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  primary,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  primary?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  // Toimintoja ei ole vielä kytketty. Ne näytetään estettyinä eikä
  // painikkeina jotka eivät tee mitään (§74).
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? "Ei vielä toteutettu" : undefined}
      className={[
        "rounded-md px-3.5 py-2 text-sm font-semibold",
        primary
          ? "bg-gold-400 text-navy-900 hover:bg-gold-300"
          : "border border-line hover:border-navy-300",
        disabled ? "cursor-not-allowed opacity-50 hover:border-line" : "",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

function kindLabel(kind: string): string {
  return (
    { receipt: "Kuitti", invoice: "Lasku", daily_report: "Päiväraportti" }[kind] ?? kind
  );
}

function deductibleLabel(value: boolean | undefined): string {
  if (value === true) return "Kyllä";
  if (value === false) return "Ei";
  return "Ratkaisematta";
}

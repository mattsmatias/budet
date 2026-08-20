/**
 * Segmenttisivu (§4).
 *
 * Yksi sivupohja, neljä sisältöä. Päiväraportin jakodemo renderöidään
 * oikealla sääntömoottorilla — markkinointisivu ei voi näyttää eri lukuja
 * kuin tuote tuottaa (§50).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SEGMENTS, segmentBySlug, type Segment, type TimelineMoment } from "@/lib/segments";
import { getDemoDocument } from "@/lib/demo/data";
import { formatMoney, formatRate } from "@/lib/money";
import { Mark, SectionHeading, StatusPill } from "@/components/marketing";

export function generateStaticParams() {
  return SEGMENTS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/kenelle/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const segment = segmentBySlug(slug);
  if (!segment) return { title: "Kenelle" };

  return {
    title: `${segment.audience} — ${segment.title} ${segment.titleAccent}`,
    description: segment.lead,
  };
}

export default async function SegmentPage({ params }: PageProps<"/kenelle/[slug]">) {
  const { slug } = await params;
  const segment = segmentBySlug(slug);
  if (!segment) notFound();

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero segment={segment} />
        {slug === "ravintoloille" ? <DailyReportDemo /> : null}
        <Timeline segment={segment} />
        <Pillars segment={segment} />
        <Scenario segment={segment} />
        <SegmentFaqSection segment={segment} />
        <OtherDoors current={slug} />
        <FinalCta segment={segment} />
      </main>
      <SiteFooter />
    </>
  );
}

// ---------------------------------------------------------------------------

function SiteHeader() {
  return (
    <header className="border-b border-navy-800 bg-navy-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-3.5">
        <Link href="/" className="flex items-center gap-2 text-navy-50">
          <Mark />
          <span className="text-lg font-semibold tracking-tight">Verra</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-navy-200 hover:text-navy-50">
            Kirjaudu
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-gold-400 px-3.5 py-2 text-sm font-semibold text-navy-900 hover:bg-gold-300"
          >
            Aloita ilmaiseksi
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero({ segment }: { segment: Segment }) {
  return (
    <section className="border-b border-navy-800 bg-navy-900 text-navy-50">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <p className="mb-5 inline-flex rounded-full border border-gold-400/40 px-3 py-1 text-xs font-medium text-gold-300">
          {segment.audience}
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
          {segment.title}
          <br />
          <span className="text-gold-400">{segment.titleAccent}</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-navy-200">
          {segment.lead}
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="rounded-md bg-gold-400 px-5 py-3 text-sm font-semibold text-navy-900 hover:bg-gold-300"
          >
            Aloita ilmaiseksi
          </Link>
          <a
            href="#viikko"
            className="rounded-md border border-navy-600 px-5 py-3 text-sm font-semibold text-navy-100 hover:border-navy-400"
          >
            Katso miten se toimii
          </a>
        </div>
        <p className="mt-6 text-sm text-navy-300">{segment.ctaNote}</p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Päiväraportin jako — moottorin oikea tulos
// ---------------------------------------------------------------------------

function DailyReportDemo() {
  const doc = getDemoDocument("doc-linnea-0614");
  if (!doc) return null;

  const { classification } = doc;
  const gross = classification.totalNetCents + classification.totalVatCents;

  return (
    <section className="border-b border-line bg-surface">
      <div className="mx-auto max-w-3xl px-5 py-16">
        <div className="overflow-hidden rounded-xl border border-line bg-background">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <p className="text-sm font-semibold">Illan päiväraportti · {doc.supplier}</p>
              <p className="text-xs text-muted">{doc.date} · 22.47</p>
            </div>
            <p className="text-2xl font-semibold tabular">{formatMoney(gross)}</p>
          </div>

          <ul className="divide-y divide-line">
            {classification.lines.map((line) => (
              <li
                key={line.lineNumber}
                className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{line.description}</p>
                  <p className="text-xs text-muted tabular">
                    {formatMoney(line.decision.inputFacts.netAmountCents)} netto ·{" "}
                    <span className="font-mono">{line.decision.ruleId}</span>
                  </p>
                </div>
                <div className="flex items-baseline gap-3 tabular">
                  <span className="rounded bg-navy-900 px-2 py-0.5 text-xs font-medium text-navy-100">
                    {formatRate(line.decision.vatRate)}
                  </span>
                  <span className="text-sm font-medium">
                    {formatMoney(line.decision.vatAmountCents)}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-5 py-3.5">
            <p className="text-sm text-muted">
              {classification.treatmentCount} ALV-käsittelyä jaettu · 0 käsityötä
            </p>
            <p className="text-sm font-semibold tabular">
              ALV {formatMoney(classification.totalVatCents)}
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted">
          Luvut tuottaa sama sääntömoottori jota sovellus ajaa. Säännöt ovat
          demo-tasoisia, joten tämä tosite menisi tarkistukseen — Verra ei
          hyväksy validoimattomalla säännöllä tehtyä päätöstä automaattisesti.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Timeline({ segment }: { segment: Segment }) {
  return (
    <section id="viikko" className="border-b border-line">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <SectionHeading
          eyebrow="Tyypillinen jakso"
          title="Tunnet tämän. Katso sama toisin päin."
          lead={segment.timelineIntro}
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <TimelineColumn
            label={segment.beforeLabel}
            moments={segment.before}
            tone="before"
          />
          <TimelineColumn
            label={segment.afterLabel}
            moments={segment.after}
            tone="after"
          />
        </div>

        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted">
          {segment.timelineOutro}
        </p>
      </div>
    </section>
  );
}

function TimelineColumn({
  label,
  moments,
  tone,
}: {
  label: string;
  moments: TimelineMoment[];
  tone: "before" | "after";
}) {
  const accent = tone === "after" ? "bg-gold-400" : "bg-navy-300";

  return (
    <div
      className={[
        "rounded-lg border p-6",
        tone === "after" ? "border-gold-400/40 bg-surface" : "border-line",
      ].join(" ")}
    >
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
        {label}
      </h3>
      <ol className="mt-4 space-y-3">
        {moments.map((moment, index) => (
          <li key={`${moment.time}-${index}`} className="flex gap-3">
            <span
              aria-hidden="true"
              className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${accent}`}
            />
            <div className="min-w-0">
              <span className="block text-xs font-medium tabular text-muted">
                {moment.time}
              </span>
              <span className="block text-sm">{moment.text}</span>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
        {moments.length} vaihetta
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Pillars({ segment }: { segment: Segment }) {
  return (
    <section className="border-b border-line bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <SectionHeading
          eyebrow="Mitä Verra tekee"
          title={segment.pillarsTitle}
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {segment.pillars.map((pillar) => (
            <div key={pillar.title} className="rounded-lg border border-line bg-background p-6">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold">{pillar.title}</h3>
                <StatusPill status={pillar.status} />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{pillar.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Scenario({ segment }: { segment: Segment }) {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-3xl px-5 py-20">
        <blockquote className="border-l-2 border-gold-400 pl-6">
          <p className="text-xl leading-relaxed">&rdquo;{segment.scenarioQuote}&rdquo;</p>
          <footer className="mt-4 text-sm text-muted">{segment.scenarioWho}</footer>
        </blockquote>
      </div>
    </section>
  );
}

function SegmentFaqSection({ segment }: { segment: Segment }) {
  return (
    <section className="border-b border-line bg-surface">
      <div className="mx-auto max-w-3xl px-5 py-20">
        <SectionHeading eyebrow="UKK" title="Mitä kysytään ensimmäisenä." />
        <div className="mt-10 divide-y divide-line border-t border-line">
          {segment.faq.map((item) => (
            <details key={item.question} className="group py-4">
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-medium">
                <span className="flex flex-wrap items-center gap-2">
                  {item.question}
                  {item.status ? <StatusPill status={item.status} /> : null}
                </span>
                <span
                  aria-hidden="true"
                  className="shrink-0 text-muted transition group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{item.answer}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-sm text-muted">
          Pidempi vastaus?{" "}
          <a
            href="mailto:oktay@verra.app"
            className="text-navy-700 underline underline-offset-4"
          >
            oktay@verra.app
          </a>
        </p>
      </div>
    </section>
  );
}

function OtherDoors({ current }: { current: string }) {
  const others = SEGMENTS.filter((s) => s.slug !== current);

  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Muut sisääntulot
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-3">
          {others.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/kenelle/${s.slug}`}
                className="block rounded-lg border border-line p-4 hover:border-navy-300"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-gold-600">
                  {s.audience}
                </p>
                <p className="mt-1.5 text-sm font-medium">
                  {s.title} {s.titleAccent}
                </p>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-xs text-muted">
          Sama tuote ja sama sääntömoottori kaikille. Vain sisääntulo eroaa.
        </p>
      </div>
    </section>
  );
}

function FinalCta({ segment }: { segment: Segment }) {
  return (
    <section className="bg-navy-900 text-navy-50">
      <div className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Kokeile yhdellä tositteella
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-navy-200">{segment.ctaNote}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/signup"
            className="rounded-md bg-gold-400 px-5 py-3 text-sm font-semibold text-navy-900 hover:bg-gold-300"
          >
            Aloita ilmaiseksi
          </Link>
          <a
            href="mailto:oktay@verra.app"
            className="rounded-md border border-navy-600 px-5 py-3 text-sm font-semibold text-navy-100 hover:border-navy-400"
          >
            Keskustele tiimin kanssa
          </a>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-navy-800 bg-navy-950 text-navy-300">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-navy-50">
            <Mark size={20} />
            <span className="font-semibold">Verra</span>
          </Link>
          <nav aria-label="Alatunniste" className="flex flex-wrap gap-5 text-sm">
            <Link href="/" className="hover:text-navy-50">Etusivu</Link>
            <Link href="/dashboard" className="hover:text-navy-50">Demo</Link>
            <Link href="/login" className="hover:text-navy-50">Kirjaudu</Link>
          </nav>
        </div>
        <p className="mt-8 border-t border-navy-800 pt-6 text-xs">
          Sivun tarinat ja lainaukset ovat havainnollistavia käyttötilanteita,
          eivät asiakkaiden lausuntoja. Esitetyt verokannat ja sääntötunnukset
          ovat demo-sääntöjä eivätkä oikeudellinen kannanotto.
        </p>
      </div>
    </footer>
  );
}

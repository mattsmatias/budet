/**
 * Verran laskeutumissivu (§31–§33).
 *
 * Rivikohtaisen ALV:n demo renderöidään OIKEALLA sääntömoottorilla, ei
 * käsin kirjoitetuilla luvuilla. Jos sääntö muuttuu, tämä sivu muuttuu
 * mukana — eikä markkinointisivu voi ajautua eri linjalle kuin tuote (§50).
 */

import Link from "next/link";
import { getDemoDocument } from "@/lib/demo/data";
import { formatMoney, formatRate } from "@/lib/money";
import { reviewReasonLabel } from "@/lib/tax/engine";

export default function LandingPage() {
  const linnea = getDemoDocument("doc-linnea-0614")!;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <TrustStrip />
        <HowItWorks />
        <LineLevelVatDemo doc={linnea} />
        <ViesDemo />
        <Segments />
        <Auditability />
        <TimoSection />
        <WhyVerra />
        <Pricing />
        <FounderStory />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}

// ---------------------------------------------------------------------------

function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-navy-800 bg-navy-900/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-3.5">
        <Link href="/" className="flex items-center gap-2 text-navy-50">
          <Mark />
          <span className="text-lg font-semibold tracking-tight">Verra</span>
        </Link>
        <nav aria-label="Päänavigaatio" className="hidden gap-6 text-sm text-navy-200 md:flex">
          <a href="#miten" className="hover:text-navy-50">Miten se toimii</a>
          <a href="#alv" className="hover:text-navy-50">Rivikohtainen ALV</a>
          <a href="#kenelle" className="hover:text-navy-50">Kenelle</a>
          <a href="#hinnoittelu" className="hover:text-navy-50">Hinnoittelu</a>
          <a href="#ukk" className="hover:text-navy-50">UKK</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-navy-200 hover:text-navy-50">
            Kirjaudu
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md bg-gold-400 px-3.5 py-2 text-sm font-semibold text-navy-900 hover:bg-gold-300"
          >
            Aloita ilmainen kokeilu
          </Link>
        </div>
      </div>
    </header>
  );
}

function Mark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <rect width="24" height="24" rx="5" fill="#E9AE3B" />
      <path
        d="M6 7.5l4.6 9.5L18 6"
        stroke="#051226"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Hero() {
  return (
    <section className="border-b border-navy-800 bg-navy-900 text-navy-50">
      <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
        <p className="mb-5 inline-flex rounded-full border border-gold-400/40 px-3 py-1 text-xs font-medium text-gold-300">
          Verotuksen compliance-moottori · EU
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
          Veropäätöksiä, jotka kone tekee.
          <br />
          <span className="text-gold-400">Ja tilintarkastaja voi toistaa.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-navy-200">
          AI-pohjainen verotuksen compliance-moottori Euroopassa kauppaa käyville
          yrityksille. Lähetä kuittisi — Verra luokittelee rivikohtaisen ALV:n,
          tarkistaa EU VIESin ja tallentaa jokaisen päätöksen perustelun.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-md bg-gold-400 px-5 py-3 text-sm font-semibold text-navy-900 hover:bg-gold-300"
          >
            Aloita ilmainen kokeilu
          </Link>
          <a
            href="#yhteys"
            className="rounded-md border border-navy-600 px-5 py-3 text-sm font-semibold text-navy-100 hover:border-navy-400"
          >
            Keskustele tiimin kanssa
          </a>
        </div>
        <ul className="mt-10 flex flex-wrap gap-x-7 gap-y-2 text-sm text-navy-300">
          {["14 päivän kokeilu", "Ei luottokorttia", "EU-hosting", "Audit trail", "GDPR-first"].map(
            (item) => (
              <li key={item} className="flex items-center gap-2">
                <span aria-hidden="true" className="text-gold-400">
                  ✓
                </span>
                {item}
              </li>
            ),
          )}
        </ul>
      </div>
    </section>
  );
}

function TrustStrip() {
  return (
    <section className="border-b border-line bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-6">
        <p className="text-sm text-muted">
          Verra on rakenteilla. Emme esitä asiakasmääriä, liikevaihtoa tai
          sertifiointeja ennen kuin ne ovat todennettavissa.{" "}
          <a href="#yhteys" className="font-medium text-navy-700 underline underline-offset-4">
            Haluatko mukaan varhaisiin käyttäjiin?
          </a>
        </p>
      </div>
    </section>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Lähetä dokumentti",
    body: "Vedä kuitti, lasku tai päiväraportti selaimeen, kuvaa se puhelimella tai lähetä sähköpostilla työtilan omaan osoitteeseen.",
  },
  {
    n: "02",
    title: "Verra lukee ja normalisoi",
    body: "Toimittaja, maa, ALV-tunniste, päivä, valuutta ja rivit poimitaan. Jokainen kenttä säilyttää oman luottamuksensa ja lähteensä.",
  },
  {
    n: "03",
    title: "Sääntömoottori päättää",
    body: "Deterministinen, versioitu sääntöjoukko ratkaisee rivikohtaisen ALV-kohtelun. Ei kielimallia päätöksessä — sama syöte tuottaa aina saman tuloksen.",
  },
  {
    n: "04",
    title: "Ihminen hyväksyy",
    body: "Epävarma tapaus menee tarkistusjonoon perusteltuna. Hyväksytty päätös lukitaan ja siirtyy kirjanpidon vientiin.",
  },
];

function HowItWorks() {
  return (
    <section id="miten" className="border-b border-line">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <SectionHeading
          eyebrow="Miten se toimii"
          title="Neljä vaihetta kuitista kirjanpitoon"
          lead="Monimutkaisuus asuu Verran sisällä, ei sinun työprosessissasi."
        />
        <ol className="mt-12 grid gap-6 md:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.n} className="rounded-lg border border-line bg-surface p-5">
              <span className="font-mono text-xs font-semibold text-gold-600">{step.n}</span>
              <h3 className="mt-2 text-base font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Rivikohtaisen ALV:n demo — luvut tulevat sääntömoottorilta
// ---------------------------------------------------------------------------

function LineLevelVatDemo({ doc }: { doc: ReturnType<typeof getDemoDocument> }) {
  if (!doc) return null;
  const { classification } = doc;

  return (
    <section id="alv" className="border-b border-line bg-navy-900 text-navy-50">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <SectionHeading
          dark
          eyebrow="Rivikohtainen ALV"
          title="Yksi dokumentti. Monta ALV-käsittelyä. Ei käsin jakamista."
          lead="Ravintolan päiväraportilla on eri verokanta ruoalle ja alkoholille, ja palvelumaksu vaatii oman arvionsa. Verra ei niputa niitä yhteen kantaan."
        />

        <div className="mt-12 overflow-hidden rounded-xl border border-navy-700 bg-navy-800">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-700 px-5 py-4">
            <div>
              <p className="text-sm font-semibold">{doc.supplier}</p>
              <p className="text-xs text-navy-300">
                {doc.documentNumber} · {doc.date} · {doc.country}
              </p>
            </div>
            <span className="rounded-md border border-gold-400/50 bg-gold-400/10 px-2 py-1 text-xs font-medium text-gold-300">
              Demo-aineisto
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <caption className="sr-only">
                Päiväraportin rivit ja niiden ALV-käsittelyt
              </caption>
              <thead>
                <tr className="border-b border-navy-700 text-left text-xs uppercase tracking-wide text-navy-300">
                  <th scope="col" className="px-5 py-3 font-medium">Rivi</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Veroton</th>
                  <th scope="col" className="px-5 py-3 font-medium">ALV-koodi</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Kanta</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">ALV</th>
                  <th scope="col" className="px-5 py-3 font-medium">Sääntö</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {classification.lines.map((line) => (
                  <tr key={line.lineNumber} className="border-b border-navy-700/60 last:border-0">
                    <td className="px-5 py-3.5">{line.description}</td>
                    <td className="px-5 py-3.5 text-right">
                      {formatMoney(
                        doc.classification.lines.find(
                          (l) => l.lineNumber === line.lineNumber,
                        )?.decision.inputFacts.netAmountCents,
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs text-gold-300">
                        {line.decision.vatCode ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {formatRate(line.decision.vatRate)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium">
                      {formatMoney(line.decision.vatAmountCents)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs text-navy-300">
                        {line.decision.ruleId} v{line.decision.ruleVersion}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-px border-t border-navy-700 bg-navy-700 sm:grid-cols-3">
            <Stat label="ALV-käsittelyä" value={String(classification.treatmentCount)} />
            <Stat label="Manuaalista jakoa" value="0" />
            <Stat label="ALV yhteensä" value={formatMoney(classification.totalVatCents)} />
          </div>
        </div>

        {classification.needsReview ? (
          <div className="mt-6 rounded-lg border border-gold-400/40 bg-gold-400/5 p-5">
            <p className="text-sm font-semibold text-gold-300">
              Verra ei hyväksy tätä automaattisesti
            </p>
            <p className="mt-2 text-sm leading-relaxed text-navy-200">
              Näin sen kuuluukin toimia. Nämä säännöt ovat demo-tasoisia eikä
              niitä ole validoitu virallista lähdettä vasten, ja palvelumaksun
              poiminta jäi epävarmaksi. Verra merkitsee tapauksen tarkistettavaksi
              sen sijaan että esittäisi varmuutta jota sillä ei ole.
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {classification.reviewReasons.map((r) => (
                <li
                  key={r}
                  className="rounded border border-navy-600 px-2 py-1 text-xs text-navy-200"
                >
                  {reviewReasonLabel(r)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-navy-800 px-5 py-4">
      <div className="text-xs uppercase tracking-wide text-navy-300">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular text-gold-400">{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ViesDemo() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-2 md:items-center">
        <div>
          <SectionHeading
            eyebrow="EU VIES"
            title="Tunnisteen vahvistus on todiste, ei oletus"
            lead="Verra tarkistaa ALV-tunnisteen, tallentaa vastauksen ja kuittausnumeron ja liittää ne tapahtumaan. Vahvistettu tunniste ei silti yksin ratkaise verokohtelua — sen tekee sääntömoottori koko tapahtuman perusteella."
          />
        </div>
        <div className="rounded-xl border border-line bg-surface p-6">
          <dl className="space-y-3 text-sm">
            <Row label="ALV-tunniste" value="DE 811205325" mono />
            <Row label="Tila" value="Voimassa" tone="ok" />
            <Row label="Vahvistettu" value="14.5.2026 10.42 UTC" />
            <Row label="Yritys" value="Bauhaus AG" />
            <Row label="Maa" value="Saksa" />
          </dl>
          <div className="mt-5 rounded-md border border-navy-200 bg-background p-3.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Sääntömoottorin päätös
            </p>
            <p className="mt-1.5 text-sm">
              Mahdollinen käännetty verovelvollisuus —{" "}
              <span className="font-mono text-xs">vat-fi-rc-eu-b2b</span>. Edellyttää
              että myös suoritetyyppi ja ostajan asema täsmäävät.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "ok";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3 last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd
        className={[
          "text-right font-medium",
          mono ? "font-mono text-xs" : "",
          tone === "ok" ? "text-ok-600" : "",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------

const SEGMENTS = [
  {
    title: "Ravintolat",
    body: "Päiväraportit ja kuitit, joilla on useita verokantoja samalla tositteella. Ruoka, alkoholi ja palvelumaksut erotellaan rivitasolla.",
  },
  {
    title: "Tilitoimistot",
    body: "Useita asiakkaita yhdestä työtilasta. Näet kenen aineisto puuttuu, mikä odottaa tarkistusta ja mikä on valmis toimitettavaksi.",
  },
  {
    title: "Kevytyrittäjät",
    body: "Automaattinen kuittien käsittely, ALV-tuki ja kirjanpitoviennit ilman että joudut opettelemaan verolainsäädäntöä.",
  },
  {
    title: "Kansainväliset perustajat",
    body: "Ymmärrä Suomen ja EU:n verokohtelu omalla kielelläsi. Päätös pysyy samana riippumatta kielestä.",
  },
];

function Segments() {
  return (
    <section id="kenelle" className="border-b border-line bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <SectionHeading
          eyebrow="Kenelle"
          title="Neljä sisääntuloa, yksi compliance-moottori"
          lead="Erilaiset lähtökohdat, sama jäljitettävä päätöksenteko."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {SEGMENTS.map((s) => (
            <div key={s.title} className="rounded-lg border border-line bg-background p-5">
              <h3 className="text-base font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Auditability() {
  const items = [
    ["Jäljitettävä", "Jokaisella verotuspäätöksellä on syy, sääntötunnus ja versio."],
    ["Deterministinen", "Sama normalisoitu syöte ja sama sääntöversio tuottavat saman päätöksen."],
    ["Versioitu", "Säännöt muuttuvat. Vanha versio säilyy voimassaolopäivineen."],
    ["Ihmisen hallinnassa", "Voit hyväksyä, muokata, hylätä ja ohittaa — jokainen valinta kirjataan."],
    ["Vietävissä", "Saat datasi ulos. Verra ei ole umpikuja."],
  ];

  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <SectionHeading
          eyebrow="Auditoitavuus"
          title="Viisi periaatetta joista ei jousteta"
          lead="Verotuspäätöksen jäljitettävyydestä ei tingitä visuaalisen kiillon vuoksi."
        />
        <dl className="mt-12 grid gap-x-10 gap-y-8 md:grid-cols-2">
          {items.map(([term, desc]) => (
            <div key={term} className="border-l-2 border-gold-400 pl-5">
              <dt className="text-base font-semibold">{term}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-muted">{desc}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function TimoSection() {
  return (
    <section className="border-b border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-2 md:items-center">
        <div>
          <SectionHeading
            eyebrow="Timo"
            title="Keskusteleva käyttöliittymä, ei veroauktoriteetti"
            lead="Timo hakee rakenteiset faktat ja sääntöpäätökset ja selittää ne. Se ei keksi lakiviitteitä. Kun asiaa ei voi ratkaista turvallisesti, Timo sanoo sen suoraan."
          />
          <p className="mt-5 text-sm text-muted">
            Suomi, englanti, ruotsi, tanska, turkki, saksa ja espanja. Kieli vaihtaa
            vastauksen, ei päätöstä.
          </p>
        </div>
        <div className="space-y-3 rounded-xl border border-line bg-background p-6">
          <div className="ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-navy-900 px-4 py-2.5 text-sm text-navy-50">
            Onko tämä SaaS-lasku Saksaan käännetty verovelvollisuus?
          </div>
          <div className="max-w-[92%] rounded-lg rounded-bl-sm border border-line bg-surface px-4 py-3 text-sm">
            <p>
              Tämän tositteen osalta en voi vahvistaa sitä automaattisesti. Ostajan
              ALV-tunnistetta ei ole vahvistettu VIESissä, joten käännetyn
              verovelvollisuuden ehto jää täyttymättä.
            </p>
            <ul className="mt-3 space-y-1 text-xs text-muted">
              <li>
                Sääntö: <span className="font-mono">vat-fi-rc-eu-b2b</span> v2026.1
              </li>
              <li>Jurisdiktio: FI · Luottamus: matala</li>
              <li>Tarkistus vaaditaan: ALV-tunnistetta ei ole vahvistettu</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhyVerra() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <SectionHeading
          eyebrow="Miksi Verra"
          title="Poiminta on alku, ei loppu"
          lead="Yleiskäyttöiset OCR-työkalut pysähtyvät usein loppusummaan. Verra on rakennettu jurisdiktiokohtaisten sääntöjen, rivikohtaisen kohtelun ja auditoitavuuden ympärille."
        />
        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="py-3 pr-4 font-medium text-muted">Ominaisuus</th>
                <th scope="col" className="py-3 pr-4 font-medium text-muted">Yleinen OCR-työkalu</th>
                <th scope="col" className="py-3 font-medium">Verra</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Poiminta", "Loppusumma ja toimittaja", "Rivit, kentät, luottamus ja lähde"],
                ["ALV", "Yksi kanta per tosite", "Rivikohtainen kohtelu"],
                ["Päätöksenteko", "Malli tai sääntöjä koodissa", "Versioitu sääntömoottori"],
                ["Perustelu", "Harvoin saatavilla", "Sääntötunnus, versio ja käytetyt faktat"],
                ["Epävarmuus", "Arvaus tai hiljainen oletus", "Merkitään tarkistettavaksi"],
                ["Toistettavuus", "Ei taattua", "Uudelleenajo historiallisella versiolla"],
              ].map(([feature, them, us]) => (
                <tr key={feature} className="border-b border-line last:border-0">
                  <td className="py-3 pr-4 font-medium">{feature}</td>
                  <td className="py-3 pr-4 text-muted">{them}</td>
                  <td className="py-3">{us}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "0 €",
    period: "/kk",
    features: ["15 dokumenttia/kk", "Perus-OCR", "Perus-ALV-luokittelu", "1 työtila", "CSV-vienti"],
  },
  {
    id: "solo",
    name: "Solo",
    price: "19 €",
    period: "/kk",
    features: ["150 dokumenttia/kk", "Täysi ALV-moottori", "Timo", "VIES", "Kirjanpitoviennit", "Sähköpostivastaanotto", "Matkat"],
  },
  {
    id: "business",
    name: "Business",
    price: "49 €",
    period: "/kk",
    highlight: true,
    features: ["750 dokumenttia/kk", "Useita käyttäjiä", "Kehittynyt tarkistus", "Päiväraportit", "Rajat ylittävät säännöt", "Kirjanpitointegraatiot"],
  },
  {
    id: "growth",
    name: "Pro / Growth",
    price: "99 €",
    period: "/kk",
    features: ["2 500 dokumenttia/kk", "Useita yhtiöitä", "Kehittynyt audit", "API", "Automaatiot"],
  },
];

function Pricing() {
  return (
    <section id="hinnoittelu" className="border-b border-line bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <SectionHeading
          eyebrow="Hinnoittelu"
          title="Selkeät rajat, ei yllätyslaskuja"
          lead="Rajat ja hinnat tulevat tietokannasta. Näet aina käytön ja jäljellä olevan määrän ennen kuin raja tulee vastaan."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={[
                "flex flex-col rounded-lg border bg-background p-5",
                plan.highlight ? "border-gold-400 ring-1 ring-gold-400/30" : "border-line",
              ].join(" ")}
            >
              <h3 className="text-base font-semibold">{plan.name}</h3>
              <p className="mt-3">
                <span className="text-3xl font-semibold tabular">{plan.price}</span>
                <span className="text-sm text-muted">{plan.period}</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-muted">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span aria-hidden="true" className="text-gold-500">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard"
                className={[
                  "mt-6 rounded-md px-4 py-2.5 text-center text-sm font-semibold",
                  plan.highlight
                    ? "bg-gold-400 text-navy-900 hover:bg-gold-300"
                    : "border border-line hover:border-navy-300",
                ].join(" ")}
              >
                Aloita kokeilu
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-lg border border-line bg-background p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold">Tilitoimisto</h3>
              <p className="mt-1 text-sm text-muted">
                Monen asiakkaan työtila, asiakashallinta ja henkilökunnan tunnukset.
              </p>
            </div>
            <p className="text-sm">
              <span className="text-2xl font-semibold tabular">49 €</span>
              <span className="text-muted">/kk + 5–15 € / aktiivinen asiakas</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FounderStory() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-3xl px-5 py-20">
        <SectionHeading eyebrow="Perustaja" title="Miksi Verra on olemassa" />
        <div className="mt-8 space-y-4 text-base leading-relaxed text-muted">
          <p>
            Pienyritykset menettävät aikaa dokumenttien, kuittien ja kirjanpidon
            hallintoon. Työ on toistuvaa, mutta virheet ovat kalliita — ja
            kysymykseen &rdquo;miksi tämä kirjattiin näin&rdquo; pitäisi pystyä
            vastaamaan vielä vuosien päästä.
          </p>
          <p>
            Verra rakennetaan siitä lähtökohdasta. Kone tekee työn, mutta jokainen
            päätös on perusteltavissa ja toistettavissa. Kun järjestelmä ei tiedä,
            se sanoo niin.
          </p>
        </div>
        <div className="mt-8 flex items-center gap-4 border-t border-line pt-6">
          <div
            aria-hidden="true"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-900 text-sm font-semibold text-gold-400"
          >
            OH
          </div>
          <div>
            <p className="text-sm font-semibold">Oktay Hun</p>
            <p className="text-sm text-muted">Perustaja &amp; toimitusjohtaja · Helsinki</p>
          </div>
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  ["Missä dataani säilytetään?", "Sovellus on suunniteltu EU-alueen infrastruktuurille. Emme esitä tarkkaa sijaintilupausta ennen kuin infrastruktuuri on lukittu ja todennettavissa — asetus näkyy tuotteen tietosuoja-asetuksissa."],
  ["Tarvitsenko luottokortin?", "Et. Kokeilu kestää 14 päivää ilman korttia."],
  ["Mitä kirjanpitojärjestelmiä tuetaan?", "CSV ja Excel-yhteensopiva CSV ovat käytettävissä. Procountor-, Netvisor- ja e-conomic-integraatioille on rakennettu palvelurajapinta; varsinainen yhteys avataan kun sopimukset ovat kunnossa."],
  ["Tukeeko se HEIC-kuvia?", "Kyllä, samoin PDF, JPG ja PNG. Enimmäistiedostokoko on asetettavissa."],
  ["Miten ALV-luokittelu toimii?", "Poiminta tuottaa rivit ja kentät. Deterministinen sääntömoottori ratkaisee kohtelun sääntöversion perusteella. Kielimallia ei käytetä itse päätöksessä."],
  ["Miten VIES toimii?", "Verra tarkistaa tunnisteen muodon, pyytää vahvistuksen, tallentaa vastauksen ja kuittausnumeron ja liittää ne tapahtumaan. Vahvistus on ehto, ei automaattinen lopputulos."],
  ["Pääseekö kirjanpitäjäni työtilaani?", "Pääsee, jos kutsut hänet. Pääsy kulkee nimenomaisen tilitoimistosuhteen kautta ja on peruttavissa."],
  ["Saanko datani ulos?", "Saat. Vienti on tuotteen ydinominaisuus, ei lisäosa."],
  ["Mitä tapahtuu kun verosäännöt muuttuvat?", "Uusi sääntöversio saa oman voimassaoloaikansa. Vanhat päätökset säilyvät ennallaan, ja voit ajaa päätöksen uudelleen nähdäksesi eron."],
  ["Mitä tapahtuu kun Verra on epävarma?", "Tapaus menee tarkistusjonoon perusteltuna. Verra ei arvaa eikä esitä varmuutta jota sillä ei ole."],
  ["Miten tekoäly käyttää dataani?", "Poiminnassa käytetään dokumentin sisältöä. Emme käytä asiakasaineistoa mallien kouluttamiseen. Tarkat alihankkijat luetellaan alihankkijasivulla."],
];

function Faq() {
  return (
    <section id="ukk" className="border-b border-line bg-surface">
      <div className="mx-auto max-w-3xl px-5 py-20">
        <SectionHeading eyebrow="UKK" title="Usein kysytyt kysymykset" />
        <div className="mt-10 divide-y divide-line border-t border-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-medium">
                {q}
                <span aria-hidden="true" className="text-muted transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section id="yhteys" className="bg-navy-900 text-navy-50">
      <div className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Kokeile yhdellä kuitilla
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-navy-200">
          Näet alle minuutissa mitä rivikohtainen ALV, sääntötunnus ja perustelu
          tarkoittavat käytännössä.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-md bg-gold-400 px-5 py-3 text-sm font-semibold text-navy-900 hover:bg-gold-300"
          >
            Aloita ilmainen kokeilu
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
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-xs">
            <div className="flex items-center gap-2 text-navy-50">
              <Mark />
              <span className="font-semibold">Verra</span>
            </div>
            <p className="mt-3 text-sm">
              Veropäätöksiä, jotka kone tekee ja tilintarkastaja voi toistaa.
            </p>
          </div>
          <nav aria-label="Alatunniste" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm sm:grid-cols-3">
            {[
              ["Tuote", ["Miten se toimii", "#miten"], ["Rivikohtainen ALV", "#alv"], ["Hinnoittelu", "#hinnoittelu"]],
              ["Yritys", ["UKK", "#ukk"], ["Yhteys", "#yhteys"]],
              ["Juridiikka", ["Tietosuoja", "/legal/privacy"], ["Ehdot", "/legal/terms"], ["Tietoturva", "/legal/security"]],
            ].map(([heading, ...links]) => (
              <div key={heading as string}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-400">
                  {heading as string}
                </p>
                <ul className="space-y-1.5">
                  {(links as [string, string][]).map(([label, href]) => (
                    <li key={label}>
                      <a href={href} className="hover:text-navy-50">
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <p className="mt-10 border-t border-navy-800 pt-6 text-xs">
          © {new Date().getFullYear()} Verra. Sivustolla esitetyt verokannat ja
          sääntötunnukset ovat havainnollistavia demo-sääntöjä eivätkä
          oikeudellinen kannanotto.
        </p>
      </div>
    </footer>
  );
}

function SectionHeading({
  eyebrow,
  title,
  lead,
  dark,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  dark?: boolean;
}) {
  return (
    <div className="max-w-2xl">
      <p
        className={[
          "text-xs font-semibold uppercase tracking-wider",
          dark ? "text-gold-400" : "text-gold-600",
        ].join(" ")}
      >
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
      {lead ? (
        <p className={["mt-4 text-base leading-relaxed", dark ? "text-navy-200" : "text-muted"].join(" ")}>
          {lead}
        </p>
      ) : null}
    </div>
  );
}

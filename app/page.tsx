/**
 * Verran laskeutumissivu (§31–§34).
 *
 * Kaksi periaatetta ohjaavat tätä sivua:
 *
 * 1. Demot renderöidään OIKEILLA moottoreilla, ei käsin kirjoitetuilla
 *    luvuilla. Jos sääntö muuttuu, sivu muuttuu mukana eikä markkinointi voi
 *    ajautua eri linjalle kuin tuote (§50).
 *
 * 2. Jokainen luvattu ominaisuus kantaa StatusPillin. Sivu ei väitä tuotteen
 *    tekevän jotain mitä se ei tee (§67, §74).
 */

import Link from "next/link";
import { getDemoDocument } from "@/lib/demo/data";
import { formatMoney, formatRate } from "@/lib/money";
import { reviewReasonLabel } from "@/lib/tax/engine";
import { parseTripText } from "@/lib/trips/parse";
import { calculateTrip, TRIP_REVIEW_LABELS } from "@/lib/trips/rules";
import { Card, Mark, SectionHeading, StatusPill } from "@/components/marketing";

export default function LandingPage() {
  const linnea = getDemoDocument("doc-linnea-0614")!;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <TrustStrip />
        <ThreeSteps />
        <LineLevelVatDemo doc={linnea} />
        <FourDoors />
        <AuditableAi />
        <ViesDemo />
        <TripsSection />
        <TimoSection />
        <WhyNow />
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
        <nav aria-label="Päänavigaatio" className="hidden gap-6 text-sm text-navy-200 lg:flex">
          <a href="#miten" className="hover:text-navy-50">Miten se toimii</a>
          <a href="#alv" className="hover:text-navy-50">Rivikohtainen ALV</a>
          <a href="#kenelle" className="hover:text-navy-50">Kenelle</a>
          <a href="#matkat" className="hover:text-navy-50">Matkat</a>
          <a href="#hinnoittelu" className="hover:text-navy-50">Hinnoittelu</a>
          <a href="#ukk" className="hover:text-navy-50">UKK</a>
        </nav>
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
          Lähetä kuittisi — Verra luokittelee rivikohtaisen ALV:n, tarkistaa EU
          VIESin ja tallentaa jokaisen päätöksen perustelun. Sääntömoottori on
          deterministinen, ei kielimalli: sama kuitti luokitellaan aina samalla
          tavalla.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="rounded-md bg-gold-400 px-5 py-3 text-sm font-semibold text-navy-900 hover:bg-gold-300"
          >
            Aloita ilmaiseksi
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md border border-navy-600 px-5 py-3 text-sm font-semibold text-navy-100 hover:border-navy-400"
          >
            Katso demo ilman tunnusta
          </Link>
        </div>
        <ul className="mt-10 flex flex-wrap gap-x-7 gap-y-2 text-sm text-navy-300">
          {["14 päivän kokeilu", "Ei luottokorttia", "15 kuittia / kk ilmaiseksi", "Audit trail"].map(
            (item) => (
              <li key={item} className="flex items-center gap-2">
                <span aria-hidden="true" className="text-gold-400">✓</span>
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
          Verra on rakenteilla. Emme esitä asiakasmääriä, liikevaihtoa,
          sertifiointeja emmekä referenssejä ennen kuin ne ovat todennettavissa.
          Jokainen ominaisuus alla on merkitty sen mukaan, toimiiko se jo.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 01 · 02 · 03
// ---------------------------------------------------------------------------

const STEPS = [
  {
    n: "01",
    title: "Luo tunnus.",
    body: "Sähköposti ja salasana. Free-taso ei vaadi luottokorttia. Y-tunnuksen voi antaa heti tai lisätä myöhemmin — se ei estä aloittamista.",
    meta: "Aina ilmainen · 15 kuittia / kk",
    status: "live" as const,
  },
  {
    n: "02",
    title: "Lähetä kuitit.",
    body: "Vedä ja pudota selaimessa tai kuvaa puhelimella. PDF, JPG, PNG ja HEIC. Sama tiedosto ei mene kahdesti läpi — tiiviste tunnistaa duplikaatin ennen kuin mitään tallennetaan.",
    meta: "Vedä ja pudota · valokuva · PDF · HEIC",
    status: "live" as const,
  },
  {
    n: "03",
    title: "Tarkista ja vie.",
    body: "Verra jäsentää, luokittelee rivikohtaisen ALV:n ja perustelee jokaisen päätöksen. Epävarma tapaus menee tarkistusjonoon syineen. Hyväksyt ja viet kirjanpitoon.",
    meta: "Vienti · CSV",
    status: "live" as const,
  },
];

function ThreeSteps() {
  return (
    <section id="miten" className="border-b border-line">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <SectionHeading
          eyebrow="Miten se toimii"
          title="Postilaatikosta kirjanpitoon. Kolme vaihetta."
          lead="Ei taulukoita. Ei käsin jakamista. Ei käyttöönottopuhelua."
        />
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="rounded-lg border border-line bg-surface p-6">
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-xs font-semibold text-gold-600">
                  {step.n}
                </span>
                <StatusPill status={step.status} />
              </div>
              <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
                {step.meta}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-6 rounded-lg border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Sähköpostivastaanotto</p>
              <p className="mt-1 text-sm text-muted">
                Työtilakohtainen osoite johon voit lähettää kuitit suoraan
                sähköpostilla. Tietokantarakenteet ja duplikaattisuoja ovat
                valmiina, mutta vastaanotto ei ole vielä kytketty.
              </p>
            </div>
            <StatusPill status="planned" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Rivikohtainen ALV — moottorin oikea tulos
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
          title="Päiväraportit jakavat itsensä."
          lead="Ravintolan päiväraportilla ruoka ja alkoholi ovat eri verokannalla, ja palvelumaksu vaatii oman arvionsa. Verra ei niputa niitä yhteen kantaan."
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
              <caption className="sr-only">Päiväraportin rivit ja ALV-käsittelyt</caption>
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
                      {formatMoney(line.decision.inputFacts.netAmountCents)}
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
              poiminta jäi epävarmaksi. Verra merkitsee tapauksen
              tarkistettavaksi sen sijaan että esittäisi varmuutta jota sillä
              ei ole.
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
// Neljä etuovea
// ---------------------------------------------------------------------------

const DOORS = [
  {
    audience: "Ravintoloille",
    headline: "Päiväraportit jakavat itsensä.",
    scenario:
      "Päiväraportilla ruoka on alennetulla kannalla ja olut yleisellä. Ilman rivikohtaista käsittelyä jako tehdään käsin joka kuukausi.",
    href: "#alv",
    hrefLabel: "Katso miten jako toimii",
  },
  {
    audience: "Kirjanpitäjille",
    headline: "Kaikki asiakkaat yhdessä näkymässä.",
    scenario:
      "Näet kenen aineisto puuttuu, mikä odottaa tarkistusta ja mikä on valmis toimitettavaksi — ilman että jokaista asiakasta pitää avata erikseen.",
    href: "/clients",
    hrefLabel: "Asiakasnäkymä",
  },
  {
    audience: "Kevytyrittäjille",
    headline: "Neljännesvuoden ALV ilman iltatöitä.",
    scenario:
      "Kuitit sisään pitkin kautta, ALV-erittely koodeittain ulos. Rivit jotka eivät ratkea päätyvät jonoon perusteltuna, eivät hiljaa väärään koodiin.",
    href: "/vat",
    hrefLabel: "ALV-erittely",
  },
  {
    audience: "Ulkomaalaistaustaisille perustajille",
    headline: "Suomen verokohtelu perusteltuna.",
    scenario:
      "Jokainen päätös kertoo minkä säännön nojalla se tehtiin ja mitä faktoja käytettiin. Ei tarvitse luottaa siihen että kone tietää — voit tarkistaa.",
    href: "/rules",
    hrefLabel: "Sääntöselain",
    note: "Käyttöliittymä on toistaiseksi vain suomeksi.",
  },
];

function FourDoors() {
  return (
    <section id="kenelle" className="border-b border-line bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <SectionHeading
          eyebrow="Kenelle"
          title="Yksi tuote. Neljä etuovea."
          lead="Erilaiset lähtökohdat, sama jäljitettävä päätöksenteko. Valitse ovi joka näyttää sinulta."
        />

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {DOORS.map((door) => (
            <div key={door.audience} className="rounded-lg border border-line bg-background p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-gold-600">
                {door.audience}
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">{door.headline}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{door.scenario}</p>
              {door.note ? (
                <p className="mt-2 text-xs text-warn-600">{door.note}</p>
              ) : null}
              <Link
                href={door.href}
                className="mt-4 inline-block text-sm font-medium text-navy-700 underline underline-offset-4"
              >
                {door.hrefLabel}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs text-muted">
          Kuvaukset ovat havainnollistavia käyttötilanteita, eivät asiakkaiden
          lausuntoja. Verralla ei ole vielä julkaistavia referenssejä.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tarkastettava tekoäly
// ---------------------------------------------------------------------------

function AuditableAi() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <SectionHeading
          eyebrow="Tarkastettavuus"
          title="Yleinen tekoäly arvaa veron. Verra perustelee sen."
          lead="Keksitty luku ei ole bugi vaan vastuukysymys. Jokainen luokittelu kantaa sääntönsä, versionsa ja käytetyt faktansa — ja voidaan ajaa uudelleen samaan tulokseen."
        />

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card title="Deterministinen päätös" status="live">
            Sama normalisoitu syöte ja sama sääntöversio tuottavat aina saman
            päätöksen. Sääntömoottori ei kutsu kielimallia, verkkoa eikä kelloa.
            Tämä on varmistettu testeillä, ei lupauksella.
          </Card>

          <Card title="Audit trail" status="live">
            Jokainen lataus, luokittelu, hyväksyntä, uudelleenajo ja vienti
            kirjautuu säännön, aikaleiman ja syötteen kanssa. Taulu on
            lisäys-vain tietokannan liipaisimen pakottamana.
          </Card>

          <Card title="Uudelleenajo" status="live">
            Voit ajaa vuoden takaisen päätöksen uudelleen. Historiallista
            päätöstä ei koskaan ylikirjoiteta — uusi päätös osoittaa
            korvaamaansa, joten ero on nähtävissä.
          </Card>

          <Card title="Tenant-eristys" status="live">
            Organisaatiorajat pakotetaan tietokannan Row Level Security
            -politiikoilla jokaisessa kyselyssä, ei sovelluslogiikassa. Pääsy
            toisen organisaation dataan kulkee vain nimenomaisen
            tilitoimistosuhteen kautta.
          </Card>

          <Card title="EU-alueen tietojenkäsittely" status="unverified">
            Emme väitä tätä ennen kuin infrastruktuuri takaa sen. Sovellus
            ajetaan tällä hetkellä Vercelillä, jonka reunaverkko voi palvella
            pyynnön EU:n ulkopuolelta. Ennen väitteen esittämistä ajoalue on
            lukittava ja alihankkijat luetteloitava.
          </Card>

          <Card title="Verohallinnon mukaiset säännöt" status="planned">
            Kaikki mukana olevat säännöt ovat statukseltaan <code>demo</code>.
            Niitä ei ole validoitu virallista lähdettä vasten, ja moottori
            merkitsee jokaisen niillä tehdyn päätöksen tarkistettavaksi. Kun
            sääntö validoidaan, sille luodaan uusi versio lähdeviitteineen.
          </Card>
        </div>

        <div className="mt-6 rounded-lg border border-warn-500/30 bg-warn-100 p-5 text-sm text-warn-600">
          <p className="font-semibold">Mitä emme väitä</p>
          <p className="mt-1.5">
            Ei asiakasmääriä, liikevaihtoa, tarkkuusprosentteja, sertifiointeja
            (SOC 2, ISO), viranomaishyväksyntää eikä VIES-takuita. Nämä
            lisätään vasta kun ne ovat todennettavissa.
          </p>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function ViesDemo() {
  return (
    <section className="border-b border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-2 md:items-center">
        <div>
          <SectionHeading
            eyebrow="EU VIES"
            title="Tunnisteen vahvistus on todiste, ei oletus"
            lead="Verra tarkistaa ALV-tunnisteen, tallentaa vastauksen ja kuittausnumeron ja liittää ne tapahtumaan. Vahvistettu tunniste ei silti yksin ratkaise verokohtelua — sen tekee sääntömoottori koko tapahtuman perusteella."
          />
          <div className="mt-5">
            <StatusPill status="planned" />
            <p className="mt-2 text-sm text-muted">
              Muototarkistus ja tallennusrakenteet ovat käytössä. Yhteys
              komission rajapintaan on vielä kytkemättä, joten tuntematonta
              tunnistetta ei koskaan merkitä kelvolliseksi.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-background p-6">
          <dl className="space-y-3 text-sm">
            <Row label="ALV-tunniste" value="DE 811205325" mono />
            <Row label="Tila" value="Voimassa" tone="ok" />
            <Row label="Vahvistettu" value="14.5.2026 10.42 UTC" />
            <Row label="Yritys" value="Bauhaus AG" />
            <Row label="Maa" value="Saksa" />
          </dl>
          <div className="mt-5 rounded-md border border-navy-200 bg-surface p-3.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Sääntömoottorin päätös
            </p>
            <p className="mt-1.5 text-sm">
              Mahdollinen käännetty verovelvollisuus —{" "}
              <span className="font-mono text-xs">vat-fi-rc-eu-b2b</span>.
              Edellyttää että myös suoritetyyppi ja ostajan asema täsmäävät.
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
// Matkalasku — oikea jäsennin, oikea laskelma
// ---------------------------------------------------------------------------

const TRIP_EXAMPLE =
  "Ajoin Tampereelta Helsinkiin Acme-palaveriin, 174 km edestakaisin, 8 tuntia, söin lounaan paluumatkalla.";

function TripsSection() {
  // Jäsennetään ja lasketaan tuotannon koodilla. Luvut alla eivät ole
  // kuvituskuvaa vaan sitä mitä sovellus oikeasti tuottaa.
  const parsed = parseTripText(TRIP_EXAMPLE);
  const calc = calculateTrip({
    date: "2026-05-17",
    kilometers: parsed.kilometers,
    durationHours: parsed.durationHours,
    mealsProvided: parsed.mealsProvided,
  });

  return (
    <section id="matkat" className="border-b border-line">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionHeading
            eyebrow="Matkalaskut"
            title="Matkalasku ilman lomaketta."
            lead="Kirjoita yksi lause. Verra jäsentää reitin, kilometrit ja ateriat, laskee kilometrikorvauksen ja päivärahan voimassa olevista sääntöversioista — ja kertoo mitä se ei tunnistanut."
          />
          <StatusPill status="live" />
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Sinä kirjoitat
            </p>
            <p className="mt-3 rounded-lg bg-navy-900 px-4 py-3 text-sm leading-relaxed text-navy-50">
              {TRIP_EXAMPLE}
            </p>
            <p className="mt-4 text-xs text-muted">
              Jäsennin on deterministinen, ei kielimalli. Se ei arvaa: mitä se
              ei tunnista, se listaa sinun täytettäväksesi.
            </p>
            {parsed.missing.length > 0 ? (
              <p className="mt-2 text-xs text-warn-600">
                Tunnistamatta jäi: {parsed.missing.join(", ")}
              </p>
            ) : (
              <p className="mt-2 text-xs text-ok-600">
                Tästä lauseesta tunnistettiin kaikki kentät.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-line bg-background p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Verra jäsentää
            </p>
            <dl className="mt-3 space-y-2.5 text-sm">
              <Row
                label="Matka"
                value={`${parsed.origin ?? "?"} ↔ ${parsed.destination ?? "?"}`}
              />
              <Row label="Päivä" value="17.5.2026" />
              <Row
                label={`Kilometrit (${calc.kilometers} km × ${(calc.mileageRateCents / 100).toFixed(2).replace(".", ",")} €)`}
                value={formatMoney(calc.mileageCents)}
              />
              <Row
                label="Päiväraha · osapäivä (yli 6 h)"
                value={formatMoney(calc.perDiemCents)}
              />
              {calc.mealDeductionCents > 0 ? (
                <Row
                  label="Ateriavähennys (tarjottu lounas)"
                  value={`−${formatMoney(calc.mealDeductionCents)}`}
                />
              ) : null}
            </dl>

            <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3">
              <span className="font-semibold">Korvaus yhteensä</span>
              <span className="text-2xl font-semibold tabular text-gold-600">
                {formatMoney(calc.totalCents)}
              </span>
            </div>

            <ul className="mt-4 flex flex-wrap gap-2">
              <li className="rounded border border-line px-2 py-1 font-mono text-xs text-muted">
                {calc.mileageRuleId}@{calc.mileageRuleVersion}
              </li>
              <li className="rounded border border-line px-2 py-1 font-mono text-xs text-muted">
                {calc.perDiemRuleId}@{calc.perDiemRuleVersion}
              </li>
            </ul>

            {calc.reviewReasons.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {calc.reviewReasons.map((r) => (
                  <li
                    key={r}
                    className="rounded border border-warn-500/30 bg-warn-100 px-2 py-1 text-xs text-warn-600"
                  >
                    {TRIP_REVIEW_LABELS[r] ?? r}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Card title="Versioidut taksat" status="live">
            Kilometrikorvaus ja päiväraha ovat sääntöversioita
            voimassaoloaikoineen, eivät kovakoodattuja lukuja. Vanha matkalasku
            pysyy toistettavana kun taksa muuttuu.
          </Card>
          <Card title="Ateriavähennys" status="live">
            Tarjottu ateria pienentää päivärahaa automaattisesti. Vähennys ei
            voi koskaan ylittää päivärahaa.
          </Card>
          <Card title="Kuittien linkitys" status="planned">
            Saman päivän kuittien automaattinen liittäminen matkaan. Tietokannan
            rakenne on valmis, kytkentä puuttuu.
          </Card>
        </div>

        <div className="mt-6">
          <Link
            href="/trips"
            className="rounded-md bg-gold-400 px-5 py-3 text-sm font-semibold text-navy-900 hover:bg-gold-300"
          >
            Kokeile matkalaskua
          </Link>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

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
          <div className="mt-5">
            <StatusPill status="planned" />
            <p className="mt-2 text-sm text-muted">
              Sääntömoottori ja päätösten rakenne joihin Timo nojaa ovat
              käytössä. Keskustelukäyttöliittymää ei ole vielä rakennettu.
              Alla oleva on suunniteltu vastausmuoto.
            </p>
          </div>
        </div>
        <div className="space-y-3 rounded-xl border border-line bg-background p-6">
          <div className="ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-navy-900 px-4 py-2.5 text-sm text-navy-50">
            Onko tämä SaaS-lasku Saksaan käännetty verovelvollisuus?
          </div>
          <div className="max-w-[92%] rounded-lg rounded-bl-sm border border-line bg-surface px-4 py-3 text-sm">
            <p>
              Tämän tositteen osalta en voi vahvistaa sitä automaattisesti.
              Ostajan ALV-tunnistetta ei ole vahvistettu VIESissä, joten
              käännetyn verovelvollisuuden ehto jää täyttymättä.
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

// ---------------------------------------------------------------------------

function WhyNow() {
  return (
    <section className="border-b border-navy-800 bg-navy-900 text-navy-50">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <SectionHeading
          dark
          eyebrow="Miksi juuri nyt"
          title="Rakennettu maailmaan jossa raportointi on reaaliaikaista."
          lead="EU:n ViDA-uudistus siirtää rajat ylittävän B2B-raportoinnin rakenteiseksi ja reaaliaikaiseksi. Siinä maailmassa virhe ei odota tilinpäätöstä — se näkyy heti."
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="rounded-lg border border-navy-700 bg-navy-800 p-5">
            <h3 className="text-base font-semibold">Rakenteinen jo lähtökohtaisesti</h3>
            <p className="mt-2 text-sm leading-relaxed text-navy-200">
              Verra tallentaa rivit, kentät, luottamukset ja päätökset
              rakenteisina alusta asti. Reaaliaikainen raportointi ei vaadi
              tietomallin uudelleenkirjoitusta.
            </p>
          </div>
          <div className="rounded-lg border border-navy-700 bg-navy-800 p-5">
            <h3 className="text-base font-semibold">Virhe kiinni ennen lähetystä</h3>
            <p className="mt-2 text-sm leading-relaxed text-navy-200">
              Epävarma rivi menee tarkistusjonoon ennen vientiä, ei
              korjauspyyntönä jälkikäteen. Vienti on estetty kunnes syy on
              käsitelty.
            </p>
          </div>
          <div className="rounded-lg border border-navy-700 bg-navy-800 p-5">
            <h3 className="text-base font-semibold">Versioidut säännöt</h3>
            <p className="mt-2 text-sm leading-relaxed text-navy-200">
              Kun sääntö muuttuu, vanha versio jää voimaan omalle
              ajanjaksolleen. Aiempi päätös pysyy toistettavana, mikä on
              auditoinnin edellytys.
            </p>
          </div>
        </div>

        <p className="mt-8 text-sm text-navy-300">
          ViDA on EU:n hyväksymä uudistus, jonka rajat ylittävää digitaalista
          raportointia koskevat velvoitteet astuvat voimaan vaiheittain
          vuosikymmenen loppuun mennessä. Verra ei ole vielä sertifioitu
          mihinkään kansalliseen reaaliaikaraportointiin.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

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
        <p className="mt-6 text-xs text-muted">
          Vertailu koskee työkaluluokkia, ei nimettyjä kilpailijoita. Emme väitä
          minkään toisen tuotteen olevan juridisesti väärässä.
        </p>
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
    features: ["15 dokumenttia/kk", "Rivikohtainen ALV", "1 työtila", "CSV-vienti"],
  },
  {
    id: "solo",
    name: "Solo",
    price: "19 €",
    features: ["150 dokumenttia/kk", "Täysi ALV-moottori", "Matkalaskut", "Sähköpostivastaanotto"],
  },
  {
    id: "business",
    name: "Business",
    price: "49 €",
    highlight: true,
    features: ["750 dokumenttia/kk", "Useita käyttäjiä", "Päiväraportit", "Rajat ylittävät säännöt"],
  },
  {
    id: "growth",
    name: "Pro / Growth",
    price: "99 €",
    features: ["2 500 dokumenttia/kk", "Useita yhtiöitä", "Kehittynyt audit", "API"],
  },
];

function Pricing() {
  return (
    <section id="hinnoittelu" className="border-b border-line bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <SectionHeading
          eyebrow="Hinnoittelu"
          title="Selkeät rajat, ei yllätyslaskuja"
          lead="Rajat ja hinnat tulevat tietokannasta. Näet käytön ja jäljellä olevan määrän ennen kuin raja tulee vastaan."
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
                <span className="text-sm text-muted">/kk</span>
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
                href="/signup"
                className={[
                  "mt-6 rounded-md px-4 py-2.5 text-center text-sm font-semibold",
                  plan.highlight
                    ? "bg-gold-400 text-navy-900 hover:bg-gold-300"
                    : "border border-line hover:border-navy-300",
                ].join(" ")}
              >
                Aloita
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

        <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
          <StatusPill status="planned" />
          Maksaminen ei ole vielä käytössä. Kaikki tasot toimivat tällä
          hetkellä ilmaiseksi, ja rajat lasketaan mutta laskutusta ei tapahdu.
        </p>
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
            Pienyritykset menettävät aikaa dokumenttien, kuittien ja
            kirjanpidon hallintoon. Työ on toistuvaa, mutta virheet ovat
            kalliita — ja kysymykseen &rdquo;miksi tämä kirjattiin näin&rdquo;
            pitäisi pystyä vastaamaan vielä vuosien päästä.
          </p>
          <p>
            Verra rakennetaan siitä lähtökohdasta. Kone tekee työn, mutta
            jokainen päätös on perusteltavissa ja toistettavissa. Kun
            järjestelmä ei tiedä, se sanoo niin.
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

const FAQ: [string, string][] = [
  [
    "Missä dataani säilytetään?",
    "Supabase-tietokannassa ja Vercelin kautta tarjoiltavassa sovelluksessa. Emme vielä väitä että data pysyy EU:ssa, koska Vercelin reunaverkko voi palvella pyynnön muualta. Ennen väitteen esittämistä ajoalue lukitaan ja alihankkijat luetteloidaan.",
  ],
  ["Tarvitsenko luottokortin?", "Et. Free-taso on käytössä ilman korttia, eikä maksaminen ole vielä käytössä lainkaan."],
  [
    "Mitä kirjanpitojärjestelmiä tuetaan?",
    "CSV ja Excel-yhteensopiva CSV toimivat. Procountor, Netvisor ja e-conomic ovat palvelurajapinnassa määriteltyjä, mutta varsinaista integraatiota ei ole vielä rakennettu.",
  ],
  ["Tukeeko se HEIC-kuvia?", "Kyllä, samoin PDF, JPG ja PNG. Enimmäistiedostokoko on asetettavissa."],
  [
    "Miten ALV-luokittelu toimii?",
    "Poiminta tuottaa rivit ja kentät. Deterministinen sääntömoottori ratkaisee kohtelun sääntöversion perusteella. Kielimallia ei käytetä itse päätöksessä.",
  ],
  [
    "Ovatko säännöt Verohallinnon vahvistamia?",
    "Eivät vielä. Kaikki säännöt ovat statukseltaan demo, eikä niitä ole validoitu virallista lähdettä vasten. Moottori merkitsee jokaisen niillä tehdyn päätöksen tarkistettavaksi.",
  ],
  [
    "Millä kielillä tuote on?",
    "Toistaiseksi vain suomeksi. Monikielisyys on suunnitteilla, mutta käännöksiä ei ole vielä tehty emmekä väitä muuta.",
  ],
  [
    "Pääseekö kirjanpitäjäni työtilaani?",
    "Pääsee, jos kutsut hänet. Pääsy kulkee nimenomaisen tilitoimistosuhteen kautta ja on peruttavissa. Kutsujen lähetys käyttöliittymästä ei ole vielä toteutettu.",
  ],
  ["Saanko datani ulos?", "Saat. Vienti on tuotteen ydinominaisuus, ei lisäosa."],
  [
    "Mitä tapahtuu kun verosäännöt muuttuvat?",
    "Uusi sääntöversio saa oman voimassaoloaikansa. Vanhat päätökset säilyvät ennallaan, ja voit ajaa päätöksen uudelleen nähdäksesi eron.",
  ],
  [
    "Mitä tapahtuu kun Verra on epävarma?",
    "Tapaus menee tarkistusjonoon perusteltuna. Verra ei arvaa eikä esitä varmuutta jota sillä ei ole.",
  ],
  [
    "Miten tekoäly käyttää dataani?",
    "Poiminnassa käytetään dokumentin sisältöä. Emme käytä asiakasaineistoa mallien kouluttamiseen. Tällä hetkellä poiminta ajetaan paikallisella demo-toteutuksella, joka ei lähetä dataa mihinkään.",
  ],
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
          <nav
            aria-label="Alatunniste"
            className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm sm:grid-cols-3"
          >
            {[
              ["Tuote", ["Miten se toimii", "#miten"], ["Rivikohtainen ALV", "#alv"], ["Matkat", "#matkat"], ["Hinnoittelu", "#hinnoittelu"]],
              ["Sovellus", ["Kirjaudu", "/login"], ["Luo tunnus", "/signup"], ["Demo", "/dashboard"]],
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
          © {new Date().getFullYear()} Verra. Sivustolla esitetyt verokannat,
          matkataksat ja sääntötunnukset ovat havainnollistavia demo-sääntöjä
          eivätkä oikeudellinen kannanotto.
        </p>
      </div>
    </footer>
  );
}

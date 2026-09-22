import Link from "next/link";
import { pathFor, type Locale } from "@/lib/i18n/locales";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { HtmlLang } from "./html-lang";
import { LandingNav, Reveal } from "./nav";
import { Logo } from "@/components/brand/logo";
import {
  HeroFloaters,
  HeroPreview,
  MonthPreview,
  TodoPreview,
} from "./preview";
import { CountIn, ParallaxStage, Spotlight } from "./effects";
import { CategoryIcon, RfIcon } from "@/components/restoflow/icons";
import { ContactForm } from "./contact-form";

/**
 * Katen etusivu.
 *
 * VIISI SEKUNTIA.
 *
 * Kävijän on ymmärrettävä mikä Kate on, kenelle se on, miksi sitä
 * kannattaa käyttää, mitä se maksaa ja mistä pääsee alkuun. Kaikki muu
 * on tämän tiellä.
 *
 * Siksi sivu on lyhyt ja tuotteen oma käyttöliittymä on sen tärkein
 * kuva. Kolme ruutua markkinointitekstiä kertoisi vähemmän kuin yksi
 * näkymä oikeasta ohjelmasta.
 *
 * MITÄÄN EI LUVATA MITÄ EI OLE.
 *
 * Jokainen tällä sivulla mainittu ominaisuus on sovelluksessa
 * olemassa. Veroasioista sanotaan mitä Kate oikeasti tekee: se
 * valmistelee luvut ja kertoo mitä pitää tehdä, muttei lähetä
 * ilmoitusta puolestasi.
 */
export function Landing({ appHref, locale, t }: Props) {
  return (
    <div className="bd">
      <HtmlLang locale={locale} />
      <LandingNav appHref={appHref} locale={locale} page="home" t={t} />

      <main>
        <Hero appHref={appHref} t={t} />
        <Benefits t={t} />
        <Industries t={t} />
        <Flow t={t} />
        <MonthView t={t} />
        <Todo t={t} />
        <Features t={t} />
        <Pricing appHref={appHref} t={t} />
        <Contact appHref={appHref} locale={locale} t={t} />
      </main>

      <Footer locale={locale} t={t} />
    </div>
  );
}

interface Props {
  appHref: string | null;
  locale: Locale;
  t: Dictionary;
}

// ---------------------------------------------------------------------------

function Hero({ appHref, t }: { appHref: string | null; t: Dictionary }) {
  return (
    <section className="relative px-4 pb-4 pt-12 sm:px-6 sm:pt-20">
      <div className="bd-hero-glow" aria-hidden="true" />

      <div className="relative mx-auto max-w-3xl text-center">
        <p
          className="bd-rise text-[12.5px] font-semibold uppercase tracking-[0.09em]"
          style={{ color: "var(--bd-text-3)" }}
        >
          {t.hero.label}
        </p>

        <h1
          className="bd-rise bd-d1 mt-4 text-[clamp(2.1rem,6.2vw,3.6rem)] font-extrabold leading-[1.06] tracking-[-0.035em]"
          style={{ textWrap: "balance" }}
        >
          {t.hero.titleA}
          <br className="hidden sm:block" />{" "}
          <span className="bd-gradient-text">{t.hero.titleB}</span>
        </h1>

        <p
          className="bd-rise bd-d2 mx-auto mt-5 max-w-xl text-[16px] leading-relaxed sm:text-[17px]"
          style={{ color: "var(--bd-text-2)" }}
        >
          {t.hero.body}
        </p>

        <div className="bd-rise bd-d3 mt-8 flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:items-center">
          <PrimaryCta appHref={appHref} t={t} />
          <a href="#tuote" className="bd-btn bd-btn-ghost">
            {t.hero.secondary}
          </a>
        </div>

        <p
          className="bd-rise bd-d4 mx-auto mt-5 flex max-w-sm items-start justify-center gap-2 text-left text-[13.5px] sm:max-w-none sm:items-center"
          style={{ color: "var(--bd-text-2)" }}
        >
          <Check />
          {t.hero.note}
        </p>
      </div>

      {/*
        Tuotteen oma käyttöliittymä. Sivun tärkein kuva.

        Kehys kääntyy kallistuksesta suoraksi, sen takana syttyy hehku ja
        reunoille ponnahtavat Matin huomio ja päivän tulos. Kerrokset ovat
        eri syvyyksillä ja liikkuvat osoittimen mukaan.
      */}
      <ParallaxStage
        id="tuote"
        className="bd-stage relative mx-auto mt-12 max-w-5xl sm:mt-16"
      >
        <div className="bd-stage-glow" aria-hidden="true" />

        <div
          className="bd-depth relative"
          style={{ "--depth": 8 } as React.CSSProperties}
        >
          <div className="bd-frame-in">
            <div className="bd-frame">
              <HeroPreview t={t} />
            </div>
          </div>
        </div>

        <HeroFloaters t={t} />

        <p
          className="relative mt-3.5 text-center text-[12px]"
          style={{ color: "var(--bd-text-3)" }}
        >
          {t.hero.previewNote}
        </p>
      </ParallaxStage>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Benefits({ t }: { t: Dictionary }) {
  const items = [
    {
      title: t.benefits.receiptsTitle,
      body: t.benefits.receiptsBody,
      visual: <ReceiptScan t={t} />,
    },
    {
      title: t.benefits.financeTitle,
      body: t.benefits.financeBody,
      visual: <ResultBars t={t} />,
    },
    {
      title: t.benefits.ledgerTitle,
      body: t.benefits.ledgerBody,
      visual: <LedgerRows />,
    },
  ];

  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <h2
            className="max-w-2xl text-[clamp(1.5rem,3.6vw,2.1rem)] font-extrabold leading-[1.15] tracking-[-0.03em]"
            style={{ textWrap: "balance" }}
          >
            {t.benefits.headingA}
            <br />
            <span className="bd-gradient-text">{t.benefits.headingB}</span>
          </h2>

          <p
            className="mt-4 max-w-xl text-[15.5px] leading-relaxed"
            style={{ color: "var(--bd-text-2)" }}
          >
            {t.benefits.body}
          </p>
        </Reveal>

        <Spotlight className="mt-10 grid gap-4 sm:grid-cols-3">
          {items.map((item, i) => (
            <Reveal key={item.title} delay={i * 90}>
              <div className="bd-card bd-card-hover bd-spot h-full overflow-hidden">
                <div className="bd-benefit-visual" aria-hidden="true">
                  {item.visual}
                </div>
                <div className="p-5 pt-4">
                  <h3 className="text-[16px] font-bold tracking-[-0.01em]">
                    {item.title}
                  </h3>
                  <p
                    className="mt-1.5 text-[14px] leading-relaxed"
                    style={{ color: "var(--bd-text-2)" }}
                  >
                    {item.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </Spotlight>
      </div>
    </section>
  );
}

/*
 * Hyötykorttien pienet kuvitukset.
 *
 * Jokainen näyttää korttinsa lupauksen liikkeenä eikä kuvakkeena:
 * kuitti luetaan, tulos kasvaa, kirjaukset syntyvät. Liike alkaa kun
 * kortti tulee näkyviin (Reveal) ja tapahtuu kerran.
 */

function ReceiptScan({ t }: { t: Dictionary }) {
  return (
    <div className="bd-mini bd-mini-receipt">
      <div className="bd-paper">
        <i style={{ width: "70%" }} />
        <i style={{ width: "45%" }} />
        <i style={{ width: "85%" }} />
        <i style={{ width: "60%" }} />
        <i style={{ width: "40%" }} />
        <span className="bd-scanline" />
      </div>
      <div className="bd-chips">
        <span className="bd-chip bd-chip-1">{t.preview.catFood}</span>
        <span className="bd-chip bd-chip-2">{t.preview.vat} 13,5 %</span>
        <span className="bd-chip bd-chip-3 bd-chip-ok">✓ 184,20 €</span>
      </div>
    </div>
  );
}

function ResultBars({ t }: { t: Dictionary }) {
  const bars = [42, 58, 50, 72, 64, 88, 80];
  return (
    <div className="bd-mini bd-mini-bars">
      <div className="bd-bars">
        {bars.map((h, i) => (
          <i
            key={i}
            style={
              {
                "--h": `${h}%`,
                "--i": i,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <span className="bd-mini-result">
        <span style={{ color: "var(--bd-text-3)" }}>{t.preview.result}</span>
        <strong className="bd-num">
          +<CountIn to={3420} delay={500} /> €
        </strong>
      </span>
    </div>
  );
}

function LedgerRows() {
  return (
    <div className="bd-mini bd-mini-ledger">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bd-ledger-row"
          style={{ "--i": i } as React.CSSProperties}
        >
          <span className="bd-ledger-tick">✓</span>
          <i style={{ width: `${[62, 48, 70, 54][i]}%` }} />
          <b className="bd-num">{["3000", "4000", "2939", "1910"][i]}</b>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Toimialat.
 *
 * Kate on yhä sama ohjelma, mutta näkymä mukautuu: parturi ei näe
 * ruoka- ja alkoholikategorioita, eikä kahvila alkoholimyyntiä. Kortit
 * kertovat mitä kukin saa valmiina, konkreettisesti ALV-kantoja myöten,
 * koska juuri se on se mitä yrittäjä ei halua itse selvittää.
 */
function Industries({ t }: { t: Dictionary }) {
  const items = [
    {
      title: t.industries.restaurant,
      body: t.industries.restaurantBody,
      icon: "food" as const,
    },
    {
      title: t.industries.cafe,
      body: t.industries.cafeBody,
      icon: "soft_drinks" as const,
    },
    {
      title: t.industries.barber,
      body: t.industries.barberBody,
      icon: "products" as const,
    },
  ];

  return (
    <section id="toimialat" className="px-4 pb-20 sm:px-6 sm:pb-28">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <p
            className="text-[12.5px] font-semibold uppercase tracking-[0.09em]"
            style={{ color: "var(--bd-accent)" }}
          >
            {t.industries.label}
          </p>
          <h2
            className="mt-3 max-w-2xl text-[clamp(1.5rem,3.6vw,2.1rem)] font-extrabold leading-[1.15] tracking-[-0.03em]"
            style={{ textWrap: "balance" }}
          >
            {t.industries.heading}
          </h2>
          <p
            className="mt-4 max-w-2xl text-[15.5px] leading-relaxed"
            style={{ color: "var(--bd-text-2)" }}
          >
            {t.industries.body}
          </p>
        </Reveal>

        <Spotlight className="mt-10 grid gap-4 sm:grid-cols-3">
          {items.map((item, i) => (
            <Reveal key={item.title} delay={i * 90}>
              <div className="bd-card bd-card-hover bd-spot bd-industry h-full p-6">
                <span className="bd-industry-icon" aria-hidden="true">
                  <CategoryIcon category={item.icon} size={24} />
                </span>
                <h3 className="mt-5 text-[17px] font-bold tracking-[-0.01em]">
                  {item.title}
                </h3>
                <p
                  className="mt-2 text-[14px] leading-relaxed"
                  style={{ color: "var(--bd-text-2)" }}
                >
                  {item.body}
                </p>
              </div>
            </Reveal>
          ))}
        </Spotlight>

        <Reveal delay={120}>
          <p className="mt-6 text-[14px]" style={{ color: "var(--bd-text-2)" }}>
            {t.industries.more}{" "}
            <a
              href="#yhteys"
              className="font-semibold underline underline-offset-4"
              style={{ color: "var(--bd-accent)" }}
            >
              {t.nav.start}
            </a>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * Automaattinen tiedonkulku.
 *
 * Katen tärkein myyntiväite yhtenä kuvana: aikajana, jonka viiva
 * täyttyy vasemmalta oikealle kun osio tulee näkyviin ja pisteet
 * syttyvät vuorollaan. Kate on ketjun keskellä omalla tunnuksellaan,
 * koska kaikki kulkee sen kautta.
 */
function Flow({ t }: { t: Dictionary }) {
  const steps = [
    { label: t.flow.step1, note: t.flow.step1Note, icon: "sales" as const },
    { label: t.flow.step2, note: t.flow.step2Note, icon: "camera" as const },
    { label: t.flow.step3, note: t.flow.step3Note, icon: null },
    { label: t.flow.step4, note: t.flow.step4Note, icon: "file" as const },
    { label: t.flow.step5, note: t.flow.step5Note, icon: "trend" as const },
  ];

  return (
    <section
      className="px-4 py-20 sm:px-6 sm:py-28"
      style={{
        background: "var(--bd-bg-2)",
        borderBlock: "1px solid var(--bd-line)",
      }}
    >
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <div className="text-center">
            <h2 className="text-[clamp(1.5rem,3.6vw,2.1rem)] font-extrabold tracking-[-0.03em]">
              {t.flow.heading}
            </h2>
            <p
              className="mx-auto mt-3 max-w-lg text-[15.5px] leading-relaxed"
              style={{ color: "var(--bd-text-2)" }}
            >
              {t.flow.body}
            </p>
          </div>
        </Reveal>

        <Reveal delay={90}>
          <div className="bd-timeline mt-12">
            <span className="bd-timeline-track" aria-hidden="true">
              <span className="bd-timeline-fill" />
            </span>

            <ol className="bd-timeline-list">

            {steps.map((step, i) => (
              <li
                key={step.label}
                className="bd-timeline-step"
                style={{ "--i": i } as React.CSSProperties}
              >
                <span
                  className={`bd-timeline-node ${step.icon === null ? "bd-timeline-node-kate" : ""}`}
                >
                  {step.icon === null ? (
                    <Logo size={30} />
                  ) : (
                    <RfIcon name={step.icon} size={20} />
                  )}
                </span>
                <span className="bd-timeline-text">
                  <span className="block text-[15px] font-bold tracking-[-0.01em]">
                    {step.label}
                  </span>
                  <span
                    className="mt-0.5 block text-[12.5px]"
                    style={{ color: "var(--bd-text-3)" }}
                  >
                    {step.note}
                  </span>
                </span>
              </li>
            ))}
            </ol>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

function MonthView({ t }: { t: Dictionary }) {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-[clamp(1.5rem,3.6vw,2.1rem)] font-extrabold tracking-[-0.03em]">
              {t.month.heading}
            </h2>
            <p
              className="mt-3 text-[15.5px] leading-relaxed"
              style={{ color: "var(--bd-text-2)" }}
            >
              {t.month.body}
            </p>
          </div>
        </Reveal>

        <Reveal delay={90} className="mt-10">
          <MonthPreview t={t} />
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Todo({ t }: { t: Dictionary }) {
  return (
    <section
      className="px-4 py-20 sm:px-6 sm:py-28"
      style={{
        background: "var(--bd-bg-2)",
        borderBlock: "1px solid var(--bd-line)",
      }}
    >
      <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2 md:gap-14">
        <Reveal>
          <h2
            className="text-[clamp(1.5rem,3.6vw,2.1rem)] font-extrabold leading-[1.15] tracking-[-0.03em]"
            style={{ textWrap: "balance" }}
          >
            {t.todo.heading}
          </h2>
          <p
            className="mt-4 max-w-md text-[15.5px] leading-relaxed"
            style={{ color: "var(--bd-text-2)" }}
          >
            {t.todo.body}
          </p>
        </Reveal>

        <Reveal delay={90}>
          <TodoPreview t={t} />
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Features({ t }: { t: Dictionary }) {
  const features = [
    { title: t.features.receipts, body: t.features.receiptsBody, icon: "receipt" },
    { title: t.features.expenses, body: t.features.expensesBody, icon: "expenses" },
    { title: t.features.sales, body: t.features.salesBody, icon: "sales" },
    { title: t.features.till, body: t.features.tillBody, icon: "camera" },
    { title: t.features.ledger, body: t.features.ledgerBody, icon: "file" },
    { title: t.features.vat, body: t.features.vatBody, icon: "budget" },
    { title: t.features.reports, body: t.features.reportsBody, icon: "report" },
    { title: t.features.staff, body: t.features.staffBody, icon: "staff" },
    { title: t.features.tasks, body: t.features.tasksBody, icon: "check" },
    { title: t.features.files, body: t.features.filesBody, icon: "folder" },
  ] as const;

  return (
    <section id="ominaisuudet" className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <h2 className="text-[clamp(1.5rem,3.6vw,2.1rem)] font-extrabold tracking-[-0.03em]">
            {t.features.heading}
          </h2>
        </Reveal>

        {/*
          Ohut ruudukko, jossa jokaisella ominaisuudella on oma kuvake.
          Valo seuraa osoitinta solusta toiseen, ja kuvake nousee kun
          solua osoitetaan.
        */}
        <Spotlight
          className="bd-feature-grid mt-10 grid gap-px overflow-hidden rounded-[20px] sm:grid-cols-2 lg:grid-cols-5"
        >
          {features.map((feature, i) => (
            <Reveal
              key={feature.title}
              delay={Math.min(i, 4) * 50}
              className="bd-feature-cell"
            >
              <div className="bd-spot bd-feature h-full p-5">
                <span className="bd-feature-icon" aria-hidden="true">
                  <RfIcon name={feature.icon} size={18} />
                </span>
                <h3 className="mt-4 text-[15px] font-bold tracking-[-0.01em]">
                  {feature.title}
                </h3>
                <p
                  className="mt-1.5 text-[13.5px] leading-relaxed"
                  style={{ color: "var(--bd-text-2)" }}
                >
                  {feature.body}
                </p>
              </div>
            </Reveal>
          ))}
        </Spotlight>

        {/*
          Veroasioista sanotaan mitä Kate oikeasti tekee.

          "Hoitaa veroasiat" olisi lupaus jota ohjelma ei lunasta:
          ilmoituksen tekee ihminen OmaVerossa. Rehellinen rajaus tässä
          on parempi kuin pettymys ensimmäisessä verokaudessa.
        */}
        <Reveal delay={120}>
          <p
            className="mt-5 flex max-w-2xl items-start gap-2 text-[13px] leading-relaxed"
            style={{ color: "var(--bd-text-3)" }}
          >
            <span className="mt-[1px] shrink-0" aria-hidden="true">
              <RfIcon name="info" size={15} />
            </span>
            {t.features.taxNote}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Pricing({ appHref, t }: { appHref: string | null; t: Dictionary }) {
  const included = [
    t.pricing.incReceipts,
    t.pricing.incExpenses,
    t.pricing.incSales,
    t.pricing.incLedger,
    t.pricing.incVat,
    t.pricing.incReports,
    t.pricing.incStaff,
    t.pricing.incTasks,
    t.pricing.incFiles,
    t.pricing.incAssistant,
  ];

  return (
    <section
      id="hinta"
      className="relative overflow-clip px-4 py-20 sm:px-6 sm:py-28"
      style={{
        background: "var(--bd-bg-2)",
        borderBlock: "1px solid var(--bd-line)",
      }}
    >
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <div className="mx-auto max-w-lg text-center">
            <h2 className="text-[clamp(1.5rem,3.6vw,2.1rem)] font-extrabold tracking-[-0.03em]">
              {t.pricing.heading}
            </h2>
            <p
              className="mt-3 text-[15.5px] leading-relaxed"
              style={{ color: "var(--bd-text-2)" }}
            >
              {t.pricing.body}
            </p>
          </div>
        </Reveal>

        <Reveal delay={90}>
          {/*
            Hintakortti hehkuvalla reunalla: tunnusvärien kehä kiertää
            kortin ympäri hitaasti. Sivun ainoa jatkuvasti liikkuva reuna,
            koska tämä on se kohta jossa päätös tehdään.
          */}
          <div className="bd-price-ring mx-auto mt-10 max-w-md">
            <div
              className="relative overflow-hidden rounded-[22px]"
              style={{ background: "var(--bd-card)" }}
            >
              <div className="p-7 text-center">
                <p className="inline-flex items-center gap-2 text-[14px] font-bold tracking-[-0.01em]">
                  <Logo size={22} />
                  Kate
                </p>

                <p className="mt-4">
                  <span className="bd-num text-[52px] font-bold leading-none tracking-[-0.04em]">
                    <CountIn to={79} duration={900} />
                  </span>
                  <span
                    className="ml-1 text-[16px] font-semibold"
                    style={{ color: "var(--bd-text-2)" }}
                  >
                    {t.pricing.perMonth}
                  </span>
                </p>

                <p
                  className="mt-2 text-[13px]"
                  style={{ color: "var(--bd-text-3)" }}
                >
                  {t.pricing.yearly}
                </p>

                <PrimaryCta
                  appHref={appHref}
                  t={t}
                  className="mt-6 w-full"
                />

                <p
                  className="mt-3 text-[12.5px]"
                  style={{ color: "var(--bd-text-3)" }}
                >
                  {t.pricing.note}
                </p>
              </div>

              <ul
                className="grid gap-x-6 gap-y-2.5 border-t px-7 py-6 sm:grid-cols-2"
                style={{ borderColor: "var(--bd-line)" }}
              >
                {included.map((item, i) => (
                  <li
                    key={item}
                    className="bd-price-item flex items-center gap-2.5 text-[14px]"
                    style={{ "--i": i } as React.CSSProperties}
                  >
                    <Check />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Check() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
      style={{ color: "var(--bd-green)" }}
    >
      <path
        d="m3.5 8.5 3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------

/**
 * Yhteydenotto.
 *
 * Kate ei tarjoa itserekisteröitymistä: tunnukset luodaan puolesta, joten
 * sivun kaikki painikkeet johtavat tänne. Vasemmalla mitä tapahtuu kun
 * otat yhteyttä, oikealla lomake. Pyynnöt näkyvät Developer Consolessa.
 */
function Contact({
  appHref,
  locale,
  t,
}: {
  appHref: string | null;
  locale: Locale;
  t: Dictionary;
}) {
  const points = [t.contact.point1, t.contact.point2, t.contact.point3];

  return (
    <section
      id="yhteys"
      className="relative overflow-clip px-4 py-24 sm:px-6 sm:py-32"
    >
      <div className="bd-contact-glow" aria-hidden="true" />

      <div className="relative mx-auto grid max-w-5xl items-start gap-12 lg:grid-cols-[1fr_minmax(0,480px)] lg:gap-16">
        <Reveal>
          <p
            className="text-[12.5px] font-semibold uppercase tracking-[0.09em]"
            style={{ color: "var(--bd-accent)" }}
          >
            {t.contact.label}
          </p>

          <h2
            className="mt-4 text-[clamp(1.9rem,4.8vw,2.9rem)] font-extrabold leading-[1.06] tracking-[-0.035em]"
            style={{ textWrap: "balance" }}
          >
            {t.contact.titleA}
            <br />
            <span className="bd-gradient-text">{t.contact.titleB}</span>
          </h2>

          <p
            className="mt-5 max-w-md text-[16px] leading-relaxed"
            style={{ color: "var(--bd-text-2)" }}
          >
            {t.contact.body}
          </p>

          <ul className="mt-7 space-y-3">
            {points.map((point) => (
              <li
                key={point}
                className="flex items-start gap-3 text-[15px] font-medium"
              >
                <span className="bd-point-check" aria-hidden="true">
                  <Check />
                </span>
                {point}
              </li>
            ))}
          </ul>

          {appHref !== null ? (
            <Link href={appHref} className="bd-btn bd-btn-ghost mt-8">
              {t.nav.openApp}
              <span className="bd-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          ) : null}
        </Reveal>

        <Reveal delay={120}>
          <ContactForm t={t.contact} locale={locale} />
        </Reveal>
      </div>
    </section>
  );
}

/**
 * Pääpainike.
 *
 * Kirjautuneelle "Avaa Kate", muille yhteydenotto. Rekisteröitymissivua
 * ei tarjota: tunnukset luodaan puolesta.
 */
function PrimaryCta({
  appHref,
  t,
  className = "",
}: {
  appHref: string | null;
  t: Dictionary;
  className?: string;
}) {
  return (
    <Link
      href={appHref ?? "#yhteys"}
      className={`bd-btn bd-btn-primary ${className}`}
    >
      {appHref !== null ? t.nav.openApp : t.nav.start}
      <span className="bd-arrow" aria-hidden="true">
        →
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------

function Footer({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <footer
      className="px-4 py-10 sm:px-6"
      style={{
        borderTop: "1px solid var(--bd-line)",
        background: "var(--bd-bg-2)",
      }}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo size={22} />
            <span className="text-[15px] font-bold tracking-[-0.02em]">
              Kate
            </span>
          </div>
          <p className="mt-2 text-[13px]" style={{ color: "var(--bd-text-2)" }}>
            {t.footer.tagline}
          </p>
        </div>

        <nav aria-label={t.footer.sitemap}>
          <ul
            className="flex flex-wrap gap-x-6 gap-y-2 text-[13.5px]"
            style={{ color: "var(--bd-text-2)" }}
          >
            <li>
              <a href="#tuote">{t.nav.product}</a>
            </li>
            <li>
              <a href="#ominaisuudet">{t.nav.features}</a>
            </li>
            <li>
              <a href="#hinta">{t.nav.pricing}</a>
            </li>
            <li>
              <Link href={pathFor(locale, "about")}>{t.nav.about}</Link>
            </li>
            <li>
              <a href="#yhteys">{t.nav.start}</a>
            </li>
            <li>
              <Link href="/kirjaudu">{t.nav.login}</Link>
            </li>
          </ul>
        </nav>
      </div>

      <p
        className="mx-auto mt-8 max-w-5xl text-[12px]"
        style={{ color: "var(--bd-text-3)" }}
      >
        © {new Date().getFullYear()} Kate
      </p>
    </footer>
  );
}

import Link from "next/link";
import { LandingNav, Logo, Reveal } from "./nav";
import { HeroPreview, MonthPreview, TodoPreview } from "./preview";

/**
 * Budetin etusivu.
 *
 * VIISI SEKUNTIA.
 *
 * Kävijän on ymmärrettävä mikä Budet on, kenelle se on, miksi sitä
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
 * olemassa. Veroasioista sanotaan mitä Budet oikeasti tekee: se
 * valmistelee luvut ja kertoo mitä pitää tehdä, muttei lähetä
 * ilmoitusta puolestasi.
 */
export function Landing({ appHref }: { appHref: string | null }) {
  return (
    <div className="bd">
      <LandingNav appHref={appHref} />

      <main>
        <Hero appHref={appHref} />
        <Benefits />
        <Flow />
        <MonthView />
        <Todo />
        <Features />
        <Pricing appHref={appHref} />
        <FinalCta appHref={appHref} />
      </main>

      <Footer />
    </div>
  );
}

// ---------------------------------------------------------------------------

function Hero({ appHref }: { appHref: string | null }) {
  return (
    <section className="relative px-4 pb-4 pt-12 sm:px-6 sm:pt-20">
      <div className="bd-hero-glow" aria-hidden="true" />

      <div className="relative mx-auto max-w-3xl text-center">
        <p
          className="bd-rise text-[12.5px] font-semibold uppercase tracking-[0.09em]"
          style={{ color: "var(--bd-text-3)" }}
        >
          Ravintolan talous. Yhdessä paikassa.
        </p>

        <h1
          className="bd-rise bd-d1 mt-4 text-[clamp(2.1rem,6.2vw,3.6rem)] font-extrabold leading-[1.06] tracking-[-0.035em]"
          style={{ textWrap: "balance" }}
        >
          Kaikki ravintolan talousasiat.
          <br className="hidden sm:block" />{" "}
          <span style={{ color: "var(--bd-text-2)" }}>Yhdessä paikassa.</span>
        </h1>

        <p
          className="bd-rise bd-d2 mx-auto mt-5 max-w-xl text-[16px] leading-relaxed sm:text-[17px]"
          style={{ color: "var(--bd-text-2)" }}
        >
          Kuitit, kulut, myynti, kassaraportit ja kirjanpito ilman turhaa
          käsityötä. Budet pitää taloutesi järjestyksessä.
        </p>

        <div className="bd-rise bd-d3 mt-8 flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:items-center">
          <Link
            href={appHref ?? "/rekisteroidy"}
            className="bd-btn bd-btn-primary"
          >
            {appHref !== null ? "Avaa Budet" : "Aloita ilmaiseksi"}
            <span className="bd-arrow" aria-hidden="true">→</span>
          </Link>
          <a href="#tuote" className="bd-btn bd-btn-ghost">
            Tutustu Budetiin
          </a>
        </div>
      </div>

      {/* Tuotteen oma käyttöliittymä. Sivun tärkein kuva. */}
      <div
        id="tuote"
        className="bd-rise bd-d4 relative mx-auto mt-12 max-w-5xl sm:mt-16"
      >
        <div className="bd-frame">
          <HeroPreview />
        </div>

        <p
          className="mt-3.5 text-center text-[12px]"
          style={{ color: "var(--bd-text-3)" }}
        >
          Budetin käyttöliittymä. Luvut ovat esimerkkejä.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Benefits() {
  const items = [
    {
      title: "Kuitit",
      body: "Kuvaa kuitti puhelimella. Rivit, ALV ja kategoria poimitaan valmiiksi.",
      icon: <IconReceipt />,
    },
    {
      title: "Talous",
      body: "Näet mitä ravintola tienaa ja mihin raha menee — päivä ja kuukausi kerrallaan.",
      icon: <IconChart />,
    },
    {
      title: "Kirjanpito",
      body: "Kuitit ja myyntipäivät siirtyvät kirjanpitoon sitä mukaa kun ne tallennetaan.",
      icon: <IconLedger />,
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
            Sinä pyörität ravintolaa.
            <br />
            <span style={{ color: "var(--bd-text-2)" }}>
              Budet pitää numerot järjestyksessä.
            </span>
          </h2>

          <p
            className="mt-4 max-w-xl text-[15.5px] leading-relaxed"
            style={{ color: "var(--bd-text-2)" }}
          >
            Myynti, kulut, kuitit ja kassaraportit kulkevat automaattisesti
            samaan kokonaisuuteen.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {items.map((item, i) => (
            <Reveal key={item.title} delay={i * 70}>
              <div className="bd-card bd-card-hover h-full p-5">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-[11px]"
                  style={{ background: "var(--bd-bg-2)", color: "var(--bd-text)" }}
                >
                  {item.icon}
                </span>
                <h3 className="mt-4 text-[16px] font-bold tracking-[-0.01em]">
                  {item.title}
                </h3>
                <p
                  className="mt-1.5 text-[14px] leading-relaxed"
                  style={{ color: "var(--bd-text-2)" }}
                >
                  {item.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * Automaattinen tiedonkulku.
 *
 * Budetin tärkein myyntiväite yhtenä kuvana. Ketju luetaan kerran ja
 * se on ymmärretty — kappale samasta asiasta ei olisi.
 */
function Flow() {
  const steps = [
    { label: "Myynti", note: "Ilta päättyy" },
    { label: "Kassaraportti", note: "Kuvaa tai kirjaa" },
    { label: "Budet", note: "Yhdistää tiedot" },
    { label: "Kirjanpito", note: "Syntyy itsestään" },
    { label: "Raportit & ALV", note: "Valmiina" },
  ];

  return (
    <section
      className="px-4 py-20 sm:px-6 sm:py-28"
      style={{ background: "var(--bd-bg-2)", borderBlock: "1px solid var(--bd-line)" }}
    >
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <div className="text-center">
            <h2 className="text-[clamp(1.5rem,3.6vw,2.1rem)] font-extrabold tracking-[-0.03em]">
              Syötä tieto kerran.
            </h2>
            <p
              className="mx-auto mt-3 max-w-lg text-[15.5px] leading-relaxed"
              style={{ color: "var(--bd-text-2)" }}
            >
              Budet yhdistää saman tiedon automaattisesti oikeisiin paikkoihin.
            </p>
          </div>
        </Reveal>

        <Reveal delay={90}>
          <ol className="mt-10 flex flex-col items-stretch gap-2 min-[900px]:flex-row min-[900px]:items-center">
            {steps.map((step, i) => (
              <li
                key={step.label}
                className="flex items-center gap-2 min-[900px]:flex-1 min-[900px]:flex-col"
              >
                <div
                  className="flex-1 rounded-[13px] px-4 py-3.5 text-center min-[900px]:w-full min-[900px]:flex-none"
                  style={{
                    background: "#fff",
                    border: "1px solid var(--bd-line)",
                    boxShadow: "var(--bd-shadow-sm)",
                  }}
                >
                  <p className="text-[14px] font-bold tracking-[-0.01em]">{step.label}</p>
                  <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--bd-text-3)" }}>
                    {step.note}
                  </p>
                </div>

                {i < steps.length - 1 ? (
                  <span
                    className="bd-flow-arrow shrink-0 min-[900px]:hidden"
                    aria-hidden="true"
                  >
                    <Arrow />
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}

function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 8h10m0 0-3.5-3.5M13 8l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------

function MonthView() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-[clamp(1.5rem,3.6vw,2.1rem)] font-extrabold tracking-[-0.03em]">
              Tiedät aina missä mennään.
            </h2>
            <p
              className="mt-3 text-[15.5px] leading-relaxed"
              style={{ color: "var(--bd-text-2)" }}
            >
              Kuukauden myynti, kulut, tulos ja ALV samasta näkymästä.
            </p>
          </div>
        </Reveal>

        <Reveal delay={90} className="mt-10">
          <MonthPreview />
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Todo() {
  return (
    <section
      className="px-4 py-20 sm:px-6 sm:py-28"
      style={{ background: "var(--bd-bg-2)", borderBlock: "1px solid var(--bd-line)" }}
    >
      <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2 md:gap-14">
        <Reveal>
          <h2
            className="text-[clamp(1.5rem,3.6vw,2.1rem)] font-extrabold leading-[1.15] tracking-[-0.03em]"
            style={{ textWrap: "balance" }}
          >
            Budet kertoo, mitä seuraavaksi.
          </h2>
          <p
            className="mt-4 max-w-md text-[15.5px] leading-relaxed"
            style={{ color: "var(--bd-text-2)" }}
          >
            Sinun ei tarvitse muistaa kaikkea itse. Puuttuvat kuitit,
            tarkistettavat kirjaukset ja täsmäämätön ALV nousevat esiin
            silloin kun ne ovat ajankohtaisia.
          </p>
        </Reveal>

        <Reveal delay={90}>
          <TodoPreview />
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Features() {
  const features = [
    { title: "Kuitit", body: "Kuvaa, tarkista ja järjestä." },
    { title: "Kulut", body: "Seuraa mihin raha menee." },
    { title: "Myynti", body: "Päivä ja kuukausi kerrallaan." },
    { title: "Kassaraportit", body: "Päiväraportti kuvasta kirjanpitoon." },
    { title: "Kirjanpito", body: "Kaksinkertainen kirjanpito automaattisesti." },
    { title: "ALV & veroasiat", body: "Luvut valmiina, ohjeet mukana." },
    { title: "Raportit", body: "Päiväkirja, pääkirja, tuloslaskelma ja tase." },
    { title: "Työntekijät", body: "Työvuorot, työaika ja palkkalaskelmat." },
  ];

  return (
    <section id="ominaisuudet" className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <h2 className="text-[clamp(1.5rem,3.6vw,2.1rem)] font-extrabold tracking-[-0.03em]">
            Kaikki tärkeä yhdessä paikassa.
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-px overflow-hidden rounded-[20px] sm:grid-cols-2 lg:grid-cols-4"
          style={{ background: "var(--bd-line)", border: "1px solid var(--bd-line)" }}
        >
          {features.map((feature, i) => (
            <Reveal key={feature.title} delay={Math.min(i, 4) * 50}>
              <div className="h-full bg-white p-5">
                <h3 className="text-[15px] font-bold tracking-[-0.01em]">{feature.title}</h3>
                <p
                  className="mt-1.5 text-[13.5px] leading-relaxed"
                  style={{ color: "var(--bd-text-2)" }}
                >
                  {feature.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        {/*
          Veroasioista sanotaan mitä Budet oikeasti tekee.

          "Hoitaa veroasiat" olisi lupaus jota ohjelma ei lunasta:
          ilmoituksen tekee ihminen OmaVerossa. Rehellinen rajaus tässä
          on parempi kuin pettymys ensimmäisessä verokaudessa.
        */}
        <Reveal delay={120}>
          <p
            className="mt-5 max-w-2xl text-[13px] leading-relaxed"
            style={{ color: "var(--bd-text-3)" }}
          >
            Budet valmistelee ALV-luvut kirjanpidosta ja kertoo mitä sinun
            pitää tehdä. Ilmoituksen teet itse OmaVerossa — Budet ei lähetä
            sitä puolestasi.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Pricing({ appHref }: { appHref: string | null }) {
  const included = [
    "Kuitit",
    "Kulut",
    "Myynti & kassa",
    "Kirjanpito",
    "ALV & veroasiat",
    "Raportit",
    "Työntekijät",
    "Matti-avustaja",
  ];

  return (
    <section
      id="hinta"
      className="px-4 py-20 sm:px-6 sm:py-28"
      style={{ background: "var(--bd-bg-2)", borderBlock: "1px solid var(--bd-line)" }}
    >
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <div className="mx-auto max-w-lg text-center">
            <h2 className="text-[clamp(1.5rem,3.6vw,2.1rem)] font-extrabold tracking-[-0.03em]">
              Yksi hinta. Kaikki mukana.
            </h2>
            <p
              className="mt-3 text-[15.5px] leading-relaxed"
              style={{ color: "var(--bd-text-2)" }}
            >
              Ei käyttäjäkohtaisia maksuja eikä lisäosia.
            </p>
          </div>
        </Reveal>

        <Reveal delay={90}>
          <div
            className="mx-auto mt-10 max-w-md overflow-hidden rounded-[22px]"
            style={{
              background: "#fff",
              border: "1px solid var(--bd-line-2)",
              boxShadow: "var(--bd-shadow)",
            }}
          >
            <div className="p-7 text-center">
              <p className="text-[14px] font-bold tracking-[-0.01em]">Budet</p>

              <p className="mt-4">
                <span className="bd-num text-[46px] font-bold leading-none tracking-[-0.04em]">
                  79
                </span>
                <span
                  className="ml-1 text-[16px] font-semibold"
                  style={{ color: "var(--bd-text-2)" }}
                >
                  € / kk
                </span>
              </p>

              <p className="mt-2 text-[13px]" style={{ color: "var(--bd-text-3)" }}>
                790 € / vuosi · säästä 158 € vuodessa
              </p>

              <Link
                href={appHref ?? "/rekisteroidy"}
                className="bd-btn bd-btn-primary mt-6 w-full"
              >
                {appHref !== null ? "Avaa Budet" : "Aloita ilmaiseksi"}
                <span className="bd-arrow" aria-hidden="true">→</span>
              </Link>
            </div>

            <ul
              className="grid gap-x-6 gap-y-2.5 border-t px-7 py-6 sm:grid-cols-2"
              style={{ borderColor: "var(--bd-line)" }}
            >
              {included.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-[14px]">
                  <Check />
                  {item}
                </li>
              ))}
            </ul>
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

function FinalCta({ appHref }: { appHref: string | null }) {
  return (
    <section className="px-4 py-24 sm:px-6 sm:py-32">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <h2
            className="text-[clamp(1.7rem,4.4vw,2.6rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
            style={{ textWrap: "balance" }}
          >
            Ravintolan talous.
            <br />
            <span style={{ color: "var(--bd-text-2)" }}>Yksinkertaisemmin.</span>
          </h2>

          <p
            className="mx-auto mt-4 max-w-md text-[15.5px] leading-relaxed"
            style={{ color: "var(--bd-text-2)" }}
          >
            Kaikki tärkeä yhdessä paikassa.
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:items-center">
            <Link
              href={appHref ?? "/rekisteroidy"}
              className="bd-btn bd-btn-primary"
            >
              {appHref !== null ? "Avaa Budet" : "Aloita ilmaiseksi"}
              <span className="bd-arrow" aria-hidden="true">→</span>
            </Link>
            <a href="#tuote" className="bd-btn bd-btn-ghost">
              Katso miten Budet toimii
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Footer() {
  return (
    <footer
      className="px-4 py-10 sm:px-6"
      style={{ borderTop: "1px solid var(--bd-line)", background: "var(--bd-bg-2)" }}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo size={22} />
            <span className="text-[15px] font-bold tracking-[-0.02em]">Budet</span>
          </div>
          <p className="mt-2 text-[13px]" style={{ color: "var(--bd-text-2)" }}>
            Ravintolan talous yhdessä paikassa.
          </p>
        </div>

        <nav aria-label="Sivukartta">
          <ul
            className="flex flex-wrap gap-x-6 gap-y-2 text-[13.5px]"
            style={{ color: "var(--bd-text-2)" }}
          >
            <li><a href="#tuote">Tuote</a></li>
            <li><a href="#ominaisuudet">Ominaisuudet</a></li>
            <li><a href="#hinta">Hinta</a></li>
            <li><Link href="/kirjaudu">Kirjaudu</Link></li>
          </ul>
        </nav>
      </div>

      <p
        className="mx-auto mt-8 max-w-5xl text-[12px]"
        style={{ color: "var(--bd-text-3)" }}
      >
        © {new Date().getFullYear()} Budet
      </p>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Kuvakkeet
//
// Kolme kuvaketta piirrettynä tähän eikä sovelluksen sarjasta: sarja on
// mitoitettu 15–20 pikselin kokoon tiheässä näkymässä, ja tässä ne ovat
// kaksinkertaisia. Sama piirros suurennettuna näyttäisi ohuelta.

function IconReceipt() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 3.5v17l2-1.3 2 1.3 2-1.3 2 1.3 2-1.3 2 1.3v-17zM9.5 8h5M9.5 12h5M9.5 16h3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20V10M10 20V4M16 20v-7M22 20H2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconLedger() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 3h8l4 4v14H6zM14 3v4h4M9.5 12.5h5M9.5 16.5h3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

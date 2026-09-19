import Image from "next/image";
import Link from "next/link";
import { pathFor, type Locale } from "@/lib/i18n/locales";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { TEAM } from "@/lib/team";
import { HtmlLang } from "./html-lang";
import { LandingNav, Reveal } from "./nav";
import { Spotlight, Tilt } from "./effects";
import { Logo } from "@/components/brand/logo";

/**
 * Meistä-sivu.
 *
 * IHMISET, EI TARINA.
 *
 * Sivun tehtävä on vastata kysymykseen "kuka tämän takana on".
 * Pitkä yrityskertomus ei vastaa siihen; kuva ja nimi vastaavat.
 * Siksi sivu alkaa tiimistä ja tekstiä on vähän.
 */
export function About({
  appHref,
  locale,
  t,
}: {
  appHref: string | null;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <div className="bd">
      <HtmlLang locale={locale} />
      <LandingNav appHref={appHref} locale={locale} page="about" t={t} />

      <main>
        <Team t={t} />
        <Why t={t} />
        <Beliefs t={t} />
        <Cta appHref={appHref} locale={locale} t={t} />
      </main>

      <Footer locale={locale} t={t} />
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Tiimi.
 *
 * Sivun avaus: kasvot ja nimet ensin, sillä ne vastaavat kysymykseen
 * "kuka tämän takana on" nopeammin kuin mikään kertomus. Jokainen
 * henkilö saa saman kortin — samankokoinen kuva kertoo, että kyse on
 * tiimistä eikä yhdestä ihmisestä ja apulaisesta.
 *
 * Liike kertoo järjestyksen: kuva paljastuu verhon takaa ja asettuu,
 * sen takana syttyy tunnusvärien hehku, K-merkki ponnahtaa kuvan
 * kulmaan ja nimi nousee viimeisenä. Toinen kortti seuraa hieman
 * perässä. Osoittimella kuva kallistuu ja sen pinnalla liikkuu
 * heijastus.
 */
function Team({ t }: { t: Dictionary }) {
  const text = {
    founder: {
      role: t.about.founderRole,
      bio: t.about.founderBio,
      label: t.about.founderLabel,
    },
    finance: {
      role: t.about.financeRole,
      bio: t.about.financeBio,
      label: t.about.financeLabel,
    },
  };

  return (
    <section className="relative overflow-clip px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-16">
      <div className="bd-hero-glow" aria-hidden="true" />

      <div className="relative mx-auto max-w-5xl">
        <h1 className="bd-rise text-center text-[clamp(2rem,5.6vw,3.4rem)] font-extrabold leading-[1.05] tracking-[-0.04em]">
          <span className="bd-shine">{t.about.teamHeading}</span>
        </h1>

        <div className="mt-12 grid gap-14 sm:mt-16 md:grid-cols-2 md:gap-10 lg:gap-16">
          {TEAM.map((person, i) => {
            const own = text[person.key];
            return (
              <article
                key={person.name}
                className="bd-member"
                style={{ "--bd-member-delay": `${i * 260}ms` } as React.CSSProperties}
              >
                <div className="bd-portrait-stage mx-auto w-full max-w-[360px]">
                  <div className="bd-aurora" aria-hidden="true" />

                  <Tilt className="bd-portrait-tilt">
                    <div className="bd-portrait">
                      <Image
                        src={person.image}
                        alt={person.name}
                        fill
                        priority
                        unoptimized={person.image.endsWith(".svg")}
                        sizes="(max-width: 768px) 360px, 400px"
                        className="bd-portrait-img"
                      />
                      <span className="bd-portrait-glare" aria-hidden="true" />
                    </div>

                    <div className="bd-badge">
                      <Logo size={30} />
                      <span>
                        <span className="block text-[13px] font-bold leading-tight">
                          Kate
                        </span>
                        <span
                          className="block text-[11.5px] leading-tight"
                          style={{ color: "var(--bd-text-2)" }}
                        >
                          {own.label}
                        </span>
                      </span>
                    </div>
                  </Tilt>
                </div>

                <div className="mx-auto mt-8 max-w-[360px] text-center">
                  <h2 className="bd-rise bd-member-rise text-[clamp(1.7rem,3.6vw,2.2rem)] font-extrabold leading-[1.08] tracking-[-0.035em]">
                    {person.name}
                  </h2>

                  <p className="bd-rise bd-member-rise mt-3">
                    <span className="bd-role">{own.role}</span>
                  </p>

                  <p
                    className="bd-rise bd-member-rise mt-4 text-[15.5px] leading-relaxed"
                    style={{ color: "var(--bd-text-2)", textWrap: "pretty" }}
                  >
                    {own.bio}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * Miksi Kate.
 *
 * Teksti sanoo "tuoda nämä yhteen", ja kuvio näyttää sen: Katen osat
 * ovat ensin hajallaan kuin eri järjestelmissä, ja kun osio tulee
 * näkyviin, ne liukuvat kehälle K-tunnuksen ympärille ja niistä
 * vedetään viivat keskelle. Yksi ele, joka toistaa otsikon ajatuksen.
 *
 * Kehällä on vain asioita joita Katessa oikeasti on.
 */
const ORBIT_COUNT = 8;

function Why({ t }: { t: Dictionary }) {
  const parts = [
    t.features.sales,
    t.features.receipts,
    t.features.expenses,
    t.features.till,
    t.features.ledger,
    t.features.reports,
    t.features.tasks,
    t.features.files,
  ];

  /*
   * Lähtöpaikat hajallaan ja vinossa. Kiinteät arvot eivätkä
   * satunnaiset: palvelin ja selain piirtävät saman kuvan.
   */
  const scatter = [
    [-60, -150, -14],
    [150, -110, 11],
    [190, 40, -9],
    [120, 170, 16],
    [-20, 190, -12],
    [-170, 120, 9],
    [-200, -10, -18],
    [-150, -170, 13],
  ];

  return (
    <section
      className="overflow-clip px-4 py-20 sm:px-6 sm:py-28"
      style={{
        background: "var(--bd-bg-2)",
        borderBlock: "1px solid var(--bd-line)",
      }}
    >
      <div className="mx-auto grid max-w-5xl items-center gap-14 lg:grid-cols-[1fr_minmax(0,440px)] lg:gap-16">
        <Reveal>
          <p
            className="text-[12.5px] font-semibold uppercase tracking-[0.09em]"
            style={{ color: "var(--bd-text-3)" }}
          >
            {t.about.whyLabel}
          </p>

          <h2
            className="mt-4 text-[clamp(1.5rem,3.8vw,2.2rem)] font-extrabold leading-[1.14] tracking-[-0.03em]"
            style={{ textWrap: "balance" }}
          >
            {t.about.whyHeading}
          </h2>

          <p
            className="mt-5 text-[15.5px] leading-relaxed"
            style={{ color: "var(--bd-text-2)" }}
          >
            {t.about.whyBody}
          </p>

          <p className="mt-4 text-[16px] font-bold tracking-[-0.01em]">
            {t.about.whyEmphasis}
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div className="bd-orbit" aria-hidden="true">
            <div className="bd-orbit-ring" />

            <svg
              className="bd-orbit-lines"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {parts.map((_, i) => {
                const angle = (i / ORBIT_COUNT) * Math.PI * 2 - Math.PI / 2;
                return (
                  <line
                    key={i}
                    x1="50"
                    y1="50"
                    x2={(50 + Math.cos(angle) * 38).toFixed(2)}
                    y2={(50 + Math.sin(angle) * 38).toFixed(2)}
                    pathLength={1}
                    style={{ "--i": i } as React.CSSProperties}
                  />
                );
              })}
            </svg>

            <div className="bd-orbit-core">
              <Logo size={64} />
            </div>

            {parts.map((label, i) => {
              const angle = (i / ORBIT_COUNT) * Math.PI * 2 - Math.PI / 2;
              const [sx, sy, sr] = scatter[i];
              return (
                <span
                  key={label}
                  className="bd-orbit-chip"
                  style={
                    {
                      left: `${(50 + Math.cos(angle) * 38).toFixed(2)}%`,
                      top: `${(50 + Math.sin(angle) * 38).toFixed(2)}%`,
                      "--sx": `${sx}px`,
                      "--sy": `${sy}px`,
                      "--sr": `${sr}deg`,
                      "--i": i,
                    } as React.CSSProperties
                  }
                >
                  {label}
                </span>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Beliefs({ t }: { t: Dictionary }) {
  const items = [
    { title: t.about.belief1Title, body: t.about.belief1Body },
    { title: t.about.belief2Title, body: t.about.belief2Body },
    { title: t.about.belief3Title, body: t.about.belief3Body },
  ];

  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <p
            className="text-[12.5px] font-semibold uppercase tracking-[0.09em]"
            style={{ color: "var(--bd-text-3)" }}
          >
            {t.about.beliefsLabel}
          </p>
        </Reveal>

        <Spotlight className="mt-8 grid gap-4 sm:grid-cols-3">
          {items.map((item, i) => (
            <Reveal key={item.title} delay={i * 70}>
              <div className="bd-card bd-card-hover bd-spot h-full p-6">
                <p
                  className="text-[11.5px] font-semibold uppercase tracking-[0.07em]"
                  style={{ color: "var(--bd-text-3)" }}
                >
                  {item.title}
                </p>
                <p className="mt-3 text-[16px] font-semibold leading-[1.45] tracking-[-0.01em]">
                  {item.body}
                </p>
              </div>
            </Reveal>
          ))}
        </Spotlight>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * Värillinen loppuosio.
 *
 * Sivun ainoa täysvärinen pinta. Yksi per sivu riittää: kaksi tekisi
 * siitä raidan eikä päätöstä.
 *
 * Oranssi eikä tunnusvärinen punainen: punainen on painikkeiden ja
 * linkkien väri, ja kokonaisena pintana se veisi huomion siltä
 * painikkeelta joka osion sisällä on.
 */
function Cta({
  appHref,
  locale,
  t,
}: {
  appHref: string | null;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <section className="px-4 pb-20 sm:px-6 sm:pb-28">
      <Reveal>
        <div
          className="mx-auto max-w-5xl overflow-hidden px-6 py-16 text-center sm:px-10 sm:py-20"
          style={{ background: "var(--bd-orange)", borderRadius: 26 }}
        >
          <h2
            className="mx-auto max-w-2xl text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold leading-[1.12] tracking-[-0.035em]"
            style={{ color: "#fff", textWrap: "balance" }}
          >
            {t.about.ctaHeading}
          </h2>

          <p
            className="mx-auto mt-4 max-w-md text-[15.5px] leading-relaxed"
            style={{ color: "var(--bd-orange-text)" }}
          >
            {t.about.ctaBody}
          </p>

          <div className="mt-8 flex justify-center">
            <Link
              href={appHref ?? pathFor(locale, "home")}
              className="bd-btn"
              style={{ background: "#fff", color: "var(--bd-orange-strong)" }}
            >
              {appHref !== null ? t.nav.openApp : t.about.cta}
              <span className="bd-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Footer({ locale, t }: { locale: Locale; t: Dictionary }) {
  const home = pathFor(locale, "home");

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
              <Link href={`${home}#tuote`}>{t.nav.product}</Link>
            </li>
            <li>
              <Link href={`${home}#ominaisuudet`}>{t.nav.features}</Link>
            </li>
            <li>
              <Link href={`${home}#hinta`}>{t.nav.pricing}</Link>
            </li>
            <li>
              <Link href={pathFor(locale, "about")}>{t.nav.about}</Link>
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

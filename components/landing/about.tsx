import Image from "next/image";
import Link from "next/link";
import { pathFor, type Locale } from "@/lib/i18n/locales";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { TEAM, TEAM_PHOTO, TEAM_PLACEHOLDERS } from "@/lib/team";
import { HtmlLang } from "./html-lang";
import { LandingNav, Logo, Reveal } from "./nav";

/**
 * Meistä-sivu.
 *
 * IHMISET, EI TARINA.
 *
 * Sivun tehtävä on vastata kysymykseen "kuka tämän takana on".
 * Pitkä yrityskertomus ei vastaa siihen; kuva ja nimi vastaavat.
 * Siksi kuvat ovat suurina ja tekstiä on vähän.
 *
 * TYHJÄ ON REHELLINEN.
 *
 * Tiimin tiedot tulevat lib/team.ts:stä, ja se on tyhjä. Sivu kertoo
 * sen ääneen ja näyttää paikat, joten asettelu ei muutu kun tiedot
 * lisätään. Keksitty perustaja olisi tuhonnut juuri sen luottamuksen
 * jota sivu rakentaa.
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
        <Hero t={t} />
        <TeamPhoto t={t} />
        <People t={t} />
        <Why t={t} />
        <Beliefs t={t} />
        <Cta appHref={appHref} locale={locale} t={t} />
      </main>

      <Footer locale={locale} t={t} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function Hero({ t }: { t: Dictionary }) {
  return (
    <section className="relative px-4 pb-2 pt-12 sm:px-6 sm:pt-20">
      <div className="bd-hero-glow" aria-hidden="true" />

      <div className="relative mx-auto max-w-3xl">
        <p
          className="bd-rise text-[12.5px] font-semibold uppercase tracking-[0.09em]"
          style={{ color: "var(--bd-text-3)" }}
        >
          {t.about.label}
        </p>

        <h1
          className="bd-rise bd-d1 mt-4 text-[clamp(2rem,5.4vw,3.2rem)] font-extrabold leading-[1.08] tracking-[-0.035em]"
          style={{ textWrap: "balance" }}
        >
          {t.about.heading}
        </h1>

        <p
          className="bd-rise bd-d2 mt-5 max-w-2xl text-[16px] leading-relaxed sm:text-[17px]"
          style={{ color: "var(--bd-text-2)" }}
        >
          {t.about.body}
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * Yhteiskuva.
 *
 * Sivun tärkein elementti, joten se on leveä ja saa oman hengitystilan.
 * Kuvan päällä ei ole tekstiä: teksti kuvan päällä tarkoittaa että
 * kuvan pitää olla tietyn näköinen, ja silloin oikea valokuva ei enää
 * kelpaa sellaisenaan.
 */
function TeamPhoto({ t }: { t: Dictionary }) {
  return (
    <section className="px-4 pb-4 pt-8 sm:px-6 sm:pt-12">
      <div className="mx-auto max-w-5xl">
        <div className="bd-rise bd-d3">
          <div className="bd-photo bd-photo-wide">
            {TEAM_PHOTO ? (
              <Image
                src={TEAM_PHOTO}
                alt={t.about.photoAlt}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 1024px"
                style={{ objectFit: "cover" }}
              />
            ) : (
              <div className="bd-photo-empty h-full w-full">
                <p className="px-6 text-center text-[13px]" style={{ color: "var(--bd-text-3)" }}>
                  {t.about.photoPending}
                </p>
              </div>
            )}
          </div>
        </div>

        <Reveal delay={60}>
          <div className="mx-auto mt-7 max-w-xl text-center">
            <p className="text-[19px] font-bold tracking-[-0.02em] sm:text-[21px]">
              {t.about.captionA}
            </p>
            <p
              className="mt-2 text-[15px] leading-relaxed"
              style={{ color: "var(--bd-text-2)" }}
            >
              {t.about.captionB}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function People({ t }: { t: Dictionary }) {
  const empty = TEAM.length === 0;

  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <h2 className="text-[clamp(1.5rem,3.6vw,2.1rem)] font-extrabold tracking-[-0.03em]">
            {t.about.teamHeading}
          </h2>

          {empty ? (
            <p
              className="mt-3 max-w-xl text-[15px] leading-relaxed"
              style={{ color: "var(--bd-text-2)" }}
            >
              {t.about.teamPending}
            </p>
          ) : null}
        </Reveal>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {empty
            ? Array.from({ length: TEAM_PLACEHOLDERS }, (_, i) => (
                <Reveal key={i} delay={i * 70}>
                  <div>
                    <div className="bd-photo bd-photo-person bd-photo-empty" aria-hidden="true" />
                    <div className="mt-4 space-y-2" aria-hidden="true">
                      <div className="h-[14px] w-28 rounded-full" style={{ background: "var(--bd-bg-2)" }} />
                      <div className="h-[12px] w-20 rounded-full" style={{ background: "var(--bd-bg-2)" }} />
                    </div>
                  </div>
                </Reveal>
              ))
            : TEAM.map((person, i) => (
                <Reveal key={person.name} delay={i * 70}>
                  <figure>
                    <div className="bd-photo bd-photo-person">
                      <Image
                        src={person.image}
                        alt={person.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        style={{ objectFit: "cover" }}
                      />
                    </div>

                    <figcaption className="mt-4">
                      <p className="text-[16px] font-bold tracking-[-0.01em]">{person.name}</p>
                      <p className="mt-0.5 text-[13.5px]" style={{ color: "var(--bd-text-3)" }}>
                        {person.role}
                      </p>
                      <p
                        className="mt-2 text-[14px] leading-relaxed"
                        style={{ color: "var(--bd-text-2)" }}
                      >
                        {person.bio}
                      </p>
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Why({ t }: { t: Dictionary }) {
  return (
    <section
      className="px-4 py-20 sm:px-6 sm:py-28"
      style={{ background: "var(--bd-bg-2)", borderBlock: "1px solid var(--bd-line)" }}
    >
      <div className="mx-auto max-w-3xl">
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

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {items.map((item, i) => (
            <Reveal key={item.title} delay={i * 70}>
              <div className="bd-card bd-card-hover h-full p-6">
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
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * Tumma loppuosio.
 *
 * Sivun ainoa tumma pinta. Yksi per sivu riittää: kaksi tekisi siitä
 * raidan eikä päätöstä.
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
          style={{ background: "#0f1729", borderRadius: 26 }}
        >
          <h2
            className="mx-auto max-w-2xl text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold leading-[1.12] tracking-[-0.035em]"
            style={{ color: "#fff", textWrap: "balance" }}
          >
            {t.about.ctaHeading}
          </h2>

          <p
            className="mx-auto mt-4 max-w-md text-[15.5px] leading-relaxed"
            style={{ color: "#a8b3c7" }}
          >
            {t.about.ctaBody}
          </p>

          <div className="mt-8 flex justify-center">
            <Link
              href={appHref ?? pathFor(locale, "home")}
              className="bd-btn"
              style={{ background: "#fff", color: "#0f1729" }}
            >
              {appHref !== null ? t.nav.openApp : t.about.cta}
              <span className="bd-arrow" aria-hidden="true">→</span>
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
      style={{ borderTop: "1px solid var(--bd-line)", background: "var(--bd-bg-2)" }}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo size={22} />
            <span className="text-[15px] font-bold tracking-[-0.02em]">Budet</span>
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
            <li><Link href={`${home}#tuote`}>{t.nav.product}</Link></li>
            <li><Link href={`${home}#ominaisuudet`}>{t.nav.features}</Link></li>
            <li><Link href={`${home}#hinta`}>{t.nav.pricing}</Link></li>
            <li><Link href={pathFor(locale, "about")}>{t.nav.about}</Link></li>
            <li><Link href="/kirjaudu">{t.nav.login}</Link></li>
          </ul>
        </nav>
      </div>

      <p className="mx-auto mt-8 max-w-5xl text-[12px]" style={{ color: "var(--bd-text-3)" }}>
        © {new Date().getFullYear()} Budet
      </p>
    </footer>
  );
}

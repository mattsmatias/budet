"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  LOCALES,
  LOCALE_NAMES,
  pathFor,
  type Locale,
  type MarketingPage,
} from "@/lib/i18n/locales";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { Logo } from "@/components/brand/logo";

/**
 * Etusivun navigaatio.
 *
 * KELLUVA VASTA KUN ON MISTÄ KELLUA.
 *
 * Palkki alkaa läpinäkyvänä sivun päällä ja saa taustan sekä varjon
 * vasta kun sivua on vieritetty. Heti alusta asti kelluva palkki
 * piirtäisi viivan hero-otsikon yläpuolelle ennen kuin mitään on
 * mennyt sen alle.
 *
 * Puhelimessa valikko on paneeli eikä koko ruudun peite: linkkejä on
 * kourallinen, eikä niitä varten tarvitse pimentää sivua.
 */
export function LandingNav({
  appHref,
  locale,
  page,
  t,
}: {
  appHref: string | null;
  locale: Locale;
  /** Millä sivulla ollaan — kielivalinta pysyy samalla sivulla. */
  page: MarketingPage;
  t: Dictionary;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const home = pathFor(locale, "home");

  /*
   * Osioankkurit vain etusivulla.
   *
   * Meistä-sivulla #hinta ei osu mihinkään. Linkki joka vie sivun
   * yläreunaan ja jättää käyttäjän ihmettelemään on huonompi kuin
   * linkki joka vie etusivulle oikeaan kohtaan.
   */
  const anchor = (id: string) => (page === "home" ? `#${id}` : `${home}#${id}`);

  const links = [
    { href: anchor("tuote"), label: t.nav.product },
    { href: anchor("ominaisuudet"), label: t.nav.features },
    { href: anchor("hinta"), label: t.nav.pricing },
    { href: pathFor(locale, "about"), label: t.nav.about },
  ];

  return (
    <div className="sticky top-0 z-50 px-4 pt-3 sm:px-6">
      <header
        ref={panel}
        className="mx-auto max-w-6xl transition-all duration-300"
        style={{
          background: scrolled ? "rgba(255,255,255,0.82)" : "transparent",
          backdropFilter: scrolled ? "saturate(180%) blur(16px)" : "none",
          WebkitBackdropFilter: scrolled ? "saturate(180%) blur(16px)" : "none",
          border: `1px solid ${scrolled ? "var(--bd-line)" : "transparent"}`,
          borderRadius: 16,
          boxShadow: scrolled ? "var(--bd-shadow-sm)" : "none",
        }}
      >
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
          <Link
            href={home}
            className="flex shrink-0 items-center gap-2.5"
            aria-label={t.nav.home}
          >
            <Logo size={26} />
            <span className="text-[17px] font-bold tracking-[-0.02em]">
              Kate
            </span>
          </Link>

          <nav aria-label={t.nav.sections} className="hidden lg:block">
            <ul className="flex items-center gap-0.5">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="bd-navlink block whitespace-nowrap rounded-[9px] px-3 py-2 text-[14px] font-medium"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <LanguagePicker
              locale={locale}
              page={page}
              label={t.nav.language}
            />

            {appHref !== null ? (
              <Link
                href={appHref}
                className="bd-btn bd-btn-primary !py-[11px] !text-[14px]"
              >
                {t.nav.openApp}
                <span className="bd-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            ) : (
              <>
                <Link
                  href="/kirjaudu"
                  className="bd-navlink rounded-[9px] px-3 py-2 text-[14px] font-medium"
                >
                  {t.nav.login}
                </Link>
                <Link
                  href="/rekisteroidy"
                  className="bd-btn bd-btn-primary !py-[11px] !text-[14px]"
                >
                  {t.nav.start}
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] lg:hidden"
            style={{
              border: "1px solid var(--bd-line-2)",
              background: "var(--bd-card)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                d={
                  open ? "M4 4l10 10M14 4L4 14" : "M2.5 5h13M2.5 9h13M2.5 13h13"
                }
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </button>
        </div>

        {open ? (
          <div
            className="border-t px-3 pb-3 pt-2 lg:hidden"
            style={{ borderColor: "var(--bd-line)" }}
          >
            <ul className="flex flex-col">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-[10px] px-3 py-3 text-[15px] font-medium"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>

            <div className="mt-2 flex flex-col gap-2">
              {appHref !== null ? (
                <Link href={appHref} className="bd-btn bd-btn-primary w-full">
                  {t.nav.openApp}
                </Link>
              ) : (
                <>
                  <Link
                    href="/rekisteroidy"
                    className="bd-btn bd-btn-primary w-full"
                  >
                    {t.nav.start}
                  </Link>
                  <Link href="/kirjaudu" className="bd-btn bd-btn-ghost w-full">
                    {t.nav.login}
                  </Link>
                </>
              )}
            </div>

            {/*
              Kielet rivinä puhelimessa.

              Pudotusvalikko valikon sisällä olisi valikko valikossa.
              Kuusi lyhyttä nimeä mahtuu kahdelle riville, ja valittu on
              merkitty — silloin listan näkeminen riittää.
            */}
            <div
              className="mt-3 border-t pt-3"
              style={{ borderColor: "var(--bd-line)" }}
            >
              <p
                className="px-1 text-[11px] font-semibold uppercase tracking-[0.07em]"
                style={{ color: "var(--bd-text-3)" }}
              >
                {t.nav.language}
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-1">
                {LOCALES.map((code) => (
                  <li key={code}>
                    <Link
                      href={pathFor(code, page)}
                      hrefLang={code}
                      onClick={() => setOpen(false)}
                      aria-current={code === locale ? "true" : undefined}
                      className="block rounded-[9px] px-3 py-2 text-[14px] font-medium"
                      style={
                        code === locale
                          ? {
                              background: "var(--bd-accent-bg)",
                              color: "var(--bd-accent-strong)",
                            }
                          : { color: "var(--bd-text-2)" }
                      }
                    >
                      {LOCALE_NAMES[code]}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </header>
    </div>
  );
}

/**
 * Kielivalitsin työpöydällä.
 *
 * VALINTA ON LINKKI, EI LOMAKE.
 *
 * Jokainen kieli on oma osoitteensa, joten valitsin on lista linkkejä.
 * Silloin sen voi avata uuteen välilehteen, hakukone löytää kaikki
 * kielet ja valinta toimii myös ilman JavaScriptiä sen jälkeen kun
 * valikko on auki.
 */
function LanguagePicker({
  locale,
  page,
  label,
}: {
  locale: Locale;
  page: MarketingPage;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node))
        setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`${label}: ${LOCALE_NAMES[locale]}`}
        className="bd-navlink flex items-center gap-1.5 rounded-[9px] px-2.5 py-2 text-[14px] font-medium"
      >
        <Globe />
        <span className="hidden xl:inline">{LOCALE_NAMES[locale]}</span>
        <span className="xl:hidden">{locale.toUpperCase()}</span>
      </button>

      {open ? (
        <ul
          role="menu"
          className="bd-menu absolute right-0 top-[calc(100%+8px)] z-50 w-44 p-1.5"
          style={{
            background: "var(--bd-card)",
            border: "1px solid var(--bd-line)",
            borderRadius: 12,
            boxShadow: "var(--bd-shadow)",
          }}
        >
          {LOCALES.map((code) => (
            <li key={code} role="none">
              <Link
                role="menuitem"
                href={pathFor(code, page)}
                hrefLang={code}
                onClick={() => setOpen(false)}
                aria-current={code === locale ? "true" : undefined}
                className="flex items-center justify-between rounded-[8px] px-3 py-2 text-[14px]"
                style={
                  code === locale
                    ? {
                        background: "var(--bd-accent-bg)",
                        color: "var(--bd-accent-strong)",
                        fontWeight: 600,
                      }
                    : { color: "var(--bd-text)" }
                }
              >
                {LOCALE_NAMES[code]}
                {code === locale ? <Tick /> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Globe() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 1.8c1.7 1.7 2.6 3.9 2.6 6.2S9.7 12.5 8 14.2C6.3 12.5 5.4 10.3 5.4 8S6.3 3.5 8 1.8ZM2 8h12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Tick() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m3.5 8.5 3 3 6-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Paljastus vieritettäessä.
 *
 * IntersectionObserver eikä vierityskuuntelija: selain kertoo itse kun
 * elementti tulee näkyviin, eikä jokaista vierityspikseliä tarvitse
 * käsitellä JavaScriptissä.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  /*
   * Attribuutti suoraan solmuun, ei Reactin tilan kautta.
   *
   * Näkyminen on visuaalinen tehoste eikä sovelluksen tilaa: mikään muu
   * ei lue sitä, eikä sen muuttuminen tarvitse uutta renderiä.
   */
  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const show = () => node.setAttribute("data-shown", "true");

    if (typeof IntersectionObserver === "undefined") {
      show();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            show();
            observer.disconnect();
          }
        }
      },
      /*
       * Kiinteä marginaali eikä prosentti.
       *
       * -12 % tarkoittaa isolla ruudulla yli sataa pikseliä, ja sivun
       * viimeinen lyhyt elementti ei välttämättä koskaan pääse niin
       * syvälle näkymään — silloin se jäisi pysyvästi näkymättömäksi.
       */
      { rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`bd-reveal ${className}`}
      data-shown="false"
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

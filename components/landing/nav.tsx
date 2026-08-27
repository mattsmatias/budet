"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
 * viisi, ja viittä linkkiä varten ei tarvitse pimentää sivua.
 */
export function LandingNav({ appHref }: { appHref: string | null }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Esc sulkee, ja klikkaus paneelin ulkopuolelle sulkee. */
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

  const links = [
    { href: "#tuote", label: "Tuote" },
    { href: "#ominaisuudet", label: "Ominaisuudet" },
    { href: "#hinta", label: "Hinta" },
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
        <div className="flex items-center justify-between gap-4 px-3 py-2.5 sm:px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Budet, etusivu">
            <Logo />
            <span className="text-[17px] font-bold tracking-[-0.02em]">Budet</span>
          </Link>

          <nav aria-label="Sivun osiot" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="block rounded-[9px] px-3 py-2 text-[14px] font-medium transition-colors"
                    style={{ color: "var(--bd-text-2)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--bd-text)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--bd-text-2)")}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {appHref !== null ? (
              <Link href={appHref ?? "/admin"} className="bd-btn bd-btn-primary !py-[11px] !text-[14px]">
                Avaa Budet
                <span className="bd-arrow" aria-hidden="true">→</span>
              </Link>
            ) : (
              <>
                <Link
                  href="/kirjaudu"
                  className="rounded-[9px] px-3 py-2 text-[14px] font-medium transition-colors"
                  style={{ color: "var(--bd-text-2)" }}
                >
                  Kirjaudu
                </Link>
                <Link href="/rekisteroidy" className="bd-btn bd-btn-primary !py-[11px] !text-[14px]">
                  Aloita ilmaiseksi
                </Link>
              </>
            )}
          </div>

          {/* Puhelin */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Sulje valikko" : "Avaa valikko"}
            className="flex h-10 w-10 items-center justify-center rounded-[10px] md:hidden"
            style={{ border: "1px solid var(--bd-line-2)", background: "var(--bd-card)" }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                d={open ? "M4 4l10 10M14 4L4 14" : "M2.5 5h13M2.5 9h13M2.5 13h13"}
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
            className="border-t px-3 pb-3 pt-2 md:hidden"
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
                <Link href={appHref ?? "/admin"} className="bd-btn bd-btn-primary w-full">
                  Avaa Budet
                </Link>
              ) : (
                <>
                  <Link href="/rekisteroidy" className="bd-btn bd-btn-primary w-full">
                    Aloita ilmaiseksi
                  </Link>
                  <Link href="/kirjaudu" className="bd-btn bd-btn-ghost w-full">
                    Kirjaudu
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : null}
      </header>
    </div>
  );
}

/** Sama tunnus kuin sovelluksessa. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="7.5" fill="#0f1729" />
      <path
        d="M9 19V9.6c0-.3.3-.6.6-.6h4.6a3 3 0 0 1 0 6H11"
        stroke="#fff"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m14.4 15 4.6 4" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Paljastus vieritettäessä.
 *
 * IntersectionObserver eikä vierityskuuntelija: selain kertoo itse kun
 * elementti tulee näkyviin, eikä jokaista vierityspikseliä tarvitse
 * käsitellä JavaScriptissä.
 *
 * Kertaluontoinen. Elementti joka häviää ja palaa vieritettäessä
 * ylös-alas on tehoste, ei sisällön esittely.
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
   * Näkyminen on visuaalinen tehoste eikä sovelluksen tilaa: mikään
   * muu ei lue sitä, eikä sen muuttuminen tarvitse uutta renderiä.
   * Tilana se olisi myös aiheuttanut renderin jokaisesta osiosta
   * erikseen sitä mukaa kun niitä vieritetään näkyviin.
   */
  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const show = () => node.setAttribute("data-shown", "true");

    // Ilman tukea sisältö on näkyvissä. Puuttuva tehoste on parempi
    // kuin puuttuva sisältö.
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
       * Neljäkymmentä pikseliä riittää porrastukseen eikä voi jäädä
       * saavuttamatta.
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

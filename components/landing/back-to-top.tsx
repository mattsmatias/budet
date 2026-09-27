"use client";

import { useEffect, useState } from "react";

/**
 * Takaisin ylös.
 *
 * ILMESTYY VASTA KUN SILLE ON TARVETTA.
 *
 * Nappi näkyy vasta kun sivua on vieritetty reilusti ohi ensimmäisen
 * ruudun. Heti näkyvä nappi olisi ylälaidassa ehdotus palata sinne
 * missä jo ollaan, ja se peittäisi sisältöä koko matkan.
 *
 * VIERITYSTÄ EI KUUNNELLA JOKA PIKSELILTÄ.
 *
 * Kuuntelija on passiivinen eikä tee työtä itse: se merkitsee tiedon
 * ja ruudunpiirto lukee sen. Ilman tätä sivun vieritys tekisi satoja
 * tilapäivityksiä sekunnissa puhelimessa, jossa niitä on vähiten
 * varaa tehdä.
 *
 * PEHMEÄ VIERITYS ON VALINTA, EI OLETUS.
 *
 * Sivustolta poistettiin globaali scroll-behavior, koska se häiritsi
 * reitittimen omaa siirtoa. Tässä pehmeys pyydetään erikseen — ja
 * jätetään pyytämättä jos käyttäjä on kertonut haluavansa vähemmän
 * liikettä.
 */
export function BackToTop({ label }: { label: string }) {
  const [nakyy, setNakyy] = useState(false);

  useEffect(() => {
    let odottaa = false;

    const tarkista = () => {
      odottaa = false;
      setNakyy(window.scrollY > 700);
    };

    const kuuntele = () => {
      if (odottaa) return;
      odottaa = true;
      requestAnimationFrame(tarkista);
    };

    tarkista();
    window.addEventListener("scroll", kuuntele, { passive: true });
    return () => window.removeEventListener("scroll", kuuntele);
  }, []);

  const ylos = () => {
    const vahemmanLiiketta = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    window.scrollTo({ top: 0, behavior: vahemmanLiiketta ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={ylos}
      aria-label={label}
      title={label}
      className="bd-top"
      data-nakyy={nakyy ? "" : undefined}
      hidden={!nakyy}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
        <path
          d="M12 19V6M6 12l6-6 6 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

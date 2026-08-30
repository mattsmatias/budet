"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/money";

/** Loppua kohti hidastuva: nopea alku, pehmeä pysähdys. */
function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

const DURATION = 800;

export type CountFormat = "money" | "integer" | "hours";

/**
 * Muotoilu tehdään täällä eikä kutsupaikassa: funktiota ei voi välittää
 * palvelinkomponentista asiakaskomponentille, joten muoto valitaan
 * nimellä.
 */
function renderValue(value: number, format: CountFormat): string {
  switch (format) {
    case "money":
      return formatMoney(Math.round(value));
    case "hours":
      return `${Math.round(value)} h`;
    case "integer":
      return String(Math.round(value));
  }
}

/**
 * Luku joka kasvaa paikalleen.
 *
 * Kolme asiaa on hoidettava, koska animaatio näyttää matkalla lukuja
 * jotka eivät ole tosia:
 *
 * 1. Viimeinen ruutu asetetaan tarkalleen kohdearvoon eikä
 *    interpoloituun. Muuten pyöristys voisi jättää näkyviin luvun joka
 *    on sentin pielessä — ja se jäisi siihen pysyvästi.
 *
 * 2. Ruudunlukija saa vain lopullisen arvon. Animoitu teksti on
 *    aria-hidden, ja rinnalla on sr-only-elementti oikealla luvulla.
 *    Muuten avustava teknologia lukisi juoksevaa numerosarjaa.
 *
 * 3. Jos animaatiota ei ajeta — heti latauksessa, prefers-reduced-motion
 *    päällä tai arvon pysyessä samana — näytetään suoraan oikea luku.
 *    Näytettävä arvo johdetaan siitä mille kohdearvolle animaatio on
 *    käynnissä, joten vanhentunut välitulos ei voi jäädä ruutuun.
 *
 * Ensimmäisellä kerralla lähdetään nollasta. Myöhemmin — esimerkiksi
 * kuukautta vaihdettaessa — lähdetään edellisestä arvosta, koska se
 * kertoo muutoksen suunnan. Nollaan palaaminen väittäisi että kulut
 * kävivät välillä nollassa.
 */
export function CountUp({
  to,
  format,
  className,
}: {
  to: number;
  format: CountFormat;
  className?: string;
}) {
  // Kohde tallennetaan arvon rinnalle: jos ne eroavat, animaatio koskee
  // vanhaa lukua eikä sen välitulosta saa näyttää.
  const [progress, setProgress] = useState({ target: to, value: to });
  const from = useRef(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const start = from.current;
    from.current = to;

    if (start === to) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const began = performance.now();

    function step(now: number) {
      const elapsed = Math.min(1, (now - began) / DURATION);

      if (elapsed >= 1) {
        // Tarkka arvo, ei interpoloitu.
        setProgress({ target: to, value: to });
        frame.current = null;
        return;
      }

      setProgress({
        target: to,
        value: start + (to - start) * easeOut(elapsed),
      });
      frame.current = requestAnimationFrame(step);
    }

    frame.current = requestAnimationFrame(step);

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [to]);

  const shown = progress.target === to ? progress.value : to;

  return (
    <span className={className}>
      <span aria-hidden="true">{renderValue(shown, format)}</span>
      <span className="sr-only">{renderValue(to, format)}</span>
    </span>
  );
}

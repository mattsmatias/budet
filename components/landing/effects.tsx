"use client";

import { useEffect, useRef } from "react";

/**
 * Osoittimeen reagoivat pinnat.
 *
 * Kumpikin kirjoittaa vain CSS-muuttujia solmuun: ei Reactin tilaa eikä
 * uutta renderiä jokaisella hiiren liikkeellä. Itse ulkoasu on
 * landing.cssissä, ja ilman JavaScriptiä pinta on vain paikallaan.
 *
 * Kosketusnäytöllä ja vähennetyn liikkeen asetuksella kallistus jää
 * pois: sormella kallistus seuraisi vieritystä, ja se tuntuu viasta.
 */

function reduced(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Kuva joka kallistuu osoittimen mukaan ja jonka pinnalla liikkuu
 * heijastus. Kallistus on pieni (enintään 8 astetta): tarkoitus on
 * antaa kuvalle syvyyttä, ei tehdä siitä leikkikalua.
 */
export function Tilt({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function move(event: React.PointerEvent<HTMLDivElement>) {
    const node = ref.current;
    if (!node || event.pointerType !== "mouse" || reduced()) return;

    const rect = node.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    node.style.setProperty("--tilt-x", `${(0.5 - y) * 8}deg`);
    node.style.setProperty("--tilt-y", `${(x - 0.5) * 8}deg`);
    node.style.setProperty("--glare-x", `${x * 100}%`);
    node.style.setProperty("--glare-y", `${y * 100}%`);
    node.dataset.active = "true";
  }

  function leave() {
    const node = ref.current;
    if (!node) return;
    node.style.setProperty("--tilt-x", "0deg");
    node.style.setProperty("--tilt-y", "0deg");
    node.dataset.active = "false";
  }

  return (
    <div
      ref={ref}
      className={`bd-tilt ${className}`}
      onPointerMove={move}
      onPointerLeave={leave}
    >
      {children}
    </div>
  );
}

/**
 * Ruudukko jonka korteissa valo seuraa osoitinta.
 *
 * Yksi kuuntelija koko ruudukolle eikä yksi per kortti: jokainen kortti
 * laskee valon paikan omasta reunastaan, joten valo liukuu korttien
 * välillä yhtenäisenä.
 */
export function Spotlight({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function move(event: React.PointerEvent<HTMLDivElement>) {
    const node = ref.current;
    if (!node || event.pointerType !== "mouse") return;

    for (const card of node.querySelectorAll<HTMLElement>(".bd-spot")) {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
      card.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
    }
  }

  return (
    <div ref={ref} className={className} onPointerMove={move}>
      {children}
    </div>
  );
}

/** 5240 → "5 240" kapealla sitovalla välilyönnillä, kielestä riippumatta. */
function groupDigits(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Luku joka rullaa nollasta paikalleen.
 *
 * Teksti kirjoitetaan suoraan solmuun animaation ajan: Reactin tila
 * renderöisi komponentin kuusikymmentä kertaa sekunnissa. Palvelin
 * piirtää valmiin luvun, joten ilman JavaScriptiä ja hakukoneelle luku
 * on oikein.
 */
export function CountIn({
  to,
  delay = 0,
  duration = 1400,
}: {
  to: number;
  delay?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || reduced()) return;

    const format = (value: number) => groupDigits(Math.round(value));

    let frame = 0;
    let start = 0;
    node.textContent = format(0);

    const step = (now: number) => {
      if (!start) start = now;
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      node.textContent = format(to * eased);
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    const timer = window.setTimeout(() => {
      frame = requestAnimationFrame(step);
    }, delay);

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      node.textContent = format(to);
    };
  }, [to, delay, duration]);

  return (
    <span ref={ref}>
      {groupDigits(to)}
    </span>
  );
}

/**
 * Näyttämö jonka kerrokset liikkuvat osoittimen mukaan eri syvyyksillä.
 *
 * Kerros lukee muuttujat --px ja --py (-1…1) ja kertoo ne omalla
 * syvyydellään (ks. landing.css, .bd-depth). Liike on pieni: tarkoitus
 * on tuntua kolmiulotteiselta, ei heilua.
 */
export function ParallaxStage({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function move(event: React.PointerEvent<HTMLDivElement>) {
    const node = ref.current;
    if (!node || event.pointerType !== "mouse" || reduced()) return;
    const rect = node.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    node.style.setProperty("--px", x.toFixed(3));
    node.style.setProperty("--py", y.toFixed(3));
  }

  function leave() {
    const node = ref.current;
    if (!node) return;
    node.style.setProperty("--px", "0");
    node.style.setProperty("--py", "0");
  }

  return (
    <div
      ref={ref}
      id={id}
      className={className}
      onPointerMove={move}
      onPointerLeave={leave}
    >
      {children}
    </div>
  );
}

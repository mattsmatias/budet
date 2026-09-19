"use client";

import { useRef } from "react";

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

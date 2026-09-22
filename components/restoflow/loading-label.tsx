"use client";

import { useSyncExternalStore } from "react";

/**
 * Latausilmoitus ruudunlukijalle.
 *
 * MIKSI ASIAKASKOMPONENTTI EIKÄ SANAKIRJA.
 *
 * Tämä renderöidään loading.tsx:ssä, joka on Suspense-varasisältö.
 * Varasisältö ei saa itse odottaa mitään: async-komponentti siinä
 * keskeytyisi, React etsisi seuraavan rajan ylempää eikä luurankoa
 * näkyisi lainkaan. Kieltä ei siis voi hakea evästeestä täällä.
 *
 * Siksi kieli luetaan <html lang> -attribuutista, jonka juurisommittelu
 * on jo asettanut, ja teksti tulee tästä pienestä taulukosta. Yksi
 * lause ei ansaitse omaa sanakirjaansa, mutta ansaitsee kääntyä.
 */

const TEKSTIT: Record<string, string> = {
  fi: "Ladataan…",
  en: "Loading…",
  sv: "Laddar…",
  da: "Indlæser…",
  tr: "Yükleniyor…",
  et: "Laadin…",
  ar: "جارٍ التحميل…",
};

/** Kieli ei vaihdu kesken sivun: tilaus on tyhjä eikä sitä pureta. */
const tilaa = () => () => {};

const selaimessa = () =>
  document.documentElement.lang.slice(0, 2).toLowerCase();

/** Palvelimella teksti on suomeksi ja korjautuu ensimmäisessä piirrossa. */
const palvelimella = () => "fi";

export function LoadingLabel() {
  const kieli = useSyncExternalStore(tilaa, selaimessa, palvelimella);

  return (
    <span className="sr-only">{TEKSTIT[kieli] ?? TEKSTIT.fi}</span>
  );
}

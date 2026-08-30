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
 * on jo asettanut, ja teksti tulee tästä pienestä taulukosta. Kaksi
 * lausetta ei ansaitse omaa sanakirjaansa, mutta ansaitsee kääntyä.
 */

const TEKSTIT: Record<string, { yleinen: string; lounas: string }> = {
  fi: { yleinen: "Ladataan…", lounas: "Ladataan lounaslistaa…" },
  en: { yleinen: "Loading…", lounas: "Loading the lunch menu…" },
  sv: { yleinen: "Laddar…", lounas: "Laddar lunchlistan…" },
  da: { yleinen: "Indlæser…", lounas: "Indlæser frokostmenuen…" },
  tr: { yleinen: "Yükleniyor…", lounas: "Öğle menüsü yükleniyor…" },
  et: { yleinen: "Laadin…", lounas: "Laadin lõunamenüüd…" },
};

/** Kieli ei vaihdu kesken sivun: tilaus on tyhjä eikä sitä pureta. */
const tilaa = () => () => {};

const selaimessa = () =>
  document.documentElement.lang.slice(0, 2).toLowerCase();

/** Palvelimella teksti on suomeksi ja korjautuu ensimmäisessä piirrossa. */
const palvelimella = () => "fi";

export function LoadingLabel({
  kind = "yleinen",
}: {
  kind?: "yleinen" | "lounas";
}) {
  const kieli = useSyncExternalStore(tilaa, selaimessa, palvelimella);

  return (
    <span className="sr-only">{(TEKSTIT[kieli] ?? TEKSTIT.fi)[kind]}</span>
  );
}

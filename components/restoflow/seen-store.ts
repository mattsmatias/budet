"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Nähdyt tunnisteet selaimen muistissa.
 *
 * Merkki (kellon luku, Matin piste) kertoo että jotain UUTTA on
 * tullut. Kun käyttäjä on nähnyt asian, merkki katoaa, vaikka asia
 * itse jää listalle kunnes se on hoidettu. Nähty ei ole sama kuin
 * hoidettu: lista kertoo mitä on tekemättä, merkki mitä ei ole vielä
 * katsottu.
 *
 * Tieto on käyttäjän oma mukavuus eikä tietoturva-asia, joten se on
 * selaimessa. Jos muisti tyhjenee, merkki näkyy kerran turhaan.
 */

const listeners = new Set<() => void>();
const SEPARATOR = "\n";

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

/** Montako tunnistetta enintään muistetaan: vanhimmat putoavat pois. */
const LIMIT = 500;

/** Onko tunniste nähty. "*" on palvelimen oletus: kaikki nähty. */
export function seenIn(raw: string, id: string): boolean {
  return raw === "*" || raw.split(SEPARATOR).includes(id);
}

/** Uudet tunnisteet mukaan, kaksoiskappaleet pois, vanhimmat pois rajan yli. */
export function mergeSeen(raw: string, ids: string[]): string {
  const current = raw === "*" ? [] : raw.split(SEPARATOR).filter(Boolean);
  return [...new Set([...current, ...ids])].slice(-LIMIT).join(SEPARATOR);
}

export function useSeenIds(storageKey: string) {
  /* Palvelimella "kaikki nähty": merkki ei saa välähtää latauksessa. */
  const raw = useSyncExternalStore(
    subscribe,
    () => read(storageKey),
    () => "*",
  );

  const isSeen = useCallback((id: string) => seenIn(raw, id), [raw]);

  const markSeen = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      try {
        window.localStorage.setItem(storageKey, mergeSeen(read(storageKey), ids));
      } catch {
        // Estetty muisti: merkki vain näkyy uudelleen.
      }
      listeners.forEach((listener) => listener());
    },
    [storageKey],
  );

  return { isSeen, markSeen };
}

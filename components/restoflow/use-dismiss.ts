"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Sulkeminen ulkopuolisesta napautuksesta ja Esc-näppäimestä.
 *
 * Jaettu, koska sovelluksessa on useampi avautuva paneeli. Kopioituna
 * ne ajautuisivat erilleen: yksi sulkeutuisi Escistä ja toinen ei, eikä
 * kukaan huomaisi ennen kuin käyttäjä kokeilee väärää.
 *
 * Palauttaa viitteen joka kiinnitetään paneelin uloimpaan elementtiin.
 * Sen sisällä tapahtuvat napautukset eivät sulje paneelia.
 */
export function useDismiss<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
): RefObject<T | null> {
  const container = useRef<T>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!container.current?.contains(event.target as Node)) onClose();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return container;
}

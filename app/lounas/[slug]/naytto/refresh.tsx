"use client";

import { useEffect } from "react";

/** Kymmenen minuuttia. Lounaslista ei muutu useammin. */
const INTERVAL_MS = 10 * 60 * 1000;

/**
 * Näytön uudelleenlataus.
 *
 * Infonäyttö on kiinni vuorokausia kerrallaan eikä kukaan käy
 * päivittämässä sitä. Ilman tätä maanantaina julkaistu lista jäisi
 * seinälle koko viikoksi.
 *
 * Koko sivun lataus eikä osittainen päivitys. Selain joka on ollut
 * auki viikon vuotaa muistia ja kerää vanhentunutta tilaa; lataus
 * palauttaa sen alkutilaan. Näytöllä ei ole ketään jota välähdys
 * häiritsisi.
 */
export function DisplayRefresh() {
  useEffect(() => {
    const timer = setTimeout(() => window.location.reload(), INTERVAL_MS);
    return () => clearTimeout(timer);
  }, []);

  return null;
}

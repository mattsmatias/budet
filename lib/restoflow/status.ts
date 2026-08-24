/**
 * Kokonaistila yhtenä lauseena.
 *
 * Yleiskuvan ensimmäinen asia vastaa kysymykseen "onko kaikki
 * kunnossa". Jos siihen joutuu lukemaan neljä korttia ja päättelemään
 * itse, vastausta ei ole annettu.
 *
 * NELJÄS TILA ON TÄRKEIN.
 *
 * "Kaikki kunnossa" ja "ei vielä arvioitavaa" näyttävät samalta jos
 * molemmat piirretään vihreällä, mutta ne tarkoittavat eri asioita:
 * ensimmäinen on tarkastuksen tulos, toinen on se ettei tarkastusta ole
 * voitu tehdä. Tyhjä aineisto ei ole hyvä uutinen.
 */

import type { FocusItem, FocusSeverity } from "./dashboard";

export type StatusTone = "good" | "warn" | "bad" | "unknown";

export interface OverallStatus {
  tone: StatusTone;
  /** Yhden lauseen vastaus. */
  headline: string;
  /** Tarkennus, tai null jos otsikko riittää. */
  detail: string | null;
  counts: Record<FocusSeverity, number>;
}

export function overallStatus(
  items: FocusItem[],
  canJudge: boolean,
): OverallStatus {
  const counts = {
    critical: items.filter((i) => i.severity === "critical").length,
    warning: items.filter((i) => i.severity === "warning").length,
    info: items.filter((i) => i.severity === "info").length,
  };

  if (counts.critical > 0) {
    return {
      tone: "bad",
      headline:
        counts.critical === 1
          ? "1 kriittinen asia vaatii huomiota"
          : `${counts.critical} kriittistä asiaa vaatii huomiota`,
      detail: counts.warning > 0 ? `Lisäksi ${counts.warning} huomautusta.` : null,
      counts,
    };
  }

  if (counts.warning > 0) {
    return {
      tone: "warn",
      headline:
        counts.warning === 1
          ? "1 asia vaatii huomiota"
          : `${counts.warning} asiaa vaatii huomiota`,
      detail: null,
      counts,
    };
  }

  if (!canJudge) {
    return {
      tone: "unknown",
      headline: "Ei vielä arvioitavaa",
      detail:
        "Lisää kuitteja, budjetit ja päivän myynti, jotta Budet voi kertoa " +
        "miten menee. Tyhjä aineisto ei tarkoita että kaikki on kunnossa.",
      counts,
    };
  }

  return {
    tone: "good",
    headline: "Kaikki näyttää hyvältä",
    detail:
      counts.info > 0
        ? `${counts.info} ${counts.info === 1 ? "havainto" : "havaintoa"} seurattavaksi.`
        : null,
    counts,
  };
}

/**
 * Montako kohtaa listasta näytetään.
 *
 * Viisitoista varoitusta kerralla ei ole priorisointia vaan lista, ja
 * lista jonka loppuun ei jakseta lukea ei ohjaa mitään. Loput ovat
 * omalla sivullaan.
 */
export const FOCUS_LIMIT = 4;

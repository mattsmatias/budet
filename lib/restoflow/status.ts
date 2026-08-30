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
import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";

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
  t: AdminText,
): OverallStatus {
  const counts = {
    critical: items.filter((i) => i.severity === "critical").length,
    warning: items.filter((i) => i.severity === "warning").length,
    info: items.filter((i) => i.severity === "info").length,
  };

  /*
   * OTSIKON LUVUN ON VASTATTAVA LISTAA.
   *
   * Otsikko laski vain varoitukset ja jätti havainnot huomiotta,
   * vaikka ne piirtyvät samaan listaan sen alle. Kaksi varoitusta ja
   * yksi havainto tuotti otsikon "2 asiaa vaatii huomiota" kolmen
   * rivin yllä, ja lukija joutui laskemaan kumpi on oikeassa.
   */
  const rest = counts.warning + counts.info;

  if (counts.critical > 0) {
    return {
      tone: "bad",
      headline:
        counts.critical === 1
          ? t.tila.oneCritical
          : fill(t.tila.manyCritical, { maara: String(counts.critical) }),
      /*
       * "Kriittistä" rajaa otsikon luvun, joten se ei väitä olevansa
       * listan pituus — mutta loput on silti kerrottava, tai rivien
       * määrä jää selittämättä.
       */
      detail:
        rest > 0
          ? fill(rest === 1 ? t.tila.oneMore : t.tila.manyMore, {
              maara: String(rest),
            })
          : null,
      counts,
    };
  }

  if (counts.warning > 0) {
    return {
      tone: "warn",
      headline:
        rest === 1
          ? t.tila.oneNeedsAttention
          : fill(t.tila.manyNeedAttention, { maara: String(rest) }),
      detail:
        counts.info > 0
          ? fill(
              counts.info === 1 ? t.tila.checksAndOne : t.tila.checksAndMany,
              {
                tarkistettavia: String(counts.warning),
                havaintoja: String(counts.info),
              },
            )
          : null,
      counts,
    };
  }

  if (!canJudge) {
    return {
      tone: "unknown",
      headline: t.tila.nothingToJudge,
      detail: t.tila.nothingToJudgeBody,
      counts,
    };
  }

  return {
    tone: "good",
    headline: t.tila.allGood,
    /*
     * Havainto ei ole puute vaan suunta, joten otsikko pysyy
     * vihreänä — mutta luku on silti kerrottava, koska havainnot
     * piirtyvät riveiksi otsikon alle.
     */
    detail:
      counts.info > 0
        ? fill(counts.info === 1 ? t.tila.oneInsight : t.tila.manyInsights, {
            maara: String(counts.info),
          })
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

/**
 * Kokeilun tila.
 *
 * KOKEILU ON LUPAUS, JOTEN SEN PITAA NAKYA.
 *
 * Etusivu lupaa kolmekymmentä päivää ilmaiseksi. Jos sovellus ei
 * kerro montako niistä on jäljellä, lupaus muuttuu yllätykseksi sinä
 * päivänä kun laskutus alkaa — ja yllätys laskussa on se hetki jona
 * asiakas menetetään.
 *
 * TÄMÄ EI SULJE OVEA.
 *
 * Päättynyt kokeilu näkyy mutta ei estä käyttöä. Käyttöönotto on
 * tehty käsin eikä sovelluksessa ole maksutapaa, joten lukitseminen
 * jättäisi asiakkaan tilanteeseen jossa hän ei voi maksaa vaikka
 * haluaisi. Katkaisu on myynnin päätös, ja se tehdään hallinnasta
 * tilaa vaihtamalla — ei laskemalla päiviä käyttäjän selaimessa.
 */

import { daysBetween } from "./dates";

export type TrialKind = "none" | "active" | "ending" | "ended";

export interface TrialState {
  kind: TrialKind;
  /** Päiviä jäljellä. Negatiivinen kun kokeilu on ohi, null kun ei kokeilua. */
  daysLeft: number | null;
  /** Päättymispäivä sellaisenaan, tai null. */
  endsOn: string | null;
}

/** Montako päivää ennen loppua varoitus näytetään korostettuna. */
export const TRIAL_WARNING_DAYS = 7;

const NO_TRIAL: TrialState = { kind: "none", daysLeft: null, endsOn: null };

/**
 * Kokeilun tila päivänä.
 *
 * Päivä tulee kutsujalta eikä kellosta: sama luku on laskettava
 * yrityksen aikavyöhykkeellä, ja palvelin käy UTC:ssä.
 */
export function trialState(
  status: string | null,
  endsOn: string | null,
  today: string,
): TrialState {
  if (status !== "trial" || !endsOn) return NO_TRIAL;

  /*
   * Päättymispäivä on mukana kokeilussa.
   *
   * Kun kokeilu päättyy 30.9., se on voimassa koko sen päivän.
   * Toisin päin laskettuna asiakas menettäisi päivän jonka hänelle
   * luvattiin.
   */
  const daysLeft = daysBetween(today, endsOn);

  if (daysLeft < 0) return { kind: "ended", daysLeft, endsOn };
  if (daysLeft <= TRIAL_WARNING_DAYS) {
    return { kind: "ending", daysLeft, endsOn };
  }

  return { kind: "active", daysLeft, endsOn };
}

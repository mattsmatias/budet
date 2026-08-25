/**
 * Vuoron oletusajat yhdelle työntekijälle.
 *
 * Raahaus antaa vain kaksi tietoa: kuka ja mikä päivä. Kellonajat on
 * pääteltävä, tai jokainen raahattu vuoro pitäisi avata ja korjata —
 * jolloin raahaus ei säästäisi mitään.
 *
 * VIIMEISIN VUORO ON PARAS ARVAUS.
 *
 * Ravintolassa sama ihminen tekee lähes aina samaa vuoroa: kokki
 * aamuvuoroa, tarjoilija iltaa. Viimeisin on siksi osuvampi kuin mikä
 * tahansa vakioaika, ja väärinkin osuessaan se on lähempänä kuin
 * tyhjä lomake.
 *
 * ARVAUS ON NÄHTÄVÄ.
 *
 * Raahattu vuoro syntyy luonnoksena kuten muutkin, ja se näkyy
 * kalenterissa heti. Väärä aika korjataan samasta paikasta, eikä
 * mikään mene työntekijälle ennen julkaisua.
 */

import type { Shift } from "./types";

export interface ShiftDefaults {
  startTime: string;
  endTime: string;
  breakMinutes: number;
}

/**
 * Vakioarvo kun ihmisellä ei ole yhtään vuoroa.
 *
 * Kymmenestä kuuteen puolen tunnin tauolla: tavallisin päivävuoro, ja
 * sellainen jonka virheellisyyden huomaa heti.
 */
export const FALLBACK_SHIFT: ShiftDefaults = {
  startTime: "10:00",
  endTime: "18:00",
  breakMinutes: 30,
};

/**
 * Oletusajat työntekijälle hänen omista vuoroistaan.
 *
 * Peruttuja ei käytetä mallina: peruttu vuoro on nimenomaan sellainen
 * jota ei tehty, eikä sitä kannata toistaa.
 */
export function defaultShiftFor(userId: string, shifts: Shift[]): ShiftDefaults {
  const own = shifts
    .filter((shift) => shift.userId === userId && shift.cancelledAt === null)
    .sort((a, b) => b.date.localeCompare(a.date));

  const latest = own[0];
  if (!latest) return FALLBACK_SHIFT;

  return {
    startTime: latest.startTime,
    endTime: latest.endTime,
    breakMinutes: latest.breakMinutes,
  };
}

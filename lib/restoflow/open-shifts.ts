/**
 * Avoimet vuorot työntekijän näkökulmasta.
 *
 * Avoin vuoro on työvuoro jolle ei ole tekijää. Esihenkilö saa siitä
 * hälytyksen, mutta hälytys ei tee työtä: joku on otettava vuoro.
 *
 * SÄÄNTÖ ON KAHDESSA PAIKASSA, JA SE ON TARKOITUKSELLISTA.
 *
 * Tämän tiedoston vastine on claim_open_shift-funktiossa (migraatio
 * 0034). Kanta ratkaisee, tämä kertoo etukäteen. Piilotettu rivi ei ole
 * este, mutta este ilman selitystä ei ole käyttöliittymä.
 *
 * Kaikki vertailu tehdään ravintolan ajassa. Vuoron kellonajat ovat
 * paikallisia, joten UTC-hetkeen niitä ei voi verrata.
 */

import { dayIn, minutesOfDayIn } from "./clock-context";
import { shiftBounds } from "./shift-window";
import type { OpenShift, Shift, StaffPosition } from "./types";

/** Montako päivää eteenpäin avoimia vuoroja näytetään. */
export const OPEN_SHIFT_HORIZON_DAYS = 21;

/**
 * Vuorot jotka tämä työntekijä voi ottaa.
 *
 * Kolme rajausta:
 *
 *   ASEMA. Kokki ei näe salin vuoroja. Näkyvyysrajaus on parempi kuin
 *   virheilmoitus painalluksen jälkeen: sitä mitä ei näe, ei tarvitse
 *   selittää. Ilman asemaa oleva jäsen — omistaja joka ei ole
 *   työsuhteessa — ei näe mitään.
 *
 *   AIKA. Päättynyttä vuoroa ei voi ottaa. Kesken olevan voi: jos joku
 *   ei tullut, se vuoro on juuri se joka pitää saada tehdyksi.
 *
 *   PÄÄLLEKKÄISYYS. Ihminen ei voi olla kahdessa paikassa. Tämä on
 *   ainoa ehdoton este, ja siksi ainoa jonka takia vuoro katoaa
 *   listasta ilman että kukaan on tehnyt mitään väärin.
 */
export function claimableShifts(input: {
  openShifts: OpenShift[];
  myShifts: Shift[];
  position: StaffPosition | null;
  nowIso: string;
  timezone: string;
}): OpenShift[] {
  const { openShifts, myShifts, position, nowIso, timezone } = input;

  if (position === null) return [];

  const today = dayIn(timezone, nowIso);
  const nowMin = minutesOfDayIn(timezone, nowIso);
  const horizon = addDays(today, OPEN_SHIFT_HORIZON_DAYS);

  return openShifts
    .filter((open) => open.position === position)
    .filter((open) => open.date >= today && open.date <= horizon)
    .filter((open) => open.date > today || shiftBounds(open).endMin > nowMin)
    .filter((open) => !overlapsAny(open, myShifts))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

/**
 * Osuuko avoin vuoro päällekkäin jonkin omistetun vuoron kanssa?
 *
 * Vertailu tehdään minuutteina vuoron aloituspäivän keskiyöstä, jolloin
 * yön yli menevä vuoro on yksinkertaisesti pidempi eikä vaadi toista
 * päivämäärää. Naapuripäivät otetaan mukaan juuri siksi: eilen klo 22
 * alkanut vuoro jatkuu tähän aamuun.
 */
export function overlapsAny(open: OpenShift, myShifts: Shift[]): boolean {
  const bounds = shiftBounds(open);

  return myShifts.some((mine) => {
    if (mine.status === "declined") return false;

    const offset = dayOffset(mine.date, open.date);
    if (offset === null) return false;

    const other = shiftBounds(mine);
    return (
      other.startMin + offset < bounds.endMin &&
      other.endMin + offset > bounds.startMin
    );
  });
}

// ---------------------------------------------------------------------------

/**
 * Montako minuuttia toisen vuoron keskiyö on ensimmäisen keskiyöstä.
 *
 * Null kun päivät ovat kauempana kuin vuorokauden päässä: silloin
 * päällekkäisyys on mahdoton, koska yksikään vuoro ei kestä kahta
 * vuorokautta.
 */
function dayOffset(from: string, to: string): number | null {
  const diff = Math.round(
    (Date.parse(`${from}T00:00:00Z`) - Date.parse(`${to}T00:00:00Z`)) / 86_400_000,
  );

  return Math.abs(diff) <= 1 ? diff * 24 * 60 : null;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

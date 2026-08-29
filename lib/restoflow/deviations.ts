/**
 * Työvuorojen poikkeamat.
 *
 * Yksi lista siitä mikä meni toisin kuin suunniteltiin. Luvut ovat jo
 * olemassa vertailussa ja leimauksissa; tämä kokoaa niistä sen mitä
 * esihenkilön on tehtävä.
 *
 * POIKKEAMA ON MENNEISYYTTÄ.
 *
 * Tulevasta vuorosta ei voi sanoa että siitä puuttuu leimaus — se on
 * vasta edessä. Kaikki tässä koskee vuoroja jotka ovat jo alkaneet ja
 * päättyneet.
 *
 * SIETORAJAT OVAT OLEMASSA.
 *
 * Kaksi minuuttia myöhässä ei ole myöhästyminen vaan kello. Ilman
 * rajaa lista täyttyisi kohinasta, ja kohinan seasta ei löydä sitä
 * yhtä vuoroa joka jäi kokonaan tekemättä.
 */

import { shiftDurationMinutes, type ShiftComparison } from "./shifts";
import { publicationOf } from "./shift-planning";
import { dayIn } from "./clock-context";
import type { Shift, User } from "./types";

export type DeviationKind =
  "no_clock_in" | "late" | "overrun" | "shift_missing" | "overlap";

export type DeviationSeverity = "critical" | "warning";

export interface Deviation {
  kind: DeviationKind;
  severity: DeviationSeverity;
  user: User | null;
  date: string;
  /** Lyhyt kuvaus. Yksi lause, luettavissa listasta. */
  text: string;
  /** Poikkeaman suuruus minuutteina, jos sellainen on. */
  minutes: number | null;
  shiftId: string | null;
}

/** Alle tämän ei ole myöhästyminen vaan kello. */
export const LATE_TOLERANCE_MINUTES = 10;

/** Alle tämän ei ole ylitys vaan siivoaminen loppuun. */
export const OVERRUN_TOLERANCE_MINUTES = 20;

/**
 * Vuoron suunniteltu alku aikaleimana.
 *
 * Vuoron kellonaika on paikallista aikaa ja leimaus UTC:tä. Vertailu
 * tehdään siksi paikallisen ajan merkkijonon kautta: Date osaa lukea
 * "2026-09-01T10:00" paikallisena vain jos aikavyöhyke on sama, joten
 * ero lasketaan leimauksen paikallisesta kellonajasta.
 */
function plannedStartMinutes(shift: Shift): number {
  const [h, m] = shift.startTime.split(":").map(Number);
  return h * 60 + m;
}

function localMinutes(iso: string, timezone: string): number {
  const parts = new Intl.DateTimeFormat("fi-FI", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  return hour * 60 + minute;
}

/**
 * Poikkeamat menneistä vuoroista ja leimauksista.
 *
 * Perutut ja luonnokset jäävät pois: peruttua vuoroa ei ollut tarkoitus
 * tehdä, eikä luonnosta ole luvattu kenellekään.
 */
export function findDeviations(input: {
  comparisons: ShiftComparison[];
  /** Päivät joilta on leimauksia, käyttäjää kohti. */
  clockedDates: { userId: string; date: string }[];
  shifts: Shift[];
  users: User[];
  timezone: string;
}): Deviation[] {
  const found: Deviation[] = [];

  for (const row of input.comparisons) {
    const { shift, user } = row;

    if (shift.cancelledAt !== null) continue;
    if (publicationOf(shift) === "draft") continue;

    /*
     * JÄLKIKÄTEEN LISÄTTY VUORO EI VOI ODOTTAA LEIMAUSTA.
     *
     * Kuukauden vuorot lisätään usein jälkikäteen: kirjanpitoa varten,
     * tai kun suunnittelu otetaan käyttöön kesken kuun. Kukaan ei ole
     * voinut leimata sisään vuoroon jota ei ollut olemassa silloin kun
     * työ olisi tehty.
     *
     * Ilman tätä yksi toistuvien vuorojen luonti tuottaa yhtä monta
     * "ei leimausta" -poikkeamaa kuin menneitä päiviä osui jaksoon —
     * ja ne työntävät todelliset poikkeamat listan ulkopuolelle.
     *
     * Päällekkäisyydet tarkistetaan silti: ne ovat suunnitteluvirheitä
     * eivätkä riipu siitä milloin rivi kirjattiin.
     */
    if (isRetroactive(shift, input.timezone)) continue;

    /*
     * Ei leimausta lainkaan.
     *
     * Vakavin poikkeama: vuoro oli luvattu, mutta työaikaa ei ole.
     * Joko työntekijä ei tullut tai leimaus jäi tekemättä — kumpikin
     * vaatii ihmisen selvittämään.
     */
    if (row.actualStart === null) {
      found.push({
        kind: "no_clock_in",
        severity: "critical",
        user: user ?? null,
        date: shift.date,
        text: `${user?.name ?? "Tuntematon"} ei leimannut sisään vuoroon ${shift.startTime}–${shift.endTime}.`,
        minutes: null,
        shiftId: shift.id,
      });
      continue;
    }

    const late =
      localMinutes(row.actualStart, input.timezone) -
      plannedStartMinutes(shift);

    if (late >= LATE_TOLERANCE_MINUTES) {
      found.push({
        kind: "late",
        severity: "warning",
        user: user ?? null,
        date: shift.date,
        text: `${user?.name ?? "Tuntematon"} myöhästyi ${late} min vuorosta ${shift.startTime}.`,
        minutes: late,
        shiftId: shift.id,
      });
    }

    const overrunMinutes = Math.round(row.varianceMs / 60000);

    if (overrunMinutes >= OVERRUN_TOLERANCE_MINUTES) {
      found.push({
        kind: "overrun",
        severity: "warning",
        user: user ?? null,
        date: shift.date,
        text: `${user?.name ?? "Tuntematon"} ylitti suunnitellun ajan ${overrunMinutes} min vuorossa ${shift.startTime}–${shift.endTime}.`,
        minutes: overrunMinutes,
        shiftId: shift.id,
      });
    }
  }

  /*
   * Työtä ilman vuoroa.
   *
   * Leimaus päivälle jolle ei ole vuoroa tarkoittaa joko puuttuvaa
   * suunnitelmaa tai väärää päivää. Palkka lasketaan leimauksista,
   * joten tämä näkyy suoraan kuluissa ilman että kukaan päätti niin.
   */
  const shiftDays = new Set(
    input.shifts
      .filter((shift) => shift.cancelledAt === null)
      .map((shift) => `${shift.userId}|${shift.date}`),
  );

  for (const clocked of input.clockedDates) {
    if (shiftDays.has(`${clocked.userId}|${clocked.date}`)) continue;

    const user = input.users.find((u) => u.id === clocked.userId) ?? null;

    found.push({
      kind: "shift_missing",
      severity: "critical",
      user,
      date: clocked.date,
      text: `${user?.name ?? "Tuntematon"} teki työaikaa ilman työvuoroa.`,
      minutes: null,
      shiftId: null,
    });
  }

  /*
   * Vakavin ensin, sitten uusin.
   *
   * Lista luetaan ylhäältä ja se katkeaa siihen mihin aika loppuu.
   * Silloin ylimmäisenä on oltava se joka pitää selvittää.
   */
  return found.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    return b.date.localeCompare(a.date);
  });
}

/** Kuinka pitkä vuoro oli suunniteltu. Käytetään otsikoissa. */
export function plannedLabel(shift: Shift): string {
  const minutes = shiftDurationMinutes(shift);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export const DEVIATION_LABELS: Record<DeviationKind, string> = {
  no_clock_in: "Ei leimausta",
  late: "Myöhästyminen",
  overrun: "Ylitys",
  shift_missing: "Työvuoro puuttuu",
  overlap: "Päällekkäinen vuoro",
};

/**
 * Kirjattiinko vuoro vasta sen päivän jälkeen?
 *
 * Vertailu tehdään päivän tarkkuudella ravintolan aikavyöhykkeellä.
 * Saman päivän aikana lisätty vuoro ei ole jälkikäteinen: illan
 * vuoro voidaan hyvinkin kirjata aamulla, ja siihen leimataan
 * normaalisti.
 */
export function isRetroactive(shift: Shift, timezone: string): boolean {
  return dayIn(timezone, shift.createdAt) > shift.date;
}

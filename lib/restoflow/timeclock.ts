/**
 * Työajan laskenta.
 *
 * Tila johdetaan AINA tapahtumista, ei tallenneta erikseen. Jos tila
 * tallennettaisiin, se voisi ajautua eri linjalle kuin tapahtumat — ja
 * ristiriidassa työntekijän palkka on väärin.
 *
 * Nykyhetki annetaan parametrina eikä lueta kellosta. Muuten funktiota ei
 * voisi testata eikä sama syöte tuottaisi samaa tulosta.
 */

import { dayIn, timeIn } from "./clock-context";
import type { ClockEvent, ClockEventType, ClockState } from "./types";

/** Tapahtumat aikajärjestyksessä, vanhin ensin. */
export function sortEvents(events: ClockEvent[]): ClockEvent[] {
  return [...events].sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * Mikä siirtymä on sallittu missäkin tilassa.
 *
 * Ilman tätä käyttöliittymä voisi tarjota "ULOS" työntekijälle joka ei ole
 * kirjautunut sisään, ja laskenta saisi tapahtumajonon josta ei voi päätellä
 * mitään järkevää.
 */
export function allowedActions(state: ClockState): ClockEventType[] {
  switch (state) {
    case "off":
      return ["in"];
    case "working":
      return ["break_start", "out"];
    case "on_break":
      return ["break_end", "out"];
  }
}

export function canPerform(state: ClockState, action: ClockEventType): boolean {
  return allowedActions(state).includes(action);
}

/** Tila tapahtumien jälkeen. */
export function currentState(events: ClockEvent[]): ClockState {
  let state: ClockState = "off";

  for (const event of sortEvents(events)) {
    switch (event.type) {
      case "in":
        if (state === "off") state = "working";
        break;
      case "break_start":
        if (state === "working") state = "on_break";
        break;
      case "break_end":
        if (state === "on_break") state = "working";
        break;
      case "out":
        state = "off";
        break;
    }
  }

  return state;
}

export interface WorkedTime {
  /** Tehty työaika millisekunteina, tauot vähennettyinä. */
  workedMs: number;
  /** Taukoaika millisekunteina. */
  breakMs: number;
  /** Käynnissä olevan jakson alku, jos työntekijä on juuri nyt töissä. */
  runningSince: string | null;
}

/**
 * Laskee tehdyn työajan tapahtumista.
 *
 * Tauko vähentää työaikaa. Keskeneräinen jakso lasketaan mukaan annettuun
 * hetkeen asti — muuten käynnissä oleva työvuoro näyttäisi nollaa.
 */
export function computeWorked(events: ClockEvent[], nowIso: string): WorkedTime {
  const sorted = sortEvents(events);
  const now = Date.parse(nowIso);

  let workedMs = 0;
  let breakMs = 0;
  let state: ClockState = "off";
  let segmentStart: number | null = null;
  let runningSince: string | null = null;

  const close = (endMs: number, into: "work" | "break") => {
    if (segmentStart === null) return;
    const delta = Math.max(0, endMs - segmentStart);
    if (into === "work") workedMs += delta;
    else breakMs += delta;
    segmentStart = null;
  };

  for (const event of sorted) {
    const at = Date.parse(event.at);
    if (Number.isNaN(at)) continue;

    switch (event.type) {
      case "in":
        if (state === "off") {
          state = "working";
          segmentStart = at;
          runningSince = event.at;
        }
        break;

      case "break_start":
        if (state === "working") {
          close(at, "work");
          state = "on_break";
          segmentStart = at;
        }
        break;

      case "break_end":
        if (state === "on_break") {
          close(at, "break");
          state = "working";
          segmentStart = at;
          runningSince = event.at;
        }
        break;

      case "out":
        if (state === "working") close(at, "work");
        else if (state === "on_break") close(at, "break");
        state = "off";
        runningSince = null;
        break;
    }
  }

  // Keskeneräinen jakso annettuun hetkeen asti.
  if (state === "working") close(now, "work");
  else if (state === "on_break") close(now, "break");

  return {
    workedMs,
    breakMs,
    runningSince: state === "working" ? runningSince : null,
  };
}

export interface WorkSegment {
  /** Jakson alku ja loppu millisekunteina epookista. */
  startMs: number;
  endMs: number;
}

/**
 * Työjaksot, tauot pois leikattuina.
 *
 * `computeWorked` antaa kokonaiskeston, mikä riittää tuntimäärään mutta
 * ei palkkalisiin: iltalisä maksetaan niiltä minuuteilta jotka osuvat
 * ikkunaan, eikä tauolla vietetty tunti ole niitä. Jaksot kertovat
 * milloin työtä oikeasti tehtiin.
 *
 * Keskeneräinen jakso päättyy annettuun hetkeen samoin kuin
 * `computeWorked`issa — muuten käynnissä oleva vuoro näyttäisi nollaa.
 */
export function workSegments(events: ClockEvent[], nowIso: string): WorkSegment[] {
  const sorted = sortEvents(events);
  const now = Date.parse(nowIso);

  const segments: WorkSegment[] = [];
  let state: ClockState = "off";
  let startMs: number | null = null;

  const close = (endMs: number) => {
    if (startMs !== null && endMs > startMs) segments.push({ startMs, endMs });
    startMs = null;
  };

  for (const event of sorted) {
    const at = Date.parse(event.at);
    if (Number.isNaN(at)) continue;

    switch (event.type) {
      case "in":
        if (state === "off") {
          state = "working";
          startMs = at;
        }
        break;

      case "break_start":
        if (state === "working") {
          close(at);
          state = "on_break";
        }
        break;

      case "break_end":
        if (state === "on_break") {
          state = "working";
          startMs = at;
        }
        break;

      case "out":
        if (state === "working") close(at);
        state = "off";
        startMs = null;
        break;
    }
  }

  if (state === "working") close(now);

  return segments;
}

/**
 * Tapahtumat yhdeltä päivältä ravintolan ajassa.
 *
 * Vyöhyke on pakollinen eikä oletusarvoinen. Aiemmin päivä poimittiin
 * ISO-merkkijonosta, mikä on UTC: Helsingissä klo 02:15 tehty leimaus
 * kirjautui edelliselle päivälle. Oletusarvo olisi jättänyt saman virhen
 * voimaan kaikkialle missä sitä ei muisteta antaa.
 */
export function eventsOnDate(
  events: ClockEvent[],
  isoDate: string,
  timezone: string,
): ClockEvent[] {
  return sortEvents(events).filter((e) => dayIn(timezone, e.at) === isoDate);
}

/** Tapahtumat aikaväliltä, molemmat päät mukaan lukien. */
export function eventsBetween(
  events: ClockEvent[],
  fromDate: string,
  toDate: string,
  timezone: string,
): ClockEvent[] {
  return sortEvents(events).filter((e) => {
    const day = dayIn(timezone, e.at);
    return day >= fromDate && day <= toDate;
  });
}

/**
 * Päivän työaika. Lasketaan päiväkohtaisista tapahtumista, jotta yön yli
 * jatkuva vuoro ei sekoita edellisen päivän summaa.
 */
export function workedOnDate(
  events: ClockEvent[],
  isoDate: string,
  nowIso: string,
  timezone: string,
): WorkedTime {
  return computeWorked(eventsOnDate(events, isoDate, timezone), nowIso);
}

export function workedBetween(
  events: ClockEvent[],
  fromDate: string,
  toDate: string,
  nowIso: string,
  timezone: string,
): WorkedTime {
  // Päivä kerrallaan, jotta keskeneräiset jaksot rajautuvat oikein.
  let workedMs = 0;
  let breakMs = 0;

  for (const day of datesInRange(fromDate, toDate)) {
    const result = workedOnDate(events, day, nowIso, timezone);
    workedMs += result.workedMs;
    breakMs += result.breakMs;
  }

  return { workedMs, breakMs, runningSince: null };
}

export function datesInRange(fromDate: string, toDate: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);

  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

// ---------------------------------------------------------------------------
// Muotoilu
// ---------------------------------------------------------------------------

/** "7 h 24 min" */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${String(minutes).padStart(2, "0")} min`;
}

/** "04:37:21" — suureen laskuriin. */
export function formatClock(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** "09:02" ravintolan ajassa. */
export function formatTimeOfDay(iso: string, timezone: string): string {
  return timeIn(timezone, iso);
}

/** Tunteina desimaalilukuna, palkkalaskentaa varten. */
export function msToHours(ms: number): number {
  return Math.max(0, ms) / 3600000;
}

/**
 * Henkilöstökulu sentteinä.
 *
 * Pyöristetään vasta lopussa: minuuttikohtainen pyöristys kertyisi
 * kuukaudessa merkittäväksi virheeksi.
 */
export function staffCostCents(ms: number, hourlyRateCents: number): number {
  return Math.round(msToHours(ms) * hourlyRateCents);
}

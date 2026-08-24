/**
 * Palvelupäivä.
 *
 * RAVINTOLAN AIKAYKSIKKÖ EI OLE KUUKAUSI.
 *
 * Budet on tähän asti näyttänyt kuukauden: kulut, budjetit, palkat.
 * Se on kirjanpitäjän aikayksikkö. Ravintoloitsijan aikayksikkö on
 * palvelupäivä — prep, lounas, ilta, sulku — ja hänen kysymyksensä
 * kello 14 on "kuka on salissa ja kuka on myöhässä", ei "paljonko
 * elokuussa on kulunut".
 *
 * Tämä moduuli kääntää vuorot ja leimaukset yhdeksi aikajanaksi:
 * kaistat aseman mukaan, palkit vuoroista, tila leimauksista.
 *
 * KAIKKI RAVINTOLAN AJASSA.
 *
 * Vuoron kellonajat ovat paikallisia ("14:00"). Minuutit lasketaan
 * paikallisesta keskiyöstä, ja nykyhetki luetaan samaan yksikköön.
 * Tämä on sama ansa joka on osunut Budetiin kuudesti.
 */

import { dayIn, minutesOfDayIn } from "./clock-context";
import { shiftBounds } from "./shift-window";
import { currentState, eventsOnDate } from "./timeclock";
import {
  POSITION_LABELS,
  type ClockEvent,
  type Shift,
  type StaffPosition,
  type User,
} from "./types";

/**
 * Vuoron alusta tämän jälkeen puuttuva leimaus on myöhässä.
 *
 * Sama armoaika kuin poikkeamissa (operations.ts). Kahta lukua samasta
 * säännöstä ei kannata pitää synkronissa käsin, mutta tämä on
 * esitystapa eikä hälytys — jos ne joskus eroavat, se on tietoinen
 * päätös eikä unohdus.
 */
const LATE_MINUTES = 20;

/** Vuoron lopusta tämän jälkeen yhä auki oleva työaika on venynyt. */
const OVERRUN_MINUTES = 60;

/** Kuinka paljon tyhjää aikajanan molempiin päihin. */
const PADDING_MINUTES = 60;

export type ServiceState =
  /** Vuoro ei ole vielä alkanut. */
  | "upcoming"
  /** Vuoro alkoi, leimausta ei ole. */
  | "late"
  /** Töissä juuri nyt. */
  | "working"
  /** Tauolla. */
  | "break"
  /** Vuoro ohi ja ulos leimattu. */
  | "done"
  /** Vuoro ohi mutta työaika yhä auki. */
  | "overrun"
  /** Vuoro on mennyt eikä siitä ole leimausta lainkaan. */
  | "missed";

export interface ServiceBar {
  shiftId: string;
  userId: string;
  name: string;
  initials: string;
  /** Minuuttia paikallisesta keskiyöstä. Loppu voi ylittää 1440. */
  startMin: number;
  endMin: number;
  /** "14:00–22:00" */
  label: string;
  state: ServiceState;
  /** Milloin sisään leimattiin, minuutteina. Null jos ei leimattu. */
  clockedInMin: number | null;
}

export interface ServiceLane {
  position: StaffPosition;
  label: string;
  bars: ServiceBar[];
}

export interface ServiceDay {
  /** Aikajanan ikkuna, tasatunneiksi pyöristettynä. */
  fromMin: number;
  toMin: number;
  /** Nykyhetki minuutteina, tai null jos katsotaan muuta päivää. */
  nowMin: number | null;
  lanes: ServiceLane[];
  /** Montako on töissä juuri nyt. */
  onFloor: number;
  /** Montako vuoroa alkaa vielä tänään. */
  upcoming: number;
  /** Montako vaatii huomiota: myöhässä tai venynyt. */
  attention: number;
}

/**
 * Päivän aikajana.
 *
 * Null kun päivälle ei ole yhtään vuoroa. Tyhjä aikajana kertoisi
 * ravintolan olevan kiinni, mikä on eri asia kuin se ettei vuoroja ole
 * vielä merkitty — ja näkymän on sanottava kumpi.
 */
export function buildServiceDay(input: {
  date: string;
  shifts: Shift[];
  clockEvents: ClockEvent[];
  users: User[];
  nowIso: string;
  timezone: string;
}): ServiceDay | null {
  const { date, shifts, clockEvents, users, nowIso, timezone } = input;

  const today = dayIn(timezone, nowIso);
  const isToday = date === today;
  const nowMin = isToday ? minutesOfDayIn(timezone, nowIso) : null;

  const mine = shifts.filter((s) => s.date === date && s.status !== "declined");
  if (mine.length === 0) return null;

  const byUser = new Map(users.map((u) => [u.id, u]));

  const bars: ServiceBar[] = mine.map((shift) => {
    const { startMin, endMin } = shiftBounds(shift);
    const user = byUser.get(shift.userId);

    const events = eventsOnDate(
      clockEvents.filter((e) => e.userId === shift.userId),
      date,
      timezone,
    );

    const firstIn = events.find((e) => e.type === "in") ?? null;

    return {
      shiftId: shift.id,
      userId: shift.userId,
      name: user?.name ?? "Työntekijä",
      initials: user?.initials ?? "?",
      startMin,
      endMin,
      label: `${shift.startTime}–${shift.endTime}`,
      state: stateOf({ startMin, endMin, nowMin, events }),
      clockedInMin: firstIn ? minutesOfDayIn(timezone, firstIn.at) : null,
    };
  });

  /*
   * Kaistat vain niistä asemista joilla on vuoroja.
   *
   * Neljä kaistaa joista kaksi on tyhjiä näyttäisi siltä että
   * keittiöstä puuttuu väkeä — vaikka keittiö olisi kiinni koko
   * päivän.
   */
  const order: StaffPosition[] = ["manager", "waiter", "kitchen", "cleaning"];
  const lanes: ServiceLane[] = order
    .map((position) => ({
      position,
      label: POSITION_LABELS[position],
      bars: bars
        .filter((bar) => positionOf(byUser.get(bar.userId)) === position)
        .sort((a, b) => a.startMin - b.startMin),
    }))
    .filter((lane) => lane.bars.length > 0);

  // Työntekijä jolta puuttuu asema päätyy tarjoilijakaistalle, jottei
  // hänen vuoronsa katoa aikajanalta kokonaan.
  const placed = new Set(lanes.flatMap((l) => l.bars.map((b) => b.shiftId)));
  const orphans = bars.filter((bar) => !placed.has(bar.shiftId));

  if (orphans.length > 0) {
    const waiters = lanes.find((l) => l.position === "waiter");
    if (waiters) waiters.bars.push(...orphans);
    else
      lanes.push({
        position: "waiter",
        label: POSITION_LABELS.waiter,
        bars: orphans,
      });
  }

  const starts = bars.map((b) => b.startMin);
  const ends = bars.map((b) => b.endMin);

  return {
    fromMin: floorHour(Math.min(...starts) - PADDING_MINUTES),
    toMin: ceilHour(Math.max(...ends) + PADDING_MINUTES),
    nowMin,
    lanes,
    onFloor: bars.filter((b) => b.state === "working" || b.state === "break").length,
    upcoming: bars.filter((b) => b.state === "upcoming").length,
    attention: bars.filter((b) => b.state === "late" || b.state === "overrun").length,
  };
}

/** Osuus 0–1 aikajanan leveydestä. */
export function positionOn(day: ServiceDay, minute: number): number {
  const span = day.toMin - day.fromMin || 1;
  return Math.min(1, Math.max(0, (minute - day.fromMin) / span));
}

/** Tasatunnit aikajanan alle. */
export function hourMarks(day: ServiceDay, step = 2): number[] {
  const marks: number[] = [];
  for (let m = day.fromMin; m <= day.toMin; m += step * 60) marks.push(m);
  return marks;
}

/** "14:00" minuuteista. Yli vuorokauden menevä kiertää ympäri. */
export function clockLabel(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}.${String(m).padStart(2, "0")}`;
}

export const SERVICE_STATE_LABELS: Record<ServiceState, string> = {
  upcoming: "Tulossa",
  late: "Ei leimannut",
  working: "Töissä",
  break: "Tauolla",
  done: "Tehty",
  overrun: "Yhä auki",
  missed: "Ei leimausta",
};

// ---------------------------------------------------------------------------

/**
 * Kuinka aikaisin leimaus luetaan tämän vuoron leimaukseksi.
 *
 * Leimaustila on henkilökohtainen, ei vuorokohtainen: kanta tietää
 * että Minna on sisällä, muttei kumpaan hänen kahdesta vuorostaan se
 * kuuluu. Ilman tätä rajaa illan vuoro näyttäisi "töissä" jo
 * iltapäivällä, ja sama ihminen laskettaisiin saliin kahdesti.
 */
const EARLY_ARRIVAL_MINUTES = 60;

/**
 * Vuoron tila.
 *
 * Vuoron ikkunan sisällä leimaus voittaa suunnitelman: jos joku on
 * kirjautuneena sisään, hän on töissä riippumatta siitä mitä
 * suunnitelmassa lukee. Suunnitelma kertoo mitä piti tapahtua, leimaus
 * mitä tapahtui — ja näkymän tehtävä on näyttää jälkimmäinen.
 *
 * Ikkunan ulkopuolella ratkaisee kello. Muuten yksi leimaus värjäisi
 * kaikki saman ihmisen vuorot samalla tilalla.
 */
function stateOf(input: {
  startMin: number;
  endMin: number;
  nowMin: number | null;
  events: ClockEvent[];
}): ServiceState {
  const { startMin, endMin, nowMin, events } = input;
  const clock = currentState(events);

  // Mennyt päivä: vain leimaukset kertovat mitä tapahtui.
  if (nowMin === null) {
    if (events.length === 0) return "missed";
    return clock === "off" ? "done" : "overrun";
  }

  // Ennen ikkunaa: vuoro ei ole vielä ajankohtainen.
  if (nowMin < startMin - EARLY_ARRIVAL_MINUTES) return "upcoming";

  // Vuoron jälkeen: auki oleva työaika venyy, muuten tehty tai jäi tekemättä.
  if (nowMin >= endMin) {
    if (clock === "off") return events.length > 0 ? "done" : "missed";
    return nowMin - endMin >= OVERRUN_MINUTES ? "overrun" : "working";
  }

  if (clock === "on_break") return "break";
  if (clock === "working") return "working";
  if (events.length > 0) return "done";

  if (nowMin < startMin) return "upcoming";
  return nowMin - startMin >= LATE_MINUTES ? "late" : "upcoming";
}

function positionOf(user: User | undefined): StaffPosition | null {
  return user?.position ?? null;
}

function floorHour(minutes: number): number {
  return Math.max(0, Math.floor(minutes / 60) * 60);
}

function ceilHour(minutes: number): number {
  return Math.ceil(minutes / 60) * 60;
}

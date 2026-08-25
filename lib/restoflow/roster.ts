/**
 * Kuukauden työvuorolista.
 *
 * Vuorolista on ravintolan seinällä, ei näytöllä. Se kertoo yhdellä
 * silmäyksellä kuka on töissä minäkin päivänä, ja siihen osoitetaan
 * sormella kesken illan. Siksi tämä rakentaa ruudukon — ihmiset
 * riveinä, päivät sarakkeina — eikä aikajärjestyksessä olevaa listaa,
 * jollainen työvuorosivulla jo on.
 *
 * TÄMÄ EI LASKE PALKKAA.
 *
 * Tunnit ovat suunniteltuja, eivät toteutuneita. Toteutunut aika tulee
 * leimauksista ja näkyy työvuorosivun vertailussa; palkka lasketaan
 * palkkanäkymässä. Sama luku kahdessa merkityksessä olisi pahin
 * mahdollinen sekaannus juuri tässä aineistossa.
 */

import { shiftDurationMinutes } from "./shifts";
import type { AbsenceKind, Absence, OpenShift, Shift, ShiftStatus, User } from "./types";

export interface RosterShift {
  startTime: string;
  endTime: string;
  status: ShiftStatus;
  minutes: number;
}

export interface RosterCell {
  date: string;
  /** Päivän vuorot. Sama ihminen voi tehdä kaksi vuoroa samana päivänä. */
  shifts: RosterShift[];
  /** Poissaolo joka osuu tähän päivään, tai null. */
  absence: AbsenceKind | null;
}

export interface RosterRow {
  /** null tarkoittaa avoimia vuoroja: ne eivät ole kenenkään. */
  user: User | null;
  cells: RosterCell[];
  /** Suunnitellut minuutit. Ei sisällä vuoroja joista on kieltäydytty. */
  plannedMinutes: number;
  shiftCount: number;
}

export interface RosterDay {
  date: string;
  /** Kuukaudenpäivä 1–31. */
  day: number;
  /** 1 = maanantai … 7 = sunnuntai. */
  weekday: number;
  weekend: boolean;
}

export interface Roster {
  month: string;
  days: RosterDay[];
  rows: RosterRow[];
  /** Montako ihmistä on vuorossa kunakin päivänä, päiväjärjestyksessä. */
  perDay: number[];
  plannedMinutes: number;
}

const WEEKDAY_NAMES = ["ma", "ti", "ke", "to", "pe", "la", "su"];

/** "ma", "ti" … listan otsikkoriville. */
export function weekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday - 1] ?? "";
}

/**
 * Kuukauden päivät.
 *
 * UTC-keskipäivä, ei paikallinen keskiyö. Keskiyöstä laskettuna
 * kesäaika siirtäisi päivän edelliseksi niissä aikavyöhykkeissä joissa
 * siirtymä on negatiivinen — ja vuorolista siirtyisi päivän verran.
 */
export function monthDays(month: string): RosterDay[] {
  const [year, m] = month.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(m)) return [];

  const count = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const days: RosterDay[] = [];

  for (let day = 1; day <= count; day += 1) {
    const date = new Date(Date.UTC(year, m - 1, day, 12));
    // getUTCDay(): 0 = sunnuntai. Suomessa viikko alkaa maanantaista.
    const weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();

    days.push({
      date: `${month}-${String(day).padStart(2, "0")}`,
      day,
      weekday,
      weekend: weekday >= 6,
    });
  }

  return days;
}

/**
 * Osuuko poissaolojakso tähän päivään.
 *
 * Jakso on suljettu molemmista päistä: yhden päivän poissaolossa
 * date ja endDate ovat sama päivä.
 */
function absenceOn(absences: Absence[], userId: string, date: string): AbsenceKind | null {
  const hit = absences.find(
    (absence) =>
      absence.userId === userId && absence.date <= date && absence.endDate >= date,
  );

  return hit?.kind ?? null;
}

/**
 * Kuukauden vuorolista.
 *
 * KIELTÄYTYMINEN NÄKYY MUTTEI LASKE TUNTEJA.
 *
 * Vuoro josta on kieltäydytty on yhä listalla, koska se on aukko joka
 * pitää täyttää. Sen tunteja ei kuitenkaan lasketa kenenkään
 * summaan — kukaan ei ole lupautunut tekemään sitä, ja summattuna se
 * väittäisi työvoimaa olevan enemmän kuin on.
 *
 * MUKANA VAIN NE JOILLA ON JOTAIN.
 *
 * Rivi ihmisestä jolla ei ole kuukaudessa yhtään vuoroa eikä
 * poissaoloa on tyhjä rivi paperilla. Vapaana olevat näkee vuoron
 * luonnissa, jossa lista on koko henkilöstö.
 */
export function buildRoster(input: {
  month: string;
  users: User[];
  shifts: Shift[];
  openShifts: OpenShift[];
  absences: Absence[];
}): Roster {
  const days = monthDays(input.month);
  const dates = new Set(days.map((d) => d.date));

  const shifts = input.shifts.filter((shift) => dates.has(shift.date));
  const openShifts = input.openShifts.filter((open) => dates.has(open.date));

  const absences = input.absences.filter(
    (absence) => absence.date <= days[days.length - 1]?.date && absence.endDate >= days[0]?.date,
  );

  const userIds = new Set<string>([
    ...shifts.map((shift) => shift.userId),
    ...absences.map((absence) => absence.userId),
  ]);

  const rows: RosterRow[] = input.users
    .filter((user) => userIds.has(user.id))
    .sort((a, b) => a.name.localeCompare(b.name, "fi"))
    .map((user) => {
      const cells = days.map((day) => ({
        date: day.date,
        shifts: shifts
          .filter((shift) => shift.userId === user.id && shift.date === day.date)
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
          .map(toRosterShift),
        absence: absenceOn(absences, user.id, day.date),
      }));

      return {
        user,
        cells,
        plannedMinutes: countedMinutes(cells),
        shiftCount: cells.reduce((sum, cell) => sum + cell.shifts.length, 0),
      };
    });

  /*
   * Avoimet vuorot omalle riville listan loppuun.
   *
   * Ne ovat päiviä joilta puuttuu tekijä, ja juuri ne ovat se syy
   * miksi listaa katsotaan. Sekoitettuna ihmisten riveihin ne
   * näyttäisivät jonkun vuoroilta.
   */
  if (openShifts.length > 0) {
    const cells = days.map((day) => ({
      date: day.date,
      shifts: openShifts
        .filter((open) => open.date === day.date)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map((open) => ({
          startTime: open.startTime,
          endTime: open.endTime,
          status: "pending" as ShiftStatus,
          minutes: minutesBetween(open.startTime, open.endTime),
        })),
      absence: null,
    }));

    rows.push({
      user: null,
      cells,
      plannedMinutes: 0,
      shiftCount: cells.reduce((sum, cell) => sum + cell.shifts.length, 0),
    });
  }

  const perDay = days.map((_, index) =>
    rows.filter((row) => row.user !== null && row.cells[index].shifts.length > 0).length,
  );

  return {
    month: input.month,
    days,
    rows,
    perDay,
    plannedMinutes: rows.reduce((sum, row) => sum + row.plannedMinutes, 0),
  };
}

function toRosterShift(shift: Shift): RosterShift {
  return {
    startTime: shift.startTime,
    endTime: shift.endTime,
    status: shift.status,
    minutes: shiftDurationMinutes(shift),
  };
}

/** Yön yli menevä vuoro lasketaan oikein myös avoimelle vuorolle. */
function minutesBetween(startTime: string, endTime: string): number {
  return shiftDurationMinutes({
    startTime,
    endTime,
  } as Shift);
}

function countedMinutes(cells: RosterCell[]): number {
  return cells.reduce(
    (sum, cell) =>
      sum +
      cell.shifts
        .filter((shift) => shift.status !== "declined")
        .reduce((cellSum, shift) => cellSum + shift.minutes, 0),
    0,
  );
}

/**
 * "7 h 30 min" → "7,5 h".
 *
 * Listassa tunnit ovat vertailtavia lukuja eivätkä kestoja: rivin
 * summaa katsotaan suhteessa toisiin riveihin. Desimaali on siihen
 * luettavampi kuin tunnit ja minuutit erikseen.
 */
export function formatPlannedHours(minutes: number): string {
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours.toLocaleString("fi-FI", { maximumFractionDigits: 1 })} h`;
}

/** "10:00"–"18:00" → "10–18", "10:30" → "10.30". Paperilla tila on kortilla. */
export function shortTime(time: string): string {
  const [h, m] = time.split(":");
  return m === "00" ? String(Number(h)) : `${Number(h)}.${m}`;
}

/** Yhden vuoron merkintä ruudussa: "10–18". */
export function shiftLabel(shift: RosterShift): string {
  return `${shortTime(shift.startTime)}–${shortTime(shift.endTime)}`;
}

/** Lyhenne poissaololle. Ruudussa on tilaa kahdelle merkille. */
export const ABSENCE_SHORT: Record<AbsenceKind, string> = {
  sick: "SL",
  other: "P",
  cannot_attend: "EP",
};

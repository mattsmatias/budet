/**
 * Työntekijän ilmoitukset.
 *
 * Sama periaate kuin esihenkilön hälytyksissä: johdetaan tilasta joka
 * kerta, ei tallenneta. Tallennettu ilmoitus jäisi roikkumaan sen
 * jälkeenkin kun asia on hoidettu, ja "lue tämä" joka ei enää päde
 * opettaa käyttäjän ohittamaan koko listan.
 *
 * Rajaus: vain sellaista mille työntekijä voi itse tehdä jotain. Tieto
 * jonka varassa ei voi toimia ei ole ilmoitus vaan häiriö.
 */

import { currentState, eventsOnDate } from "./timeclock";
import { SHIFT_STATUS_LABELS, type Absence, type ClockEvent, type Shift } from "./types";

export type EmployeeAlertKind =
  | "shift_changed"
  | "clock_open"
  | "absence_reported";

export type EmployeeAlertSeverity = "action" | "info";

export interface EmployeeAlert {
  id: string;
  kind: EmployeeAlertKind;
  severity: EmployeeAlertSeverity;
  title: string;
  detail: string;
  href: string;
}

export interface EmployeeAlertContext {
  shifts: Shift[];
  clockEvents: ClockEvent[];
  absences: Absence[];
  today: string;
  now: string;
}

/**
 * Kaikki ilmoitukset, kiireellisin ensin.
 *
 * Vastausta odottava vuoro on ensin: siitä on kiinni pääseekö
 * esihenkilö suunnittelemaan viikon loppuun.
 */
export function buildEmployeeAlerts(ctx: EmployeeAlertContext): EmployeeAlert[] {
  return [
    ...changedShifts(ctx),
    ...openClock(ctx),
    ...reportedAbsences(ctx),
  ];
}

// ---------------------------------------------------------------------------

/**
 * Muutettu vuoro on ensin: työntekijä on voinut suunnitella päivänsä
 * vanhojen aikojen mukaan, eikä muutos saa hukkua listaan.
 */
function changedShifts(ctx: EmployeeAlertContext): EmployeeAlert[] {
  return ctx.shifts
    .filter((shift) => shift.status === "changed" && shift.date >= ctx.today)
    .map((shift) => ({
      id: `shift-changed-${shift.id}`,
      kind: "shift_changed" as const,
      severity: "action" as const,
      title: "Työvuoro muuttui",
      detail:
        `${formatDate(shift.date)} · ` +
        (shift.previousStartTime
          ? `oli ${shift.previousStartTime}–${shift.previousEndTime}, nyt ${shift.startTime}–${shift.endTime}`
          : `${shift.startTime}–${shift.endTime}`) +
        ".",
      href: `/app/vuorot?paiva=${shift.date}`,
    }));
}

/**
 * Eilen tai aiemmin auki jäänyt leimaus.
 *
 * Kuluvaa päivää ei nosteta: työvuoro on kesken eikä siinä ole mitään
 * korjattavaa. Auki jäänyt eilinen sen sijaan vääristää tunnit, eikä
 * työntekijä huomaa sitä itse.
 */
function openClock(ctx: EmployeeAlertContext): EmployeeAlert[] {
  const days = [
    ...new Set(ctx.clockEvents.map((event) => event.at.slice(0, 10))),
  ]
    .filter((day) => day < ctx.today)
    .sort();

  const stuck = days.filter((day) => {
    const state = currentState(eventsOnDate(ctx.clockEvents, day));
    return state === "working" || state === "on_break";
  });

  if (stuck.length === 0) return [];

  return [
    {
      id: "clock-open",
      kind: "clock_open",
      severity: "action",
      title:
        stuck.length === 1
          ? "Leimaus jäi auki"
          : `${stuck.length} päivää jäi leimaamatta ulos`,
      detail:
        `${stuck.map(formatDate).join(", ")}. ` +
        "Kerro esihenkilölle, jotta tunnit korjataan — auki jäänyt leimaus ei laske työaikaa oikein.",
      href: "/app/tyoaika",
    },
  ];
}

/** Oma poissaoloilmoitus näkyy kuittauksena, ei toimenpiteenä. */
function reportedAbsences(ctx: EmployeeAlertContext): EmployeeAlert[] {
  const upcoming = ctx.absences.filter((absence) => absence.date >= ctx.today);
  if (upcoming.length === 0) return [];

  return [
    {
      id: "absence-reported",
      kind: "absence_reported",
      severity: "info",
      title:
        upcoming.length === 1
          ? "Poissaoloilmoitus lähetetty"
          : `${upcoming.length} poissaoloilmoitusta lähetetty`,
      detail:
        `${upcoming.map((absence) => formatDate(absence.date)).join(", ")}. ` +
        "Ilmoitus ei peru vuoroa — esihenkilö etsii tilalle tekijän.",
      href: "/app/vuorot",
    },
  ];
}

// ---------------------------------------------------------------------------

/** Vuoron tila sanoina — käytetään listauksissa. */
export function shiftStatusText(shift: Shift): string {
  return SHIFT_STATUS_LABELS[shift.status];
}

function formatDate(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(d)}.${Number(m)}.`;
}

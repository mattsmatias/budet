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
import { fill } from "@/lib/i18n/auth-text";
import type { WorkerText } from "@/lib/i18n/worker-text";
import { formatDayShortIn } from "@/lib/i18n/labels";
import { dayIn } from "./clock-context";
import { labels } from "@/lib/i18n/labels";
import type { AppLocale } from "@/lib/i18n/app-locales";
import type { Absence, ClockEvent, Shift } from "./types";

export type EmployeeAlertKind =
  "shift_changed" | "clock_open" | "absence_reported";

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
  /** Ravintolan aikavyöhyke: leimauksen päivä luetaan siinä ajassa. */
  timezone: string;
  /** Työntekijänäkymän tekstit. */
  t: WorkerText;
  /** Käyttäjän kieli päivämäärien muotoiluun. */
  locale: AppLocale;
}

/**
 * Kaikki ilmoitukset, kiireellisin ensin.
 *
 * Vastausta odottava vuoro on ensin: siitä on kiinni pääseekö
 * esihenkilö suunnittelemaan viikon loppuun.
 */
export function buildEmployeeAlerts(
  ctx: EmployeeAlertContext,
): EmployeeAlert[] {
  return [...changedShifts(ctx), ...openClock(ctx), ...reportedAbsences(ctx)];
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
      title: ctx.t.omatHalytykset.shiftChanged,
      detail:
        `${formatDate(shift.date, ctx.locale)} · ` +
        (shift.previousStartTime
          ? fill(ctx.t.omatHalytykset.shiftWasNow, {
              ennenAlku: shift.previousStartTime,
              ennenLoppu: shift.previousEndTime ?? "",
              alku: shift.startTime,
              loppu: shift.endTime,
            })
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
    ...new Set(ctx.clockEvents.map((event) => dayIn(ctx.timezone, event.at))),
  ]
    .filter((day) => day < ctx.today)
    .sort();

  const stuck = days.filter((day) => {
    const state = currentState(
      eventsOnDate(ctx.clockEvents, day, ctx.timezone),
    );
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
          ? ctx.t.omatHalytykset.clockLeftOpen
          : fill(ctx.t.omatHalytykset.clockLeftOpenDays, {
              maara: String(stuck.length),
            }),
      detail:
        `${stuck.map((d) => formatDate(d, ctx.locale)).join(", ")}. ` +
        ctx.t.omatHalytykset.tellManager,
      href: "/app/tyoaika",
    },
  ];
}

/** Oma poissaoloilmoitus näkyy kuittauksena, ei toimenpiteenä. */
function reportedAbsences(ctx: EmployeeAlertContext): EmployeeAlert[] {
  const upcoming = ctx.absences.filter(
    (absence) => absence.endDate >= ctx.today,
  );
  if (upcoming.length === 0) return [];

  return [
    {
      id: "absence-reported",
      kind: "absence_reported",
      severity: "info",
      title:
        upcoming.length === 1
          ? ctx.t.omatHalytykset.absenceSent
          : fill(ctx.t.omatHalytykset.absencesSent, {
              maara: String(upcoming.length),
            }),
      detail:
        `${upcoming.map((absence) => formatDate(absence.date, ctx.locale)).join(", ")}. ` +
        ctx.t.omatHalytykset.absenceNoCancel,
      href: "/app/vuorot",
    },
  ];
}

// ---------------------------------------------------------------------------

/** Vuoron tila sanoina — käytetään listauksissa. */
export function shiftStatusText(shift: Shift, locale: AppLocale): string {
  return labels(locale).shiftStatus[shift.status];
}

function formatDate(isoDate: string, locale: AppLocale): string {
  return formatDayShortIn(isoDate, locale);
}

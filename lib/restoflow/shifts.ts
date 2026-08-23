/**
 * Työvuorot ja toteutunut työaika samassa laskennassa.
 *
 * Suunniteltu ja toteutunut eivät saa olla kahta irrallista järjestelmää.
 * Yksittäinen +13 minuutin ylitys on merkityksetön; se että sitä kertyy
 * joka vuorossa on tieto jota manageri ei muuten näe.
 */

import {
  computeWorked,
  eventsOnDate,
  msToHours,
  staffCostCents,
} from "./timeclock";
import type { ClockEvent, Shift, User } from "./types";

/** "14:00" → minuutteina vuorokauden alusta. */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

/**
 * Vuoron kesto minuutteina.
 *
 * Yön yli menevä vuoro (22:00–02:00) lasketaan oikein: päättymisaika
 * pienempänä kuin alku tarkoittaa seuraavaa päivää.
 */
export function shiftDurationMinutes(shift: Shift): number {
  const start = timeToMinutes(shift.startTime);
  const end = timeToMinutes(shift.endTime);
  return end >= start ? end - start : end + 24 * 60 - start;
}

export interface ShiftComparison {
  shift: Shift;
  user: User | undefined;
  plannedMs: number;
  actualMs: number;
  /** Toteutunut miinus suunniteltu. Positiivinen = ylitys. */
  varianceMs: number;
  /** Toteutuneen alku ja loppu, jos leimauksia on. */
  actualStart: string | null;
  actualEnd: string | null;
  plannedCostCents: number;
  actualCostCents: number;
}

/**
 * Vertaa yhtä vuoroa toteutuneeseen työaikaan.
 *
 * Toteutunut luetaan saman päivän leimauksista. Jos leimauksia ei ole,
 * toteutunut on nolla eikä arvioida mitään — vuoro on voinut jäädä
 * tekemättä.
 */
export function compareShift(
  shift: Shift,
  users: User[],
  clockEvents: ClockEvent[],
  nowIso: string,
  timezone: string,
): ShiftComparison {
  const user = users.find((u) => u.id === shift.userId);
  const dayEvents = eventsOnDate(
    clockEvents.filter((e) => e.userId === shift.userId),
    shift.date,
    timezone,
  );

  const worked = computeWorked(dayEvents, nowIso);
  const plannedMs = shiftDurationMinutes(shift) * 60000;
  const rate = user?.hourlyRateCents ?? 0;

  return {
    shift,
    user,
    plannedMs,
    actualMs: worked.workedMs,
    varianceMs: worked.workedMs - plannedMs,
    actualStart: dayEvents.find((e) => e.type === "in")?.at ?? null,
    actualEnd:
      [...dayEvents].reverse().find((e) => e.type === "out")?.at ?? null,
    plannedCostCents: staffCostCents(plannedMs, rate),
    actualCostCents: staffCostCents(worked.workedMs, rate),
  };
}

export function compareShifts(
  shifts: Shift[],
  users: User[],
  clockEvents: ClockEvent[],
  nowIso: string,
  timezone: string,
): ShiftComparison[] {
  return shifts
    .map((shift) => compareShift(shift, users, clockEvents, nowIso, timezone))
    .sort((a, b) => a.shift.date.localeCompare(b.shift.date));
}

export interface LabourSummary {
  plannedMs: number;
  actualMs: number;
  varianceMs: number;
  plannedCostCents: number;
  actualCostCents: number;
  varianceCostCents: number;
  shiftCount: number;
}

/**
 * Työvoimakustannuksen yhteenveto.
 *
 * TÄRKEÄ RAJAUS: tämä ei ole palkkalaskenta. Se on tuntien ja tuntipalkan
 * tulo, eikä sisällä lisiä, lomakorvauksia, sivukuluja eikä verotusta.
 * Käyttöliittymän on sanottava se, jottei lukua käytetä palkanmaksuun.
 */
export function labourSummary(comparisons: ShiftComparison[]): LabourSummary {
  const plannedMs = comparisons.reduce((s, c) => s + c.plannedMs, 0);
  const actualMs = comparisons.reduce((s, c) => s + c.actualMs, 0);
  const plannedCostCents = comparisons.reduce((s, c) => s + c.plannedCostCents, 0);
  const actualCostCents = comparisons.reduce((s, c) => s + c.actualCostCents, 0);

  return {
    plannedMs,
    actualMs,
    varianceMs: actualMs - plannedMs,
    plannedCostCents,
    actualCostCents,
    varianceCostCents: actualCostCents - plannedCostCents,
    shiftCount: comparisons.length,
  };
}

/** "+13 min" / "−22 min" / "tasan". */
export function formatVariance(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes === 0) return "tasan";
  const sign = minutes > 0 ? "+" : "−";
  const abs = Math.abs(minutes);

  if (abs < 60) return `${sign}${abs} min`;

  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `${sign}${h} h` : `${sign}${h} h ${m} min`;
}

/**
 * Toistuva ylitys työntekijää kohti.
 *
 * Yksi ylitys on kohinaa. Kolme peräkkäistä on kuvio, ja kuvio on se mikä
 * kannattaa näyttää.
 */
export interface VariancePattern {
  user: User | undefined;
  shiftCount: number;
  totalVarianceMs: number;
  averageVarianceMs: number;
  costImpactCents: number;
}

export function variancePatterns(
  comparisons: ShiftComparison[],
  minShifts = 2,
): VariancePattern[] {
  const byUser = new Map<string, ShiftComparison[]>();

  for (const c of comparisons) {
    // Vuoro jota ei ole tehty lainkaan ei kerro ylityskuviosta.
    if (c.actualMs === 0) continue;
    byUser.set(c.shift.userId, [...(byUser.get(c.shift.userId) ?? []), c]);
  }

  return [...byUser.values()]
    .filter((list) => list.length >= minShifts)
    .map((list) => {
      const totalVarianceMs = list.reduce((s, c) => s + c.varianceMs, 0);
      return {
        user: list[0].user,
        shiftCount: list.length,
        totalVarianceMs,
        averageVarianceMs: Math.round(totalVarianceMs / list.length),
        costImpactCents: list.reduce(
          (s, c) => s + (c.actualCostCents - c.plannedCostCents),
          0,
        ),
      };
    })
    .sort((a, b) => Math.abs(b.totalVarianceMs) - Math.abs(a.totalVarianceMs));
}

/** Tuntia, kahden desimaalin tarkkuudella — raportteihin. */
export function hoursOf(ms: number): number {
  return Math.round(msToHours(ms) * 100) / 100;
}

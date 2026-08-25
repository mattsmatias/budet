/**
 * Kuukausikalenterin ruudukko.
 *
 * Viikot riveinä, maanantaista sunnuntaihin. Ruudukko täytetään
 * edellisen ja seuraavan kuun päivillä, jotta jokainen rivi on
 * seitsemän ruutua pitkä — vajaa ensimmäinen viikko siirtäisi
 * viikonpäivät väärään sarakkeeseen.
 *
 * VIIKKONUMERO ON VUOROLISTAN KIELTÄ.
 *
 * Ravintolassa puhutaan viikoista: "viikonloppu 38" tai "vk 40 on
 * täynnä". Numero on siksi rivin alussa eikä koristeena.
 */

import type { Shift } from "./types";

export interface CalendarDay {
  date: string;
  /** Kuukaudenpäivä 1–31. */
  day: number;
  /** 1 = maanantai … 7 = sunnuntai. */
  weekday: number;
  weekend: boolean;
  /** Kuuluuko päivä katsottavaan kuukauteen vai täytteeseen. */
  inMonth: boolean;
  isToday: boolean;
}

export interface CalendarWeek {
  /** ISO-viikkonumero. */
  week: number;
  days: CalendarDay[];
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * ISO-viikkonumero.
 *
 * Viikko kuuluu sille vuodelle jossa sen torstai on. Ilman tätä
 * vuodenvaihteen viikko saisi numeron 1 tai 53 sen mukaan mistä
 * päivästä sattuu laskemaan.
 */
export function isoWeek(date: string): number {
  const d = new Date(`${date}T12:00:00Z`);
  const weekday = d.getUTCDay() === 0 ? 7 : d.getUTCDay();

  // Siirry viikon torstaihin: se ratkaisee vuoden.
  d.setUTCDate(d.getUTCDate() + 4 - weekday);

  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const days = Math.floor((d.getTime() - yearStart.getTime()) / 86400000);

  return Math.floor(days / 7) + 1;
}

/**
 * Kuukauden kalenteriruudukko.
 *
 * Päivät lasketaan UTC-keskipäivästä. Keskiyöstä laskettuna kesäaika
 * siirtäisi päivän edelliseksi osassa aikavyöhykkeitä, ja koko
 * kalenteri liukuisi sarakkeen verran.
 */
export function monthCalendar(month: string, today: string): CalendarWeek[] {
  const [year, m] = month.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(m)) return [];

  const first = new Date(Date.UTC(year, m - 1, 1, 12));
  const firstWeekday = first.getUTCDay() === 0 ? 7 : first.getUTCDay();

  // Aloita ruudukko sen viikon maanantaista johon kuukauden 1. päivä osuu.
  const cursor = new Date(first);
  cursor.setUTCDate(cursor.getUTCDate() - (firstWeekday - 1));

  const last = new Date(Date.UTC(year, m, 0, 12));
  const weeks: CalendarWeek[] = [];

  while (cursor <= last || weeks.length === 0 || weeks[weeks.length - 1].days.length < 7) {
    const days: CalendarDay[] = [];

    for (let i = 0; i < 7; i += 1) {
      const date = iso(cursor);
      const weekday = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay();

      days.push({
        date,
        day: cursor.getUTCDate(),
        weekday,
        weekend: weekday >= 6,
        inMonth: date.startsWith(month),
        isToday: date === today,
      });

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    weeks.push({ week: isoWeek(days[0].date), days });

    // Valmis kun viimeinen kuukauden päivä on jo mukana.
    if (days[6].date >= iso(last)) break;
  }

  return weeks;
}

/**
 * Päivän vuorot aikajärjestyksessä.
 *
 * Perutut jäävät mukaan mutta viimeisiksi: peruutus on tieto jonka
 * suunnittelija tarvitsee, muttei se mitä hän ensin lukee.
 */
export function shiftsOn(shifts: Shift[], date: string): Shift[] {
  return shifts
    .filter((shift) => shift.date === date)
    .sort((a, b) => {
      const aCancelled = a.cancelledAt !== null ? 1 : 0;
      const bCancelled = b.cancelledAt !== null ? 1 : 0;
      if (aCancelled !== bCancelled) return aCancelled - bCancelled;
      return a.startTime.localeCompare(b.startTime);
    });
}

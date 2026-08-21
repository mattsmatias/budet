/**
 * Sivukonteksti hallintanäkymille.
 *
 * Yksi kutsu antaa istunnon, ravintolan, nykyhetken ravintolan
 * aikavyöhykkeellä ja aineiston. Ilman tätä jokainen sivu toistaisi saman
 * viiden rivin alustuksen, ja yksikin unohtunut aikavyöhykemuunnos
 * laskisi kuukauden väärin.
 */

import { cache } from "react";
import { monthIn, todayIn, weekStart } from "./clock-context";
import { can } from "./permissions";
import { workedBetween } from "./timeclock";
import {
  fetchAbsences,
  fetchClockEvents,
  fetchReceipts,
  fetchRestaurantData,
  fetchShifts,
  type RestaurantData,
} from "./queries";
import { requireContext, type Context } from "./session";
import type { Absence, ClockEvent, Receipt, Shift } from "./types";

export interface AdminContext extends Context, RestaurantData {
  /** Kuluva kuukausi "2026-08" ravintolan aikavyöhykkeellä. */
  month: string;
  /** Kuluva päivä "2026-08-20" ravintolan aikavyöhykkeellä. */
  today: string;
  /** Nykyhetki ISO-aikaleimana. */
  now: string;
  /** Kuukauden toteutuneet tunnit käyttäjää kohti, leimauksista laskettuna. */
  monthlyHours: Record<string, number>;
}

/**
 * cache(): sama pyyntö saa saman tuloksen, joten layout ja sivu eivät
 * hae aineistoa kahdesti.
 */
const loadData = cache(
  async (restaurantId: string): Promise<RestaurantData> =>
    fetchRestaurantData(restaurantId),
);

export async function adminContext(returnTo: string): Promise<AdminContext> {
  const ctx = await requireContext(returnTo);
  const data = await loadData(ctx.restaurant.id);

  const month = monthIn(ctx.restaurant.timezone);
  const today = todayIn(ctx.restaurant.timezone);
  const now = new Date().toISOString();

  return {
    ...ctx,
    ...data,
    month,
    today,
    now,
    monthlyHours: hoursByUser(data, month, now),
  };
}

/**
 * Kuukauden tunnit käyttäjää kohti, leimauksista laskettuna.
 *
 * Lasketaan päivä kerrallaan, jotta keskeneräinen vuoro rajautuu oikein
 * eikä yön yli jatkuva leimaus kerrytä kahta päivää yhteen.
 */
function hoursByUser(
  data: RestaurantData,
  month: string,
  now: string,
): Record<string, number> {
  const from = `${month}-01`;
  const [year, m] = month.split("-").map(Number);
  const to = new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);

  const out: Record<string, number> = {};
  for (const user of data.users) {
    const events = data.clockEvents.filter((e) => e.userId === user.id);
    const worked = workedBetween(events, from, to, now);
    out[user.id] = Math.round((worked.workedMs / 3600000) * 10) / 10;
  }
  return out;
}


// ---------------------------------------------------------------------------
// Työntekijän näkymä
// ---------------------------------------------------------------------------

export interface EmployeeContext extends Context {
  month: string;
  today: string;
  now: string;
  /** Vain tämän käyttäjän leimaukset. */
  clockEvents: ClockEvent[];
  /** Vain tämän käyttäjän vuorot. */
  shifts: Shift[];
  /** Kuitit joihin käyttäjällä on oikeus — RLS rajaa työntekijän omiin. */
  receipts: Receipt[];
  /** Näkeekö käyttäjä muidenkin kuitit? */
  seesAllReceipts: boolean;
  /** Vain tämän käyttäjän poissaoloilmoitukset. */
  absences: Absence[];
}

/**
 * Konteksti työntekijän mobiilinäkymälle.
 *
 * Hakee vain sen mitä yksi työntekijä tarvitsee. Koko ravintolan aineiston
 * lataaminen puhelimeen olisi hidasta eikä työntekijällä ole siihen
 * oikeuttakaan.
 */
export async function employeeContext(returnTo: string): Promise<EmployeeContext> {
  const ctx = await requireContext(returnTo);

  const month = monthIn(ctx.restaurant.timezone);
  const today = todayIn(ctx.restaurant.timezone);
  const now = new Date().toISOString();

  // Leimaukset kuluvan viikon alusta: päivä- ja viikkonäkymä tarvitsevat ne,
  // vanhemmat eivät kuulu tähän näkymään.
  const [allEvents, allShifts, receipts, allAbsences] = await Promise.all([
    fetchClockEvents(ctx.restaurant.id, `${weekStart(today)}T00:00:00.000Z`),
    fetchShifts(ctx.restaurant.id),
    fetchReceipts(ctx.restaurant.id, 50),
    fetchAbsences(ctx.restaurant.id, today),
  ]);

  return {
    ...ctx,
    month,
    today,
    now,
    clockEvents: allEvents.filter((e) => e.userId === ctx.user.id),
    shifts: allShifts.filter((s) => s.userId === ctx.user.id),
    receipts,
    seesAllReceipts: can(ctx.role, "receipts.view"),
    absences: allAbsences.filter((a) => a.userId === ctx.user.id),
  };
}

/**
 * Palkkakauden aineisto yhdestä paikasta.
 *
 * Sekä näkymä että hyväksyntä laskevat palkat tästä. Jos hyväksyntä
 * luottaisi selaimen lähettämiin summiin, palkan voisi asettaa
 * lomakekentästä; jos se laskisi omalla koodillaan, näytetty ja
 * tallennettu summa voisivat erota. Yksi lataaja sulkee molemmat.
 */

import {
  fetchClockEvents,
  fetchPayComponents,
  fetchShifts,
  fetchTimeCorrections,
  fetchUsers,
} from "./queries";
import { windowStartIso } from "./clock-context";
import { buildPayslip, type PayComponent, type Payslip, type PeriodBounds } from "./payroll";
import type { User } from "./types";

export interface PayrollData {
  users: User[];
  components: PayComponent[];
  slips: Payslip[];
  /** Kaikki kauden varoitukset yhdessä listassa. */
  issues: Payslip["issues"];
}

/**
 * Kenelle palkkaa lasketaan.
 *
 * Vain työntekijäasemassa olevat. Omistaja voi olla jäsen ilman
 * työsuhdetta, eikä hänen kuulu ilmestyä palkkalistalle pelkän
 * jäsenyyden perusteella.
 */
function paidStaff(users: User[]): User[] {
  return users.filter((u) => u.active && u.position !== null);
}

export async function loadPayroll(
  restaurantId: string,
  timezone: string,
  period: PeriodBounds,
  nowIso: string,
): Promise<PayrollData> {
  /*
   * Hakuikkuna alkaa vuorokautta ennen kautta.
   *
   * Kysely rajaa UTC-aikaleimoja, mutta kauden raja on paikallinen
   * päivä. Kuun ensimmäisenä yönä klo 01:50 tehty leimaus on edellisen
   * UTC-päivän puolella ja jäisi kaudelta pois. Ylimääräiset rivit
   * rajautuvat pois päiväkohtaisessa laskennassa.
   */
  const [users, events, shifts, corrections, components] = await Promise.all([
    fetchUsers(restaurantId),
    fetchClockEvents(restaurantId, windowStartIso(period.startsOn)),
    fetchShifts(restaurantId),
    fetchTimeCorrections(restaurantId, period.startsOn, period.endsOn),
    fetchPayComponents(restaurantId),
  ]);

  const staff = paidStaff(users);

  const slips = staff.map((user) =>
    buildPayslip({
      user,
      from: period.startsOn,
      to: period.endsOn,
      events,
      shifts,
      corrections,
      components,
      nowIso,
      timezone,
    }),
  );

  return {
    users: staff,
    components,
    slips,
    issues: slips.flatMap((s) => s.issues),
  };
}

/** Yhteenveto kauden korteille. */
export interface PayrollSummary {
  staffCount: number;
  workedMinutes: number;
  grossCents: number;
  /** Laskelmat joissa on jotain tarkistettavaa. */
  needsReview: number;
}

export function summarise(data: PayrollData): PayrollSummary {
  const withIssues = new Set(data.issues.map((i) => i.userId));

  return {
    staffCount: data.slips.filter((s) => s.workedMinutes > 0).length,
    workedMinutes: data.slips.reduce((sum, s) => sum + s.workedMinutes, 0),
    grossCents: data.slips.reduce((sum, s) => sum + s.grossCents, 0),
    needsReview: withIssues.size,
  };
}

/** "142 h 30 min" → "142,5 h" listaan, jossa tunnit vertaillaan. */
export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded.toLocaleString("fi-FI", { maximumFractionDigits: 1 })} h`;
}

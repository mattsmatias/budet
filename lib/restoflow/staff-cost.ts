import type { Employee, TimeEntry } from "./employees";
import { summarise } from "./employees";
import {
  EMPTY_COST,
  costForDated,
  costPerHourCents,
  sumCosts,
  type EmployerCost,
  type PayrollSettings,
} from "./payroll";
import { settingsResolver, type TesAgreement } from "./tes";

/**
 * Kuukauden työtunnit ja niiden kustannus — yksi lähde kaikkialle.
 *
 * YKSI KAAVA, EI KOLMEA.
 *
 * Yleiskatsaus, Palkat-sivu ja kuukausiraportti puhuvat samasta
 * luvusta. Kun jokainen laski sen omalla tavallaan, yleiskatsaus
 * näytti pelkän peruspalkan ja Palkat-sivu lisineen ja sivukuluineen —
 * kaksi eri lukua samalla nimellä on pahempi kuin ei lukua ollenkaan.
 *
 * TUNTIKUSTANNUS ON JAKOLASKUN TULOS, EI ASETUS.
 *
 * Lisät osuvat vain niille minuuteille joilla ne pätevät, joten
 * kustannus tunnilta ei ole vakio vaan riippuu siitä milloin työ
 * tehtiin. Se lasketaan aina kokonaiskustannuksesta jaettuna
 * tunneilla, jolloin kustannus ja tuntihinta täsmäävät keskenään.
 */

export interface StaffCostRow {
  employee: Employee;
  /** Toteutuneet minuutit kuukaudessa. */
  minutes: number;
  /** Työnantajan kustannus näistä minuuteista. */
  cost: EmployerCost;
  /** Onko vuoro käynnissä juuri nyt. */
  working: boolean;
}

export interface StaffCost {
  rows: StaffCostRow[];
  /** Kaikkien työntekijöiden kustannus yhteensä. */
  total: EmployerCost;
  minutes: number;
  working: number;
}

/**
 * Työntekijät, heidän tuntinsa ja kustannuksensa.
 *
 * Versio ratkaistaan vuoron päivällä: kuukausi voi ylittää
 * sopimuskauden vaihtumisen, ja vanha vuoro lasketaan silloin voimassa
 * olleilla lisillä. Ilman sopimusta käytetään yrityksen omia
 * asetuksia.
 */
export function staffCost(
  employees: Employee[],
  entries: TimeEntry[],
  month: string,
  timezone: string,
  settings: PayrollSettings | null,
  tesVersions: TesAgreement[] = [],
): StaffCost {
  const rows = summarise(employees, entries, month);
  const inMonth = entries.filter((entry) => entry.date.startsWith(month));
  const resolve = settings ? settingsResolver(tesVersions, settings) : null;

  const withCost: StaffCostRow[] = rows.map((row) => ({
    employee: row.employee,
    minutes: row.minutes,
    working: row.working,
    cost: resolve
      ? costForDated(
          inMonth.filter((entry) => entry.employeeId === row.employee.id),
          row.employee.hourlyCents,
          timezone,
          resolve,
        )
      : { ...EMPTY_COST },
  }));

  return {
    rows: withCost,
    total: sumCosts(withCost.map((row) => row.cost)),
    minutes: withCost.reduce((sum, row) => sum + row.minutes, 0),
    working: withCost.filter((row) => row.working).length,
  };
}

/**
 * Arvioitu työnantajakustannus tunnilta, tai null kun tunteja ei ole.
 *
 * Sama funktio joka paikassa, jotta näytetty tuntihinta kerrottuna
 * tunneilla on aina näytetty kustannus.
 */
export function staffCostPerHour(cost: EmployerCost): number | null {
  return costPerHourCents(cost);
}

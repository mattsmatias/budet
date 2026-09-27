import type { Employee, TimeEntry } from "./employees";
import { summarise } from "./employees";
import {
  EMPTY_COST,
  commissionExtraCents,
  costForDated,
  costPerHourCents,
  sumCosts,
  withCommission,
  type EmployerCost,
  type PayrollSettings,
} from "./payroll";
import {
  datesWithoutTes,
  settingsResolver,
  type TesAgreement,
} from "./tes";

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
  /**
   * Kuukauden päivät joille sopimuksesta ei löytynyt versiota.
   *
   * Nämä päivät on laskettu yrityksen omilla asetuksilla, ei
   * sopimuksella. Käyttöliittymä kertoo sen; hiljaa se olisi väärä
   * lupaus.
   */
  missingTes: string[];
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
  /**
   * Työntekijän oma myynti kuukaudessa ilman alv, sentteinä.
   *
   * Vain provisiopalkkaisilla on tässä rivi. Tyhjä taulukko tarkoittaa
   * ettei provisiota ole — se on tuntipalkkaisen yrityksen tavallinen
   * tila, eikä se muuta laskentaa millään tavalla.
   */
  sales: Record<string, number> = {},
): StaffCost {
  const rows = summarise(employees, entries, month);
  const inMonth = entries.filter((entry) => entry.date.startsWith(month));
  const resolve = settings ? settingsResolver(tesVersions, settings) : null;

  const withCost: StaffCostRow[] = rows.map((row) => {
    const tunnit = resolve
      ? costForDated(
          inMonth.filter((entry) => entry.employeeId === row.employee.id),
          row.employee.hourlyCents,
          timezone,
          resolve,
        )
      : { ...EMPTY_COST };

    /*
     * Provisio kuukauden lopuksi, ei vuoroittain.
     *
     * Myynti on kuukauden luku eikä vuoron luku, joten provisio
     * lasketaan kerran koko kuukaudelle. Takuupalkkamalli vaatii sen:
     * vertailu tunteihin on mahdollinen vasta kun kaikki tunnit ovat
     * tiedossa. Vuorokohtainen vertailu antaisi toisen tuloksen.
     */
    const extra = settings
      ? commissionExtraCents(
          row.employee.payModel,
          row.employee.commissionRate,
          sales[row.employee.id] ?? 0,
          tunnit.baseCents,
        )
      : 0;

    return {
      employee: row.employee,
      minutes: row.minutes,
      working: row.working,
      cost: settings ? withCommission(tunnit, extra, settings) : tunnit,
    };
  });

  return {
    rows: withCost,
    total: sumCosts(withCost.map((row) => row.cost)),
    minutes: withCost.reduce((sum, row) => sum + row.minutes, 0),
    working: withCost.filter((row) => row.working).length,
    missingTes: datesWithoutTes(
      tesVersions,
      inMonth.filter((entry) => entry.clockOut !== null).map((e) => e.date),
    ),
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

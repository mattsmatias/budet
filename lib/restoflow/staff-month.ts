import { cache } from "react";
import { monthRange } from "./dates";
import {
  fetchCompanyTes,
  fetchEmployeeSales,
  fetchEmployees,
  fetchPayrollSettings,
  fetchTimeEntries,
} from "./queries";
import { staffCost, type StaffCost } from "./staff-cost";
import type { Employee, TimeEntry } from "./employees";
import type { PayrollSettings } from "./payroll";
import type { TesAgreement } from "./tes";

/**
 * Kuukauden henkilöstökustannus yhdellä kutsulla.
 *
 * YKSI HAKU, YKSI LASKENTA, KOLME NÄKYMÄÄ.
 *
 * Yleiskatsaus, Palkat-sivu ja kuukausiraportti näyttävät saman
 * luvun. Aiemmin jokainen haki osansa itse ja kutsui laskentaa omilla
 * argumenteillaan, ja jokaisessa luki kommentti "sama laskenta kuin
 * muualla". Kommentti ei pidä lukuja samana: kun laskenta sai uuden
 * syötteen — työntekijän oman myynnin — yksi sivu sai sen ja kaksi ei,
 * ja yleiskatsaus näytti palkoiksi kaksi tuhatta vähemmän kuin
 * Palkat-sivu.
 *
 * Nyt syöte on yhdessä paikassa. Uusi tieto lisätään tähän, ja
 * kaikki kolme saavat sen samalla kertaa tai ei kukaan.
 *
 * Tulos on välimuistissa pyynnön ajan, joten sama kuukausi maksaa
 * yhden hakukierroksen vaikka sitä kysyisi kaksi näkymää.
 */

export interface StaffMonth {
  employees: Employee[];
  /** Vuorot kuukauden alusta, myös kesken olevat. */
  entries: TimeEntry[];
  settings: PayrollSettings;
  tesVersions: TesAgreement[];
  /** Työntekijän oma myynti kuukaudessa ilman alv, avaimena tunniste. */
  sales: Record<string, number>;
  cost: StaffCost;
}

export const staffMonth = cache(
  async (
    restaurantId: string,
    month: string,
    timezone: string,
  ): Promise<StaffMonth> => {
    const { from } = monthRange(month);

    const [employees, entries, settings, tesVersions, sales] =
      await Promise.all([
        fetchEmployees(restaurantId),
        fetchTimeEntries(restaurantId, from),
        fetchPayrollSettings(restaurantId),
        fetchCompanyTes(restaurantId),
        fetchEmployeeSales(restaurantId, month),
      ]);

    return {
      employees,
      entries,
      settings,
      tesVersions,
      sales,
      cost: staffCost(
        employees,
        entries,
        month,
        timezone,
        settings,
        tesVersions,
        sales,
      ),
    };
  },
);

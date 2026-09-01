/**
 * Mitä palkka maksaa työnantajalle.
 *
 * Katen palkkamoduuli on kertonut bruttopalkan. Se ei ole se luku jota
 * ravintoloitsija tarvitsee: bruttopalkan päälle tulee eläkemaksu,
 * sairausvakuutusmaksu ja työttömyysvakuutusmaksu, ja vasta summa
 * kertoo mitä työntekijä oikeasti maksaa.
 *
 * Ero on noin viidennes. Kahdentuhannen euron palkka maksaa lähes
 * kaksi ja puoli tuhatta, ja juuri se erotus on se jonka takia
 * hinnoittelu menee pieleen.
 *
 * ---------------------------------------------------------------------
 * YKSI LATAUS, KOKO KAUSI
 * ---------------------------------------------------------------------
 *
 * Sekä kauden yhteenveto että yhden työntekijän laskelma tarvitsevat
 * saman aineiston: vuosisäännöt, ravintolan omat prosentit, verokortit,
 * luontoisedut ja tulorajan käytön. Työntekijäkohtainen lataus
 * tarkoittaisi kolmeakymmentä kyselyä kolmenkymmenen työntekijän
 * ravintolassa.
 *
 * ---------------------------------------------------------------------
 * TÄMÄ ON ENNUSTE, EI LASKELMA
 * ---------------------------------------------------------------------
 *
 * Hyväksytyn laskelman luvut luetaan laskelmalta, koska ne on
 * jäädytetty siihen. Tämä moduuli laskee sen mitä palkka *tulisi*
 * maksamaan, jotta kustannuksen näkee ennen hyväksymistä. Kaksi eri
 * kysymystä, kaksi eri lähdettä.
 */

import { createClient } from "@/utils/supabase/server";
import { calculatePayslipTax, type PayslipTax } from "./payroll-tax";
import {
  loadAllTaxCards,
  loadBenefits,
  loadEmployerSettings,
  loadPayrollProfiles,
  loadTaxRules,
  type TaxCardRow,
} from "./payroll-tax-queries";
import type { Payslip } from "./payroll";

export interface PeriodCosts {
  /** Työntekijän tunnus → laskettu verotus ja kustannus. */
  byUser: Map<string, PayslipTax>;

  /** Verovuosi jonka säännöillä laskettiin. */
  taxYear: number;

  /**
   * Miksi laskenta ei onnistunut.
   *
   * Tyhjä kun kaikki on kunnossa. Sisältää valmiin lauseen, ei
   * virhekoodia: käyttöliittymä näyttää sen sellaisenaan eikä yritä
   * kääntää sitä.
   */
  blocked: string | null;
}

const TYHJA: PeriodCosts = {
  byUser: new Map(),
  taxYear: 0,
  blocked: null,
};

/**
 * Kauden kustannukset kaikille työntekijöille.
 *
 * Ilman maksupäivää ei lasketa mitään. Maksupäivä ratkaisee sekä
 * verokortin että verovuoden, eikä kumpaakaan voi arvata kauden
 * lopusta: palkka maksetaan usein vasta seuraavassa kuussa, ja
 * joulukuun työ voi kuulua uuteen verovuoteen.
 */
export async function costsForPeriod(input: {
  restaurantId: string;
  periodFrom: string;
  periodTo: string;
  payDate: string | null;
  slips: Payslip[];
  /** Lause joka näytetään kun maksupäivä puuttuu. */
  noPayDateMessage: string;
  /** Lause joka näytetään kun vuoden sääntöjä ei ole. Sisältää {vuosi}. */
  noRulesMessage: string;
}): Promise<PeriodCosts> {
  const {
    restaurantId,
    periodFrom,
    periodTo,
    payDate,
    slips,
    noPayDateMessage,
    noRulesMessage,
  } = input;

  if (!payDate) return { ...TYHJA, blocked: noPayDateMessage };

  const vuosi = Number(payDate.slice(0, 4));
  const rules = await loadTaxRules(vuosi);

  if (!rules) {
    return {
      ...TYHJA,
      taxYear: vuosi,
      blocked: noRulesMessage.replace("{vuosi}", String(vuosi)),
    };
  }

  const [cards, benefits, employer, profiles, aiemmat] = await Promise.all([
    loadAllTaxCards(restaurantId),
    loadBenefits(restaurantId),
    loadEmployerSettings(restaurantId),
    loadPayrollProfiles(restaurantId),
    paidThisYear(restaurantId, vuosi, periodFrom, periodTo),
  ]);

  const cardsByUser = groupBy(cards, (card) => card.userId);
  const benefitsByUser = groupBy(benefits, (row) => row.userId);

  /*
   * Ravintolan palkkasumma ennen tätä kautta.
   *
   * Työnantajan työttömyysvakuutusmaksu on porrastettu koko yrityksen
   * vuosipalkkasumman mukaan, joten yhden työntekijän maksu riippuu
   * kaikkien muiden palkoista.
   */
  const payrollBefore = aiemmat.reduce((sum, row) => sum + row.taxableCents, 0);

  const byUser = new Map<string, PayslipTax>();

  for (const slip of slips) {
    const omat = cardsByUser.get(slip.userId) ?? [];

    /*
     * Tulorajan käyttö kortin voimassaoloajalta.
     *
     * Muutosverokortti tuo mukanaan oman rajansa loppuvuodelle, joten
     * käyttöä ei lasketa koko kalenterivuodelta. Sama sääntö kuin
     * kannan income_limit_status-funktiossa — ja siksi sama tulos.
     */
    const kortti = omat.find(
      (card) =>
        card.validFrom <= payDate && (card.validTo ?? "9999") >= payDate,
    );

    const kaytetty = kortti
      ? kortti.priorIncomeCents +
        aiemmat
          .filter(
            (row) =>
              row.userId === slip.userId &&
              row.payDate >= kortti.validFrom &&
              (kortti.validTo === null || row.payDate <= kortti.validTo),
          )
          .reduce((sum, row) => sum + row.taxableCents, 0)
      : 0;

    byUser.set(
      slip.userId,
      calculatePayslipTax({
        grossCents: slip.grossCents,
        periodFrom,
        periodTo,
        payDate,
        cards: omat,
        benefits: benefitsByUser.get(slip.userId) ?? [],
        usedLimitCents: kaytetty,
        payrollBeforeCents: payrollBefore,
        rules,
        employer,
        birthDate:
          profiles.find((row) => row.userId === slip.userId)?.birthDate ?? null,
      }),
    );
  }

  return { byUser, taxYear: vuosi, blocked: null };
}

/** Kauden yhteissummat työnantajan näkökulmasta. */
export interface CostSummary {
  grossCents: number;
  benefitsCents: number;
  taxableCents: number;
  withholdingCents: number;
  employeeDeductionsCents: number;
  netCents: number;
  employerContributionsCents: number;
  employerTotalCents: number;
  /** Kuinka monta prosenttia maksut lisäävät bruttopalkan päälle. */
  overheadPercent: number;
}

export function summariseCosts(costs: PeriodCosts): CostSummary {
  let gross = 0;
  let benefits = 0;
  let taxable = 0;
  let withholding = 0;
  let deductions = 0;
  let net = 0;
  let employerTotal = 0;

  for (const tax of costs.byUser.values()) {
    gross += tax.grossCents;
    benefits += tax.benefitsCents;
    taxable += tax.taxableCents;
    withholding += tax.withholding.cents;
    deductions += tax.employeePensionCents + tax.employeeUnemploymentCents;
    net += tax.netCents;
    employerTotal += tax.employerTotalCents;
  }

  const employerContributions = employerTotal - taxable;

  return {
    grossCents: gross,
    benefitsCents: benefits,
    taxableCents: taxable,
    withholdingCents: withholding,
    employeeDeductionsCents: deductions,
    netCents: net,
    employerContributionsCents: employerContributions,
    employerTotalCents: employerTotal,

    /*
     * Lisäkulu prosentteina.
     *
     * "2 386,40 €" ei kerro onko se paljon. "+19,3 % palkan päälle"
     * kertoo, ja se on se luku jota hinnoittelussa käytetään.
     */
    overheadPercent:
      taxable === 0
        ? 0
        : Math.round((employerContributions / taxable) * 1000) / 10,
  };
}

// ---------------------------------------------------------------------------

interface PaidRow {
  userId: string;
  payDate: string;
  taxableCents: number;
}

/**
 * Vuoden aikana jo hyväksytyt ja maksetut laskelmat.
 *
 * Tämä kausi rajataan pois: sen laskelmat ovat juuri niitä joita
 * ollaan laskemassa, ja mukana ne kuluttaisivat tulorajaa kahdesti.
 * Luonnos ei ole mukana lainkaan — se on keskeneräinen arvio.
 */
async function paidThisYear(
  restaurantId: string,
  year: number,
  periodFrom: string,
  periodTo: string,
): Promise<PaidRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("payslips")
    .select(
      "user_id, pay_date, taxable_cents, pay_periods!inner(starts_on, ends_on)",
    )
    .eq("restaurant_id", restaurantId)
    .in("status", ["approved", "paid"])
    .gte("pay_date", `${year}-01-01`)
    .lte("pay_date", `${year}-12-31`);

  return (
    (data as
      | {
          user_id: string;
          pay_date: string | null;
          taxable_cents: number;
          pay_periods: { starts_on: string; ends_on: string } | null;
        }[]
      | null) ?? []
  )
    .filter((row) => {
      if (!row.pay_date) return false;

      const kausi = row.pay_periods;
      return !(
        kausi &&
        kausi.starts_on === periodFrom &&
        kausi.ends_on === periodTo
      );
    })
    .map((row) => ({
      userId: row.user_id,
      payDate: row.pay_date as string,
      taxableCents: Number(row.taxable_cents),
    }));
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();

  for (const row of rows) {
    const k = key(row);
    const lista = map.get(k);
    if (lista) lista.push(row);
    else map.set(k, [row]);
  }

  return map;
}

export type { TaxCardRow };

/**
 * Palkanlaskennan verotiedot kannasta.
 *
 * Erillään payroll-tax.ts:stä, koska se on puhdas moduuli jonka voi
 * ajaa ilman kantaa. Laskenta ei saa tietää mistä luvut tulevat, ja
 * juuri siksi se on testattavissa.
 */

import { createClient } from "@/utils/supabase/server";
import type {
  EmployeeBenefit,
  EmployerSettings,
  TaxCard,
  TaxRules,
} from "./payroll-tax";

// ---------------------------------------------------------------------------
// Vuosisäännöt
// ---------------------------------------------------------------------------

interface RulesRecord {
  tax_year: number;
  employee_pension_rate: string;
  employee_unemployment_rate: string;
  employer_pension_rate: string;
  employer_health_rate: string;
  employer_unemployment_low_rate: string;
  employer_unemployment_high_rate: string;
  employer_unemployment_threshold_cents: number;
  no_tax_card_rate: string;
  max_withholding_rate: string;
  pension_min_age: number;
  pension_max_age: number;
  unemployment_min_age: number;
  unemployment_max_age: number;
  confirmed: boolean;
  source_url: string;
  source_note: string;
}

/**
 * Vuoden säännöt.
 *
 * numeric tulee PostgRESTistä merkkijonona, koska JavaScriptin
 * liukuluku ei riitä kaikille numeric-arvoille. Nämä ovat prosentteja
 * kahdella desimaalilla, joten muunnos on turvallinen — mutta se
 * tehdään tässä eikä jätetä kutsujalle.
 *
 * Puuttuva vuosi palauttaa null. Se on oikea vastaus eikä virhe:
 * vuoden 2027 säännöt eivät ole olemassa ennen kuin ne vahvistetaan,
 * ja palkanlaskennan on kerrottava se eikä keksittävä lukuja.
 */
export async function loadTaxRules(year: number): Promise<TaxRules | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("payroll_tax_rules")
    .select("*")
    .eq("tax_year", year)
    .maybeSingle();

  const row = data as RulesRecord | null;
  if (!row) return null;

  return {
    taxYear: row.tax_year,
    employeePensionRate: Number(row.employee_pension_rate),
    employeeUnemploymentRate: Number(row.employee_unemployment_rate),
    employerPensionRate: Number(row.employer_pension_rate),
    employerHealthRate: Number(row.employer_health_rate),
    employerUnemploymentLowRate: Number(row.employer_unemployment_low_rate),
    employerUnemploymentHighRate: Number(row.employer_unemployment_high_rate),
    employerUnemploymentThresholdCents: Number(
      row.employer_unemployment_threshold_cents,
    ),
    noTaxCardRate: Number(row.no_tax_card_rate),
    maxWithholdingRate: Number(row.max_withholding_rate),
    pensionMinAge: row.pension_min_age,
    pensionMaxAge: row.pension_max_age,
    unemploymentMinAge: row.unemployment_min_age,
    unemploymentMaxAge: row.unemployment_max_age,
  };
}

export interface RulesSource {
  taxYear: number;
  confirmed: boolean;
  sourceUrl: string;
  sourceNote: string;
}

/** Mistä vuoden luvut tulivat. Näytetään laskelman yhteydessä. */
export async function loadRulesSource(
  year: number,
): Promise<RulesSource | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("payroll_tax_rules")
    .select("tax_year, confirmed, source_url, source_note")
    .eq("tax_year", year)
    .maybeSingle();

  const row = data as RulesRecord | null;
  if (!row) return null;

  return {
    taxYear: row.tax_year,
    confirmed: row.confirmed,
    sourceUrl: row.source_url,
    sourceNote: row.source_note,
  };
}

// ---------------------------------------------------------------------------
// Luontoisetujen taulukkoarvot
// ---------------------------------------------------------------------------

export interface BenefitDefault {
  kind: EmployeeBenefit["kind"];
  valueCents: number;
  unit: "per_month" | "per_meal";
  requiresManualValue: boolean;
  note: string;
}

/**
 * Verohallinnon taulukkoarvot vuodelta.
 *
 * Nämä ovat käyttöliittymän ehdotus, eivät laskennan lähde. Kun etu
 * tallennetaan työntekijälle, arvo kirjoitetaan riville — silloin
 * seuraavan vuoden taulukko ei muuta tämän vuoden palkkoja.
 */
export async function loadBenefitDefaults(
  year: number,
): Promise<BenefitDefault[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("payroll_benefit_values")
    .select("kind, value_cents, unit, requires_manual_value, note")
    .eq("tax_year", year);

  return (
    (data as
      | {
          kind: EmployeeBenefit["kind"];
          value_cents: number;
          unit: "per_month" | "per_meal";
          requires_manual_value: boolean;
          note: string;
        }[]
      | null) ?? []
  ).map((row) => ({
    kind: row.kind,
    valueCents: row.value_cents,
    unit: row.unit,
    requiresManualValue: row.requires_manual_value,
    note: row.note,
  }));
}

// ---------------------------------------------------------------------------
// Verokortit
// ---------------------------------------------------------------------------

interface CardRecord {
  id: string;
  user_id: string;
  base_percent: string;
  additional_percent: string;
  income_limit_cents: number;
  prior_income_cents: number;
  valid_from: string;
  valid_to: string | null;
  file_id: string | null;
  source: "manual" | "document";
  note: string;
  created_at: string;
}

export interface TaxCardRow extends TaxCard {
  userId: string;
  fileId: string | null;
  source: "manual" | "document";
  note: string;
  createdAt: string;
}

function toCard(row: CardRecord): TaxCardRow {
  return {
    id: row.id,
    userId: row.user_id,
    basePercent: Number(row.base_percent),
    additionalPercent: Number(row.additional_percent),
    incomeLimitCents: Number(row.income_limit_cents),
    priorIncomeCents: Number(row.prior_income_cents),
    validFrom: row.valid_from,
    validTo: row.valid_to,
    fileId: row.file_id,
    source: row.source,
    note: row.note,
    createdAt: row.created_at,
  };
}

const CARD_COLUMNS =
  "id, user_id, base_percent, additional_percent, income_limit_cents, " +
  "prior_income_cents, valid_from, valid_to, file_id, source, note, created_at";

/**
 * Työntekijän verokortit, uusin ensin.
 *
 * Koko historia eikä vain voimassa oleva. Vanha kortti on se
 * peruste jolla keväällä maksettu palkka laskettiin, ja sen
 * katoaminen tekisi kevään laskelmista selittämättömiä.
 */
export async function loadTaxCards(
  restaurantId: string,
  userId: string,
): Promise<TaxCardRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("tax_cards")
    .select(CARD_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .eq("user_id", userId)
    .order("valid_from", { ascending: false });

  return ((data as CardRecord[] | null) ?? []).map(toCard);
}

/** Koko henkilöstön kortit yhdellä kyselyllä. Listanäkymää varten. */
export async function loadAllTaxCards(
  restaurantId: string,
): Promise<TaxCardRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("tax_cards")
    .select(CARD_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .order("valid_from", { ascending: false });

  return ((data as CardRecord[] | null) ?? []).map(toCard);
}

// ---------------------------------------------------------------------------
// Luontoisedut
// ---------------------------------------------------------------------------

interface BenefitRecord {
  id: string;
  user_id: string;
  kind: EmployeeBenefit["kind"];
  label: string;
  monthly_value_cents: number;
  valid_from: string;
  valid_to: string | null;
}

export interface BenefitRow extends EmployeeBenefit {
  userId: string;
}

export async function loadBenefits(
  restaurantId: string,
  userId?: string,
): Promise<BenefitRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("employee_benefits")
    .select("id, user_id, kind, label, monthly_value_cents, valid_from, valid_to")
    .eq("restaurant_id", restaurantId)
    .order("valid_from", { ascending: false });

  if (userId) query = query.eq("user_id", userId);

  const { data } = await query;

  return ((data as BenefitRecord[] | null) ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    label: row.label,
    monthlyValueCents: row.monthly_value_cents,
    validFrom: row.valid_from,
    validTo: row.valid_to,
  }));
}

// ---------------------------------------------------------------------------
// Ravintolan palkka-asetukset
// ---------------------------------------------------------------------------

/**
 * Ravintolan omat työnantajamaksut.
 *
 * Puuttuva rivi ei ole virhe: useimmilla ravintoloilla näitä ei ole
 * syötetty, ja silloin eläkemaksuna käytetään kansallista keskiarvoa
 * ja kaksi muuta jätetään pois. Laskelma sanoo sen ääneen.
 */
export async function loadEmployerSettings(
  restaurantId: string,
): Promise<EmployerSettings> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("payroll_settings")
    .select("employer_pension_rate, employer_accident_rate, employer_group_life_rate")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  const row = data as {
    employer_pension_rate: string | null;
    employer_accident_rate: string | null;
    employer_group_life_rate: string | null;
  } | null;

  return {
    pensionRate: row?.employer_pension_rate
      ? Number(row.employer_pension_rate)
      : null,
    accidentRate: row?.employer_accident_rate
      ? Number(row.employer_accident_rate)
      : null,
    groupLifeRate: row?.employer_group_life_rate
      ? Number(row.employer_group_life_rate)
      : null,
  };
}

// ---------------------------------------------------------------------------
// Työsuhteen tiedot
// ---------------------------------------------------------------------------

export interface PayrollProfile {
  userId: string;
  payType: "hourly" | "monthly";
  hourlyRateCents: number | null;
  monthlySalaryCents: number | null;
  employmentStartsOn: string | null;
  employmentEndsOn: string | null;
  birthDate: string | null;
}

/**
 * Palkkaperustiedot funktion kautta.
 *
 * Sarakkeisiin ei ole lukuoikeutta rajapinnasta: syntymäaika ja
 * palkka eivät saa tulla kenelle tahansa jäsenelle. Funktio
 * suodattaa esihenkilölle kaikki ja työntekijälle omansa.
 */
export async function loadPayrollProfiles(
  restaurantId: string,
): Promise<PayrollProfile[]> {
  const supabase = await createClient();

  const { data } = await supabase.rpc("employee_payroll_info", {
    p_restaurant: restaurantId,
  });

  return (
    (data as
      | {
          user_id: string;
          pay_type: "hourly" | "monthly";
          hourly_rate_cents: number | null;
          monthly_salary_cents: number | null;
          employment_starts_on: string | null;
          employment_ends_on: string | null;
          birth_date: string | null;
        }[]
      | null) ?? []
  ).map((row) => ({
    userId: row.user_id,
    payType: row.pay_type,
    hourlyRateCents: row.hourly_rate_cents,
    monthlySalaryCents: row.monthly_salary_cents,
    employmentStartsOn: row.employment_starts_on,
    employmentEndsOn: row.employment_ends_on,
    birthDate: row.birth_date,
  }));
}

// ---------------------------------------------------------------------------
// Kertymä ja tuloraja
// ---------------------------------------------------------------------------

export interface Accrual {
  grossCents: number;
  benefitsCents: number;
  taxableCents: number;
  withholdingCents: number;
  employeePensionCents: number;
  employeeUnemploymentCents: number;
  netCents: number;
  employerCostCents: number;
  payslipCount: number;
}

const TYHJA_KERTYMA: Accrual = {
  grossCents: 0,
  benefitsCents: 0,
  taxableCents: 0,
  withholdingCents: 0,
  employeePensionCents: 0,
  employeeUnemploymentCents: 0,
  netCents: 0,
  employerCostCents: 0,
  payslipCount: 0,
};

/**
 * Verovuoden kertymä hyväksytyistä ja maksetuista laskelmista.
 *
 * Kanta laskee, ei selain. Selaimessa laskettu kertymä olisi oikea
 * vain niin kauan kuin sivulla on kaikki laskelmat, eikä se ole
 * koskaan totta.
 */
export async function loadAccrual(
  restaurantId: string,
  userId: string,
  year: number,
): Promise<Accrual> {
  const supabase = await createClient();

  const { data } = await supabase.rpc("payroll_accrual", {
    p_restaurant: restaurantId,
    p_user: userId,
    p_year: year,
  });

  const row = (
    data as
      | {
          gross_cents: number;
          benefits_cents: number;
          taxable_cents: number;
          withholding_cents: number;
          employee_pension_cents: number;
          employee_unemployment_cents: number;
          net_cents: number;
          employer_cost_cents: number;
          payslip_count: number;
        }[]
      | null
  )?.[0];

  if (!row) return TYHJA_KERTYMA;

  return {
    grossCents: Number(row.gross_cents),
    benefitsCents: Number(row.benefits_cents),
    taxableCents: Number(row.taxable_cents),
    withholdingCents: Number(row.withholding_cents),
    employeePensionCents: Number(row.employee_pension_cents),
    employeeUnemploymentCents: Number(row.employee_unemployment_cents),
    netCents: Number(row.net_cents),
    employerCostCents: Number(row.employer_cost_cents),
    payslipCount: row.payslip_count,
  };
}

export interface IncomeLimit {
  taxCardId: string;
  limitCents: number;
  usedCents: number;
  remainingCents: number;
}

/**
 * Tulorajan tila maksupäivänä.
 *
 * Null tarkoittaa ettei maksupäivälle ole verokorttia. Se on eri asia
 * kuin nolla käytettyä, ja käyttöliittymän on kerrottava kumpi.
 */
export async function loadIncomeLimit(
  restaurantId: string,
  userId: string,
  payDate: string,
): Promise<IncomeLimit | null> {
  const supabase = await createClient();

  const { data } = await supabase.rpc("income_limit_status", {
    p_restaurant: restaurantId,
    p_user: userId,
    p_pay_date: payDate,
  });

  const row = (
    data as
      | {
          tax_card_id: string;
          limit_cents: number;
          used_cents: number;
          remaining_cents: number;
        }[]
      | null
  )?.[0];

  if (!row) return null;

  return {
    taxCardId: row.tax_card_id,
    limitCents: Number(row.limit_cents),
    usedCents: Number(row.used_cents),
    remainingCents: Number(row.remaining_cents),
  };
}

/**
 * Ravintolan palkkasumma vuodelta ennen annettua maksupäivää.
 *
 * Työnantajan työttömyysvakuutusmaksu on porrastettu koko yrityksen
 * vuosipalkkasumman mukaan, joten yhden työntekijän laskelma tarvitsee
 * tiedon kaikkien muiden palkoista. Vain hyväksytyt ja maksetut:
 * luonnos ei ole palkkasummaa.
 */
export async function loadPayrollBefore(
  restaurantId: string,
  payDate: string,
): Promise<number> {
  const supabase = await createClient();

  const vuosi = payDate.slice(0, 4);

  const { data } = await supabase
    .from("payslips")
    .select("taxable_cents")
    .eq("restaurant_id", restaurantId)
    .in("status", ["approved", "paid"])
    .gte("pay_date", `${vuosi}-01-01`)
    .lt("pay_date", payDate);

  return ((data as { taxable_cents: number }[] | null) ?? []).reduce(
    (sum, row) => sum + Number(row.taxable_cents),
    0,
  );
}

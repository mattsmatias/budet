/**
 * Bruttopalkasta nettopalkkaan ja työnantajan kustannukseen.
 *
 * Sama erittely kahdessa paikassa: hyväksytyllä laskelmalla se
 * näyttää jäädytetyt luvut, luonnoksella ennusteen. Kaksi
 * toteutusta erkanisi ensimmäisen muutoksen kohdalla, ja lukija
 * näkisi kahdessa näkymässä kaksi eri erittelyä samasta palkasta.
 *
 * ---------------------------------------------------------------------
 * KOLME LOHKOA, KOLME KYSYMYSTÄ
 * ---------------------------------------------------------------------
 *
 *   veronalainen palkka   mistä pidätetään
 *   vähennykset           mitä työntekijältä jää pois
 *   työnantajan maksut    mitä palkan päälle tulee
 *
 * Kolmas on se jonka takia tämä komponentti on olemassa. Bruttopalkka
 * ei ole palkkakustannus, ja ero on noin viidennes.
 */

import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { formatMoney } from "@/lib/money";
import type { PayslipTax } from "@/lib/restoflow/payroll-tax";
import type { StoredPayslip } from "@/lib/restoflow/queries";

/**
 * Prosentti käyttäjän kielellä.
 *
 * String(19.3) antaa "19.3", ja suomeksi luetaan "19,3". Piste
 * desimaalierottimena on englantia keskellä suomenkielistä
 * palkkalaskelmaa — pieni asia, mutta juuri se pieni asia jonka
 * kohdalla lukija alkaa epäillä muutakin.
 */
function percent(value: number, tag: string): string {
  return `${value.toLocaleString(tag, { maximumFractionDigits: 2 })} %`;
}

export interface CostRows {
  grossCents: number;
  benefitsCents: number;
  taxableCents: number;

  withholdingCents: number;
  employeePensionCents: number;
  employeeUnemploymentCents: number;
  netCents: number;

  employerPensionCents: number;
  employerHealthCents: number;
  employerUnemploymentCents: number;
  employerAccidentCents: number;
  employerGroupLifeCents: number;
  employerTotalCents: number;

  noTaxCard: boolean;
  basePercent: number | null;
  employeePensionRate: number | null;
  employeeUnemploymentRate: number | null;
  employerPensionRate: number | null;
  employerHealthRate: number | null;
  employerUnemploymentRate: number | null;
  employerAccidentRate: number | null;
  employerGroupLifeRate: number | null;
}

/** Laskennan tulos näyttömuotoon. */
export function rowsFromTax(tax: PayslipTax): CostRows {
  return {
    grossCents: tax.grossCents,
    benefitsCents: tax.benefitsCents,
    taxableCents: tax.taxableCents,
    withholdingCents: tax.withholding.cents,
    employeePensionCents: tax.employeePensionCents,
    employeeUnemploymentCents: tax.employeeUnemploymentCents,
    netCents: tax.netCents,
    employerPensionCents: tax.employerPensionCents,
    employerHealthCents: tax.employerHealthCents,
    employerUnemploymentCents: tax.employerUnemploymentCents,
    employerAccidentCents: tax.employerAccidentCents,
    employerGroupLifeCents: tax.employerGroupLifeCents,
    employerTotalCents: tax.employerTotalCents,
    noTaxCard: tax.withholding.noTaxCard,
    basePercent: tax.used.basePercent,
    employeePensionRate: tax.used.employeePensionRate,
    employeeUnemploymentRate: tax.used.employeeUnemploymentRate,
    employerPensionRate: tax.used.employerPensionRate,
    employerHealthRate: tax.used.employerHealthRate,
    employerUnemploymentRate: tax.used.employerUnemploymentRate,
    employerAccidentRate: tax.used.employerAccidentRate,
    employerGroupLifeRate: tax.used.employerGroupLifeRate,
  };
}

/**
 * Tallennettu laskelma näyttömuotoon.
 *
 * Luvut luetaan riviltä eikä lasketa uudelleen. Hyväksytty palkka on
 * tilannekuva, ja sen numeroiden on pysyttävä samoina myös sinä
 * päivänä kun vuosisäännöt vaihtuvat.
 */
export function rowsFromStored(slip: StoredPayslip): CostRows {
  return {
    grossCents: slip.grossCents,
    benefitsCents: slip.benefitsCents,
    taxableCents: slip.taxableCents,
    withholdingCents: slip.withholdingCents,
    employeePensionCents: slip.employeePensionCents,
    employeeUnemploymentCents: slip.employeeUnemploymentCents,
    netCents: slip.netCents,
    employerPensionCents: slip.employerPensionCents,
    employerHealthCents: slip.employerHealthCents,
    employerUnemploymentCents: slip.employerUnemploymentCents,
    employerAccidentCents: slip.employerAccidentCents,
    employerGroupLifeCents: slip.employerGroupLifeCents,
    employerTotalCents:
      slip.taxableCents +
      slip.employerPensionCents +
      slip.employerHealthCents +
      slip.employerUnemploymentCents +
      slip.employerAccidentCents +
      slip.employerGroupLifeCents,
    noTaxCard: slip.noTaxCard,
    basePercent: slip.taxBasePercentUsed,
    employeePensionRate: slip.employeePensionRateUsed,
    employeeUnemploymentRate: slip.employeeUnemploymentRateUsed,
    employerPensionRate: slip.employerPensionRateUsed,
    employerHealthRate: slip.employerHealthRateUsed,
    employerUnemploymentRate: slip.employerUnemploymentRateUsed,
    employerAccidentRate: slip.employerAccidentRateUsed,
    employerGroupLifeRate: slip.employerGroupLifeRateUsed,
  };
}

export function CostBreakdown({
  t,
  tag,
  rows,
  /** Ennuste vai hyväksytyn laskelman jäädytetyt luvut. */
  frozen,
}: {
  t: AdminText;
  /** Intl-tunniste prosenttien ja lukujen muotoiluun. */
  tag: string;
  rows: CostRows;
  frozen: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* --- Veronalainen palkka ----------------------------------------- */}

      <dl className="space-y-2 text-[14px]">
        <Line label={t.verotus.grossPay} cents={rows.grossCents} />

        {/*
          Luontoisetu näkyy vain jos sellainen on.

          Nollarivi jokaisella laskelmalla olisi rivi joka kysyy
          lukijalta huomiota kertomatta mitään.
        */}
        {rows.benefitsCents > 0 ? (
          <Line label={t.verotus.benefits} cents={rows.benefitsCents} />
        ) : null}

        {rows.benefitsCents > 0 ? (
          <Line label={t.verotus.taxablePay} cents={rows.taxableCents} strong />
        ) : null}
      </dl>

      {/* --- Vähennykset -------------------------------------------------- */}

      <div className="pt-3" style={{ borderTop: "1px solid var(--rf-line)" }}>
        <p
          className="mb-2 text-[12px] font-semibold uppercase"
          style={{ color: "var(--rf-text-3)", letterSpacing: "0.04em" }}
        >
          {t.verotus.deductions}
        </p>

        <dl className="space-y-2 text-[14px]">
          <Line
            label={t.verotus.withholding}
            /*
              Verokortitta laskettu pidätys sanotaan ääneen.

              Kuusikymmentä prosenttia näyttäisi muuten virheeltä, ja
              se on juuri se rivi jonka takia työntekijä tulee
              kysymään.
            */
            hint={
              rows.noTaxCard
                ? fill(t.verotus.withoutCard, {
                    prosentti: percent(rows.basePercent ?? 60, tag).replace(
                      " %",
                      "",
                    ),
                  })
                : rows.basePercent !== null
                  ? percent(rows.basePercent, tag)
                  : undefined
            }
            cents={-rows.withholdingCents}
            warn={rows.noTaxCard}
          />

          <Line
            label={t.verotus.employeePension}
            hint={
              rows.employeePensionRate
                ? percent(rows.employeePensionRate, tag)
                : undefined
            }
            cents={-rows.employeePensionCents}
          />

          <Line
            label={t.verotus.employeeUnemployment}
            hint={
              rows.employeeUnemploymentRate
                ? percent(rows.employeeUnemploymentRate, tag)
                : undefined
            }
            cents={-rows.employeeUnemploymentCents}
          />

          {/*
            Luontoisetu takaisin pois.

            Se kasvatti veronalaista palkkaa ja siten pidätystä, mutta
            sitä ei makseta rahana. Ilman tätä riviä nettopalkka ei
            täsmäisi yhteenlaskussa, ja lukija etsisi virhettä sieltä
            missä sitä ei ole.
          */}
          {rows.benefitsCents > 0 ? (
            <Line label={t.verotus.benefits} cents={-rows.benefitsCents} />
          ) : null}
        </dl>

        <div
          className="mt-3 flex items-baseline justify-between gap-4 pt-3"
          style={{ borderTop: "1px solid var(--rf-line)" }}
        >
          <span className="text-[15px] font-semibold">{t.verotus.netPay}</span>
          <span className="rf-tabular text-[19px] font-semibold">
            {formatMoney(rows.netCents)}
          </span>
        </div>
      </div>

      {/* --- Työnantajan maksut ------------------------------------------- */}

      <div
        className="px-3 py-3"
        style={{
          background: "var(--rf-inset)",
          borderRadius: "var(--rf-r-card)",
        }}
      >
        <p
          className="mb-2 text-[12px] font-semibold uppercase"
          style={{ color: "var(--rf-text-3)", letterSpacing: "0.04em" }}
        >
          {t.verotus.employerContributions}
        </p>

        <dl className="space-y-2 text-[14px]">
          <Line
            label={t.verotus.employerPension}
            hint={
              rows.employerPensionRate
                ? percent(rows.employerPensionRate, tag)
                : undefined
            }
            cents={rows.employerPensionCents}
          />
          <Line
            label={t.verotus.employerHealth}
            hint={
              rows.employerHealthRate
                ? percent(rows.employerHealthRate, tag)
                : undefined
            }
            cents={rows.employerHealthCents}
          />
          <Line
            label={t.verotus.employerUnemployment}
            hint={
              rows.employerUnemploymentRate
                ? percent(rows.employerUnemploymentRate, tag)
                : undefined
            }
            cents={rows.employerUnemploymentCents}
          />

          {/*
            Tapaturma- ja ryhmähenkivakuutus vain jos ravintola on
            kertonut prosenttinsa. Nolla näyttäisi siltä ettei niitä
            makseta, ja se olisi väärä väite.
          */}
          {rows.employerAccidentRate !== null ? (
            <Line
              label={t.verotus.employerAccident}
              hint={percent(rows.employerAccidentRate, tag)}
              cents={rows.employerAccidentCents}
            />
          ) : null}

          {rows.employerGroupLifeRate !== null ? (
            <Line
              label={t.verotus.employerGroupLife}
              hint={percent(rows.employerGroupLifeRate, tag)}
              cents={rows.employerGroupLifeCents}
            />
          ) : null}
        </dl>

        <div
          className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-3"
          style={{ borderTop: "1px solid var(--rf-line-strong)" }}
        >
          <span className="text-[15px] font-semibold">
            {t.verotus.employerTotal}
          </span>
          <span className="rf-tabular text-[22px] font-semibold">
            {formatMoney(rows.employerTotalCents)}
          </span>

          {/*
            Lisäkulu prosentteina.

            "2 386,40 €" ei kerro onko se paljon. "+19,3 % palkan
            päälle" kertoo, ja se on se luku jota hinnoittelussa
            käytetään.
          */}
          {rows.taxableCents > 0 ? (
            <span
              className="w-full text-[12.5px]"
              style={{ color: "var(--rf-text-2)" }}
            >
              {fill(t.verotus.overhead, {
                prosentti: (
                  Math.round(
                    ((rows.employerTotalCents - rows.taxableCents) /
                      rows.taxableCents) *
                      1000,
                  ) / 10
                ).toLocaleString(tag, { maximumFractionDigits: 1 }),
              })}
            </span>
          ) : null}
        </div>
      </div>

      <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
        {frozen ? t.verotus.frozen : t.verotus.estimate}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Yksi rivi: nimi, peruste ja summa.
 *
 * Peruste on prosentti. Ilman sitä lukija ei voi tarkistaa riviä, ja
 * palkkalaskelma jota ei voi tarkistaa on lupaus eikä laskelma.
 */
function Line({
  label,
  hint,
  cents,
  strong,
  warn,
}: {
  label: string;
  hint?: string;
  cents: number;
  strong?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="min-w-0">
        <span
          className={strong ? "font-semibold" : undefined}
          style={warn ? { color: "var(--rf-amber-text)" } : undefined}
        >
          {label}
        </span>
        {hint ? (
          <span
            className="mt-0.5 block text-[12px]"
            style={{
              color: warn ? "var(--rf-amber-text)" : "var(--rf-text-3)",
            }}
          >
            {hint}
          </span>
        ) : null}
      </dt>
      <dd
        className={`rf-tabular shrink-0 ${strong ? "font-semibold" : "font-medium"}`}
      >
        {formatMoney(cents)}
      </dd>
    </div>
  );
}

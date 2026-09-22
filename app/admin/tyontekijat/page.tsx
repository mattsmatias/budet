import Link from "next/link";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { LOCALE_INFO } from "@/lib/i18n/app-locales";
import { adminContext } from "@/lib/restoflow/page-context";
import { monthFromParams, monthRange } from "@/lib/restoflow/dates";
import { formatMonth } from "@/lib/restoflow/expenses";
import {
  fetchEmployees,
  fetchPayrollSettings,
  fetchTimeEntries,
} from "@/lib/restoflow/queries";
import { costFor, sumCosts } from "@/lib/restoflow/payroll";
import { formatMoney } from "@/lib/money";
import { formatHours, summarise, totals } from "@/lib/restoflow/employees";
import { fill } from "@/lib/i18n/auth-text";
import { CountUp } from "@/components/restoflow/count-up";
import { RfIcon } from "@/components/restoflow/icons";
import { EmptyState, MetricCard, Pill } from "@/components/restoflow/ui";
import { EmployeeList } from "./list";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.tyo.title };
}

/**
 * Työntekijät ja toteutuneet tunnit.
 *
 * KATE EI LASKE PALKKOJA.
 *
 * Tunnit kertaa tuntipalkka on arvio siitä mitä työ maksoi. Se on
 * käytettävissä heti kuun aikana, kun palkkalaskelma tulee jälkikäteen.
 * TES-lisät, lomakorvaukset ja työnantajan sivukulut jäävät
 * palkkapalveluun, eikä tämä näkymä teeskentele tietävänsä niistä.
 */
export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { restaurant, month: nykyinen } = await adminContext(
    "/admin/tyontekijat",
  );

  const locale = await resolveLocale();
  const t = adminText(locale);
  const month = monthFromParams(await searchParams, nykyinen);
  const tag = LOCALE_INFO[locale].tag;

  const { from } = monthRange(month);

  /*
   * Leimaukset kuukauden alusta.
   *
   * Kesken oleva vuoro voi olla alkanut eilen, joten haku alkaa
   * kuukauden alusta eikä tästä päivästä — muuten yövuoro katoaisi
   * listalta kesken vuoron.
   */
  const [employees, entries, payroll] = await Promise.all([
    fetchEmployees(restaurant.id),
    fetchTimeEntries(restaurant.id, from),
    fetchPayrollSettings(restaurant.id),
  ]);

  const rows = summarise(employees, entries, month);
  const summa = totals(rows);

  /*
   * Mita tyo maksaa, ei mita siita jaa kateen.
   *
   * Lisat, lomakorvaus ja sivukulut tulevat yrityksen asetuksista.
   * Ilman niita kustannus on sama kuin bruttopalkka — liian pieni,
   * mutta rehellisesti eika keksityilla prosenteilla.
   */
  const inMonth = entries.filter((e) => e.date.startsWith(month));
  const costs = rows.map((row) =>
    costFor(
      inMonth.filter((e) => e.employeeId === row.employee.id),
      row.employee.hourlyCents,
      restaurant.timezone,
      payroll,
    ),
  );
  const cost = sumCosts(costs);

  return (
    <div className="rf-enter space-y-5 md:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {t.tyo.lead} · {formatMonth(month, locale)}
        </p>

        <div className="flex items-center gap-3">
          {summa.working > 0 ? (
            <Pill tone="ok" dot>
              {fill(t.tyo.workingNow, { maara: String(summa.working) })}
            </Pill>
          ) : null}

          {/*
            Lisäys on käyttäjissä, ei täällä.

            Työntekijä on käyttäjä: hän tarvitsee tunnuksen voidakseen
            leimata. Kun lisäys oli kahdessa paikassa, sama sähköposti
            kirjoitettiin kahdesti ja meni eri tavalla.
          */}
          <Link
            href="/admin/asetukset?osio=kayttajat"
            className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
            style={{
              background: "var(--rf-accent)",
              color: "var(--rf-on-accent)",
              borderRadius: "var(--rf-r-control)",
              minHeight: 36,
            }}
          >
            <RfIcon name="plus" size={16} />
            {t.tyo.add}
          </Link>
        </div>
      </div>

      <section
        aria-label={t.sanat.keyFigures}
        className="grid auto-rows-fr rf-stat-grid grid-cols-2 gap-2.5 sm:gap-3.5"
      >
        <MetricCard
          label={t.tyo.totalHours}
          value={formatHours(summa.minutes, tag)}
          icon={<RfIcon name="clock" size={17} />}
          tileTone="blue"
          tone="muted"
          conclusion={formatMonth(month, locale)}
        />

        <MetricCard
          label={t.palkkaAs.cost}
          value={<CountUp to={cost.totalCents} format="money" />}
          icon={<RfIcon name="staff" size={17} />}
          tileTone="violet"
          tone="muted"
          conclusion={
            cost.totalCents > summa.payCents
              ? t.palkkaAs.costHint
              : t.palkkaAs.setUp
          }
          href="/admin/asetukset?osio=palkat"
          linkLabel={t.palkkaAs.section}
        />
      </section>

      <p
        className="px-1 text-[12.5px] leading-relaxed"
        style={{ color: "var(--rf-text-3)" }}
      >
        {t.tyo.estimateNote}
      </p>

      {/* Erittely: mista kustannus koostuu. */}
      {cost.totalCents > 0 ? (
        <div
          className="flex flex-wrap gap-x-5 gap-y-1 px-1 text-[12.5px]"
          style={{ color: "var(--rf-text-3)" }}
        >
          <span>
            {t.palkkaAs.wage} {formatMoney(cost.baseCents)}
          </span>
          {cost.supplementCents > 0 ? (
            <span>
              {t.palkkaAs.supplements} {formatMoney(cost.supplementCents)}
            </span>
          ) : null}
          {cost.holidayCents > 0 ? (
            <span>
              {t.palkkaAs.holiday} {formatMoney(cost.holidayCents)}
            </span>
          ) : null}
          {cost.sideCostCents > 0 ? (
            <span>
              {t.palkkaAs.sideCosts} {formatMoney(cost.sideCostCents)}
            </span>
          ) : null}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState title={t.tyo.none} description={t.tyo.noneHint} />
      ) : (
        <EmployeeList t={t} rows={rows} locale={tag} />
      )}
    </div>
  );
}

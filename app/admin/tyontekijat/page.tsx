import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { LOCALE_INFO } from "@/lib/i18n/app-locales";
import { adminContext } from "@/lib/restoflow/page-context";
import { monthFromParams, monthRange } from "@/lib/restoflow/dates";
import { formatMonth } from "@/lib/restoflow/expenses";
import { fetchEmployees, fetchTimeEntries } from "@/lib/restoflow/queries";
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
  const [employees, entries] = await Promise.all([
    fetchEmployees(restaurant.id),
    fetchTimeEntries(restaurant.id, from),
  ]);

  const rows = summarise(employees, entries, month);
  const summa = totals(rows);

  return (
    <div className="rf-enter space-y-5 md:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {t.tyo.lead} · {formatMonth(month, locale)}
        </p>

        {summa.working > 0 ? (
          <Pill tone="ok" dot>
            {fill(t.tyo.workingNow, { maara: String(summa.working) })}
          </Pill>
        ) : null}
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
          label={t.tyo.totalPay}
          value={<CountUp to={summa.payCents} format="money" />}
          icon={<RfIcon name="staff" size={17} />}
          tileTone="violet"
          tone="muted"
          conclusion={t.tyo.estimatedPay}
        />
      </section>

      <p
        className="px-1 text-[12.5px] leading-relaxed"
        style={{ color: "var(--rf-text-3)" }}
      >
        {t.tyo.estimateNote}
      </p>

      {rows.length === 0 && employees.length === 0 ? (
        <>
          <EmptyState title={t.tyo.none} description={t.tyo.noneHint} />
          <EmployeeList t={t} rows={[]} locale={tag} />
        </>
      ) : (
        <EmployeeList t={t} rows={rows} locale={tag} />
      )}
    </div>
  );
}

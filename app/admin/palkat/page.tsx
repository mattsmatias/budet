import Link from "next/link";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { LOCALE_INFO } from "@/lib/i18n/app-locales";
import { adminContext } from "@/lib/restoflow/page-context";
import { monthFromParams, monthRange } from "@/lib/restoflow/dates";
import {
  formatMonth,
  previousMonth,
  receiptsInMonth,
  sortByDateDesc,
} from "@/lib/restoflow/expenses";
import {
  labourShareOfSales,
  salesBetween,
  totalSalesCents,
} from "@/lib/restoflow/sales";
import { can } from "@/lib/restoflow/permissions";
import {
  fetchCompanyTes,
  fetchEmployees,
  fetchPayrollSettings,
  fetchTimeEntries,
} from "@/lib/restoflow/queries";
import { formatHours, fullName } from "@/lib/restoflow/employees";
import { staffCost } from "@/lib/restoflow/staff-cost";
import { costPerHourCents } from "@/lib/restoflow/payroll";
import { formatTesValidity, versionFor } from "@/lib/restoflow/tes";
import { fill } from "@/lib/i18n/auth-text";
import { formatMoney } from "@/lib/money";
import { formatDayIn } from "@/lib/i18n/labels";
import { CountUp } from "@/components/restoflow/count-up";
import { RfIcon } from "@/components/restoflow/icons";
import {
  Card,
  CardHeader,
  EmptyState,
  MetricCard,
  Pill,
} from "@/components/restoflow/ui";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.palkat.title };
}

/**
 * Palkat.
 *
 * YKSI SIVU, KAKSI LUKUA SAMASTA ASIASTA.
 *
 * Kirjattu palkkakulu on tosiasia: se tulee palkkapalvelusta ja menee
 * kirjanpitoon. Toteutuneista tunneista laskettu kustannus on arvio,
 * mutta se on käytettävissä jo kesken kuun. Kumpikin vastaa samaan
 * kysymykseen — paljonko henkilöstö maksaa — joten ne kuuluvat samalle
 * sivulle eivätkä kahdelle.
 *
 * KATE EI LASKE PALKKOJA.
 *
 * Ennakonpidätys, sairausajan palkka ja TES-tulkinnat kuuluvat
 * palkkapalveluun. Tämä sivu kertoo mitä työ maksaa työnantajalle ja
 * mikä osuus se on myynnistä.
 *
 * Työntekijöiden hallinta on asetuksissa käyttäjien kanssa: työntekijä
 * on käyttäjä, ja lisääminen kahdessa paikassa tuotti kaksi eri
 * sähköpostia samalle ihmiselle.
 */
export default async function WagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { receipts, sales, restaurant, role, month: nykyinen } =
    await adminContext("/admin/palkat");

  const locale = await resolveLocale();
  const t = adminText(locale);
  const tag = LOCALE_INFO[locale].tag;
  const month = monthFromParams(await searchParams, nykyinen);

  const staffIn = (kuukausi: string) =>
    receiptsInMonth(receipts, kuukausi)
      .filter((r) => r.category === "staff")
      .reduce((sum, r) => sum + r.totalCents, 0);

  const entries = sortByDateDesc(
    receiptsInMonth(receipts, month).filter((r) => r.category === "staff"),
  );
  const totalCents = staffIn(month);

  const { from, to } = monthRange(month);
  const salesCents = totalSalesCents(salesBetween(sales, from, to));
  const share =
    totalCents > 0 ? labourShareOfSales(totalCents, salesCents) : null;

  /* Kuusi kuukautta taaksepäin, vanhin ensin. */
  const history: { month: string; cents: number }[] = [];
  let cursor = month;
  for (let i = 0; i < 6; i += 1) {
    history.unshift({ month: cursor, cents: staffIn(cursor) });
    cursor = previousMonth(cursor);
  }
  const maxCents = Math.max(...history.map((h) => h.cents), 1);

  /*
   * Tunnit vain sille joka saa nähdä työntekijät.
   *
   * Kirjanpitäjä lukee palkkakulun ja sen osuuden myynnistä; kuka teki
   * mitäkin ja millä tuntipalkalla ei kuulu hänelle.
   */
  const seesHours = can(role, "employees.manage");

  const [employees, timeEntries, payroll, tesVersions] = seesHours
    ? await Promise.all([
        fetchEmployees(restaurant.id),
        fetchTimeEntries(restaurant.id, from),
        fetchPayrollSettings(restaurant.id),
        fetchCompanyTes(restaurant.id),
      ])
    : [[], [], null, []];

  /* Sama laskenta kuin yleiskatsauksessa ja kuukausiraportissa. */
  const time = staffCost(
    employees,
    timeEntries,
    month,
    restaurant.timezone,
    payroll,
    tesVersions,
  );
  const rows = time.rows;

  /* Voimassa oleva versio nayttoa varten. */
  const tes = versionFor(tesVersions, to);
  const cost = time.total;

  /*
   * Ohjearvo vain sille jolle se sopii.
   *
   * Ravintolan ja kahvilan 25–35 % on alan yleinen väli. Parturin
   * palkkio- ja tuolivuokramallit vaihtelevat niin paljon, ettei
   * yleinen luku kerro siellä mitään.
   */
  const typical =
    restaurant.businessType === "barber"
      ? t.palkat.ownHistoryNote
      : t.palkat.typicalNote;

  return (
    <div className="rf-enter space-y-5 md:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {t.palkat.lead} · {formatMonth(month, locale)}
        </p>

        <div className="flex items-center gap-3">
          {time.working > 0 ? (
            <Pill tone="ok" dot>
              {fill(t.tyo.workingNow, { maara: String(time.working) })}
            </Pill>
          ) : null}

          <Link
            href="/admin/kuitit/uusi?luokka=staff"
            className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
            style={{
              background: "var(--rf-accent)",
              color: "var(--rf-on-accent)",
              borderRadius: "var(--rf-r-control)",
              minHeight: 36,
            }}
          >
            <RfIcon name="plus" size={16} />
            {t.palkat.record}
          </Link>
        </div>
      </div>

      <section
        aria-label={t.sanat.keyFigures}
        className="grid auto-rows-fr rf-stat-grid grid-cols-2 gap-2.5 sm:gap-3.5 xl:grid-cols-4"
      >
        <MetricCard
          label={t.palkat.monthTotal}
          value={<CountUp to={totalCents} format="money" />}
          icon={<RfIcon name="staff" size={17} />}
          tileTone="blue"
          tone="muted"
          conclusion={formatMonth(month, locale)}
        />

        <MetricCard
          label={t.palkat.share}
          value={share === null ? "—" : `${Math.round(share * 100)} %`}
          icon={<RfIcon name="trend" size={17} />}
          tileTone="violet"
          tone="muted"
          conclusion={
            totalCents === 0
              ? t.palkat.none
              : share === null
                ? t.palkat.noSales
                : t.palkat.shareNote
          }
        />

        {seesHours ? (
          <>
            <MetricCard
              label={t.tyo.totalHours}
              value={formatHours(time.minutes, tag)}
              icon={<RfIcon name="clock" size={17} />}
              tileTone="green"
              tone="muted"
              conclusion={formatMonth(month, locale)}
            />

            <MetricCard
              label={t.palkkaAs.cost}
              value={<CountUp to={cost.totalCents} format="money" />}
              icon={<RfIcon name="staff" size={17} />}
              tileTone="brand"
              tone="muted"
              /*
               * Kustannus tunnilta on yrittajalle hyodyllisempi luku
               * kuin kuukauden summa: sita voi verrata tuntipalkkaan.
               */
              conclusion={
                costPerHourCents(cost) === null
                  ? t.palkkaAs.setUp
                  : `${formatMoney(costPerHourCents(cost)!)}/h`
              }
              href="/admin/asetukset?osio=palkat"
              linkLabel={t.palkkaAs.section}
            />
          </>
        ) : null}
      </section>

      <div
        className="space-y-1 px-1 text-[12.5px] leading-relaxed"
        style={{ color: "var(--rf-text-3)" }}
      >
        <p>{typical}</p>

        {/*
          Puuttuva sopimusversio sanotaan aaneen.

          Nama paivat on laskettu yrityksen omilla asetuksilla, ei
          sopimuksella. Ilman huomautusta luku nayttaisi yhta
          sopimuksenmukaiselta kuin muutkin.
        */}
        {time.missingTes.length > 0 ? (
          <p style={{ color: "var(--rf-warn-text, var(--rf-text-2))" }}>
            {fill(t.palkkaAs.tesMissing, {
              paivat: time.missingTes
                .map((paiva) => formatDayIn(paiva, locale))
                .join(", "),
            })}
          </p>
        ) : null}

        {/* Sovellettava sopimus nakyy mutta ei aukea muokattavaksi. */}
        {tes ? (
          <p>
            {t.palkkaAs.tesTitle}: {tes.name} ({formatTesValidity(tes, locale, t.palkkaAs.untilFurther)})
          </p>
        ) : null}
      </div>

      {/* Erittely: mistä työn kustannus koostuu. */}
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

      {/*
        Työntekijät tunteineen.

        Luettelo eikä hallinta: muokkaus ja käytöstä poisto ovat
        asetuksissa käyttäjien kanssa, koska työntekijä on käyttäjä.
      */}
      {seesHours && rows.length > 0 ? (
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader title={t.tyo.title} subtitle={t.tyo.lead} />
          </div>

          <ul className="space-y-3.5 px-5 pb-5">
            {rows.map((row) => (
              <li
                key={row.employee.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
              >
                <span className="min-w-0">
                  <span className="text-[15px] font-semibold">
                    {fullName(row.employee)}
                  </span>
                  {row.working ? (
                    <span className="ms-2 align-middle">
                      <Pill tone="ok" dot>
                        {t.tyo.working}
                      </Pill>
                    </span>
                  ) : null}
                  <span
                    className="block text-[12.5px]"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    {row.employee.jobTitle ?? "—"} ·{" "}
                    {formatMoney(row.employee.hourlyCents)}/h
                  </span>
                </span>

                <span className="rf-tabular shrink-0 text-end">
                  <span className="block text-[15px] font-semibold">
                    {formatHours(row.minutes, tag)}
                  </span>
                  <span
                    className="block text-[12.5px]"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    {formatMoney(row.cost.totalCents)}
                    {costPerHourCents(row.cost) !== null
                      ? ` · ${formatMoney(costPerHourCents(row.cost)!)}/h`
                      : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div
            className="border-t px-5 py-3.5 text-[12.5px]"
            style={{ borderColor: "var(--rf-line)" }}
          >
            <Link
              href="/admin/asetukset?osio=kayttajat"
              className="rf-press font-semibold underline-offset-4 hover:underline"
            >
              {t.tyo.manageInSettings} →
            </Link>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title={t.palkat.history} />
        <ul className="mt-3 space-y-2.5">
          {history.map((row) => (
            <li key={row.month}>
              <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                <span>{formatMonth(row.month, locale)}</span>
                <span className="rf-tabular font-semibold">
                  {formatMoney(row.cents)}
                </span>
              </div>
              {/* Palkki on suhde, ei koriste: kuukaudet ovat vertailukelpoisia
                  vain kun ne on mitattu samalla asteikolla. */}
              <div
                className="mt-1 h-1.5 w-full overflow-hidden"
                style={{ background: "var(--rf-inset)", borderRadius: 999 }}
              >
                <div
                  className="h-full"
                  style={{
                    width: `${Math.round((row.cents / maxCents) * 100)}%`,
                    background: "var(--rf-blue)",
                    borderRadius: 999,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {entries.length === 0 ? (
        <EmptyState title={t.palkat.none} description={t.palkat.noneHint} />
      ) : (
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title={t.palkat.entries}
              subtitle={t.palkat.entriesHint}
            />
          </div>

          <ul className="space-y-3 px-5 pb-5">
            {entries.map((receipt) => (
              <li key={receipt.id}>
                <Link
                  href={`/admin/kuitit/${receipt.id}`}
                  className="rf-press flex items-baseline justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold">
                      {receipt.supplierName}
                    </span>
                    <span
                      className="rf-tabular block text-[12px]"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      {formatDayIn(receipt.date, locale)}
                    </span>
                  </span>
                  <span className="rf-tabular shrink-0 text-[16px] font-semibold">
                    {formatMoney(receipt.totalCents)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

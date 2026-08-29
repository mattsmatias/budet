import Link from "next/link";
import { adminText } from "@/lib/i18n/admin-text";
import type { AdminText } from "@/lib/i18n/admin-text";
import {
  formatDayIn,
  weekdayShortIn,
  formatDayShortIn,
} from "@/lib/i18n/labels";
import type { AppLocale } from "@/lib/i18n/app-locales";
import { fill } from "@/lib/i18n/auth-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { monthFromParams } from "@/lib/restoflow/dates";
import { formatMonth } from "@/lib/restoflow/expenses";
import { adminContext } from "@/lib/restoflow/page-context";
import { can } from "@/lib/restoflow/permissions";
import { fetchDailySales } from "@/lib/restoflow/queries";
import { compareSales, type DailySales } from "@/lib/restoflow/sales";
import { formatMoney } from "@/lib/money";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, Pill } from "@/components/restoflow/ui";
import { Panel, PanelEmpty } from "@/components/restoflow/dashboard-ui";
import { SalesForm } from "./form";
import { ReportCapture } from "./capture";
import { averageCheckCents } from "@/lib/restoflow/sales-report";
import { DeleteDay } from "./delete-day";
import { ReconciliationPanel } from "./reconciliation";
import { reconcile as reconcileWithPos } from "@/lib/restoflow/sales-vat";
import {
  fetchPosMappings,
  fetchSalesGroups,
  fetchPosVatRates,
  fetchSalesLines,
} from "@/lib/restoflow/queries";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.myynti.salesWord };
}

/**
 * Päivän myynti.
 *
 * Yksi luku päivässä, ja se on kaiken myyntiin liittyvän lähde:
 * yleiskuvan vertailu, työvoiman osuus, karkea tulos ja raportit.
 *
 * Sivu on valikon talousosaston ensimmäinen kohta: kassan päiväraportti
 * kirjataan joka ilta, ja päivittäinen tehtävä kuuluu valikkoon.
 */
export default async function SalesPage({
  searchParams,
}: PageProps<"/admin/myynti">) {
  const t = adminText(await resolveLocale());
  const locale = await resolveLocale();
  const {
    restaurant,
    role,
    today,
    month: nykyinen,
  } = await adminContext("/admin/myynti");

  const month = monthFromParams(await searchParams, nykyinen);

  /*
   * Kirjaus koskee aina tata paivaa.
   *
   * Kuvaus ja kasin kirjaus ovat toimintoja eivatka kuukauden nakyma,
   * ja niiden otsikoissa lukee "taman paivan". Heinakuun listan
   * ylapuolella ne lukisivat vaarin. Menneessa kuussa sivu on siis
   * katselua; kirjaaminen loytyy kuluvasta kuusta, ja lomakkeen
   * paivakentalla voi yha taydentaa menneen paivan.
   */
  const kuluva = month === nykyinen;

  const sales = await fetchDailySales(restaurant.id);

  /*
   * Verotusasetukset ja tämän päivän rivit.
   *
   * Rivit vain yhdeltä päivältä: sadan päivän rivit olisi tuhat riviä
   * jota kukaan ei katso, ja täsmäytys koskee aina yhtä päivää.
   */
  const [groups, mappings, todayLines, todayVatRates] = await Promise.all([
    fetchSalesGroups(restaurant.id),
    fetchPosMappings(restaurant.id),
    fetchSalesLines(restaurant.id, today),
    fetchPosVatRates(restaurant.id, today),
  ]);
  const canManage = can(role, "sales.manage");

  const todayRow = sales.find((s) => s.date === today);
  const yesterday = addDays(today, -1);
  const missingYesterday = !sales.some((s) => s.date === yesterday);

  // Lista rajataan kuukauteen; vertailut lukevat yha koko historiaa.
  const inMonth = sales.filter((row) => row.date.startsWith(month));

  return (
    <div className="rf-stagger space-y-5 md:space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            {t.myynti.netFromReport}
          </p>
        </div>
      </header>

      {/*
        Kuvaaminen ensin, käsin kirjaus sen alla.

        Päiväraportti on jo tulostettu illan päätteeksi, ja siinä lukee
        enemmän kuin yksi luku. Käsin kirjaus jää siltä varalta ettei
        raporttia ole tai poiminta ei osu — se on nopein tie yhteen
        lukuun, muttei enää ainoa tie.
      */}
      {canManage && kuluva ? (
        <Card>
          <h2 className="text-[15px] font-bold tracking-[-0.0075em]">
            {t.myynti.shootDailyReport}
          </h2>
          <p
            className="mt-[3px] text-[12.5px]"
            style={{ color: "var(--rf-text-2)" }}
          >
            {t.myynti.extractionHint}
          </p>

          <div className="mt-3.5">
            <ReportCapture
              t={t}
              today={today}
              groups={groups}
              mappings={mappings}
            />
          </div>
        </Card>
      ) : null}

      {canManage && kuluva ? (
        <Card>
          <h2 className="text-[15px] font-bold tracking-[-0.0075em]">
            {todayRow ? t.myynti.editThisDay : t.myynti.enterManually}
          </h2>
          <SalesForm
            t={t}
            defaultDate={today}
            defaultNet={todayRow ? centsToInput(todayRow.netCents) : ""}
            defaultTarget={
              todayRow?.targetCents ? centsToInput(todayRow.targetCents) : ""
            }
          />
        </Card>
      ) : null}

      {/*
        Täsmäytys näkyy vain kun päivä on kirjattu raportista.

        Käsin kirjatulla päivällä ei ole rivejä eikä kassan lukuja,
        joten vertailulla ei olisi kahta osapuolta — ja "täsmää" ilman
        vertailukohtaa tarkoittaisi vain ettei mitään ole verrattu.
      */}
      {todayLines.length > 0 && todayRow && kuluva ? (
        <Card>
          <h2 className="text-[15px] font-bold tracking-[-0.0075em]">
            {t.myynti.reconciliation}
          </h2>
          <p
            className="mt-[3px] text-[12.5px]"
            style={{ color: "var(--rf-text-2)" }}
          >
            {formatDay(today, locale)} · kassan päiväraportti vs. Katen laskelma
          </p>

          <div className="mt-3.5">
            <ReconciliationPanel
              t={t}
              result={reconcileWithPos({
                posGrossCents: todayRow.posGrossCents,
                posVatCents: todayRow.posVatCents,
                posVatRates: todayVatRates,
                lines: todayLines,
              })}
            />
          </div>
        </Card>
      ) : null}

      {/*
        Eilinen puuttuu useammin kuin tämä päivä: myynti kirjataan illan
        päätteeksi, ja unohtuminen huomataan vasta seuraavana aamuna.
      */}
      {canManage && missingYesterday ? (
        <Card>
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 shrink-0"
              style={{ color: "var(--rf-amber-text)" }}
            >
              <RfIcon name="alert" size={18} />
            </span>
            <div>
              <p className="text-[15px] font-medium">
                {t.myynti.yesterdayMissing}
              </p>
              <p
                className="mt-1 text-[13px] leading-relaxed"
                style={{ color: "var(--rf-text-2)" }}
              >
                {formatDay(yesterday, locale)} on kirjaamatta. Ilman sitä viikon
                vertailut ja työvoiman osuus jäävät vajaiksi.
              </p>
              <div className="mt-3">
                <SalesForm
                  t={t}
                  defaultDate={yesterday}
                  defaultNet=""
                  defaultTarget=""
                  compact
                />
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {/*
        Otsikko kortin sisään.

        Tässä oli harmaa versaaliotsikko kortin yläpuolella — ainoa
        laatuaan koko hallinnassa. Muualla osion nimi on kortin
        ensimmäinen rivi, ja kaksi eri tapaa nimetä osio saa saman
        sivun näyttämään kahdesta eri sovelluksesta kootulta.
      */}
      <Panel
        title={t.myynti.recordedDays}
        subtitle={fill(
          inMonth.length === 1 ? t.myynti.monthDaysOne : t.myynti.monthDaysMany,
          {
            kuukausi: formatMonth(month, locale),
            maara: String(inMonth.length),
          },
        )}
      >
        {inMonth.length === 0 ? (
          <PanelEmpty
            text={
              sales.length === 0
                ? t.myynti.noSalesYet
                : fill(t.myynti.noSalesThisMonth, {
                    maara: String(sales.length),
                  })
            }
          />
        ) : (
          /* Taulukko kortin reunoihin, kuten Viimeisimmät kuitit. */
          <div className="-mx-[18px] -mb-4 mt-[14px] overflow-x-auto rounded-b-[var(--rf-r-card)]">
            <table className="rf-table w-full min-w-[34rem]">
              <thead>
                <tr>
                  <th>{t.myynti.dayWord}</th>
                  <th className="text-right">{t.myynti.withoutTax}</th>
                  <th className="text-right">{t.myynti.receiptsWord}</th>
                  <th className="text-right">{t.myynti.averageWord}</th>
                  <th className="text-right">{t.myynti.target}</th>
                  <th>{t.myynti.comparison}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {inMonth.map((row) => (
                  <Row
                    locale={locale}
                    t={t}
                    key={row.date}
                    row={row}
                    history={sales}
                    today={today}
                    canManage={canManage}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p
        className="px-1 text-[12px] leading-relaxed"
        style={{ color: "var(--rf-text-3)" }}
      >
        {t.myynti.netReason}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Row({
  locale,
  t,
  row,
  history,
  today,
  canManage,
}: {
  locale: AppLocale;
  t: AdminText;
  row: DailySales;
  history: DailySales[];
  today: string;
  canManage: boolean;
}) {
  const comparison = compareSales(row, history);
  const average = averageCheckCents(row.grossCents, row.transactions);

  return (
    <tr
      className="border-b last:border-0"
      style={{ borderColor: "var(--rf-line)" }}
    >
      <td>
        <span className="flex items-center gap-2">
          <span>{formatDay(row.date, locale)}</span>

          {/*
            Raportista luettu päivä merkitään.

            Käsin kirjattu ja raportista luettu ovat eri luotettavuutta,
            ja ero on nähtävä jälkikäteen — muuten ei voi tietää
            kannattaako lukua epäillä kun se ei täsmää kirjanpitoon.
          */}
          {row.source === "report" ? (
            <span
              aria-label={t.myynti.readFromReport}
              title={t.myynti.readFromReport}
              style={{ color: "var(--rf-text-3)" }}
            >
              <RfIcon name="camera" size={14} />
            </span>
          ) : null}

          {row.date === today ? (
            <span className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
              {t.myynti.todayWord}
            </span>
          ) : null}
        </span>
      </td>

      <td className="num">
        {formatMoney(row.netCents)}
        {row.grossCents !== null ? (
          <span
            className="block text-[11.5px] font-normal"
            style={{ color: "var(--rf-text-3)" }}
          >
            {formatMoney(row.grossCents)} verollinen
          </span>
        ) : null}
      </td>

      <td className="num" style={{ color: "var(--rf-text-2)" }}>
        {row.transactions ?? "—"}
      </td>

      <td className="num" style={{ color: "var(--rf-text-2)" }}>
        {average === null ? "—" : formatMoney(average)}
      </td>
      <td
        className="rf-tabular px-5 py-3 text-right"
        style={{ color: "var(--rf-text-3)" }}
      >
        {row.targetCents ? formatMoney(row.targetCents) : "—"}
      </td>
      <td>
        {comparison.kind === "none" ? (
          <span className="text-[13px]" style={{ color: "var(--rf-text-3)" }}>
            {t.myynti.noComparison}
          </span>
        ) : (
          <Pill
            tone={
              comparison.ratio >= 1
                ? "ok"
                : comparison.ratio >= 0.9
                  ? "warn"
                  : "risk"
            }
          >
            {percent(comparison.ratio)}{" "}
            {comparison.kind === "target"
              ? "tavoitteesta"
              : t.myynti.vsSameWeekday}
          </Pill>
        )}
      </td>

      <td className="text-right">
        <span className="flex items-center justify-end gap-1">
          {/*
            Rivi vie päivän omaan näkymään.

            Täsmäytys ei mahdu riville eikä kuulu sinne: se on se
            näkymä johon palataan kun kirjanpitäjä kysyy, ja siihen on
            voitava linkittää.
          */}
          <Link
            href={`/admin/myynti/${row.date}`}
            aria-label={fill(t.myynti.openDay, {
              paiva: formatDayIn(row.date, locale),
            })}
            className="rf-press flex h-7 w-7 items-center justify-center"
            style={{ color: "var(--rf-text-3)", borderRadius: 8 }}
          >
            <RfIcon name="chevron" size={15} />
          </Link>

          {canManage ? (
            <DeleteDay date={row.date} label={formatDay(row.date, locale)} />
          ) : null}
        </span>
      </td>
    </tr>
  );
}

/** "+7 %" / "−9 %" */
function percent(ratio: number): string {
  const change = Math.round((ratio - 1) * 100);
  if (change === 0) return "tasan";
  return `${change > 0 ? "+" : "−"}${Math.abs(change)} %`;
}

function formatDay(isoDate: string, locale: AppLocale): string {
  return `${weekdayShortIn(isoDate, locale)} ${formatDayShortIn(isoDate, locale)}`;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Sentit lomakkeen tekstikenttään suomalaisittain. */
function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

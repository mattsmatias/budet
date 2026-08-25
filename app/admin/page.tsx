import type { ReactNode } from "react";
import Link from "next/link";
import { ISO_MONTH } from "@/lib/restoflow/dates";
import { adminContext } from "@/lib/restoflow/page-context";
import {
  budgetLines,
  compareToPreviousMonth,
  focusItems,
  receiptSplit,
} from "@/lib/restoflow/dashboard";
import { buildInsights } from "@/lib/restoflow/insights";
import {
  formatMonth,
  monthlySeries,
  periodTotals,
  previousMonth,
  receiptsInMonth,
  sortByDateDesc,
  totalsByCustomCategory,
} from "@/lib/restoflow/expenses";
import { currentState } from "@/lib/restoflow/timeclock";
import { can } from "@/lib/restoflow/permissions";
import { CATEGORY_LABELS } from "@/lib/restoflow/types";
import { formatMoney } from "@/lib/money";
import { initials } from "@/lib/restoflow/initials";
import { CountUp } from "@/components/restoflow/count-up";
import {
  CategoryBubble,
  Pill,
} from "@/components/restoflow/ui";
import {
  Panel,
  PanelEmpty,
  StatCard,
} from "@/components/restoflow/dashboard-ui";
import { RfIcon } from "@/components/restoflow/icons";
import { Rhythm } from "./home/rhythm";
import { StatusHeader } from "./home/status-header";
import {
  COST_COLOR,
  Donut,
  SALES_COLOR,
  seriesColor,
  Sparkline,
} from "@/components/restoflow/dashboard-ui";
import { AreaChart } from "@/components/restoflow/area-chart";
import { shiftBounds } from "@/lib/restoflow/shift-window";
import { fetchPosVatRates, fetchSalesLines } from "@/lib/restoflow/queries";
import { reconcile as reconcileSales } from "@/lib/restoflow/sales-vat";
import { labourCost } from "@/lib/restoflow/payroll-data";
import { todayPulse } from "@/lib/restoflow/pulse";
import { overallStatus } from "@/lib/restoflow/status";
import { evaluability } from "@/lib/restoflow/dashboard";
import { dayIn, minutesOfDayIn, monthStartDate } from "@/lib/restoflow/clock-context";
import { monthlyFlow, spendRhythm } from "@/lib/restoflow/spend-rhythm";

export const metadata = { title: "Yleiskatsaus" };

/**
 * Yleiskuva.
 *
 * Näkymän tehtävä on vastata viiteen kysymykseen viidessä sekunnissa:
 * miten menee, mihin rahat menevät, kenelle ne menevät, onko jotain
 * pielessä, mitä pitää tehdä nyt. Kaikki muu on painolastia.
 *
 * Sääntö jota ei rikota: jokainen luku esittää myös johtopäätöksen, ja
 * puuttuva vertailukohta sanotaan ääneen. Keksitty prosentti on pahempi
 * kuin puuttuva prosentti — se saa tekemään päätöksiä.
 *
 * Myyntiä ei näytetä, koska Budet ei näe sitä. Kannattavuutta ei
 * lasketa ilman myyntiä.
 */
export default async function AdminDashboard({
  searchParams,
}: PageProps<"/admin">) {
  const params = await searchParams;
  const {
    receipts, users, budgets, shifts, clockEvents, absences,
    openShifts, sales,
    month, today, now, monthlyHours, restaurant, role, categories: customCategories,
  } = await adminContext("/admin");

  const requested = typeof params.kuukausi === "string" ? params.kuukausi : month;
  const viewMonth = ISO_MONTH.test(requested) && requested <= month ? requested : month;
  const isCurrentMonth = viewMonth === month;

  /*
   * Kaavion jakso osoitteessa eikä komponentin tilassa.
   *
   * Näkymä on palvelinkomponentti, ja tilan lisääminen tekisi siitä
   * selainkomponentin koko kaavion ajaksi. Osoitteessa valinta myös
   * säilyy linkkiä jaettaessa.
   */
  const CHART_RANGES = [
    { months: 3, label: "3 kk" },
    { months: 6, label: "6 kk" },
    { months: 12, label: "Vuosi" },
  ] as const;

  const requestedChart = Number(params.kaavio);
  const chartMonths = CHART_RANGES.some((r) => r.months === requestedChart)
    ? requestedChart
    : 6;

  // Valittavat kuukaudet: kuluvasta taaksepäin vuosi.
  const selectable: string[] = [];
  let cursor = month;
  for (let i = 0; i < 13; i++) {
    selectable.push(cursor);
    cursor = previousMonth(cursor);
  }

  const totals = periodTotals(receipts, viewMonth);
  const comparison = compareToPreviousMonth(receipts, viewMonth);
  const receipts_ = receiptSplit(receipts, viewMonth);

  const categories = totalsByCustomCategory(
    receiptsInMonth(receipts, viewMonth),
    customCategories,
  );
  const recent = sortByDateDesc(receiptsInMonth(receipts, viewMonth)).slice(0, 5);

  /**
   * Viimeisin kuitti tarkasteltavan kuukauden ulkopuolelta.
   *
   * Yleiskuva näyttää yhtä kuukautta. Jos kuitit ovat toisessa
   * kuukaudessa, tyhjät paneelit väittivät ettei kuitteja ole
   * ollenkaan — "Ensimmäinen kuittisi näkyy täällä" juuri lisätyn
   * kuitin jälkeen näyttää siltä että tallennus epäonnistui.
   *
   * Nyt kerrotaan missä ne ovat. Se on myös vihje siitä että kuitin
   * päivämäärä voi olla väärin luettu.
   */
  const elsewhere = sortByDateDesc(
    receipts.filter((r) => !r.date.startsWith(viewMonth)),
  )[0];

  const emptyForMonth = elsewhere
    ? {
        text:
          `${formatMonth(viewMonth)} ei sisällä yhtään kuittia. ` +
          `Viimeisin kirjattu kuitti on ${formatFullDate(elsewhere.date)}.`,
        cta: `Avaa ${formatMonth(elsewhere.date.slice(0, 7)).toLowerCase()}`,
        href: `/admin?kuukausi=${elsewhere.date.slice(0, 7)}`,
      }
    : null;

  /*
   * Sama selitys kolmesti on kohinaa.
   *
   * Kuukauden tyhjyys on yksi tosiasia eikä kolme. Aiemmin jokainen
   * kolmesta paneelista toisti saman lauseen ja saman painikkeen, ja
   * kaksi niistä olivat vierekkäin samalla rivillä. Selitys ja siirtymä
   * ovat nyt ensimmäisessä paneelissa; loput toteavat vain tyhjyyden.
   */
  const emptyShort = elsewhere
    ? { text: `${formatMonth(viewMonth)} ei sisällä yhtään kuittia.` }
    : null;

  /*
   * Tyhjä kuukausi ei tarkoita tyhjää järjestelmää.
   *
   * "Lisää ensimmäinen kuitti" neljän kuitin jälkeen väittää että
   * tallennus on epäonnistunut. Ero kuukauden tyhjyyden ja aidon
   * alkutilan välillä on kerrottava.
   */
  const emptyMonthOnly = totals.receiptCount === 0 && elsewhere !== undefined;

  const dashboardInput = {
    receipts, budgets, shifts, users, clockEvents, absences,
    openShifts, sales,
    month: viewMonth, today, now,
    timezone: restaurant.timezone,
  };


  // Havainnot syötetään samaan listaan. Käyttäjän kannalta ero
  // hälytyksen ja havainnon välillä on keinotekoinen — molemmat ovat
  // asioita joihin pitää reagoida, ja kahdesta listasta toinen jäisi
  // katsomatta.
  const insights = buildInsights({
    ...dashboardInput,
    now,
    timezone: restaurant.timezone,
  });
  const items = focusItems(dashboardInput, insights);

  const budgets_ = budgetLines(receipts, budgets, viewMonth);

  // Tunnit ja henkilöstökulu lasketaan vain kuluvalle kuukaudelle:
  // monthlyHours tulee kontekstista kuluvana kuukautena, eikä
  // menneen kuukauden tunteja saa esittää kuluvan lukuina.
  const totalHours = isCurrentMonth
    ? Object.values(monthlyHours).reduce((sum, hours) => sum + hours, 0)
    : null;



  /*
   * "Työaika tänään" laski tässä ketkä ovat sisällä.
   *
   * Palvelupäivän aikajana näyttää saman ja enemmän: kuka on töissä,
   * kuka tauolla, kuka myöhässä ja kuka tulossa. Paneelissa oli myös
   * seitsemäs kerta samaa virhettä — since.slice(11, 16) luki UTC-ajan,
   * joten kesällä sisäänleimaus 13.55 näkyi muodossa 10.55.
   */



  /*
   * Kärjen tiedot.
   *
   * Työvoima haetaan erikseen palkkamoottorista, jotta kärjen luku on
   * sama kuin palkkalaskelmassa. Myynti tulee jaetusta paketista.
   *
   * Vain kuluvalle kuukaudelle. Menneen kuukauden "tänään" ei ole
   * mitään, ja vanhan kuun kärki näyttäisi tyhjältä ilman syytä.
   */
  const [labourToday, labourMonth] = isCurrentMonth
    ? await Promise.all([
        labourCost(restaurant.id, restaurant.timezone, today, today, now),
        labourCost(restaurant.id, restaurant.timezone, monthStartDate(month), today, now),
      ])
    : [null, null];

  const pulse =
    isCurrentMonth && labourToday && labourMonth
      ? todayPulse({
          today,
          month,
          receipts,
          sales,
          labourTodayCents: labourToday.cents,
          labourTodayMinutes: labourToday.minutes,
          labourMonthCents: labourMonth.cents,
        })
      : null;

  const status = overallStatus(items, evaluability(dashboardInput).canJudge);

  /*
   * Kulurytmi katsottavalta kuukaudelta.
   *
   * "Tänään" on tarkasteltavan kuukauden viimeinen päivä silloin kun
   * katsotaan mennyttä kuukautta: silloin yksikään päivä ei ole
   * tulevaisuudessa, mikä on totta.
   */
  const rhythm = spendRhythm(
    receipts,
    viewMonth,
    isCurrentMonth ? today : `${viewMonth}-31`,
  );

  // Trendiviiva vain jos historiaa on. Kahden pisteen viiva näyttäisi
  // suunnalta olematta sellainen.
  const trend = monthlySeries(receipts, viewMonth, 6).map((point) => point.totalCents);
  const hasTrend = trend.filter((value) => value > 0).length >= 3;

  /*
   * Myynnin ja kulujen kehitys samalla akselilla.
   *
   * Myynti on null niiltä kuukausilta joilta sitä ei ole kirjattu.
   * Nolla kertoisi että myynti loppui, ja se on eri asia kuin se
   * ettei kukaan ehtinyt kirjata sitä — kaavio katkaisee viivan siitä
   * kohtaa eikä vedä sitä pohjaan.
   */
  const flow = monthlyFlow(receipts, sales, viewMonth, chartMonths);

  /*
   * Tämän päivän täsmäytys.
   *
   * Rivit vain tältä päivältä: yleiskuva kertoo mitä juuri nyt on
   * tekemättä, ja eilisen täsmäyttämättömyys on eilisen sivun asia.
   */
  const todaySales = sales.find((s) => s.date === today) ?? null;
  const [todayLines, todayVatRates] = can(role, "sales.view")
    ? await Promise.all([
        fetchSalesLines(restaurant.id, today),
        fetchPosVatRates(restaurant.id, today),
      ])
    : [[], []];

  const posCheck =
    todaySales && todayLines.length > 0
      ? reconcileSales({
          posGrossCents: todaySales.posGrossCents,
          posVatCents: todaySales.posVatCents,
          posVatRates: todayVatRates,
          lines: todayLines,
        })
      : null;

  /*
   * Budjetti jäljellä.
   *
   * Vain niistä kategorioista joille budjetti on asetettu. Kategoria
   * ilman budjettia ei ole nolla budjettia vaan päätös jota ei ole
   * tehty, eikä sitä lasketa jäljellä olevaan.
   */
  const budgetTotal = budgets_.reduce((sum, line) => sum + line.budgetCents, 0);
  const budgetSpent = budgets_.reduce((sum, line) => sum + line.spentCents, 0);
  const budgetLeft = budgetTotal - budgetSpent;
  const budgetUsed = budgetTotal > 0 ? budgetSpent / budgetTotal : null;

  /*
   * Ketkä ovat sisällä juuri nyt.
   *
   * Tila luetaan leimauksista eikä tallenneta mihinkään. Päivä luetaan
   * ravintolan ajassa — merkkijonon viipale on UTC:tä, ja yöllä tehty
   * leimaus osuisi väärälle päivälle.
   */
  const onDuty = isCurrentMonth
    ? users.filter((u) => {
        const mine = clockEvents.filter(
          (e) => e.userId === u.id && dayIn(restaurant.timezone, e.at) === today,
        );
        return currentState(mine) !== "off";
      }).length
    : null;

  const staffTotal = users.filter((u) => u.position !== null).length;

  /*
   * Seuraava alkava vuoro tänään.
   *
   * Kertoo milloin salissa on taas enemmän väkeä. Päättynyt vuoro ei
   * kelpaa: sama sääntö kuin työntekijän omassa näkymässä.
   */
  const nextToday = shifts
    .filter((sh) => sh.date === today && sh.status !== "declined")
    .map((sh) => ({ sh, bounds: shiftBounds(sh) }))
    .filter(({ bounds }) => bounds.startMin > minutesOfDayIn(restaurant.timezone, now))
    .sort((a, b) => a.bounds.startMin - b.bounds.startMin)[0];

  const upcomingToday = shifts.filter(
    (sh) =>
      sh.date === today &&
      sh.status !== "declined" &&
      shiftBounds(sh).startMin > minutesOfDayIn(restaurant.timezone, now),
  ).length;

  return (
    <div className="rf-stagger space-y-5 md:space-y-6">
      {/* 1. Yläosa */}
      {/* rf-z-page: kuukausivalitsimen paneeli avautuu KPI-korttien
          päälle. Ilman kerrosta otsikkorivi maalautuu DOM-järjestyksessä
          ennen kortteja, ja paneelin oma z-index jää sen sisään —
          porrastusanimaatio tekee jokaisesta lapsesta oman
          pinoamiskontekstin.

          Kerros on page eikä chrome: sivun otsikko nousee korttien yli
          mutta jää tunnusvalikon alle. Aiemmin molemmat olivat 40, ja
          tasapelissä myöhempi DOM-solmu voitti. */}
      {/*
        Sivun otsikko on pelkkä tunniste.

        Tervehdys on yläpalkissa ja kuukauden hallinta oman osastonsa
        otsikossa. Tässä oli aiemmin molemmat, jolloin rivi kantoi
        kolme eri asiaa: kuka olen, mitä kuukautta katson ja mitä voin
        tehdä. Ne eivät liity toisiinsa.
      */}
      {/*
        Sivu alkaa luvuista.

        Kuukausivalitsin ja vienti olivat tässä omalla rivillään.
        Valitsin siirtyi yläpalkkiin, ja vienti löytyy Raportointi-
        sivulta johon valikko vie — säädinrivi ennen sisältöä oli
        ainoa asia joka erotti näkymän suunnitelmasta.
      */}
      {/* 2. KPI-kortit */}
      <section
        aria-label="Avainluvut"
        className="grid auto-rows-fr grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Kirjatut kulut"
          value={<CountUp to={totals.totalCents} format="money" />}
          icon={<RfIcon name="receipt" size={17} />}
          /*
           * Laatan väri on tunniste eikä tila.
           *
           * Neljä korttia rinnakkain näyttivät samalta, koska kaikkien
           * laatta oli sävytetty luvun tilan mukaan ja tila oli
           * useimmiten neutraali. Väri per kortti tekee rivistä
           * luettavan: sama kortti löytyy joka kerta samasta värista.
           */
          tileTone="brand"
          /*
           * Tyhjä kuukausi ei ole lasku.
           *
           * Nolla kuittia tuottaa aina −100 % edelliseen kuuhun, ja
           * alaspäin osoittava nuoli väittäisi kulujen pienentyneen.
           * Ne eivät ole pienentyneet — niitä ei ole vielä kirjattu.
           */
          tone={
            totals.receiptCount === 0 || comparison.change === null
              ? "muted"
              : comparison.change > 0
                ? "up"
                : comparison.change < 0
                  ? "down"
                  : "neutral"
          }
          delta={
            totals.receiptCount > 0 && comparison.change !== null
              ? { text: percent(comparison.change) }
              : undefined
          }
          conclusion={
            emptyMonthOnly
              ? "Ei kuitteja tässä kuussa"
              : totals.receiptCount === 0
                ? "Lisää ensimmäinen kuitti"
                : comparison.baseMonth === null
                  ? "Ei vertailukohtaa"
                  : `${formatMoney(periodTotals(receipts, comparison.baseMonth).totalCents)} ${monthWord(comparison.baseMonth)}ssa`
          }
          trend={hasTrend ? <Sparkline values={trend} width={64} height={20} /> : undefined}
          href="/admin/kulut"
        />

{pulse ? (
          <StatCard
            label="Myynti tänään"
            tileTone="green"
            value={
              pulse.sales.cents === null ? "—" : <CountUp to={pulse.sales.cents} format="money" />
            }
            /*
             * Puuttuva myynti ei ole nolla. "—" ja "Ei vielä kirjattu"
             * kertovat sen; nolla väittäisi ettei tänään myyty mitään.
             */
            delta={
              pulse.sales.cents !== null && pulse.sales.comparison.kind !== "none"
                ? {
                    text: percent(pulse.sales.comparison.ratio - 1),
                    tone: pulse.sales.comparison.ratio >= 1 ? "down" : "warn",
                  }
                : undefined
            }
            /*
             * Täsmäytys voittaa vertailun.
             *
             * "8 % yli tavoitteen" on hyödytön tieto jos luku itsessään
             * ei täsmää kassaan. Ero kassaan on korjattava ennen kuin
             * lukua kannattaa verrata mihinkään.
             */
            conclusion={
              posCheck?.status === "mismatch"
                ? `Ei täsmää kassaan · ero ${formatMoney(
                    Math.abs(posCheck.total.diffCents ?? posCheck.vat.diffCents ?? 0),
                  )}`
                : posCheck?.status === "match"
                  ? "Täsmää kassan päiväraporttiin"
                  : pulse.sales.cents === null
                    ? "Ei vielä kirjattu"
                    : pulse.sales.comparison.kind === "target"
                      ? `Tavoite ${formatMoney(pulse.sales.comparison.targetCents)}`
                      : pulse.sales.comparison.kind === "weekday"
                        ? `${formatMoney(pulse.sales.comparison.averageCents)} saman viikonpäivän keskiarvo`
                        : "Ei vertailukohtaa"
            }
            tone={
              posCheck?.status === "mismatch"
                ? "bad"
                : pulse.sales.cents === null
                  ? "muted"
                  : pulse.sales.comparison.kind === "none"
                    ? "neutral"
                    : pulse.sales.comparison.ratio >= 1
                      ? "down"
                      : "warn"
            }
            icon={<RfIcon name="trend" size={17} />}
            /* Ero vie suoraan päivään jossa se selitetään. */
            href={
              can(role, "sales.view")
                ? posCheck
                  ? `/admin/myynti/${today}`
                  : "/admin/myynti"
                : undefined
            }
            linkLabel={posCheck?.status === "mismatch" ? "Katso ero" : "Myynti"}
          />
        ) : (
          <StatCard
            label="Kuitit"
            tileTone="green"
            value={<CountUp to={receipts_.total} format="integer" />}
            delta={
              receipts_.pending > 0 ? { text: `${receipts_.pending} kesken` } : undefined
            }
            conclusion={emptyMonthOnly ? "Ei kuitteja tässä kuussa" : receipts_.label}
            tone={receipts_.pending > 0 ? "warn" : "neutral"}
            icon={<RfIcon name="receipt" size={17} />}
            href="/admin/kuitit"
            linkLabel="Kuitit"
          />
        )}

        <StatCard
          label="Budjetti jäljellä"
          tileTone="violet"
          value={budgetTotal === 0 ? "—" : <CountUp to={budgetLeft} format="money" />}
          delta={
            budgetUsed === null
              ? undefined
              : {
                  text: `${Math.round(budgetUsed * 100)} %`,
                  tone: budgetUsed > 1 ? "bad" : budgetUsed > 0.9 ? "warn" : "neutral",
                }
          }
          bar={
            budgetUsed === null
              ? undefined
              : {
                  percent: budgetUsed * 100,
                  /*
                   * Sama violetti kuin kortin laatassa kun kaikki on
                   * kunnossa. Palkki kuuluu korttiin eikä ole
                   * hälytys ennen kuin raja lähestyy.
                   */
                  tone: budgetUsed > 1 ? "bad" : budgetUsed > 0.9 ? "warn" : "violet",
                }
          }
          conclusion={
            budgetTotal === 0
              ? "Budjetteja ei ole määritetty"
              : `${formatMoney(budgetSpent)} / ${formatMoney(budgetTotal)}`
          }
          tone={
            budgetUsed === null
              ? "muted"
              : budgetUsed > 1
                ? "bad"
                : budgetUsed > 0.9
                  ? "warn"
                  : "neutral"
          }
          icon={<RfIcon name="budget" size={17} />}
          href="/admin/budjetit"
          linkLabel="Budjetit"
        />

        {onDuty !== null ? (
          <StatCard
            label="Töissä nyt"
            tileTone="blue"
            value={`${onDuty} / ${staffTotal}`}
            delta={upcomingToday > 0 ? { text: `${upcomingToday} tulossa` } : undefined}
            conclusion={
              nextToday
                ? `Seuraava: ${users.find((u) => u.id === nextToday.sh.userId)?.name ?? "vuoro"} ${nextToday.sh.startTime}`
                : onDuty === 0
                  ? "Kukaan ei ole leimannut sisään"
                  : "Ei enempää vuoroja tänään"
            }
            tone="muted"
            icon={<RfIcon name="staff" size={17} />}
            href="/admin/tyovuorot"
            linkLabel="Vuorot"
          />
        ) : (
          <StatCard
            label="Työtunnit"
            tileTone="blue"
            value={totalHours === null ? "—" : <CountUp to={totalHours} format="hours" />}
            conclusion={
              totalHours === null ? "Vain kuluvalta kuukaudelta" : "Leimauksista laskettu"
            }
            tone="muted"
            icon={<RfIcon name="clock" size={17} />}
            href="/admin/tyovuorot"
          />
        )}

      </section>

      {/*
        "Vaatii huomiota" oli tässä omana lohkonaan.

        Se vastasi samaan kysymykseen kuin StatusHeader viisikymmentä
        riviä ylempänä: onko kaikki kunnossa ja mikä ei ole. Kaksi
        vastausta samaan kysymykseen samalla sivulla opettaa lukijan
        epäilemään kumpaakin — ja kolme eri tilaa oli toteutettu
        molemmissa erikseen, joten ne ehtivät jo erota toisistaan.
      */}

      {/*
        Kaksi kaaviota rinnakkain.

        Jakauma vastaa kysymykseen "mihin", kehitys kysymykseen "mihin
        suuntaan". Ne ovat eri kysymyksiä samasta rahasta, ja
        vierekkäin ne luetaan yhtenä silmäyksenä.
      */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <Panel title="Kulujakauma" href="/admin/kulut">
          {categories.length === 0 ? (
            <PanelEmpty
              {...(emptyForMonth ?? {
                text: "Lisää kuitteja nähdäksesi kulujakauman.",
                cta: "Lisää kuitti",
                href: "/admin/kuitit/uusi",
              })}
            />
          ) : (
            <div className="flex flex-col items-center pt-1">
              <Donut
                slices={categories.slice(0, 5).map((row) => ({
                  key: row.key,
                  label: row.name,
                  valueCents: row.totalCents,
                  share: row.share,
                }))}
                total={formatMoney(totals.totalCents)}
                caption={monthWord(viewMonth)}
              />

              <ul className="mt-3.5 grid w-full grid-cols-2 gap-x-3.5 gap-y-1.5">
                {categories.slice(0, 5).map((row, index) => (
                  <li key={row.key} className="flex items-center gap-[7px] text-[12px]">
                    <span
                      aria-hidden="true"
                      className="h-[9px] w-[9px] shrink-0 rounded-[2px]"
                      style={{ background: seriesColor(index) }}
                    />
                    <span className="min-w-0 flex-1 truncate" style={{ color: "var(--rf-text-2)" }}>
                      {row.name}
                    </span>
                    <span className="rf-tabular shrink-0 text-[11.5px]" style={{ color: "var(--rf-text-3)" }}>
                      {Math.round(row.share * 100)} %
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel
          title="Myynti ja kulut"
          action={
            <div
              role="group"
              aria-label="Aikaväli"
              className="flex gap-0.5 p-[3px]"
              style={{ background: "var(--rf-inset)", borderRadius: 980 }}
            >
              {CHART_RANGES.map((range) => {
                const on = range.months === chartMonths;
                return (
                  <Link
                    key={range.months}
                    href={`/admin?kuukausi=${viewMonth}&kaavio=${range.months}`}
                    scroll={false}
                    aria-current={on ? "true" : undefined}
                    className="rf-press px-3 py-[5px] text-[12px] font-semibold"
                    style={{
                      background: on ? "var(--rf-card)" : "transparent",
                      color: on ? "var(--rf-text)" : "var(--rf-text-2)",
                      boxShadow: on ? "var(--rf-shadow-sm)" : "none",
                      borderRadius: 980,
                    }}
                  >
                    {range.label}
                  </Link>
                );
              })}
            </div>
          }
        >
          {flow.labels.length < 2 ? (
            <PanelEmpty text="Kehitys näkyy täällä kun aineistoa on kahdelta kuukaudelta." />
          ) : (
            <>
              <AreaChart
                labels={flow.labels}
                series={[
                  { label: "Myynti", color: SALES_COLOR, points: flow.sales },
                  { label: "Kulut", color: COST_COLOR, points: flow.costs },
                ]}
                format={(value) => `${Math.round(value / 100000)} k`}
              />

              <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px]">
                <li className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-[3px] w-2.5 rounded-[2px]"
                    style={{ background: SALES_COLOR }}
                  />
                  Myynti
                </li>
                <li className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-[3px] w-2.5 rounded-[2px]"
                    style={{ background: COST_COLOR }}
                  />
                  Kulut
                </li>
                {flow.salesMissing ? (
                  <li className="ml-auto" style={{ color: "var(--rf-text-3)" }}>
                    Myynti puuttuu osalta kuukausia — viiva katkeaa siitä.
                  </li>
                ) : null}
              </ul>
            </>
          )}
        </Panel>
      </div>

      {/*
        Huomiot ja kulurytmi rinnakkain.

        Vasemmalla se mikä vaatii tekemistä, oikealla se mikä selittää
        kuukauden muodon. Molemmat luetaan harvoin mutta kumpikaan ei
        ansaitse koko rivin leveyttä.
      */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <StatusHeader
          status={status}
          items={items}
          canAddReceipt={can(role, "receipts.add")}
        />
        <Rhythm rhythm={rhythm} />
      </div>

      {/*
        Tänään, Ostot ja Budjetit olivat tässä.

        Yleiskatsaus vastaa viiteen kysymykseen, ei kahdeksaan.
        Päivän luvut ovat avainluvuissa, ostot Toimittajat-sivulla ja
        budjetin käyttöaste omassa avainlukukortissaan — kolme lohkoa
        toisti sitä mikä on jo sanottu ylempänä tai omalla sivullaan.
      */}

      {/* 9. Viimeisimmät kuitit */}
      <Panel
        title="Viimeisimmät kuitit"
        subtitle={formatMonth(viewMonth)}
        href="/admin/kuitit"
        linkLabel="Näytä kaikki kuitit"
      >
        {recent.length === 0 ? (
          <PanelEmpty
            {...(emptyShort ?? {
              text: "Ensimmäinen kuittisi näkyy täällä.",
              cta: "Lisää kuitti",
              href: "/admin/kuitit/uusi",
            })}
          />
        ) : (
          <>
            {/* Työpöydällä taulukko: viisi saraketta rinnakkain on
                nopeampi silmäillä kuin viisi korttia allekkain.
                Puhelimessa sama tieto ei mahdu riville, joten siellä
                kortit. */}
            {/*
              Taulukko ulottuu kortin reunoihin.

              Osiokortilla on 18 px pehmuste, ja se jätti otsikkorivin
              harmaan kaistan kellumaan keskelle korttia. Kaista on
              taulukon oma reuna, joten sen kuuluu koskettaa kortin
              reunaa — negatiivinen marginaali kumoaa pehmusteen ja
              alanurkat leikataan kortin kaarteeseen.

              Työpöydällä taulukko: viisi saraketta rinnakkain on
              nopeampi silmäillä kuin viisi korttia allekkain.
              Puhelimessa sama tieto ei mahdu riville, joten siellä
              kortit.
            */}
            <div className="-mx-[18px] -mb-4 mt-[14px] hidden overflow-hidden rounded-b-[var(--rf-r-card)] md:block">
              <table className="rf-table w-full">
                <caption className="sr-only">Viimeisimmät kuitit</caption>
                <thead>
                  <tr>
                    <th scope="col">Toimittaja</th>
                    <th scope="col">Kategoria</th>
                    <th scope="col">Summa</th>
                    <th scope="col">Tila</th>
                    <th scope="col">Päivä</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((receipt) => (
                    <tr key={receipt.id} className="rf-row">
                      <td>
                        <Link
                          href={`/admin/kuitit/${receipt.id}`}
                          className="flex items-center gap-[9px] underline-offset-4 hover:underline"
                        >
                          {/*
                            Nimikirjaimet eivät ole koriste.

                            Toimittajanimet ovat lyhyitä ja
                            samankaltaisia — Kespro, Kesko, Metro —
                            ja pelkkä tekstisarake luetaan kirjain
                            kerrallaan. Sama toimittaja saa joka
                            rivillä saman muodon, ja rivi tunnistuu
                            ennen lukemista.
                          */}
                          <span
                            aria-hidden="true"
                            className="flex h-9 w-9 shrink-0 items-center justify-center text-[10px] font-bold tracking-[-0.0075em]"
                            style={{
                              background: "var(--rf-inset)",
                              color: "var(--rf-text-2)",
                              borderRadius: 7,
                            }}
                          >
                            {initials(receipt.supplierName)}
                          </span>
                          <span className="min-w-0 truncate">{receipt.supplierName}</span>
                        </Link>
                      </td>

                      <td style={{ color: "var(--rf-text-2)" }}>
                        {CATEGORY_LABELS[receipt.category]}
                      </td>

                      {/*
                        Miinusmerkki kuuluu lukuun.

                        Kuitti on rahaa ulos. Ilman merkkiä sama
                        sarake näyttäisi myöhemmin samalta kuin
                        myyntirivi, ja luku olisi luettava otsikosta.
                      */}
                      <td className="rf-tabular font-semibold" style={{ color: "var(--rf-red-text)" }}>
                        −{formatMoney(receipt.totalCents)}
                      </td>

                      <td>
                        {receipt.status === "needs_review" ? (
                          <StatusChip tone="warn">Tarkistettava</StatusChip>
                        ) : (
                          <StatusChip tone="ok">Tarkistettu</StatusChip>
                        )}
                      </td>

                      <td className="rf-tabular whitespace-nowrap" style={{ color: "var(--rf-text-2)" }}>
                        {formatDate(receipt.date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="md:hidden">
              {recent.map((receipt) => (
                <li key={receipt.id}>
                  <Link
                    href={`/admin/kuitit/${receipt.id}`}
                    className="rf-press flex items-center gap-3 border-t py-3 first:border-0 first:pt-0"
                    style={{ borderColor: "var(--rf-line)" }}
                  >
                    <CategoryBubble category={receipt.category} size={34} />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">
                        {receipt.supplierName}
                      </span>
                      <span className="block text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                        {CATEGORY_LABELS[receipt.category]} · {formatDate(receipt.date)}
                      </span>
                    </span>

                    <span className="shrink-0 text-right">
                      <span className="rf-tabular block text-[14px] font-semibold">
                        {formatMoney(receipt.totalCents)}
                      </span>
                      <span className="mt-1 block">
                        {receipt.status === "needs_review" ? (
                          <Pill tone="warn" dot>
                            Tarkistettava
                          </Pill>
                        ) : (
                          <Pill tone="ok" dot>
                            Tarkistettu
                          </Pill>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

    </div>
  );
}

// ---------------------------------------------------------------------------


/** "+5,3 %" tai "−12,0 %". Ei koskaan ilman vertailujaksoa. */
function percent(change: number): string {
  const value = (Math.abs(change) * 100).toFixed(1).replace(".", ",");
  return `${change >= 0 ? "+" : "−"}${value} %`;
}

/** "heinäkuu" — kuukauden nimi pienellä vertailulausetta varten. */
function monthWord(month: string): string {
  return formatMonth(month).split(" ")[0].toLowerCase();
}

/**
 * Päivä vuosiluvun kanssa.
 *
 * formatDate jättää vuoden pois, koska listoissa kaikki on samaa
 * kuukautta. Toiseen kuukauteen viitattaessa vuosi on olennainen —
 * 1.1. voi olla eri vuodelta kuin näkymä.
 */
function formatFullDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${Number(d)}.${Number(m)}.${y}`;
}

function formatDate(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(d)}.${Number(m)}.`;
}


// ---------------------------------------------------------------------------

/**
 * Tilamerkki taulukkoriville.
 *
 * Pienempi ja tiiviimpi kuin yleinen Pill: taulukkorivi on 13 px, ja
 * yleinen pilleri kasvatti rivin korkeutta kahdella pikselillä
 * jokaisella rivillä.
 */
function StatusChip({ tone, children }: { tone: "ok" | "warn"; children: ReactNode }) {
  const ok = tone === "ok";
  return (
    <span
      className="inline-flex shrink-0 items-center gap-[5px] whitespace-nowrap px-[9px] py-[3px] text-[11.5px] font-semibold"
      style={{
        background: ok ? "var(--rf-green-bg)" : "var(--rf-amber-bg)",
        color: ok ? "var(--rf-green-text)" : "var(--rf-amber-text)",
        borderRadius: 999,
      }}
    >
      <RfIcon name={ok ? "check" : "alert"} size={13} />
      {children}
    </span>
  );
}

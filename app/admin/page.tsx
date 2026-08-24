import Link from "next/link";
import { ISO_MONTH } from "@/lib/restoflow/dates";
import { adminContext } from "@/lib/restoflow/page-context";
import {
  budgetLines,
  compareToPreviousMonth,
  focusItems,
  receiptSplit,
  staffCostShare,
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
import { supplierTotalsInMonth, supplierTrends } from "@/lib/restoflow/suppliers";
import { staffCostCents } from "@/lib/restoflow/timeclock";
import { can, canAddReceipts, seesPayRates } from "@/lib/restoflow/permissions";
import { CATEGORY_LABELS } from "@/lib/restoflow/types";
import { formatMoney } from "@/lib/money";
import { CountUp } from "@/components/restoflow/count-up";
import { CategoryIcon, RfIcon } from "@/components/restoflow/icons";
import {
  ButtonLink,
  CategoryBubble,
  Pill,
} from "@/components/restoflow/ui";
import {
  BudgetBarLine,
  Panel,
  PanelEmpty,
  StatCard,
} from "@/components/restoflow/dashboard-ui";
import { MonthPicker } from "./month-picker";
import { Hero } from "./home/hero";
import { Rhythm } from "./home/rhythm";
import { Purchases } from "./home/purchases";
import { StatusHeader } from "./home/status-header";
import { SectionHeading } from "@/components/restoflow/dashboard-ui";
import { Today } from "./home/today";
import { labourCost } from "@/lib/restoflow/payroll-data";
import { todayPulse } from "@/lib/restoflow/pulse";
import { overallStatus } from "@/lib/restoflow/status";
import { evaluability } from "@/lib/restoflow/dashboard";
import { monthStartDate } from "@/lib/restoflow/clock-context";
import { spendRhythm } from "@/lib/restoflow/spend-rhythm";

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
    receipts, users, budgets, shifts, clockEvents, absences, merchants,
    openShifts, sales,
    suppliers: supplierRows,
    month, today, now, monthlyHours, restaurant, role, categories: customCategories,
  } = await adminContext("/admin");

  const requested = typeof params.kuukausi === "string" ? params.kuukausi : month;
  const viewMonth = ISO_MONTH.test(requested) && requested <= month ? requested : month;
  const isCurrentMonth = viewMonth === month;

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
  const suppliers = supplierTotalsInMonth(receipts, viewMonth).slice(0, 5);
  const trends = new Map(
    supplierTrends(receipts, viewMonth).map((trend) => [trend.supplierId, trend]),
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

  /*
   * Kaupan tunnus toimittajalistaan.
   *
   * Sama kahden askeleen haku kuin kuittilistassa: toimittaja tietää
   * brändinsä, brändi tietää värinsä. Kartat rakennetaan kerran, koska
   * viisi riviä tekisi kymmenen hakua listan piirtämisen aikana.
   */
  const merchantById = new Map(merchants.map((m) => [m.id, m]));
  const merchantBySupplier = new Map(
    supplierRows
      .filter((row) => row.merchantId !== null)
      .map((row) => [row.id, merchantById.get(row.merchantId!) ?? null]),
  );
  const merchantOfSupplier = (id: string) => merchantBySupplier.get(id) ?? null;

  const budgets_ = budgetLines(receipts, budgets, viewMonth);

  // Tunnit ja henkilöstökulu lasketaan vain kuluvalle kuukaudelle:
  // monthlyHours tulee kontekstista kuluvana kuukautena, eikä
  // menneen kuukauden tunteja saa esittää kuluvan lukuina.
  const totalHours = isCurrentMonth
    ? Object.values(monthlyHours).reduce((sum, hours) => sum + hours, 0)
    : null;

  const staffCost = isCurrentMonth
    ? users.reduce(
        (sum, u) =>
          sum + staffCostCents((monthlyHours[u.id] ?? 0) * 3600000, u.hourlyRateCents ?? 0),
        0,
      )
    : null;

  const costShare =
    staffCost === null ? null : staffCostShare(staffCost, totals.totalCents);

  const showsRates = seesPayRates(role);

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
      <h1 className="sr-only">Yleiskatsaus</h1>

      {/*
        Kolme aikajännettä siinä järjestyksessä kuin kysymykset
        kysytään: mitä nyt tapahtuu, miten tänään menee, mitä kuussa on
        tapahtunut.

        Kuukausi oli tässä ensimmäisenä. Se on kirjanpitäjän
        aikayksikkö, ei ravintoloitsijan — kello 14 kysymys on "kuka on
        salissa", ei "paljonko elokuussa on kulunut".
      */}
      <SectionHeading title="Huomio" />
      <StatusHeader
        status={status}
        items={items}
        canAddReceipt={can(role, "receipts.add")}
      />

      {pulse ? (
        <>
          <SectionHeading
            title="Tänään"
            hint="Päivän myynti, työvoima ja kulut. Kuukauden tulos on karkea."
          />
          <Today pulse={pulse} canManageSales={can(role, "sales.manage")} />
        </>
      ) : null}

      <SectionHeading
        title={formatMonth(viewMonth)}
        action={
          <>
            <MonthPicker value={viewMonth} months={selectable} />

            {canAddReceipts(role) ? (
              <ButtonLink
                href="/admin/kuitit/uusi"
                tone="primary"
                size="sm"
                icon={<RfIcon name="plus" size={15} />}
              >
                Lisää kuitti
              </ButtonLink>
            ) : null}

            {can(role, "reports.view") ? (
              <ButtonLink
                href={`/admin/raportit?kuukausi=${viewMonth}`}
                tone="ghost"
                size="sm"
                icon={<RfIcon name="download" size={15} />}
              >
                Vie raportti
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <Rhythm rhythm={rhythm} />

      <Hero
        label="Kirjatut kulut"
        cents={totals.totalCents}
        delta={
          totals.receiptCount > 0 && comparison.change !== null
            ? percent(comparison.change)
            : null
        }
        deltaTone={
          totals.receiptCount === 0 || comparison.change === null
            ? "flat"
            : comparison.change > 0
              ? "up"
              : comparison.change < 0
                ? "down"
                : "flat"
        }
        footnote={
          emptyMonthOnly
            ? "Ei kuitteja tässä kuussa"
            : totals.receiptCount === 0
              ? "Lisää ensimmäinen kuitti aloittaaksesi"
              : comparison.baseMonth === null
                ? `${formatMonth(viewMonth)} · ei vertailukohtaa`
                : `${formatMoney(periodTotals(receipts, comparison.baseMonth).totalCents)} ${monthWord(comparison.baseMonth)}ssa`
        }
        trend={hasTrend ? trend : null}
        canAddReceipt={can(role, "receipts.add")}
      />

      {/* 2. KPI-kortit */}
      <section
        aria-label="Avainluvut"
        className="grid auto-rows-fr grid-cols-2 gap-3 xl:grid-cols-4"
      >
        {/*
          Kirjatut kulut nousi tumpaan korttiin ylös.
          Sama luku kahdessa paikassa opettaa lukijalle että toinen
          niistä on turha — ja hän ei tiedä kumpi.
        */}
        <StatCard
          label="Kuitit"
          value={<CountUp to={receipts_.total} format="integer" />}
          // "Ei vielä kuitteja" on väärin kun niitä on toisessa kuussa.
          delta={
            receipts_.pending > 0
              ? { text: `${receipts_.pending} kesken` }
              : undefined
          }
          conclusion={emptyMonthOnly ? "Ei kuitteja tässä kuussa" : receipts_.label}
          tone={receipts_.pending > 0 ? "warn" : "neutral"}
          icon={<RfIcon name="receipt" size={14} />}
          href="/admin/kuitit"
          linkLabel="Kuitit"
        />

        <StatCard
          label="Työtunnit"
          value={
            totalHours === null ? "—" : <CountUp to={totalHours} format="hours" />
          }
          conclusion={
            totalHours === null
              ? "Vain kuluvalta kuukaudelta"
              : totalHours === 0
                ? "Ei leimauksia tässä kuussa"
                : "Leimauksista laskettu"
          }
          tone="muted"
          icon={<RfIcon name="clock" size={14} />}
          href="/admin/tyovuorot"
        />

        {showsRates ? (
          <StatCard
            label="Henkilöstökulut"
            value={
              staffCost === null ? "—" : <CountUp to={staffCost} format="money" />
            }
            conclusion={
              staffCost === null
                ? "Vain kuluvalta kuukaudelta"
                : costShare === null
                  ? "Osuutta ei voi laskea"
                  : `${Math.round(costShare * 100)} % kirjatuista kuluista`
            }
            tone="muted"
            icon={<RfIcon name="staff" size={14} />}
            hint="Tunnit × tuntipalkka. Ei palkkalaskelma."
            href="/admin/tyovuorot"
          />
        ) : (
          <StatCard
            label="Toimittajat"
            value={String(supplierTotalsInMonth(receipts, viewMonth).length)}
            conclusion={
              suppliers.length === 0 ? "Ei vielä toimittajia" : "Kuukauden aikana"
            }
            tone="muted"
            icon={<RfIcon name="suppliers" size={14} />}
            href="/admin/toimittajat"
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

      <Purchases
        categories={categories.slice(0, 5).map((row) => ({
          key: row.key,
          name: row.name,
          baseCategory: row.baseCategory,
          totalCents: row.totalCents,
          share: row.share,
        }))}
        suppliers={suppliers.map((supplier) => ({
          supplierId: supplier.supplierId,
          name: supplier.name,
          totalCents: supplier.totalCents,
          share: supplier.share,
          change: trends.get(supplier.supplierId)?.change ?? null,
        }))}
        merchantOf={merchantOfSupplier}
        totalCents={totals.totalCents}
        empty={
          emptyForMonth ?? {
            text: "Lisää kuitteja nähdäksesi mihin raha menee ja keneltä ostat eniten.",
            cta: "Lisää kuitti",
            href: "/admin/kuitit/uusi",
          }
        }
      />

      {/* Budjetit */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Budjetit"
          subtitle={budgets_.length > 0 ? formatMonth(viewMonth) : undefined}
          href={budgets_.length > 0 ? "/admin/budjetit" : undefined}
        >
          {budgets_.length === 0 ? (
            <PanelEmpty
              text="Budjetteja ei ole määritetty. Aseta kategoriakohtaiset rajat, niin Budet voi tunnistaa ylitykset ajoissa."
              cta="Määritä budjetit"
              href="/admin/budjetit"
            />
          ) : (
            <ul className="space-y-4">
              {budgets_.slice(0, 5).map((line) => (
                <li key={line.category} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 shrink-0"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    <CategoryIcon category={line.category} size={18} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="text-[14px] font-medium">
                        {CATEGORY_LABELS[line.category]}
                      </span>
                      <span
                        className="rf-tabular text-[13px]"
                        style={{ color: "var(--rf-text-2)" }}
                      >
                        {formatMoney(line.spentCents)} / {formatMoney(line.budgetCents)}
                      </span>
                    </span>

                    <BudgetBarLine tone={line.tone} ratio={line.ratio} />

                    <span className="mt-1.5 flex items-center justify-between gap-3">
                      <span className="rf-tabular text-[13px] font-semibold">
                        {line.percent} %
                      </span>
                      <Pill
                        tone={
                          line.tone === "over" || line.tone === "critical"
                            ? "risk"
                            : line.tone === "warning"
                              ? "warn"
                              : "ok"
                        }
                      >
                        {line.label}
                      </Pill>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

      </div>

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
            <div className="hidden md:block">
              <table className="w-full text-[14px]">
                <caption className="sr-only">Viimeisimmät kuitit</caption>
                <thead>
                  <tr
                    className="border-b text-left text-[12px]"
                    style={{ borderColor: "var(--rf-line)", color: "var(--rf-text-3)" }}
                  >
                    <th scope="col" className="pb-2 font-medium">Toimittaja</th>
                    <th scope="col" className="pb-2 text-right font-medium">Summa</th>
                    <th scope="col" className="pb-2 pl-6 font-medium">Kategoria</th>
                    <th scope="col" className="pb-2 pl-6 font-medium">Päivämäärä</th>
                    <th scope="col" className="pb-2 pl-6 font-medium">Tila</th>
                    <th scope="col" className="pb-2" />
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
                  {recent.map((receipt) => (
                    <tr key={receipt.id} className="rf-row">
                      <td className="py-3">
                        <Link
                          href={`/admin/kuitit/${receipt.id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {receipt.supplierName}
                        </Link>
                      </td>
                      <td className="rf-tabular py-3 text-right font-semibold">
                        {formatMoney(receipt.totalCents)}
                      </td>
                      <td className="py-3 pl-6" style={{ color: "var(--rf-text-2)" }}>
                        {CATEGORY_LABELS[receipt.category]}
                      </td>
                      <td
                        className="rf-tabular py-3 pl-6"
                        style={{ color: "var(--rf-text-2)" }}
                      >
                        {formatDate(receipt.date)}
                      </td>
                      <td className="py-3 pl-6">
                        {receipt.status === "needs_review" ? (
                          <span
                            className="inline-flex items-center gap-1.5 text-[13px]"
                            style={{ color: "var(--rf-amber-text)" }}
                          >
                            <RfIcon name="alert" size={14} />
                            Tarkistettava
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1.5 text-[13px]"
                            style={{ color: "var(--rf-green-text)" }}
                          >
                            <RfIcon name="check" size={14} />
                            Tarkistettu
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right" style={{ color: "var(--rf-text-3)" }}>
                        <Link
                          href={`/admin/kuitit/${receipt.id}`}
                          aria-label={`Avaa ${receipt.supplierName}`}
                        >
                          <RfIcon name="chevron" size={15} />
                        </Link>
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

      <p className="px-1 pb-1 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
        Budet seuraa kirjattuja kuluja. Myyntidata ei ole yhdistetty, joten
        tulosta ja katetta ei lasketa.
        {isCurrentMonth ? "" : ` Katselet mennyttä kuukautta — työaika ja henkilöstökulu näkyvät vain kuluvalta.`}
      </p>
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


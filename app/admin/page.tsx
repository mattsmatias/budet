import Link from "next/link";
import { adminContext } from "@/lib/restoflow/page-context";
import {
  attention,
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
import { can, canAddReceipts, seesPayRates } from "@/lib/restoflow/permissions";
import { formatDuration, staffCostCents, workedOnDate } from "@/lib/restoflow/timeclock";
import { currentState } from "@/lib/restoflow/timeclock";
import { CATEGORY_LABELS } from "@/lib/restoflow/types";
import { formatMoney } from "@/lib/money";
import { CategoryIcon, RfIcon } from "@/components/restoflow/icons";
import {
  Avatar,
  ButtonLink,
  CategoryBubble,
  Pill,
} from "@/components/restoflow/ui";
import {
  AttentionPanel,
  BudgetBarLine,
  Donut,
  Panel,
  PanelEmpty,
  seriesColor,
  Sparkline,
  StatCard,
} from "@/components/restoflow/dashboard-ui";
import { MonthPicker } from "./month-picker";

export const metadata = { title: "Yleiskuva" };

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
    receipts, users, budgets, shifts, clockEvents,
    month, today, now, monthlyHours, restaurant, user, role, categories: customCategories,
  } = await adminContext("/admin");

  const requested = typeof params.kuukausi === "string" ? params.kuukausi : month;
  const viewMonth = /^\d{4}-\d{2}$/.test(requested) && requested <= month ? requested : month;
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

  const dashboardInput = {
    receipts, budgets, shifts, users, clockEvents,
    month: viewMonth, today,
  };

  const focus = attention(dashboardInput);

  // Havainnot syötetään samaan listaan. Käyttäjän kannalta ero
  // hälytyksen ja havainnon välillä on keinotekoinen — molemmat ovat
  // asioita joihin pitää reagoida, ja kahdesta listasta toinen jäisi
  // katsomatta.
  const insights = buildInsights({ ...dashboardInput, now });
  const items = focusItems(dashboardInput, insights);

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

  // Tänään sisällä olevat. Tila luetaan leimauksista, ei tallenneta.
  const onDuty = users
    .map((u) => {
      const events = clockEvents.filter((event) => event.userId === u.id);
      const worked = workedOnDate(events, today, now);
      const state = currentState(events.filter((event) => event.at.slice(0, 10) === today));
      const firstIn = events.find(
        (event) => event.type === "in" && event.at.slice(0, 10) === today,
      );

      return { user: u, worked, state, since: firstIn?.at ?? null };
    })
    .filter((row) => row.state === "working" || row.state === "on_break")
    .sort((a, b) => (a.since ?? "").localeCompare(b.since ?? ""));

  const staffCount = users.filter((u) => u.position !== null).length;

  const firstName = (user.fullName ?? user.email ?? "").split(" ")[0] ?? "";

  // Trendiviiva vain jos historiaa on. Kahden pisteen viiva näyttäisi
  // suunnalta olematta sellainen.
  const trend = monthlySeries(receipts, viewMonth, 6).map((point) => point.totalCents);
  const hasTrend = trend.filter((value) => value > 0).length >= 3;

  return (
    <div className="rf-enter space-y-5 md:space-y-6">
      {/* 1. Yläosa */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold tracking-tight md:text-[28px]">
            {greeting(now, restaurant.timezone)}
            {firstName ? `, ${firstName}` : ""}{" "}
            <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-1 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
            {restaurant.name} · {formatMonth(viewMonth)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker value={viewMonth} months={selectable} />

          {canAddReceipts(role) ? (
            <ButtonLink
              href={`/admin/kuitit/uusi`}
              tone="primary"
              icon={<RfIcon name="plus" size={16} />}
            >
              Lisää kuitti
            </ButtonLink>
          ) : null}

          {can(role, "reports.view") ? (
            <span className="hidden md:inline-flex">
              <ButtonLink
                href={`/admin/raportit/tulosta?kuukausi=${viewMonth}`}
                tone="ghost"
                icon={<RfIcon name="download" size={16} />}
              >
                Vie raportti
              </ButtonLink>
            </span>
          ) : null}
        </div>
      </header>

      {/* 2. KPI-kortit */}
      <section
        aria-label="Avainluvut"
        className="grid auto-rows-fr grid-cols-2 gap-3 xl:grid-cols-4"
      >
        <StatCard
          label="Kirjatut kulut"
          value={formatMoney(totals.totalCents)}
          tone={
            comparison.change === null
              ? "muted"
              : comparison.change > 0
                ? "up"
                : comparison.change < 0
                  ? "down"
                  : "neutral"
          }
          conclusion={
            totals.receiptCount === 0
              ? "Lisää ensimmäinen kuitti aloittaaksesi"
              : comparison.change === null || comparison.baseMonth === null
                ? "Ei vertailukohtaa"
                : `${percent(comparison.change)} vs. ${monthWord(comparison.baseMonth)}`
          }
          hint="Järjestelmään lisättyjen kuittien summa"
          href="/admin/kulut"
          icon={<RfIcon name="expenses" size={14} />}
          trend={hasTrend ? <Sparkline values={trend} /> : undefined}
        />

        <StatCard
          label="Kuitit"
          value={String(receipts_.total)}
          conclusion={receipts_.label}
          tone={receipts_.pending > 0 ? "warn" : "neutral"}
          icon={<RfIcon name="receipt" size={14} />}
          href="/admin/kuitit"
        />

        <StatCard
          label="Työtunnit"
          value={totalHours === null ? "—" : `${round(totalHours)} h`}
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
            value={staffCost === null ? "—" : formatMoney(staffCost)}
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

      {/* 3. Vaatii huomiota — kolme eri tilaa */}
      {focus.state !== "attention" ? (
        <div
          className="px-5 py-5"
          style={{
            background: "var(--rf-card)",
            border: "1px solid var(--rf-line)",
            borderRadius: "var(--rf-r-card)",
          }}
        >
          {focus.state === "no-data" ? (
            <>
              <h2 className="text-[16px] font-semibold">Ei vielä arvioitavaa</h2>
              <p
                className="mt-1.5 max-w-xl text-[13px] leading-relaxed"
                style={{ color: "var(--rf-text-2)" }}
              >
                Lisää ensimmäinen kuitti tai määritä budjetit, jotta Budet
                voi tunnistaa poikkeamat. Tyhjä aineisto ei tarkoita että
                kaikki on kunnossa — se tarkoittaa ettei mitään ole vielä
                tarkastettavana.
              </p>
              <Link
                href="/admin/kuitit/uusi"
                className="rf-press mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-[14px] font-semibold"
                style={{
                  background: "var(--rf-accent)",
                  color: "var(--rf-on-accent)",
                  borderRadius: "var(--rf-r-control)",
                }}
              >
                <RfIcon name="plus" size={16} />
                Lisää kuitti
              </Link>
            </>
          ) : focus.state === "clear" ? (
            <>
              <h2 className="flex items-center gap-2 text-[16px] font-semibold">
                Kaikki kunnossa
                <span style={{ color: "var(--rf-green-text)" }}>
                  <RfIcon name="check" size={18} />
                </span>
              </h2>
              <p
                className="mt-1.5 max-w-xl text-[13px] leading-relaxed"
                style={{ color: "var(--rf-text-2)" }}
              >
                Ei tarkistettavia kuitteja, budjettiylityksiä eikä poikkeavia
                kuluja. Tarkastettu {monthWord(viewMonth)}n aineistosta.
              </p>
            </>
          ) : null}
        </div>
      ) : (
        <AttentionPanel items={items} />
      )}

      {/* 5 & 6. Mihin ja kenelle */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Mihin rahat menevät?"
          subtitle={`${formatMonth(viewMonth)} · kirjattujen kulujen jakauma`}
          href="/admin/kulut"
        >
          {categories.length === 0 ? (
            <PanelEmpty
              text="Lisää kuitteja nähdäksesi kulujakauman."
              cta="Lisää kuitti"
              href="/admin/kuitit/uusi"
            />
          ) : (
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <Donut
                slices={categories.slice(0, 5).map((row) => ({
                  key: row.key,
                  label: row.name,
                  valueCents: row.totalCents,
                  share: row.share,
                }))}
                total={formatMoney(totals.totalCents)}
              />

            <ul className="w-full flex-1 space-y-1">
              {categories.slice(0, 5).map((row, index) => (
                <li key={row.key}>
                  <Link
                    href={`/admin/kuitit?suodatin=${row.baseCategory}`}
                    className="rf-press flex items-center justify-between gap-3 rounded-[10px] px-2 py-2"
                  >
                    <span className="flex min-w-0 items-center gap-2.5 text-[14px]">
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: seriesColor(index) }}
                      />
                      <span className="truncate">{row.name}</span>
                    </span>

                    <span className="flex shrink-0 items-baseline gap-3">
                      <span className="rf-tabular text-[14px] font-semibold">
                        {formatMoney(row.totalCents)}
                      </span>
                      <span
                        className="rf-tabular w-10 text-right text-[13px]"
                        style={{ color: "var(--rf-text-3)" }}
                      >
                        {Math.round(row.share * 100)} %
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            </div>
          )}
        </Panel>

        <Panel
          title="Kenelle rahat menevät?"
          subtitle="Suurimmat toimittajat"
          href="/admin/toimittajat"
        >
          {suppliers.length === 0 ? (
            <PanelEmpty text="Kun kuitteja kertyy, näet suurimmat toimittajat täällä." />
          ) : (
            <ul className="space-y-3">
              {suppliers.map((supplier) => {
                const supplierTrend = trends.get(supplier.supplierId);
                const hasTrend =
                  supplierTrend !== undefined && supplierTrend.change !== null;

                return (
                  <li key={supplier.supplierId}>
                    <Link
                      href={`/admin/toimittajat/${supplier.supplierId}`}
                      className="flex items-baseline justify-between gap-3 border-t pt-3 first:border-0 first:pt-0"
                      style={{ borderColor: "var(--rf-line)" }}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Avatar initials={initialsOf(supplier.name)} size={30} />
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-medium">
                            {supplier.name}
                          </span>
                          <span
                            className="rf-tabular block text-[12px]"
                            style={{ color: "var(--rf-text-3)" }}
                          >
                            {hasTrend
                              ? `${percent(supplierTrend!.change as number)} vs. edellinen kuukausi`
                              : "Ei vertailukohtaa"}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="rf-tabular block text-[14px] font-semibold">
                          {formatMoney(supplier.totalCents)}
                        </span>
                        <span
                          className="rf-tabular block text-[12px]"
                          style={{ color: "var(--rf-text-3)" }}
                        >
                          {(supplier.share * 100).toFixed(1).replace(".", ",")} %
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {/* 7 & 8. Budjetit ja työaika */}
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

        <Panel
          title="Työaika tänään"
          subtitle={isCurrentMonth ? undefined : "Aina kuluva päivä"}
          href="/admin/tyontekijat"
          linkLabel="Kaikki työntekijät"
        >
          <p className="rf-tabular text-[20px] font-semibold">
            {onDuty.length} / {staffCount} työntekijää työssä
          </p>

          {onDuty.length === 0 ? (
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
              {staffCount === 0
                ? "Ravintolaan ei ole vielä lisätty työntekijöitä."
                : "Kukaan ei ole vielä leimannut sisään."}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {onDuty.map((row) => (
                <li
                  key={row.user.id}
                  className="flex items-center justify-between gap-3 border-t pt-3 first:border-0 first:pt-0"
                  style={{ borderColor: "var(--rf-line)" }}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        background:
                          row.state === "on_break" ? "var(--rf-amber)" : "var(--rf-green)",
                      }}
                    />
                    <Avatar initials={row.user.initials} size={28} />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-medium">
                        {row.user.name}
                      </span>
                      <span
                        className="rf-tabular block text-[12px]"
                        style={{ color: "var(--rf-text-3)" }}
                      >
                        {row.since ? `${row.since.slice(11, 16)} → nyt` : "Työssä"}
                        {row.state === "on_break" ? " · tauolla" : ""}
                      </span>
                    </span>
                  </span>

                  <span className="rf-tabular shrink-0 text-[13px] font-medium">
                    {formatDuration(row.worked.workedMs)}
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
            text="Ensimmäinen kuittisi näkyy täällä."
            cta="Lisää kuitti"
            href="/admin/kuitit/uusi"
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

/**
 * Tervehdys ravintolan ajassa.
 *
 * Palvelin käy UTC:ssä, joten kellonaika on luettava ravintolan
 * vyöhykkeellä — muuten suomalainen omistaja saa "hyvää iltaa" aamulla.
 */
function greeting(nowIso: string, timeZone: string): string {
  const hour = Number(
    new Intl.DateTimeFormat("fi-FI", {
      timeZone,
      hour: "2-digit",
      hour12: false,
    }).format(new Date(nowIso)),
  );

  if (hour < 5) return "Hyvää yötä";
  if (hour < 11) return "Hyvää huomenta";
  if (hour < 17) return "Hyvää päivää";
  return "Hyvää iltaa";
}

/** "+5,3 %" tai "−12,0 %". Ei koskaan ilman vertailujaksoa. */
function percent(change: number): string {
  const value = (Math.abs(change) * 100).toFixed(1).replace(".", ",");
  return `${change >= 0 ? "+" : "−"}${value} %`;
}

/** "heinäkuu" — kuukauden nimi pienellä vertailulausetta varten. */
function monthWord(month: string): string {
  return formatMonth(month).split(" ")[0].toLowerCase();
}

function round(hours: number): string {
  return String(Math.round(hours));
}

function formatDate(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(d)}.${Number(m)}.`;
}

/** Toimittajan nimen alkukirjaimet. Neutraali tunniste ilman logoja. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((part) => part[0]!.toUpperCase()).join("");
}

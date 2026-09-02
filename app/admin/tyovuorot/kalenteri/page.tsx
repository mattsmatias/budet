import Link from "next/link";
import { fill } from "@/lib/i18n/auth-text";
import { labels } from "@/lib/i18n/labels";
import { resolveLocale } from "@/lib/i18n/resolve";
import { adminText } from "@/lib/i18n/admin-text";
import type { AdminText } from "@/lib/i18n/admin-text";
import { adminContext } from "@/lib/restoflow/page-context";
import { can, seesPayRates } from "@/lib/restoflow/permissions";
import { ISO_DATE, ISO_MONTH } from "@/lib/restoflow/dates";
import { formatMonth, monthWord } from "@/lib/restoflow/expenses";
import { monthCalendar, shiftsOn } from "@/lib/restoflow/calendar";
import { openAsShift } from "@/lib/restoflow/open-shifts";
import {
  findOverlaps,
  formatPlanned,
  isLive,
  planSummary,
  publicationOf,
} from "@/lib/restoflow/shift-planning";
import { formatMoney } from "@/lib/money";
import type { Shift, User } from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, CardHeader, MetricCard } from "@/components/restoflow/ui";
import { CountUp } from "@/components/restoflow/count-up";
import { DayPanel } from "./day-panel";
import { DragStaff } from "./drag-staff";
import { CopyRange, RecurringForm } from "./copy-controls";
import { BulkShifts } from "./bulk-shifts";
import { PublishBar } from "../publish-bar";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.vuoro.shiftCalendar };
}

/**
 * Kuukauden työvuorokalenteri.
 *
 * Suunnittelun päänäkymä. Työvuorosivu vastaa kysymykseen "mitä
 * seuraavaksi" ja työvuorolista kysymykseen "kuka on töissä milloin";
 * tämä vastaa kysymykseen "miltä kuukausi näyttää ja mitä siitä
 * puuttuu".
 *
 * HINTA NÄKYY SUUNNITTELUHETKELLÄ.
 *
 * Työvoimakustannus lasketaan suunnitelluista tunneista ja verrataan
 * henkilöstöbudjettiin heti yläreunassa. Kustannus joka selviää vasta
 * palkkapäivänä on tieto joka tulee liian myöhään.
 */
export default async function ShiftCalendarPage({
  searchParams,
}: PageProps<"/admin/tyovuorot/kalenteri">) {
  const t = adminText(await resolveLocale());
  const locale = await resolveLocale();
  const nimet = labels(locale);
  const {
    users,
    shifts: assigned,
    openShifts,
    budgets,
    month,
    today,
    role,
  } = await adminContext("/admin/tyovuorot");

  /*
   * Avoimet vuorot mukaan kalenteriin.
   *
   * Avoin vuoro on vuoro jolla ei ole vielä tekijää — juuri se jonka
   * takia kalenteria katsotaan. Erillisenä listana se olisi näkymättä
   * siitä ruudusta jossa tekijää etsitään.
   */
  const shifts = [...assigned, ...openShifts.map(openAsShift)];

  if (!can(role, "shifts.view.all")) return null;

  const params = await searchParams;
  const requested =
    typeof params.kuukausi === "string" ? params.kuukausi : month;
  const viewMonth = ISO_MONTH.test(requested) ? requested : month;

  const selectedDay =
    typeof params.paiva === "string" && ISO_DATE.test(params.paiva)
      ? params.paiva
      : null;

  /*
   * Kolme näkymää samasta aineistosta.
   *
   * Kuukausi on suunnittelun yleiskuva, viikko sen tarkennus ja päivä
   * yhden illan miehitys. Valinta on osoitteessa: näkymän voi
   * linkittää ja paluunappi toimii.
   */
  const view =
    params.nakyma === "viikko"
      ? "viikko"
      : params.nakyma === "paiva"
        ? "paiva"
        : "kuukausi";

  const canManage = can(role, "shifts.manage");
  const showsRates = seesPayRates(role);

  const monthShifts = shifts.filter((shift) =>
    shift.date.startsWith(viewMonth),
  );
  const weeks = monthCalendar(viewMonth, today);
  const plan = planSummary({ shifts: monthShifts, users });
  const overlapping = findOverlaps(monthShifts, users);

  const drafts = monthShifts.filter(
    (shift) => publicationOf(shift) === "draft",
  );
  const draftPlan = planSummary({ shifts: drafts, users });

  /*
   * Henkilöstöbudjetti on kulubudjetti kategorialle "staff".
   *
   * Ei omaa työvoimabudjettia: ravintolalla on yksi budjetti
   * henkilöstöstä, ja kaksi lukua samasta asiasta ajautuisi erilleen.
   * Kuukausikohtainen voittaa toistuvan.
   */
  const labourBudget =
    budgets.find((b) => b.category === "staff" && b.month === viewMonth) ??
    budgets.find((b) => b.category === "staff" && b.month === null) ??
    null;

  const overBudget =
    labourBudget !== null && plan.labourCostCents > labourBudget.amountCents;

  /*
   * Mihin viikko- ja päivänäkymä kohdistuvat.
   *
   * Valittu päivä jos sellainen on, muuten tämä päivä jos se osuu
   * kuukauteen, muuten kuukauden ensimmäinen. Ilman viimeistä ehtoa
   * menneen kuukauden viikkonäkymä avautuisi tyhjänä.
   */
  const focusDate =
    selectedDay ?? (today.startsWith(viewMonth) ? today : `${viewMonth}-01`);

  const focusWeek =
    weeks.find((week) => week.days.some((day) => day.date === focusDate)) ??
    weeks[0];

  const monthStart = `${viewMonth}-01`;
  const monthEnd =
    weeks
      .flatMap((week) => week.days)
      .filter((day) => day.inMonth)
      .at(-1)?.date ?? monthStart;

  return (
    <div className="rf-enter space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/tyovuorot"
          className="rf-press inline-flex items-center gap-1.5 text-[13px] font-bold"
          style={{ color: "var(--rf-text-2)" }}
        >
          <RfIcon name="back" size={14} />
          {t.vuoro.shiftsTitle}
        </Link>

        <Link
          href={`/admin/tyovuorot/lista?kuukausi=${viewMonth}`}
          className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
          style={{
            background: "var(--rf-inset)",
            color: "var(--rf-text)",
            border: "1px solid var(--rf-line-strong)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <RfIcon name="report" size={15} />
          {t.vuoro.shiftList}
        </Link>
      </div>

      {canManage ? (
        <PublishBar
          t={t}
          month={viewMonth}
          monthLabel={`${monthWord(viewMonth, locale)}n ${viewMonth.slice(0, 4)}`}
          drafts={drafts.length}
          people={draftPlan.people}
          hours={formatPlanned(draftPlan.plannedMinutes)}
        />
      ) : null}

      {/*
        Nopeat luontitavat ennen kalenteria.

        Kuukauden suunnittelu alkaa lähes aina kopioinnista tai
        toistuvasta vuorosta, ja vasta sen jälkeen korjataan poikkeukset
        kalenterista. Työkalut ovat siksi siinä järjestyksessä.
      */}
      {canManage ? (
        <div className="flex flex-wrap gap-2.5">
          <CopyRange
            t={t}
            month={viewMonth}
            monthStart={monthStart}
            monthEnd={monthEnd}
          />
          <RecurringForm
            t={t}
            nimet={nimet}
            users={users}
            monthStart={monthStart}
            monthEnd={monthEnd}
          />
          <BulkShifts
            locale={locale}
            t={t}
            shifts={monthShifts}
            users={users}
            today={today}
            monthLabel={formatMonth(viewMonth, locale)}
          />
        </div>
      ) : null}

      {/* Kuukauden yhteenveto, §19. */}
      <section
        aria-label={t.vuoro.keyFigures}
        className="grid auto-rows-fr grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          label={t.vuoro.staffCount}
          tileTone="brand"
          tone="muted"
          icon={<RfIcon name="staff" size={17} />}
          value={<CountUp to={plan.people} format="integer" />}
          conclusion={fill(
            plan.shiftCount === 1
              ? t.vuoro.shiftCountOne
              : t.vuoro.shiftCountMany,
            { maara: String(plan.shiftCount) },
          )}
        />

        <MetricCard
          label={t.vuoro.plannedHours}
          tileTone="green"
          tone="muted"
          icon={<RfIcon name="clock" size={17} />}
          value={formatPlanned(plan.plannedMinutes)}
          conclusion={t.vuoro.breaksDeducted}
        />

        {showsRates ? (
          <MetricCard
            label={t.vuoro.estimatedCost}
            tileTone="violet"
            icon={<RfIcon name="payroll" size={17} />}
            value={<CountUp to={plan.labourCostCents} format="money" />}
            tone={plan.missingRates > 0 ? "warn" : "muted"}
            conclusion={
              plan.missingRates > 0
                ? fill(t.vuoro.missingRatesNote, {
                    maara: String(plan.missingRates),
                  })
                : t.vuoro.hoursTimesRate
            }
          />
        ) : null}

        {showsRates ? (
          <MetricCard
            label={t.vuoro.staffBudget}
            tileTone="blue"
            icon={<RfIcon name="budget" size={17} />}
            value={
              labourBudget === null ? (
                "—"
              ) : (
                <CountUp to={labourBudget.amountCents} format="money" />
              )
            }
            tone={overBudget ? "bad" : "muted"}
            delta={
              labourBudget === null
                ? undefined
                : {
                    text: `${overBudget ? "+" : "−"}${formatMoney(
                      Math.abs(plan.labourCostCents - labourBudget.amountCents),
                    )}`,
                    tone: overBudget ? "bad" : "neutral",
                  }
            }
            conclusion={
              labourBudget === null
                ? t.vuoro.setStaffBudget
                : overBudget
                  ? t.vuoro.planOverBudget
                  : t.vuoro.planFitsBudget
            }
            href="/admin/budjetit"
            linkLabel={t.vuoro.budgets}
          />
        ) : null}
      </section>

      {overlapping.length > 0 ? (
        <p
          className="flex items-start gap-2.5 px-3.5 py-3 text-[12.5px] leading-relaxed"
          style={{
            background: "var(--rf-red-bg)",
            color: "var(--rf-red-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <span className="mt-px shrink-0">
            <RfIcon name="alert" size={15} />
          </span>
          {overlapping.length}{" "}
          {overlapping.length === 1 ? t.vuoro.overlapOne : t.vuoro.overlapMany}:{" "}
          {overlapping
            .slice(0, 3)
            .map((pair) => pair.user?.name ?? "tuntematon")
            .join(", ")}
          {overlapping.length > 3 ? " ja muita" : ""}. Sama ihminen on kahdessa
          paikassa samaan aikaan.
        </p>
      ) : null}

      {/*
        Näkymän valinta linkkeinä eikä painikkeina.

        Valinta on osa osoitetta: viikon voi lähettää kollegalle ja
        paluunappi vie edelliseen näkymään.
      */}
      <div
        className="flex flex-wrap items-center gap-0.5 self-start p-0.5"
        style={{
          background: "var(--rf-inset)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <ViewTab
          href={`/admin/tyovuorot/kalenteri?kuukausi=${viewMonth}`}
          label={t.vuoro.monthView}
          active={view === "kuukausi"}
        />
        <ViewTab
          href={`/admin/tyovuorot/kalenteri?kuukausi=${viewMonth}&nakyma=viikko&paiva=${focusDate}`}
          label={t.vuoro.weekView}
          active={view === "viikko"}
        />
        <ViewTab
          href={`/admin/tyovuorot/kalenteri?kuukausi=${viewMonth}&nakyma=paiva&paiva=${focusDate}`}
          label={t.vuoro.dayView}
          active={view === "paiva"}
        />
      </div>

      {canManage && view !== "paiva" ? (
        <DragStaff t={t} nimet={nimet} users={users} />
      ) : null}

      {view === "paiva" ? (
        <DayPanel
          locale={locale}
          t={t}
          nimet={nimet}
          date={focusDate}
          month={viewMonth}
          users={users}
          shifts={shiftsOn(shifts, focusDate)}
          canManage={canManage}
        />
      ) : (
        <>
          <Card padded={false}>
            <div className="px-5 pt-5">
              <CardHeader
                title={
                  view === "viikko"
                    ? fill(t.vuoro.weekOfMonth, {
                        viikko: String(focusWeek?.week ?? ""),
                        kuukausi: formatMonth(viewMonth, locale),
                      })
                    : formatMonth(viewMonth, locale)
                }
                subtitle={
                  view === "viikko" ? t.vuoro.allDayShifts : t.vuoro.clickDay
                }
              />
            </div>

            <div className="-mt-1 overflow-x-auto px-2 pb-2">
              <table
                className={`rf-cal w-full ${view === "viikko" ? "rf-cal-week-view" : ""}`}
              >
                <caption className="sr-only">
                  {fill(t.vuoro.calendarCaption, {
                    kuukausi: formatMonth(viewMonth, locale),
                  })}
                </caption>

                <thead>
                  <tr>
                    <th scope="col" className="rf-cal-week">
                      {t.vuoro.weekAbbr}
                    </th>
                    {[
                      t.vuoro.mon,
                      t.vuoro.tue,
                      t.vuoro.wed,
                      t.vuoro.thu,
                      t.vuoro.fri,
                      t.vuoro.sat,
                      t.vuoro.sun,
                    ].map((name) => (
                      <th key={name} scope="col">
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {(view === "viikko" && focusWeek ? [focusWeek] : weeks).map(
                    (week) => (
                      <tr key={`${week.week}-${week.days[0].date}`}>
                        <th scope="row" className="rf-cal-week">
                          {week.week}
                        </th>

                        {week.days.map((day) => (
                          <DayCell
                            t={t}
                            key={day.date}
                            date={day.date}
                            dayNumber={day.day}
                            inMonth={day.inMonth}
                            weekend={day.weekend}
                            isToday={day.isToday}
                            selected={day.date === selectedDay}
                            shifts={shiftsOn(shifts, day.date)}
                            users={users}
                            month={viewMonth}
                            view={view}
                            limit={view === "viikko" ? Infinity : 3}
                          />
                        ))}
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {selectedDay ? (
            <DayPanel
              locale={locale}
              t={t}
              nimet={nimet}
              date={selectedDay}
              month={viewMonth}
              users={users}
              shifts={shiftsOn(shifts, selectedDay)}
              canManage={canManage}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Yksi päivä kalenterissa.
 *
 * Kolme vuoroa näkyy, loput lasketaan yhteen. Kymmenen nimeä ruudussa
 * tekisi ruudusta lukukelvottoman juuri niinä päivinä jolloin
 * miehitystä eniten tarkistetaan.
 */
function DayCell({
  t,
  date,
  dayNumber,
  inMonth,
  weekend,
  isToday,
  selected,
  shifts,
  users,
  month,
  view = "kuukausi",
  limit = 3,
}: {
  t: AdminText;
  date: string;
  dayNumber: number;
  inMonth: boolean;
  weekend: boolean;
  isToday: boolean;
  selected: boolean;
  shifts: Shift[];
  users: User[];
  month: string;
  view?: string;
  /** Montako vuoroa ruutuun mahtuu ennen ylivuotorivin. */
  limit?: number;
}) {
  const live = shifts.filter((shift) => shift.cancelledAt === null);
  const shown = Number.isFinite(limit) ? live.slice(0, limit) : live;
  const rest = live.length - shown.length;

  return (
    <td
      className="rf-cal-day"
      /* Pudotusalue raahaukselle. Kuuntelijat ovat DragStaff-komponentissa. */
      data-day={date}
      style={{
        background: selected
          ? "var(--rf-accent-bg)"
          : weekend
            ? "var(--rf-inset)"
            : undefined,
        opacity: inMonth ? 1 : 0.45,
        outline: selected ? "2px solid var(--rf-accent)" : undefined,
      }}
    >
      <Link
        href={`/admin/tyovuorot/kalenteri?kuukausi=${month}&paiva=${date}${view === "kuukausi" ? "" : `&nakyma=${view}`}`}
        scroll={false}
        className="block h-full w-full px-1.5 py-1.5"
      >
        <span className="flex items-center justify-between gap-1">
          <span
            className="rf-tabular text-[12px] font-bold"
            style={{
              color: isToday ? "var(--rf-accent)" : "var(--rf-text-2)",
            }}
          >
            {dayNumber}
          </span>

          {live.length > 0 ? (
            <span
              className="rf-tabular text-[10.5px] font-medium"
              style={{ color: "var(--rf-text-3)" }}
            >
              {live.length}
            </span>
          ) : null}
        </span>

        <span className="mt-1 block space-y-[3px]">
          {shown.map((shift) => {
            const user = users.find((u) => u.id === shift.userId);
            const draft = !isLive(shift);

            return (
              <span
                key={shift.id}
                className="block truncate text-[11px] leading-tight"
                style={{
                  /*
                   * Luonnos katkoviivalla, ei vain haaleampana.
                   *
                   * Haaleus katoaa kirkkaassa keittiössä ja
                   * mustavalkoisella. Katkoviiva erottuu molemmissa.
                   */
                  color: shift.userId ? "var(--rf-text)" : "var(--rf-red-text)",
                  borderLeft: draft
                    ? "2px dashed var(--rf-amber-text)"
                    : "2px solid transparent",
                  paddingLeft: 4,
                  opacity: draft ? 0.85 : 1,
                }}
              >
                {user?.name.split(" ")[0] ?? t.vuoro.openWord}{" "}
                <span
                  className="rf-tabular"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  {short(shift.startTime)}–{short(shift.endTime)}
                </span>
              </span>
            );
          })}

          {rest > 0 ? (
            <span
              className="block text-[10.5px] font-medium"
              style={{ color: "var(--rf-text-3)" }}
            >
              {fill(t.vuoro.moreCount, { maara: String(rest) })}
            </span>
          ) : null}
        </span>
      </Link>
    </td>
  );
}

/**
 * Näkymän välilehti.
 *
 * Linkki eikä painike: valinta on osa osoitetta, joten näkymän voi
 * linkittää ja paluunappi toimii.
 */
function ViewTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="rf-press px-3.5 py-1.5 text-[12.5px] font-semibold"
      style={{
        background: active ? "var(--rf-card)" : "transparent",
        color: active ? "var(--rf-text)" : "var(--rf-text-2)",
        borderRadius: "calc(var(--rf-r-control) - 2px)",
        boxShadow: active ? "var(--rf-shadow-sm)" : undefined,
      }}
    >
      {label}
    </Link>
  );
}

/** "10:00" → "10", "10:30" → "10.30". Ruudussa tila on kortilla. */
function short(time: string): string {
  const [h, m] = time.split(":");
  return m === "00" ? String(Number(h)) : `${Number(h)}.${m}`;
}

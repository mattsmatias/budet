import Link from "next/link";
import { labels, type Labels } from "@/lib/i18n/labels";
import { resolveLocale } from "@/lib/i18n/resolve";
import { adminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { monthName } from "@/lib/i18n/format";
import { adminContext } from "@/lib/restoflow/page-context";
import { RfIcon } from "@/components/restoflow/icons";
import {
  compareShifts,
  formatVariance,
  labourSummary,
  variancePatterns,
} from "@/lib/restoflow/shifts";
import { formatDuration } from "@/lib/restoflow/timeclock";
import { dayIn } from "@/lib/restoflow/clock-context";
import {
  DEVIATION_LABELS,
  findDeviations,
  isRetroactive,
} from "@/lib/restoflow/deviations";
import { can, seesPayRates } from "@/lib/restoflow/permissions";
import { type Shift, type User } from "@/lib/restoflow/types";
import { formatMoney } from "@/lib/money";
import { ShiftStatusIcon } from "@/components/restoflow/icons";
import {
  Avatar,
  Card,
  CardHeader,
  EmptyState,
  MetricCard,
  Pill,
} from "@/components/restoflow/ui";
import {
  findOverlaps,
  formatPlanned,
  planSummary,
  publicationOf,
} from "@/lib/restoflow/shift-planning";
import { openAsShift } from "@/lib/restoflow/open-shifts";
import { cancelAbsence, markAbsenceCertificate } from "../actions";
import { PublishBar } from "./publish-bar";
import { EditShift, NewShiftButton } from "./shift-form";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.vuorot.title };
}

export default async function AdminShiftsPage() {
  const {
    users,
    shifts,
    openShifts,
    clockEvents,
    absences,
    today,
    now,
    role,
    restaurant,
  } = await adminContext("/admin/tyovuorot");
  const locale = await resolveLocale();
  const t = adminText(locale);
  const nimet = labels(locale);

  const canManage = can(role, "shifts.manage");

  /*
   * Julkaisu koskee kuukautta, ei "tulevaa".
   *
   * Kuukauden alkupuolen luonnos on yhtä julkaisematon kuin lopunkin,
   * vaikka sen päivä olisi jo mennyt.
   *
   * Palkkeja on yksi per kuukausi jolla on luonnoksia. Pelkkä kuluva
   * kuukausi jättäisi seuraavan kuun suunnitelman ilman
   * julkaisupainiketta — ja juuri seuraavaa kuuta suunnitellaan.
   */
  const draftMonths = [
    ...new Set(
      shifts
        .filter((shift) => publicationOf(shift) === "draft")
        .map((shift) => shift.date.slice(0, 7)),
    ),
  ].sort();

  /*
   * Päällekkäisyydet koko tulevalta ajalta.
   *
   * Menneitä ei tutkita: niitä ei enää voi korjata, ja varoitus
   * asiasta jolle ei voi tehdä mitään opettaa ohittamaan varoitukset.
   */
  const overlapping = findOverlaps(
    shifts.filter((s) => s.date >= today),
    users,
  );

  /*
   * Päivät joilta on työaikaa.
   *
   * Sisäänleimaus riittää: se tarkoittaa että joku oli töissä, ja
   * juuri sen vertaaminen suunnitelmaan paljastaa puuttuvan vuoron.
   * Päivä luetaan ravintolan aikavyöhykkeellä — UTC:stä poimittuna
   * yövuoron leimaus kirjautuisi edelliselle päivälle.
   */
  const clockedDates = [
    ...new Map(
      clockEvents
        .filter((event) => event.type === "in")
        .map((event) => {
          const date = dayIn(restaurant.timezone, event.at);
          return [`${event.userId}|${date}`, { userId: event.userId, date }];
        }),
    ).values(),
  ].filter((row) => row.date < today);

  const upcoming = shifts.filter((s) => s.date >= today);
  const past = shifts.filter((s) => s.date < today);

  const declined = upcoming.filter((s) => s.status === "declined");

  /*
   * Suunniteltu vs. toteutunut vain menneistä vuoroista: tulevassa
   * vuorossa ei ole toteutunutta, ja nolla näyttäisi alitukselta.
   *
   * JÄLKIKÄTEEN KIRJATTU VUORO EI OLLUT SUUNNITELMA.
   *
   * Kuukauden vuorot lisätään usein jälkikäteen, ja niissä toteutunut
   * on nolla — kukaan ei ole voinut leimata vuoroon jota ei ollut
   * olemassa. Mukaan laskettuna ne näyttäisivät sadan tunnin
   * alitukselta, vaikka mitään ei jäänyt tekemättä.
   */
  const planned = past.filter(
    (shift) => !isRetroactive(shift, restaurant.timezone),
  );

  const comparisons = compareShifts(
    planned,
    users,
    clockEvents,
    now,
    restaurant.timezone,
  );
  const labour = labourSummary(comparisons);
  const showsRates = seesPayRates(role);

  // Toistuva poikkeama on eri asia kuin yksittäinen: yksi pitkä ilta on
  // sattuma, kymmenen peräkkäistä on suunnitteluvirhe.
  const patterns = variancePatterns(comparisons).filter(
    (pattern) => Math.abs(pattern.averageVarianceMs) > 10 * 60000,
  );

  // Loppupäivä ratkaisee: eilen alkanut sairausloma on yhä voimassa,
  // eikä sen pidä kadota listalta kesken jakson.
  const upcomingAbsences = absences.filter(
    (absence) => absence.endDate >= today,
  );

  const deviations = findDeviations({
    comparisons,
    clockedDates,
    shifts,
    users,
    timezone: restaurant.timezone,
  });

  return (
    <div className="rf-enter space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            {upcoming.length} tulevaa
            {openShifts.length > 0
              ? fill(t.lauseet.openSuffix, { maara: String(openShifts.length) })
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/*
            Kuukauden lista on eri kysymys kuin tämä sivu.

            Tämä sivu kertoo mitä seuraavaksi; lista kertoo kuka on
            töissä milloin. Jälkimmäinen tulostetaan seinälle, joten
            se on oma sivunsa eikä välilehti tämän sisällä.
          */}
          <Link
            href="/admin/tyovuorot/kalenteri"
            className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
            style={{
              background: "var(--rf-inset)",
              color: "var(--rf-text)",
              border: "1px solid var(--rf-line-strong)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            <RfIcon name="calendar" size={15} />
            {t.sanat.calendar}
          </Link>

          <Link
            href="/admin/tyovuorot/lista"
            className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
            style={{
              background: "var(--rf-inset)",
              color: "var(--rf-text)",
              border: "1px solid var(--rf-line-strong)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            <RfIcon name="report" size={15} />
            {t.vuorot2.monthList}
          </Link>

          <NewShiftButton nimet={nimet} users={users} defaultDate={today} />
        </div>
      </div>

      {canManage
        ? draftMonths.map((draftMonth) => {
            const drafts = shifts.filter(
              (shift) =>
                shift.date.startsWith(draftMonth) &&
                publicationOf(shift) === "draft",
            );
            const plan = planSummary({ shifts: drafts, users });

            return (
              <PublishBar
                key={draftMonth}
                month={draftMonth}
                /*
                 * Genetiivi: "syyskuun työvuorot".
                 *
                 * Jokainen suomen kuukausi päättyy sanaan kuu, joten
                 * pääte on aina sama n. Erillistä taivutustaulukkoa ei
                 * tarvita, eikä sellainen ehtisi vanhentua.
                 */
                monthLabel={fill(t.lauseet.monthYear, {
                  kuukausi: monthName(draftMonth, locale),
                  vuosi: draftMonth.slice(0, 4),
                })}
                drafts={drafts.length}
                people={plan.people}
                hours={formatPlanned(plan.plannedMinutes)}
              />
            );
          })
        : null}

      {/*
        Päällekkäisyys on suunnitteluvirhe, ei tekijän ongelma.

        Sitä ei estetä tallennuksessa: kaksoisvuoro voi olla tarkoitus
        (lyhyt avaus ja pitkä ilta), ja este pakottaisi kiertotielle
        joka jättäisi molemmat vuorot kirjaamatta. Varoitus riittää.
      */}
      {overlapping.length > 0 ? (
        <Card>
          <CardHeader
            title={t.vuorot.overlapping}
            subtitle={t.vuorot2.samePersonTwice}
          />
          <ul className="space-y-3">
            {overlapping.map((pair) => (
              <li
                key={`${pair.a.id}-${pair.b.id}`}
                className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 first:border-0 first:pt-0"
                style={{ borderColor: "var(--rf-line)" }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar initials={pair.user?.initials ?? "?"} size={36} />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">
                      {pair.user?.name ?? "Tuntematon"}
                    </p>
                    <p
                      className="rf-tabular text-[12px]"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      {formatShortDate(pair.a.date)} {pair.a.startTime}–
                      {pair.a.endTime}
                      {" · "}
                      {formatShortDate(pair.b.date)} {pair.b.startTime}–
                      {pair.b.endTime}
                    </p>
                  </div>
                </div>

                <Pill tone="risk" dot>
                  {t.vuorot.overlap}
                </Pill>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {upcomingAbsences.length > 0 ? (
        <Card>
          <CardHeader
            title={t.vuorot2.absenceNotices}
            subtitle={t.vuorot.noticeDoesNotCancel}
          />
          <ul className="space-y-3">
            {upcomingAbsences.map((absence) => {
              const user = users.find((u) => u.id === absence.userId);
              // Vuoro haetaan jakson ajalta: monipäiväisessä
              // sairauslomassa vuoro voi olla millä tahansa päivällä.
              const shift = shifts.find(
                (s) =>
                  s.userId === absence.userId &&
                  s.date >= absence.date &&
                  s.date <= absence.endDate,
              );

              return (
                <li
                  key={absence.id}
                  className="flex flex-wrap items-start justify-between gap-3 border-t pt-3 first:border-0 first:pt-0"
                  style={{ borderColor: "var(--rf-line)" }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar initials={user?.initials ?? "?"} size={36} />
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium">
                        {user?.name ?? "Tuntematon"}
                      </p>
                      <p
                        className="rf-tabular text-[12px]"
                        style={{ color: "var(--rf-text-3)" }}
                      >
                        {absence.date === absence.endDate
                          ? formatShortDate(absence.date)
                          : `${formatShortDate(absence.date)}–${formatShortDate(absence.endDate)}`}
                        {shift
                          ? fill(t.lauseet.shiftSuffix, {
                              alku: shift.startTime,
                              loppu: shift.endTime,
                            })
                          : " · ei vuoroa"}
                        {absence.note ? ` · ${absence.note}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Pill tone="warn" dot>
                      {nimet.absences[absence.kind]}
                    </Pill>

                    {/* Vain sairaudessa. Todistusta ei tallenneta
                        Kateen — tämä on merkintä siitä että se on
                        nähty, ja se on se mitä palkanmaksuun tarvitaan. */}
                    {absence.kind === "sick" ? (
                      <form action={markAbsenceCertificate}>
                        <input
                          type="hidden"
                          name="absenceId"
                          value={absence.id}
                        />
                        <input
                          type="hidden"
                          name="seen"
                          value={absence.certificateSeenAt ? "false" : "true"}
                        />
                        <button
                          type="submit"
                          className="rf-press flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium"
                          style={
                            absence.certificateSeenAt
                              ? {
                                  background: "var(--rf-green-bg)",
                                  color: "var(--rf-green-text)",
                                  borderRadius: "var(--rf-r-control)",
                                }
                              : {
                                  background: "var(--rf-inset)",
                                  color: "var(--rf-text-2)",
                                  borderRadius: "var(--rf-r-control)",
                                }
                          }
                        >
                          {absence.certificateSeenAt ? (
                            <RfIcon name="check" size={14} />
                          ) : null}
                          {absence.certificateSeenAt
                            ? t.vuorot.certificateSeen
                            : t.vuorot.markCertificateSeen}
                        </button>
                      </form>
                    ) : null}

                    <form action={cancelAbsence}>
                      <input
                        type="hidden"
                        name="absenceId"
                        value={absence.id}
                      />
                      <button
                        type="submit"
                        className="rf-press px-3 py-1.5 text-[13px] font-medium"
                        style={{
                          background: "var(--rf-inset)",
                          color: "var(--rf-text-2)",
                          borderRadius: "var(--rf-r-control)",
                        }}
                      >
                        {t.vuorot2.acknowledge}
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {/*
        Poikkeamat yhtenä listana, §11.

        Nämä ovat menneisyyttä: vuoro on jo ollut ja jokin meni
        toisin. Vakavin ensin, koska lista luetaan ylhäältä ja se
        katkeaa siihen mihin aika loppuu.
      */}
      {deviations.length > 0 ? (
        <Card>
          <CardHeader
            title={t.vuorot2.deviations}
            subtitle={t.vuorot.plannedVsActual}
          />
          <ul className="space-y-3">
            {deviations.slice(0, 12).map((poikkeama, index) => (
              <li
                key={`${poikkeama.kind}-${poikkeama.shiftId ?? poikkeama.date}-${index}`}
                className="flex flex-wrap items-start justify-between gap-3 border-t pt-3 first:border-0 first:pt-0"
                style={{ borderColor: "var(--rf-line)" }}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className="mt-0.5 shrink-0"
                    style={{
                      color:
                        poikkeama.severity === "critical"
                          ? "var(--rf-red-text)"
                          : "var(--rf-amber-text)",
                    }}
                  >
                    <RfIcon name="alert" size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] leading-relaxed">
                      {poikkeama.text}
                    </p>
                    <p
                      className="rf-tabular text-[12px]"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      {formatShortDate(poikkeama.date)}
                    </p>
                  </div>
                </div>

                <Pill
                  tone={poikkeama.severity === "critical" ? "risk" : "warn"}
                  dot
                >
                  {DEVIATION_LABELS[poikkeama.kind].toLowerCase()}
                </Pill>
              </li>
            ))}
          </ul>

          {deviations.length > 12 ? (
            <p
              className="mt-3 text-[12px]"
              style={{ color: "var(--rf-text-3)" }}
            >
              Näytetään 12 ensimmäistä {deviations.length} poikkeamasta.
            </p>
          ) : null}
        </Card>
      ) : null}

      {declined.length > 0 ? (
        <Card>
          <CardHeader
            title={t.vuorot.declined}
            subtitle={t.vuorot.openShiftsNote}
          />
          <ul className="space-y-3">
            {declined.map((shift) => (
              <ShiftRow
                nimet={nimet}
                key={shift.id}
                shift={shift}
                users={users}
                showEdit
              />
            ))}
          </ul>
        </Card>
      ) : null}

      {comparisons.length > 0 ? (
        <section aria-label={t.vuorot.actualHours} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label={t.vuorot2.planned}
              icon={<RfIcon name="calendar" size={17} />}
              tileTone="brand"
              value={formatDuration(labour.plannedMs)}
              hint={fill(t.lauseet.pastShifts, {
                maara: String(labour.shiftCount),
              })}
            />
            <MetricCard
              label={t.vuorot2.actual}
              icon={<RfIcon name="clock" size={17} />}
              tileTone="green"
              value={formatDuration(labour.actualMs)}
              hint={fill(t.lauseet.varianceToPlan, {
                ero: formatVariance(labour.varianceMs),
              })}
            />
            {showsRates ? (
              <MetricCard
                label={t.vuorot.labourCost}
                icon={<RfIcon name="payroll" size={17} />}
                tileTone="violet"
                value={formatMoney(labour.actualCostCents)}
                hint={
                  labour.varianceCostCents === 0
                    ? "Suunnitelman mukainen"
                    : fill(t.lauseet.varianceToPlan, {
                        ero: `${labour.varianceCostCents > 0 ? "+" : "−"}${formatMoney(Math.abs(labour.varianceCostCents))}`,
                      })
                }
              />
            ) : null}
          </div>
          <p
            className="px-1 text-[12px] leading-relaxed"
            style={{ color: "var(--rf-text-3)" }}
          >
            {t.vuorot.estimateNote}
          </p>
        </section>
      ) : null}

      {upcoming.length === 0 && openShifts.length === 0 ? (
        <EmptyState
          title={t.vuorot2.noUpcoming}
          description={t.vuorot.emptyBody}
        />
      ) : (
        <Card>
          <CardHeader
            title={t.vuorot2.upcoming}
            subtitle={t.vuorot.chronological}
          />
          <ul className="space-y-3">
            {upcoming.map((shift) => (
              <ShiftRow
                nimet={nimet}
                key={shift.id}
                shift={shift}
                users={users}
                showEdit
              />
            ))}

            {openShifts.map((open) => (
              <li
                key={open.id}
                className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 first:border-0"
                style={{ borderColor: "var(--rf-line)" }}
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 items-center justify-center text-[13px] font-semibold"
                    style={{
                      background: "var(--rf-red-bg)",
                      color: "var(--rf-red-text)",
                      borderRadius: "50%",
                    }}
                  >
                    ?
                  </span>
                  <div>
                    <p className="text-[14px] font-medium">
                      {t.vuorot2.openShift}
                    </p>
                    <p
                      className="rf-tabular text-[12px]"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      {formatShortDate(open.date)} · {open.startTime}–
                      {open.endTime} · {nimet.positions[open.position]}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="risk" dot>
                    {t.vuorot.noAssignee}
                  </Pill>

                  {/*
                    Avoin vuoro on poistettavissa.

                    Väärään päivään tehty avoin vuoro jäi aiemmin
                    listalle pysyvästi: sitä ei voinut muokata eikä
                    poistaa mistään. Nyt sillä on sama muokkaus kuin
                    nimetyllä vuorolla — myös tekijän lisääminen.
                  */}
                  {canManage ? (
                    <EditShift
                      nimet={nimet}
                      users={users}
                      shift={openAsShift(open)}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {patterns.length > 0 ? (
        <Card>
          <CardHeader
            title={t.vuorot2.repeatedDeviations}
            subtitle={t.vuorot.averageDiff}
          />
          <ul className="space-y-3">
            {patterns.map((pattern) => (
              <li
                key={pattern.user?.id ?? "tuntematon"}
                className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 first:border-0 first:pt-0"
                style={{ borderColor: "var(--rf-line)" }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar initials={pattern.user?.initials ?? "?"} size={36} />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">
                      {pattern.user?.name ?? "Tuntematon"}
                    </p>
                    <p
                      className="rf-tabular text-[12px]"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      {pattern.shiftCount} vuoroa · yhteensä{" "}
                      {formatVariance(pattern.totalVarianceMs)}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p
                    className="rf-tabular text-[15px] font-semibold"
                    style={{
                      color:
                        pattern.averageVarianceMs > 0
                          ? "var(--rf-amber-text)"
                          : "var(--rf-text-2)",
                    }}
                  >
                    {formatVariance(pattern.averageVarianceMs)} / vuoro
                  </p>
                  {showsRates ? (
                    <p
                      className="rf-tabular text-[12px]"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      {pattern.costImpactCents >= 0 ? "+" : "−"}
                      {formatMoney(Math.abs(pattern.costImpactCents))}{" "}
                      kustannusvaikutus
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          <p
            className="mt-4 text-[12px] leading-relaxed"
            style={{ color: "var(--rf-text-3)" }}
          >
            {t.vuorot.overrunNote}
          </p>
        </Card>
      ) : null}

      {comparisons.length > 0 ? (
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title={t.vuorot2.plannedVsActualTitle}
              subtitle={t.vuorot2.pastShiftsNote}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="rf-table w-full min-w-[38rem] text-[14px]">
              <caption className="sr-only">{t.vuorot2.fulfilment}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.vuorot.day}</th>
                  <th scope="col">{t.vuorot.assignee}</th>
                  <th scope="col" className="text-right">
                    {t.vuorot2.planned}
                  </th>
                  <th scope="col" className="text-right">
                    {t.vuorot2.actual}
                  </th>
                  <th scope="col" className="text-right">
                    {t.vuorot2.diff}
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisons
                  .slice(-15)
                  .reverse()
                  .map((c) => (
                    <tr key={c.shift.id}>
                      <td className="rf-tabular">
                        {formatShortDate(c.shift.date)}
                      </td>
                      <td>{c.user?.name ?? "—"}</td>
                      <td
                        className="rf-tabular px-5 py-3 text-right"
                        style={{ color: "var(--rf-text-2)" }}
                      >
                        {formatDuration(c.plannedMs)}
                      </td>
                      <td className="num">
                        {c.actualMs === 0 ? "—" : formatDuration(c.actualMs)}
                      </td>
                      <td
                        className="rf-tabular px-5 py-3 text-right"
                        style={{
                          color:
                            c.actualMs === 0
                              ? "var(--rf-text-3)"
                              : Math.abs(c.varianceMs) > 15 * 60000
                                ? "var(--rf-amber-text)"
                                : "var(--rf-text-2)",
                        }}
                      >
                        {c.actualMs === 0
                          ? "ei leimauksia"
                          : formatVariance(c.varianceMs)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function ShiftRow({
  nimet,
  shift,
  users,
  showEdit,
}: {
  nimet: Labels;
  shift: Shift;
  users: User[];
  showEdit?: boolean;
}) {
  const user = users.find((u) => u.id === shift.userId);

  const tone =
    shift.status === "accepted"
      ? "ok"
      : shift.status === "changed"
        ? "info"
        : shift.status === "declined"
          ? "risk"
          : "warn";

  return (
    <li
      className="flex flex-wrap items-start justify-between gap-3 border-t pt-3 first:border-0 first:pt-0"
      style={{ borderColor: "var(--rf-line)" }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar initials={user?.initials ?? "?"} size={36} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium">
            {user?.name ?? "Avoin"}
          </p>
          <p
            className="rf-tabular text-[12px]"
            style={{ color: "var(--rf-text-3)" }}
          >
            {formatShortDate(shift.date)} · {shift.startTime}–{shift.endTime}
            {shift.location ? ` · ${shift.location}` : ""}
          </p>
          {shift.previousStartTime ? (
            <p
              className="rf-tabular text-[12px]"
              style={{ color: "var(--rf-text-3)" }}
            >
              oli {shift.previousStartTime}–{shift.previousEndTime}
            </p>
          ) : null}
        </div>
      </div>

      <Pill tone={tone}>
        <ShiftStatusIcon status={shift.status} size={13} />
        {nimet.shiftStatus[shift.status]}
      </Pill>

      {showEdit ? (
        <EditShift nimet={nimet} users={users} shift={shift} />
      ) : null}
    </li>
  );
}

function formatShortDate(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(d)}.${Number(m)}.`;
}

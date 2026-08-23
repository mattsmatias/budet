import { adminContext } from "@/lib/restoflow/page-context";
import {
  compareShifts,
  formatVariance,
  labourSummary,
  variancePatterns,
} from "@/lib/restoflow/shifts";
import { formatDuration } from "@/lib/restoflow/timeclock";
import { seesPayRates } from "@/lib/restoflow/permissions";
import {
  ABSENCE_LABELS,
  POSITION_LABELS,
  SHIFT_STATUS_LABELS,
  type Shift,
  type User,
} from "@/lib/restoflow/types";
import { formatMoney } from "@/lib/money";
import { ShiftStatusIcon } from "@/components/restoflow/icons";
import {
  Avatar,
  Card,
  CardHeader,
  EmptyState,
  Icon,
  ICONS,
  MetricCard,
  Pill,
} from "@/components/restoflow/ui";
import { cancelAbsence, markAbsenceCertificate } from "../actions";
import { EditShift, NewShiftButton } from "./shift-form";

export const metadata = { title: "Työvuorot" };

export default async function AdminShiftsPage() {
  const { users, shifts, openShifts, clockEvents, absences, today, now, role, restaurant } =
    await adminContext("/admin/tyovuorot");

  const upcoming = shifts.filter((s) => s.date >= today);
  const past = shifts.filter((s) => s.date < today);

  const declined = upcoming.filter((s) => s.status === "declined");

  // Suunniteltu vs. toteutunut vain menneistä vuoroista: tulevassa
  // vuorossa ei ole toteutunutta, ja nolla näyttäisi alitukselta.
  const comparisons = compareShifts(past, users, clockEvents, now, restaurant.timezone);
  const labour = labourSummary(comparisons);
  const showsRates = seesPayRates(role);

  // Toistuva poikkeama on eri asia kuin yksittäinen: yksi pitkä ilta on
  // sattuma, kymmenen peräkkäistä on suunnitteluvirhe.
  const patterns = variancePatterns(comparisons).filter(
    (pattern) => Math.abs(pattern.averageVarianceMs) > 10 * 60000,
  );

  // Loppupäivä ratkaisee: eilen alkanut sairausloma on yhä voimassa,
  // eikä sen pidä kadota listalta kesken jakson.
  const upcomingAbsences = absences.filter((absence) => absence.endDate >= today);

  return (
    <div className="rf-enter space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight md:text-[30px]">
            Työvuorot
          </h1>
          <p className="mt-1 text-[14px] md:text-[15px]" style={{ color: "var(--rf-text-2)" }}>
            {upcoming.length} tulevaa
            {openShifts.length > 0 ? ` · ${openShifts.length} avointa` : ""}
          </p>
        </div>
        <NewShiftButton users={users} defaultDate={today} />
      </div>

      {upcomingAbsences.length > 0 ? (
        <Card>
          <CardHeader
            title="Poissaoloilmoitukset"
            subtitle="Ilmoitus ei peru vuoroa — vuoro on yhä tekijällä"
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
                      <p className="rf-tabular text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                        {absence.date === absence.endDate
                          ? formatShortDate(absence.date)
                          : `${formatShortDate(absence.date)}–${formatShortDate(absence.endDate)}`}
                        {shift ? ` · vuoro ${shift.startTime}–${shift.endTime}` : " · ei vuoroa"}
                        {absence.note ? ` · ${absence.note}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Pill tone="warn" dot>
                      {ABSENCE_LABELS[absence.kind]}
                    </Pill>

                    {/* Vain sairaudessa. Todistusta ei tallenneta
                        Budetiin — tämä on merkintä siitä että se on
                        nähty, ja se on se mitä palkanmaksuun tarvitaan. */}
                    {absence.kind === "sick" ? (
                      <form action={markAbsenceCertificate}>
                        <input type="hidden" name="absenceId" value={absence.id} />
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
                            <Icon path={ICONS.check} size={14} />
                          ) : null}
                          {absence.certificateSeenAt
                            ? "Todistus nähty"
                            : "Merkitse todistus nähdyksi"}
                        </button>
                      </form>
                    ) : null}

                    <form action={cancelAbsence}>
                      <input type="hidden" name="absenceId" value={absence.id} />
                      <button
                        type="submit"
                        className="rf-press px-3 py-1.5 text-[13px] font-medium"
                        style={{
                          background: "var(--rf-inset)",
                          color: "var(--rf-text-2)",
                          borderRadius: "var(--rf-r-control)",
                        }}
                      >
                        Kuittaa
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {declined.length > 0 ? (
        <Card>
          <CardHeader
            title="Kieltäytyneet"
            subtitle="Nämä vuorot ovat auki — merkitse joku muu tai jätä avoimeksi"
          />
          <ul className="space-y-3">
            {declined.map((shift) => (
              <ShiftRow key={shift.id} shift={shift} users={users} showEdit />
            ))}
          </ul>
        </Card>
      ) : null}

      {comparisons.length > 0 ? (
        <section aria-label="Toteutunut työaika" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Suunniteltu"
              value={formatDuration(labour.plannedMs)}
              hint={`${labour.shiftCount} mennyttä vuoroa`}
            />
            <MetricCard
              label="Toteutunut"
              value={formatDuration(labour.actualMs)}
              hint={`${formatVariance(labour.varianceMs)} suunniteltuun`}
            />
            {showsRates ? (
              <MetricCard
                label="Työvoimakustannus"
                value={formatMoney(labour.actualCostCents)}
                hint={
                  labour.varianceCostCents === 0
                    ? "Suunnitelman mukainen"
                    : `${labour.varianceCostCents > 0 ? "+" : "−"}${formatMoney(Math.abs(labour.varianceCostCents))} suunniteltuun`
                }
              />
            ) : null}
          </div>
          <p className="px-1 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
            Laskennallinen. Ei palkkalaskelma — ei sisällä lisiä,
            lomakorvauksia eikä sivukuluja.
          </p>
        </section>
      ) : null}

      {upcoming.length === 0 && openShifts.length === 0 ? (
        <EmptyState
          title="Ei tulevia vuoroja"
          description="Luo ensimmäinen vuoro yllä olevasta painikkeesta. Tekijä saa sen hyväksyttäväkseen, ja voit myös jättää vuoron avoimeksi."
        />
      ) : (
        <Card>
          <CardHeader title="Tulevat vuorot" subtitle="Aikajärjestyksessä" />
          <ul className="space-y-3">
            {upcoming.map((shift) => (
              <ShiftRow key={shift.id} shift={shift} users={users} showEdit />
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
                    <p className="text-[14px] font-medium">Avoin vuoro</p>
                    <p className="rf-tabular text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                      {formatShortDate(open.date)} · {open.startTime}–{open.endTime} ·{" "}
                      {POSITION_LABELS[open.position]}
                    </p>
                  </div>
                </div>
                <Pill tone="risk" dot>
                  ei tekijää
                </Pill>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {patterns.length > 0 ? (
        <Card>
          <CardHeader
            title="Toistuvat poikkeamat"
            subtitle="Keskimääräinen ero suunniteltuun, vähintään kaksi vuoroa"
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
                    <p className="rf-tabular text-[12px]" style={{ color: "var(--rf-text-3)" }}>
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
                    <p className="rf-tabular text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                      {pattern.costImpactCents >= 0 ? "+" : "−"}
                      {formatMoney(Math.abs(pattern.costImpactCents))} kustannusvaikutus
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
            Toistuva ylitys ei ole syyte vaan merkki siitä että vuoro on
            mitoitettu väärin. Tarkista suunniteltu pituus ennen kuin puhut
            tekijän kanssa.
          </p>
        </Card>
      ) : null}

      {comparisons.length > 0 ? (
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Suunniteltu vs. toteutunut"
              subtitle="Menneet vuorot · toteutunut luetaan leimauksista"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[38rem] text-[14px]">
              <caption className="sr-only">Vuorojen toteutuma</caption>
              <thead>
                <tr
                  className="border-b text-left text-[12px] uppercase tracking-[0.04em]"
                  style={{ borderColor: "var(--rf-line)", color: "var(--rf-text-3)" }}
                >
                  <th scope="col" className="px-5 py-3 font-medium">Päivä</th>
                  <th scope="col" className="px-5 py-3 font-medium">Tekijä</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Suunniteltu</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Toteutunut</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Ero</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
                {comparisons.slice(-15).reverse().map((c) => (
                  <tr key={c.shift.id}>
                    <td className="rf-tabular px-5 py-3">{formatShortDate(c.shift.date)}</td>
                    <td className="px-5 py-3">{c.user?.name ?? "—"}</td>
                    <td className="rf-tabular px-5 py-3 text-right" style={{ color: "var(--rf-text-2)" }}>
                      {formatDuration(c.plannedMs)}
                    </td>
                    <td className="rf-tabular px-5 py-3 text-right font-semibold">
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
                      {c.actualMs === 0 ? "ei leimauksia" : formatVariance(c.varianceMs)}
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
  shift,
  users,
  showEdit,
}: {
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
          <p className="truncate text-[14px] font-medium">{user?.name ?? "Avoin"}</p>
          <p className="rf-tabular text-[12px]" style={{ color: "var(--rf-text-3)" }}>
            {formatShortDate(shift.date)} · {shift.startTime}–{shift.endTime}
            {shift.location ? ` · ${shift.location}` : ""}
          </p>
          {shift.previousStartTime ? (
            <p className="rf-tabular text-[12px]" style={{ color: "var(--rf-text-3)" }}>
              oli {shift.previousStartTime}–{shift.previousEndTime}
            </p>
          ) : null}
        </div>
      </div>

      <Pill tone={tone}>
        <ShiftStatusIcon status={shift.status} size={13} />
        {SHIFT_STATUS_LABELS[shift.status]}
      </Pill>

      {showEdit ? <EditShift users={users} shift={shift} /> : null}
    </li>
  );
}

function formatShortDate(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(d)}.${Number(m)}.`;
}

import Link from "next/link";
import { formatPlanned, plannedMinutes, publicationOf } from "@/lib/restoflow/shift-planning";
import { POSITION_LABELS, SHIFT_STATUS_LABELS, type Shift, type User } from "@/lib/restoflow/types";
import { Avatar, Card, CardHeader, Pill } from "@/components/restoflow/ui";
import { RfIcon } from "@/components/restoflow/icons";
import { EditShift, NewShiftButton } from "../shift-form";
import { CopyDay } from "./copy-controls";

const DAYS = [
  "sunnuntai",
  "maanantai",
  "tiistai",
  "keskiviikko",
  "torstai",
  "perjantai",
  "lauantai",
];

/**
 * Yhden päivän vuorot.
 *
 * Kalenteriruutuun mahtuu kolme nimeä; tässä on koko päivä ja
 * jokaisen vuoron muokkaus. Paneeli aukeaa ruudun klikkauksesta ja
 * osoite kertoo mikä päivä on auki — linkin voi lähettää eteenpäin ja
 * selaimen paluunappi toimii.
 */
export function DayPanel({
  date,
  month,
  users,
  shifts,
  canManage,
}: {
  date: string;
  month: string;
  users: User[];
  shifts: Shift[];
  canManage: boolean;
}) {
  const total = shifts
    .filter((shift) => shift.cancelledAt === null)
    .reduce((sum, shift) => sum + plannedMinutes(shift), 0);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CardHeader
          title={formatDay(date)}
          subtitle={
            shifts.length === 0
              ? "Ei vuoroja"
              : `${shifts.filter((s) => s.cancelledAt === null).length} vuoroa · ${formatPlanned(total)} suunniteltua työaikaa`
          }
        />

        <Link
          href={`/admin/tyovuorot/kalenteri?kuukausi=${month}`}
          scroll={false}
          aria-label="Sulje päivä"
          className="rf-press -mt-1 flex h-8 w-8 shrink-0 items-center justify-center"
          style={{ color: "var(--rf-text-3)", borderRadius: 8 }}
        >
          <span style={{ transform: "rotate(45deg)", display: "block" }}>
            <RfIcon name="plus" size={18} />
          </span>
        </Link>
      </div>

      {shifts.length > 0 ? (
        <ul className="space-y-3">
          {shifts.map((shift) => {
            const user = users.find((u) => u.id === shift.userId);
            const tila = publicationOf(shift);

            return (
              <li
                key={shift.id}
                className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 first:border-0 first:pt-0"
                style={{
                  borderColor: "var(--rf-line)",
                  opacity: tila === "cancelled" ? 0.55 : 1,
                }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar initials={user?.initials ?? "?"} size={36} />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">
                      {user?.name ?? "Avoin vuoro"}
                    </p>
                    <p className="rf-tabular text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                      {shift.startTime}–{shift.endTime}
                      {shift.breakMinutes > 0 ? ` · tauko ${shift.breakMinutes} min` : ""}
                      {" · "}
                      {formatPlanned(plannedMinutes(shift))}
                      {user?.position ? ` · ${POSITION_LABELS[user.position]}` : ""}
                      {shift.note ? ` · ${shift.note}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {tila === "draft" ? (
                    <Pill tone="warn" dot>
                      luonnos
                    </Pill>
                  ) : tila === "cancelled" ? (
                    <Pill tone="risk" dot>
                      peruttu
                    </Pill>
                  ) : (
                    <Pill tone="ok" dot>
                      {SHIFT_STATUS_LABELS[shift.status].toLowerCase()}
                    </Pill>
                  )}

                  {canManage && tila !== "cancelled" ? (
                    <>
                      <CopyDay shift={shift} />
                      <EditShift users={users} shift={shift} />
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {canManage ? (
        <div className="mt-4">
          <NewShiftButton users={users} defaultDate={date} />
        </div>
      ) : null}
    </Card>
  );
}

function formatDay(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const name = DAYS[d.getUTCDay()];
  return `${name[0].toUpperCase()}${name.slice(1)} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}

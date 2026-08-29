import Link from "next/link";
import type { AppLocale } from "@/lib/i18n/app-locales";
import { formatDayShortIn, weekdayLongIn } from "@/lib/i18n/labels";
import type { Labels } from "@/lib/i18n/labels";
import { fill } from "@/lib/i18n/auth-text";
import type { AdminText } from "@/lib/i18n/admin-text";
import {
  formatPlanned,
  plannedMinutes,
  publicationOf,
} from "@/lib/restoflow/shift-planning";
import { type Shift, type User } from "@/lib/restoflow/types";
import { Avatar, Card, CardHeader, Pill } from "@/components/restoflow/ui";
import { RfIcon } from "@/components/restoflow/icons";
import { EditShift, NewShiftButton } from "../shift-form";
import { CopyDay } from "./copy-controls";

/**
 * Yhden päivän vuorot.
 *
 * Kalenteriruutuun mahtuu kolme nimeä; tässä on koko päivä ja
 * jokaisen vuoron muokkaus. Paneeli aukeaa ruudun klikkauksesta ja
 * osoite kertoo mikä päivä on auki — linkin voi lähettää eteenpäin ja
 * selaimen paluunappi toimii.
 */
export function DayPanel({
  locale,
  t,
  nimet,
  date,
  month,
  users,
  shifts,
  canManage,
}: {
  locale: AppLocale;
  t: AdminText;
  nimet: Labels;
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
          title={formatDay(date, locale)}
          subtitle={
            shifts.length === 0
              ? t.vuoro.noShifts
              : fill(t.vuoro.dayShiftSummary, {
                  maara: String(
                    shifts.filter((s) => s.cancelledAt === null).length,
                  ),
                  aika: formatPlanned(total),
                })
          }
        />

        <Link
          href={`/admin/tyovuorot/kalenteri?kuukausi=${month}`}
          scroll={false}
          aria-label={t.vuoro.closeDay}
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
                      {user?.name ?? t.vuoro.openShift}
                    </p>
                    <p
                      className="rf-tabular text-[12px]"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      {shift.startTime}–{shift.endTime}
                      {shift.breakMinutes > 0
                        ? fill(t.vuoro.breakSuffix, {
                            maara: String(shift.breakMinutes),
                          })
                        : ""}
                      {" · "}
                      {formatPlanned(plannedMinutes(shift))}
                      {user?.position
                        ? ` · ${nimet.positions[user.position]}`
                        : ""}
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
                      {nimet.shiftStatus[shift.status].toLowerCase()}
                    </Pill>
                  )}

                  {canManage && tila !== "cancelled" ? (
                    <>
                      <CopyDay t={t} shift={shift} />
                      <EditShift
                        t={t}
                        nimet={nimet}
                        users={users}
                        shift={shift}
                      />
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
          <NewShiftButton
            t={t}
            nimet={nimet}
            users={users}
            defaultDate={date}
          />
        </div>
      ) : null}
    </Card>
  );
}

function formatDay(isoDate: string, locale: AppLocale): string {
  return `${weekdayLongIn(isoDate, locale)} ${formatDayShortIn(isoDate, locale)}`;
}

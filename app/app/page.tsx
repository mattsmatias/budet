import Link from "next/link";
import { employeeContext } from "@/lib/restoflow/page-context";
import { weekStart } from "@/lib/restoflow/clock-context";
import {
  currentState,
  eventsOnDate,
  formatDuration,
  workedBetween,
  workedOnDate,
} from "@/lib/restoflow/timeclock";
import { CLOCK_STATE_LABELS, SHIFT_STATUS_LABELS } from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";
import {
  Card,
  Pill,
  SectionLabel,
} from "@/components/restoflow/ui";

export const metadata = { title: "Koti" };

/**
 * Työntekijän koti.
 *
 * Näyttää vain sen mikä koskee tätä työntekijää: oma työaika, oma seuraava
 * vuoro, oma viikko. Kulujen kokonaisuus ei kuulu tänne — se on managerin
 * näkymä, eikä RLS edes antaisi työntekijälle koko aineistoa.
 */
export default async function EmployeeHome() {
  const { user, restaurant, clockEvents, shifts, today, now } =
    await employeeContext("/app");

  const state = currentState(eventsOnDate(clockEvents, today));
  const todayWorked = workedOnDate(clockEvents, today, now);
  const week = workedBetween(clockEvents, weekStart(today), today, now);

  const nextShift = shifts.find((s) => s.date >= today);

  const firstName = (user.fullName ?? user.email ?? "").split(" ")[0];

  return (
    <div className="rf-enter space-y-5 md:space-y-6">
      <header className="px-1 pt-2">
        <h1 className="text-[28px] font-semibold tracking-tight">
          Hei{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1 text-[14px] md:text-[15px]" style={{ color: "var(--rf-text-2)" }}>
          {restaurant.name}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="space-y-5">
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
                  Tämän päivän työaika
                </p>
                <p
                  className="rf-tabular mt-1.5 text-[34px] font-semibold leading-none"
                  suppressHydrationWarning
                >
                  {formatDuration(todayWorked.workedMs)}
                </p>
              </div>
              <Pill
                tone={state === "working" ? "ok" : state === "on_break" ? "warn" : "neutral"}
                dot
              >
                {CLOCK_STATE_LABELS[state]}
              </Pill>
            </div>

            {todayWorked.breakMs > 0 ? (
              <p className="mt-3 text-[13px]" style={{ color: "var(--rf-text-3)" }}>
                Taukoa {formatDuration(todayWorked.breakMs)} — ei lasketa työaikaan.
              </p>
            ) : null}

            <Link
              href="/app/tyoaika"
              className="rf-press mt-4 flex items-center justify-center gap-2 py-3 text-[15px] font-semibold"
              style={{
                background: "var(--rf-inset)",
                color: "var(--rf-text)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              <RfIcon name="clock" size={18} />
              {state === "off" ? "Leimaa sisään" : "Avaa työaika"}
            </Link>
          </Card>

          <Card>
            <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
              Työaika tällä viikolla
            </p>
            <p
              className="rf-tabular mt-1.5 text-[28px] font-semibold leading-none"
              suppressHydrationWarning
            >
              {formatDuration(week.workedMs)}
            </p>
          </Card>
        </div>

        <div className="space-y-5">
          <section>
            <SectionLabel>Seuraava työvuoro</SectionLabel>
            {nextShift ? (
              <Card>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
                      {nextShift.date === today ? "Tänään" : formatDayLabel(nextShift.date)}
                    </p>
                    <p className="rf-tabular mt-1 text-[22px] font-semibold">
                      {nextShift.startTime}–{nextShift.endTime}
                    </p>
                    {nextShift.location ? (
                      <p className="mt-1 text-[13px]" style={{ color: "var(--rf-text-3)" }}>
                        {nextShift.location}
                      </p>
                    ) : null}
                  </div>
                  <Pill
                    tone={
                      nextShift.status === "accepted"
                        ? "ok"
                        : nextShift.status === "changed"
                          ? "info"
                          : nextShift.status === "declined"
                            ? "risk"
                            : "warn"
                    }
                    dot
                  >
                    {SHIFT_STATUS_LABELS[nextShift.status]}
                  </Pill>
                </div>
              </Card>
            ) : (
              <Card>
                <p className="text-[14px]" style={{ color: "var(--rf-text-2)" }}>
                  Ei tulevia vuoroja.
                </p>
              </Card>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function formatDayLabel(isoDate: string): string {
  const days = [
    "Sunnuntai", "Maanantai", "Tiistai", "Keskiviikko",
    "Torstai", "Perjantai", "Lauantai",
  ];
  const d = new Date(`${isoDate}T12:00:00Z`);
  return `${days[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}

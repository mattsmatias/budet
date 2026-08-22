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
import { sortByDateDesc } from "@/lib/restoflow/expenses";
import { CLOCK_STATE_LABELS, SHIFT_STATUS_LABELS } from "@/lib/restoflow/types";
import { formatMoney } from "@/lib/money";
import { RfIcon } from "@/components/restoflow/icons";
import {
  Card,
  CategoryBubble,
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
  const { user, restaurant, clockEvents, shifts, receipts, today, now, seesAllReceipts } =
    await employeeContext("/app");

  const state = currentState(eventsOnDate(clockEvents, today));
  const todayWorked = workedOnDate(clockEvents, today, now);
  const week = workedBetween(clockEvents, weekStart(today), today, now);

  const nextShift = shifts.find((s) => s.date >= today);
  const recent = sortByDateDesc(receipts).slice(0, 3);

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

            {nextShift.status === "pending" ? (
              <Link
                href="/app/vuorot"
                className="rf-press mt-4 block py-2.5 text-center text-[14px] font-semibold"
                style={{
                  background: "var(--rf-blue)",
                  color: "var(--rf-on-accent)",
                  borderRadius: "var(--rf-r-control)",
                }}
              >
                Vastaa vuoroon
              </Link>
            ) : null}
          </Card>
        ) : (
          <Card>
            <p className="text-[14px]" style={{ color: "var(--rf-text-2)" }}>
              Ei tulevia vuoroja.
            </p>
          </Card>
        )}
      </section>

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

      {seesAllReceipts ? (
        <section>
          <div className="flex items-baseline justify-between">
            <SectionLabel>Viimeisimmät kuitit</SectionLabel>
            <Link
              href="/app/kuitit"
              className="pb-2 text-[13px] font-medium"
              style={{ color: "var(--rf-blue)" }}
            >
              Kaikki
            </Link>
          </div>

          {recent.length === 0 ? (
            <Card>
              <p className="text-[14px]" style={{ color: "var(--rf-text-2)" }}>
                Ei kuitteja.
              </p>
            </Card>
          ) : (
            <Card padded={false}>
              <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
                {recent.map((receipt) => (
                  <li key={receipt.id}>
                    <Link
                      href={`/app/kuitit/${receipt.id}`}
                      className="flex items-center gap-3 px-5 py-3.5"
                    >
                      <CategoryBubble category={receipt.category} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium">
                          {receipt.supplierName}
                        </p>
                        <p
                          className="rf-tabular mt-0.5 text-[13px]"
                          style={{ color: "var(--rf-text-3)" }}
                        >
                          {formatDate(receipt.date)}
                        </p>
                      </div>
                      <span className="rf-tabular text-[15px] font-semibold">
                        {formatMoney(receipt.totalCents)}
                      </span>
                      <span style={{ color: "var(--rf-text-3)" }}>
                        <RfIcon name="chevron" size={16} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      ) : null}
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

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

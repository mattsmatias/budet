import Link from "next/link";
import {
  CURRENT_EMPLOYEE_ID,
  DEMO_NOW,
  DEMO_TODAY,
  RECEIPTS,
  employeeById,
  eventsFor,
  shiftsFor,
} from "@/lib/restoflow/data";
import {
  currentState,
  formatDuration,
  workedBetween,
  workedOnDate,
} from "@/lib/restoflow/timeclock";
import { sortByDateDesc } from "@/lib/restoflow/expenses";
import { CLOCK_STATE_LABELS, SHIFT_STATUS_LABELS } from "@/lib/restoflow/types";
import {
  Card,
  DemoNotice,
  Icon,
  ICONS,
  Money,
  Pill,
  SectionLabel,
} from "@/components/restoflow/ui";

export const metadata = { title: "Koti" };

/**
 * Työntekijän koti.
 *
 * Näyttää vain sen mikä koskee tätä työntekijää: oma työaika, oma seuraava
 * vuoro, oma viikko. Kulujen kokonaisuus ei kuulu tänne — se on managerin
 * näkymä.
 */
export default function EmployeeHome() {
  const employee = employeeById(CURRENT_EMPLOYEE_ID)!;
  const events = eventsFor(employee.id);

  const state = currentState(events);
  const today = workedOnDate(events, DEMO_TODAY, DEMO_NOW);
  const week = workedBetween(events, "2026-08-17", "2026-08-23", DEMO_NOW);

  const shifts = shiftsFor(employee.id);
  const nextShift = shifts.find((s) => s.date >= DEMO_TODAY);

  const recentReceipts = employee.canSeeReceipts
    ? sortByDateDesc(RECEIPTS).slice(0, 3)
    : [];

  const firstName = employee.name.split(" ")[0];

  return (
    <div className="rf-enter space-y-6">
      <header className="px-1 pt-2">
        <h1 className="text-[28px] font-semibold tracking-tight">
          Hei, {firstName} <span aria-hidden="true">👋</span>
        </h1>
        <p className="mt-1 text-[15px]" style={{ color: "var(--rf-text-2)" }}>
          Hyvä päivä aloittaa.
        </p>
      </header>

      <DemoNotice>
        Demo-aineisto. Työaika ja vuorot ovat esimerkkejä eikä mitään
        tallenneta pysyvästi.
      </DemoNotice>

      {/* Tämän päivän työaika */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
              Tämän päivän työaika
            </p>
            <p className="rf-tabular mt-1.5 text-[34px] font-semibold leading-none">
              {formatDuration(today.workedMs)}
            </p>
          </div>
          <Pill tone={state === "working" ? "ok" : state === "on_break" ? "warn" : "neutral"} dot>
            {CLOCK_STATE_LABELS[state]}
          </Pill>
        </div>

        {today.breakMs > 0 ? (
          <p className="mt-3 text-[13px]" style={{ color: "var(--rf-text-3)" }}>
            Taukoa {formatDuration(today.breakMs)} — ei lasketa työaikaan.
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
          <Icon path={ICONS.clock} size={18} />
          Avaa työaika
        </Link>
      </Card>

      {/* Seuraava vuoro */}
      <section>
        <SectionLabel>Seuraava työvuoro</SectionLabel>
        {nextShift ? (
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
                  {nextShift.date === DEMO_TODAY ? "Tänään" : formatDayLabel(nextShift.date)}
                </p>
                <p className="rf-tabular mt-1 text-[22px] font-semibold">
                  {nextShift.startTime}–{nextShift.endTime}
                </p>
                <p className="mt-1 text-[13px]" style={{ color: "var(--rf-text-3)" }}>
                  {nextShift.location}
                </p>
              </div>
              <Pill
                tone={
                  nextShift.status === "approved"
                    ? "ok"
                    : nextShift.status === "changed"
                      ? "info"
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

      {/* Viikko */}
      <Card>
        <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          Työaika tällä viikolla
        </p>
        <p className="rf-tabular mt-1.5 text-[28px] font-semibold leading-none">
          {formatDuration(week.workedMs)}
        </p>
      </Card>

      {/* Kuitit — vain jos oikeus */}
      {employee.canSeeReceipts ? (
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
          <Card padded={false}>
            <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
              {recentReceipts.map((receipt) => (
                <li key={receipt.id}>
                  <Link
                    href={`/app/kuitit/${receipt.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium">
                        {receipt.supplier}
                      </p>
                      <p
                        className="rf-tabular mt-0.5 text-[13px]"
                        style={{ color: "var(--rf-text-3)" }}
                      >
                        {formatDate(receipt.date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Money cents={receipt.totalCents} className="text-[15px] font-semibold" />
                      <span style={{ color: "var(--rf-text-3)" }}>
                        <Icon path={ICONS.chevron} size={16} />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function formatDayLabel(isoDate: string): string {
  const days = ["Sunnuntai", "Maanantai", "Tiistai", "Keskiviikko", "Torstai", "Perjantai", "Lauantai"];
  const d = new Date(`${isoDate}T12:00:00Z`);
  return `${days[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

import { OPEN_SHIFTS, SHIFTS, employeeById } from "@/lib/restoflow/data";
import { ROLE_LABELS, SHIFT_STATUS_LABELS, type Shift } from "@/lib/restoflow/types";
import {
  Avatar,
  Card,
  CardHeader,
  DemoNotice,
  Pill,
} from "@/components/restoflow/ui";

export const metadata = { title: "Työvuorot" };

const WEEK_START = "2026-08-17";
const WEEKDAYS = ["Ma", "Ti", "Ke", "To", "Pe", "La", "Su"];

export default function AdminShiftsPage() {
  const days = Array.from({ length: 7 }, (_, i) => addDays(WEEK_START, i));

  const pending = SHIFTS.filter((s) => s.status === "pending");
  const changed = SHIFTS.filter((s) => s.status === "changed");

  return (
    <div className="rf-enter space-y-6">
      <div>
        <h1 className="text-[30px] font-semibold tracking-tight">Työvuorot</h1>
        <p className="mt-1 text-[15px]" style={{ color: "var(--rf-text-2)" }}>
          Viikko 17.–23.8.2026 · {SHIFTS.length} vuoroa · {OPEN_SHIFTS.length} avointa
        </p>
      </div>

      <DemoNotice>
        Demo-aineisto. Vuorojen luonti, muokkaus ja hyväksyntä vaativat
        tietokantayhteyden, jota ei ole vielä kytketty.
      </DemoNotice>

      <section aria-label="Tilanne" className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Hyväksytyt" value={SHIFTS.filter((s) => s.status === "approved").length} tone="ok" />
        <StatCard label="Odottaa hyväksyntää" value={pending.length} tone="warn" />
        <StatCard label="Avoimet vuorot" value={OPEN_SHIFTS.length} tone="risk" />
      </section>

      {/* Viikkonäkymä */}
      <Card padded={false}>
        <div className="px-5 pt-5">
          <CardHeader title="Viikko" subtitle="Vuorot työntekijöittäin" />
        </div>
        <div className="overflow-x-auto px-5 pb-5">
          <div className="grid min-w-[46rem] grid-cols-7 gap-3">
            {days.map((day, i) => {
              const dayShifts = SHIFTS.filter((s) => s.date === day);
              const dayOpen = OPEN_SHIFTS.filter((s) => s.date === day);

              return (
                <div key={day}>
                  <div className="mb-2.5">
                    <p className="text-[13px] font-semibold">{WEEKDAYS[i]}</p>
                    <p className="rf-tabular text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                      {formatShortDate(day)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    {dayShifts.map((shift) => (
                      <ShiftChip key={shift.id} shift={shift} />
                    ))}

                    {dayOpen.map((open) => (
                      <div
                        key={open.id}
                        className="px-2.5 py-2"
                        style={{
                          background: "var(--rf-red-bg)",
                          borderRadius: "10px",
                        }}
                      >
                        <p
                          className="text-[12px] font-semibold"
                          style={{ color: "var(--rf-red-text)" }}
                        >
                          Avoin
                        </p>
                        <p className="rf-tabular text-[11px]" style={{ color: "var(--rf-red-text)" }}>
                          {open.startTime}–{open.endTime}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--rf-red-text)" }}>
                          {ROLE_LABELS[open.role]}
                        </p>
                      </div>
                    ))}

                    {dayShifts.length === 0 && dayOpen.length === 0 ? (
                      <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                        —
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Odottavat */}
      {pending.length > 0 || changed.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {pending.length > 0 ? (
            <Card>
              <CardHeader
                title="Odottaa hyväksyntää"
                subtitle={`${pending.length} vuoroa`}
              />
              <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
                {pending.map((shift) => (
                  <ShiftRow key={shift.id} shift={shift} />
                ))}
              </ul>
            </Card>
          ) : null}

          {changed.length > 0 ? (
            <Card>
              <CardHeader title="Muuttuneet vuorot" subtitle={`${changed.length} vuoroa`} />
              <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
                {changed.map((shift) => {
                  const employee = employeeById(shift.employeeId);
                  return (
                    <li key={shift.id} className="flex items-center gap-3 py-3">
                      <Avatar initials={employee?.initials ?? "?"} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium">{employee?.name}</p>
                        <p className="rf-tabular text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                          {formatShortDate(shift.date)}
                        </p>
                      </div>
                      <p className="rf-tabular text-right text-[13px]">
                        <s style={{ color: "var(--rf-text-3)" }}>
                          {shift.previousStartTime}–{shift.previousEndTime}
                        </s>
                        <br />
                        <strong>
                          {shift.startTime}–{shift.endTime}
                        </strong>
                      </p>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ShiftChip({ shift }: { shift: Shift }) {
  const employee = employeeById(shift.employeeId);
  const bg =
    shift.status === "approved"
      ? "var(--rf-green-bg)"
      : shift.status === "changed"
        ? "var(--rf-blue-bg)"
        : "var(--rf-amber-bg)";
  const fg =
    shift.status === "approved"
      ? "var(--rf-green-text)"
      : shift.status === "changed"
        ? "var(--rf-blue-text)"
        : "var(--rf-amber-text)";

  return (
    <div className="px-2.5 py-2" style={{ background: bg, borderRadius: "10px" }}>
      <p className="truncate text-[12px] font-semibold" style={{ color: fg }}>
        {employee?.name.split(" ")[0] ?? "—"}
      </p>
      <p className="rf-tabular text-[11px]" style={{ color: fg }}>
        {shift.startTime}–{shift.endTime}
      </p>
    </div>
  );
}

function ShiftRow({ shift }: { shift: Shift }) {
  const employee = employeeById(shift.employeeId);

  return (
    <li className="flex items-center gap-3 py-3">
      <Avatar initials={employee?.initials ?? "?"} size={32} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium">{employee?.name}</p>
        <p className="rf-tabular text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {formatShortDate(shift.date)} · {shift.startTime}–{shift.endTime}
        </p>
      </div>
      <Pill tone="warn" dot>
        {SHIFT_STATUS_LABELS[shift.status]}
      </Pill>
    </li>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "warn" | "risk";
}) {
  const color =
    tone === "ok"
      ? "var(--rf-green-text)"
      : tone === "warn"
        ? "var(--rf-amber-text)"
        : "var(--rf-red-text)";

  return (
    <Card>
      <p className="text-[12px] font-medium uppercase tracking-[0.04em]" style={{ color: "var(--rf-text-2)" }}>
        {label}
      </p>
      <p className="rf-tabular mt-2 text-[28px] font-semibold leading-none" style={{ color }}>
        {value}
      </p>
    </Card>
  );
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatShortDate(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(d)}.${Number(m)}.`;
}

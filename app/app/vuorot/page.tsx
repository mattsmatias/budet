import Link from "next/link";
import { ISO_DATE } from "@/lib/restoflow/dates";
import { employeeContext } from "@/lib/restoflow/page-context";
import { SHIFT_STATUS_LABELS, type Shift } from "@/lib/restoflow/types";
import { RfIcon, ShiftStatusIcon } from "@/components/restoflow/icons";
import { Card, EmptyState, Pill, SectionLabel } from "@/components/restoflow/ui";
import { AbsenceReporter } from "./absence";

export const metadata = { title: "Työvuorot" };

const WEEKDAYS = ["ma", "ti", "ke", "to", "pe", "la", "su"];

export default async function ShiftsPage({ searchParams }: PageProps<"/app/vuorot">) {
  const params = await searchParams;
  const { shifts, absences, today, month } = await employeeContext("/app/vuorot");

  const selected =
    typeof params.paiva === "string" && ISO_DATE.test(params.paiva)
      ? params.paiva
      : today;

  const viewMonth = selected.slice(0, 7);
  const byDate = new Map(shifts.map((s) => [s.date, s]));

  const selectedShift = byDate.get(selected);
  const upcoming = shifts.filter((s) => s.date > today).slice(0, 5);
  const changed = shifts.filter((s) => s.status === "changed" && s.date >= today);

  return (
    <div className="rf-enter space-y-5">
      <header className="px-1 pt-2">
        <h1 className="text-[28px] font-semibold tracking-tight">Työvuorot</h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
          {shifts.length === 0
            ? "Ei vuoroja"
            : `${shifts.length} vuoroa`}
        </p>
      </header>

      {/* Muutokset ensin: ne ovat ainoa asia joka vaatii huomiota heti. */}
      {changed.map((shift) => (
        <Card key={shift.id}>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0" style={{ color: "var(--rf-blue)" }}>
              <RfIcon name="alert" size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">Työvuoro muuttui</p>
              <p className="mt-0.5 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
                {formatShortDate(shift.date)}
              </p>
              <p className="rf-tabular mt-2 text-[15px]">
                <s style={{ color: "var(--rf-text-3)" }}>
                  {shift.previousStartTime}–{shift.previousEndTime}
                </s>
                <span aria-hidden="true" style={{ color: "var(--rf-text-3)" }}>
                  {" → "}
                </span>
                <strong>
                  {shift.startTime}–{shift.endTime}
                </strong>
              </p>
            </div>
          </div>
        </Card>
      ))}

      {shifts.length === 0 ? (
        <EmptyState
          title="Ei työvuoroja"
          description="Esihenkilö lisää vuorot hallintanäkymässä. Saat ilmoituksen kun sinulle merkitään vuoro."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <Card>
            <div
              className="mb-3 grid grid-cols-7 text-center text-[11px] font-medium uppercase"
              style={{ color: "var(--rf-text-3)" }}
            >
              {WEEKDAYS.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1">
              {buildMonthGrid(viewMonth).map((cell, i) => {
                if (!cell) return <div key={`e${i}`} />;

                const shift = byDate.get(cell);
                const isSelected = cell === selected;
                const isToday = cell === today;
                const day = Number(cell.slice(8));

                return (
                  <div key={cell} className="flex justify-center">
                    <Link
                      href={`/app/vuorot?paiva=${cell}`}
                      aria-current={isSelected ? "date" : undefined}
                      aria-label={`${day}.${Number(cell.slice(5, 7))}.${shift ? `, vuoro ${shift.startTime}–${shift.endTime}` : ""}`}
                      className="rf-press relative flex h-10 w-10 flex-col items-center justify-center"
                      style={{
                        background: isSelected ? "var(--rf-text)" : "transparent",
                        color: isSelected
                          ? "#fff"
                          : isToday
                            ? "var(--rf-blue)"
                            : "var(--rf-text)",
                        borderRadius: "50%",
                        fontWeight: isToday || isSelected ? 600 : 400,
                      }}
                    >
                      <span className="rf-tabular text-[15px]">{day}</span>
                      {shift ? (
                        <span
                          aria-hidden="true"
                          className="absolute bottom-1 h-1 w-1 rounded-full"
                          style={{ background: isSelected ? "#fff" : dotColor(shift.status) }}
                        />
                      ) : null}
                    </Link>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="space-y-5">
            <section>
              <SectionLabel>{formatLongDate(selected)}</SectionLabel>
              {selectedShift ? (
                <Card>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="rf-tabular text-[26px] font-semibold leading-none">
                        {selectedShift.startTime}–{selectedShift.endTime}
                      </p>
                      {selectedShift.location ? (
                        <p className="mt-2 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
                          {selectedShift.location}
                        </p>
                      ) : null}
                    </div>
                    <StatusPill status={selectedShift.status} />
                  </div>
                </Card>
              ) : (
                <Card>
                  <p className="text-[14px]" style={{ color: "var(--rf-text-2)" }}>
                    Ei työvuoroa tänä päivänä.
                  </p>
                </Card>
              )}
            </section>

            {upcoming.length > 0 ? (
              <section>
                <SectionLabel>Tulevat työvuorot</SectionLabel>
                <Card padded={false}>
                  <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
                    {upcoming.map((shift) => (
                      <li key={shift.id}>
                        <Link
                          href={`/app/vuorot?paiva=${shift.date}`}
                          className="flex items-center justify-between gap-3 px-5 py-3.5"
                        >
                          <div>
                            <p className="rf-tabular text-[15px] font-medium">
                              {shift.startTime}–{shift.endTime}
                            </p>
                            <p className="mt-0.5 text-[13px]" style={{ color: "var(--rf-text-3)" }}>
                              {formatShortDate(shift.date)}
                              {shift.location ? ` · ${shift.location}` : ""}
                            </p>
                          </div>
                          <StatusPill status={shift.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            ) : null}
          </div>
        </div>
      )}

      <section>
        <SectionLabel>Poissaolot</SectionLabel>
        <AbsenceReporter defaultDate={selected} absences={absences} />
      </section>

      <p className="px-1 text-center text-[12px]" style={{ color: "var(--rf-text-3)" }}>
        {month === viewMonth ? "Kuluva kuukausi" : "Toinen kuukausi"} · aikavyöhyke
        ravintolan mukaan
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: Shift["status"] }) {
  const tone =
    status === "accepted"
      ? "ok"
      : status === "changed"
        ? "info"
        : status === "declined"
          ? "risk"
          : "warn";

  return (
    <Pill tone={tone}>
      <ShiftStatusIcon status={status} size={13} />
      {SHIFT_STATUS_LABELS[status]}
    </Pill>
  );
}

function dotColor(status: Shift["status"]): string {
  return status === "accepted"
    ? "var(--rf-green)"
    : status === "changed"
      ? "var(--rf-blue)"
      : status === "declined"
        ? "var(--rf-red)"
        : "var(--rf-amber)";
}

/** Kuukausiruudukko maanantaista alkaen. Tyhjät solut ovat null. */
function buildMonthGrid(month: string): (string | null)[] {
  const [year, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();

  // getUTCDay: 0 = sunnuntai. Siirretään maanantai-alkuiseksi.
  const lead = (first.getUTCDay() + 6) % 7;

  const cells: (string | null)[] = Array(lead).fill(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, "0")}`);
  }
  return cells;
}

function formatShortDate(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(d)}.${Number(m)}.`;
}

function formatLongDate(isoDate: string): string {
  const months = [
    "tammikuuta", "helmikuuta", "maaliskuuta", "huhtikuuta", "toukokuuta",
    "kesäkuuta", "heinäkuuta", "elokuuta", "syyskuuta", "lokakuuta",
    "marraskuuta", "joulukuuta",
  ];
  const [, m, d] = isoDate.split("-");
  return `${Number(d)}. ${months[Number(m) - 1]}`;
}

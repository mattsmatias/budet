import Link from "next/link";
import { CURRENT_EMPLOYEE_ID, DEMO_TODAY, shiftsFor } from "@/lib/restoflow/data";
import { SHIFT_STATUS_LABELS, type Shift } from "@/lib/restoflow/types";
import { Card, Icon, ICONS, Pill, SectionLabel } from "@/components/restoflow/ui";

export const metadata = { title: "Työvuorot" };

const MONTH = "2026-08";
const WEEKDAYS = ["ma", "ti", "ke", "to", "pe", "la", "su"];

export default async function ShiftsPage({
  searchParams,
}: PageProps<"/app/vuorot">) {
  const params = await searchParams;
  const selected = typeof params.paiva === "string" ? params.paiva : DEMO_TODAY;

  const shifts = shiftsFor(CURRENT_EMPLOYEE_ID);
  const byDate = new Map(shifts.map((s) => [s.date, s]));

  const selectedShift = byDate.get(selected);
  const upcoming = shifts.filter((s) => s.date > DEMO_TODAY).slice(0, 4);
  const changed = shifts.filter((s) => s.status === "changed");

  return (
    <div className="rf-enter space-y-5">
      <header className="px-1 pt-2">
        <h1 className="text-[28px] font-semibold tracking-tight">Työvuorot</h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
          Elokuu 2026 · {shifts.length} vuoroa
        </p>
      </header>

      {/* Muutosilmoitus ensin: se on ainoa asia joka vaatii huomiota. */}
      {changed.map((shift) => (
        <Card key={shift.id}>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0" style={{ color: "var(--rf-blue)" }}>
              <Icon path={ICONS.alert} size={20} />
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

      {/* Kalenteri */}
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
          {buildMonthGrid(MONTH).map((cell, i) => {
            if (!cell) return <div key={`e${i}`} />;

            const shift = byDate.get(cell);
            const isSelected = cell === selected;
            const isToday = cell === DEMO_TODAY;
            const day = Number(cell.slice(8));

            return (
              <div key={cell} className="flex justify-center">
                <Link
                  href={`/app/vuorot?paiva=${cell}`}
                  aria-current={isSelected ? "date" : undefined}
                  aria-label={`${day}. elokuuta${shift ? `, työvuoro ${shift.startTime}–${shift.endTime}` : ""}`}
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
                      style={{
                        background: isSelected
                          ? "#fff"
                          : shift.status === "approved"
                            ? "var(--rf-green)"
                            : shift.status === "changed"
                              ? "var(--rf-blue)"
                              : "var(--rf-amber)",
                      }}
                    />
                  ) : null}
                </Link>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Valittu päivä */}
      <section>
        <SectionLabel>{formatLongDate(selected)}</SectionLabel>
        {selectedShift ? (
          <ShiftCard shift={selectedShift} />
        ) : (
          <Card>
            <p className="text-[14px]" style={{ color: "var(--rf-text-2)" }}>
              Ei työvuoroa tänä päivänä.
            </p>
          </Card>
        )}
      </section>

      {/* Tulevat */}
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
                        {formatShortDate(shift.date)} · {shift.location}
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
  );
}

function ShiftCard({ shift }: { shift: Shift }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="rf-tabular text-[26px] font-semibold leading-none">
            {shift.startTime}–{shift.endTime}
          </p>
          <p className="mt-2 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
            {shift.location}
          </p>
        </div>
        <StatusPill status={shift.status} />
      </div>
    </Card>
  );
}

function StatusPill({ status }: { status: Shift["status"] }) {
  return (
    <Pill
      tone={status === "approved" ? "ok" : status === "changed" ? "info" : "warn"}
      dot
    >
      {SHIFT_STATUS_LABELS[status]}
    </Pill>
  );
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

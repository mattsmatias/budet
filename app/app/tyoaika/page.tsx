import { employeeContext } from "@/lib/restoflow/page-context";
import { weekStart } from "@/lib/restoflow/clock-context";
import { eventsOnDate, workedBetween } from "@/lib/restoflow/timeclock";
import { TimeClock } from "./clock";

export const metadata = { title: "Työaika" };

export default async function TimeTrackingPage() {
  const { user, clockEvents, today, now } = await employeeContext("/app/tyoaika");

  const todayEvents = eventsOnDate(clockEvents, today);

  // Viikko ilman kuluvaa päivää: kuluva päivä lasketaan selaimessa
  // sekunnin tarkkuudella ja lisätään tähän, muuten se laskettaisiin kahdesti.
  const yesterday = previousDay(today);
  const week =
    yesterday >= weekStart(today)
      ? workedBetween(clockEvents, weekStart(today), yesterday, now)
      : { workedMs: 0, breakMs: 0, runningSince: null };

  return (
    <div className="rf-enter space-y-5">
      <header className="px-1 pt-2">
        <h1 className="text-[28px] font-semibold tracking-tight">Työaika</h1>
        <p className="mt-1 text-[15px]" style={{ color: "var(--rf-text-2)" }}>
          Hei, {(user.fullName ?? user.email ?? "").split(" ")[0]}
        </p>
      </header>

      <TimeClock todayEvents={todayEvents} weekWorkedMs={week.workedMs} />
    </div>
  );
}

function previousDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

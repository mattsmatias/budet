import {
  CURRENT_USER_ID,
  DEMO_NOW,
  DEMO_TODAY,
  userById,
  eventsFor,
} from "@/lib/restoflow/data";
import { eventsOnDate, workedBetween } from "@/lib/restoflow/timeclock";
import { TimeClock } from "./clock";

export const metadata = { title: "Työaika" };

export default function TimeTrackingPage() {
  const employee = userById(CURRENT_USER_ID)!;
  const allEvents = eventsFor(employee.id);

  const todayEvents = eventsOnDate(allEvents, DEMO_TODAY);
  const week = workedBetween(allEvents, "2026-08-17", "2026-08-23", DEMO_NOW);

  return (
    <div className="rf-enter space-y-5">
      <header className="px-1 pt-2">
        <h1 className="text-[28px] font-semibold tracking-tight">Työaika</h1>
        <p className="mt-1 text-[15px]" style={{ color: "var(--rf-text-2)" }}>
          Hei, {employee.name.split(" ")[0]}
        </p>
      </header>

      <TimeClock
        initialEvents={todayEvents}
        weekWorkedMs={week.workedMs}
        demoNow={DEMO_NOW}
      />

      <p className="px-1 text-center text-[12px]" style={{ color: "var(--rf-text-3)" }}>
        Demossa leimaukset jäävät vain tähän istuntoon — tietokantayhteyttä ei
        ole vielä kytketty.
      </p>
    </div>
  );
}

import { employeeContext } from "@/lib/restoflow/page-context";
import { weekStart } from "@/lib/restoflow/clock-context";
import { fetchClockEvents } from "@/lib/restoflow/queries";
import { daySummaries, eventsOnDate, workedBetween } from "@/lib/restoflow/timeclock";
import { ClockCard } from "./home/clock-card";
import { NextShift } from "./home/next-shift";
import { WeeklyHours } from "./home/weekly-hours";
import { RecentDays } from "./home/recent-days";
import { Surface } from "./ui";

export const metadata = { title: "Koti" };

/** Montako päivää historiaa etusivulla näytetään. */
const RECENT_DAYS = 3;

/**
 * Työntekijän koti.
 *
 * Näkymä vastaa neljään kysymykseen siinä järjestyksessä kuin ne
 * kysytään: olenko töissä, mistä leimaan, milloin on seuraava vuoro,
 * paljonko olen tehnyt.
 *
 * Sivu kokoaa mutta ei laske. Jokainen osa on oma komponenttinsa, ja
 * työajan laskenta tulee samasta moottorista kuin esihenkilön puolella.
 */
export default async function EmployeeHome() {
  const { user, restaurant, clockEvents, shifts, today, now } =
    await employeeContext("/app");

  const zone = restaurant.timezone;

  /*
   * Historia haetaan erikseen ja vain tälle sivulle.
   *
   * Jaettu konteksti antaa leimaukset viikon alusta, mikä riittää
   * viikkosummaan mutta ei kolmen viimeisen työpäivän listaan:
   * maanantaina viikossa on yksi päivä. Kahden viikon ikkuna kattaa
   * myös osa-aikaisen, joka tekee kaksi vuoroa viikossa.
   */
  const history = await fetchClockEvents(restaurant.id, twoWeeksBefore(today));
  const mine = history.filter((e) => e.userId === user.id);

  const todayEvents = eventsOnDate(clockEvents, today, zone);
  const week = workedBetween(clockEvents, weekStart(today), today, now, zone);
  const recent = daySummaries(mine, now, zone, RECENT_DAYS);

  const nextShift = shifts.find((s) => s.date >= today);
  const firstName = (user.fullName ?? user.email ?? "").split(" ")[0];

  return (
    <div className="rf-enter space-y-6">
      <header className="px-1 pt-1">
        <h1 className="text-[26px] font-semibold tracking-tight">
          Hei{firstName ? `, ${firstName}` : ""} <span aria-hidden="true">👋</span>
        </h1>
        <p className="mt-0.5 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
          {restaurant.name}
        </p>
      </header>

      {/*
        Työpöydällä leimaus ja vuoro rinnakkain, puhelimessa allekkain.
        Leimaus on leveämpi myös rinnakkain: se on pääasia eikä puolikas.
      */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start lg:gap-5">
        <ClockCard todayEvents={todayEvents} timezone={zone} />

        <div className="space-y-4">
          <NextShift shift={nextShift} today={today} />

          <Surface>
            <WeeklyHours workedMs={week.workedMs} />
          </Surface>
        </div>
      </div>

      <RecentDays days={recent} timezone={zone} />
    </div>
  );
}

/** Kaksi viikkoa taaksepäin ISO-aikaleimana. */
function twoWeeksBefore(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 14);
  return d.toISOString();
}

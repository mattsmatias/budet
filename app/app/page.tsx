import { employeeContext } from "@/lib/restoflow/page-context";
import { labels } from "@/lib/i18n/labels";
import { weekStart } from "@/lib/restoflow/clock-context";
import { fetchClockEvents, fetchColleagues } from "@/lib/restoflow/queries";
import { birthdaysToday } from "@/lib/restoflow/workplace";
import {
  daySummaries,
  eventsOnDate,
  workedBetween,
} from "@/lib/restoflow/timeclock";
import { ClockCard } from "./home/clock-card";
import { NextShift } from "./home/next-shift";
import { MyTasks } from "./my-tasks";
import { WeeklyHours } from "./home/weekly-hours";
import { RecentDays } from "./home/recent-days";
import { Workplace } from "./home/workplace";
import { Surface, shortDay } from "./ui";
import { resolveLocale } from "@/lib/i18n/resolve";
import { workerText } from "@/lib/i18n/worker-text";
import {
  clockInState,
  formatMinuteOfDay,
  nextShiftFrom,
  opensInMs,
} from "@/lib/restoflow/shift-window";
import type { Shift } from "@/lib/restoflow/types";

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
  const { user, restaurant, clockEvents, shifts, tasks, today, now } =
    await employeeContext("/app");

  const zone = restaurant.timezone;
  const locale = await resolveLocale();
  const t = workerText(locale);
  const nimet = labels(locale);

  /*
   * Historia haetaan erikseen ja vain tälle sivulle.
   *
   * Jaettu konteksti antaa leimaukset viikon alusta, mikä riittää
   * viikkosummaan mutta ei kolmen viimeisen työpäivän listaan:
   * maanantaina viikossa on yksi päivä. Kahden viikon ikkuna kattaa
   * myös osa-aikaisen, joka tekee kaksi vuoroa viikossa.
   */
  const [history, colleagues] = await Promise.all([
    fetchClockEvents(restaurant.id, twoWeeksBefore(today)),
    fetchColleagues(restaurant.id),
  ]);
  const mine = history.filter((e) => e.userId === user.id);
  const birthdays = birthdaysToday(colleagues, now, zone);

  const todayEvents = eventsOnDate(clockEvents, today, zone);
  const week = workedBetween(clockEvents, weekStart(today), today, now, zone);
  const recent = daySummaries(mine, now, zone, RECENT_DAYS);

  /*
   * Seuraava vuoro, ei "tämän päivän vuoro".
   *
   * Illalla kello 20 päättynyt aamuvuoro ei ole seuraava vuoro. Sama
   * sääntö kuin leimauskortissa, samasta funktiosta.
   */
  const nextShift = nextShiftFrom(shifts, now, zone);
  const firstName = (user.fullName ?? user.email ?? "").split(" ")[0];

  /*
   * Saako sisään leimata?
   *
   * Sama sääntö kuin record_clock_event-funktiossa. Tämä päättää mitä
   * kortti näyttää; kanta päättää mitä tapahtuu. Jos ne eroaisivat,
   * käyttäjä näkisi painikkeen joka ei toimi — tai päinvastoin.
   */
  const clockIn = clockInState({
    shifts,
    userId: user.id,
    nowIso: now,
    timezone: zone,
    earlyMinutes: restaurant.clockInEarlyMinutes,
  });

  const label = (shift: Shift) => `${shift.startTime}–${shift.endTime}`;

  const clockInProps =
    clockIn.kind === "open"
      ? { kind: "open" as const, shift: label(clockIn.shift) }
      : clockIn.kind === "too-early"
        ? {
            kind: "too-early" as const,
            shift: label(clockIn.shift),
            opensAt: formatMinuteOfDay(clockIn.opensAtMinutes),
            opensInMs: opensInMs(clockIn.opensAtMinutes, now, zone),
          }
        : {
            kind: "no-shift" as const,
            next: clockIn.next
              ? `${
                  clockIn.next.date === today
                    ? t.yleinen.today.toLocaleLowerCase(locale)
                    : shortDay(clockIn.next.date, locale)
                } ${label(clockIn.next)}`
              : null,
          };

  return (
    /*
      Osiot tulevat näkyviin porrastettuna ylhäältä alas.

      Aiemmin koko sivu tuli yhtenä palana (rf-enter). Porrastus on
      etusivulta: se lukee sivun samassa järjestyksessä kuin silmä, ja
      tekee latauksesta liikkeen eikä välähdyksen. Viiveet loppuvat
      neljänteen, joten mikään ei ilmesty puolta sekuntia myöhässä.
    */
    <div className="space-y-6">
      <header className="bd-app-rise px-1 pt-1">
        <h1
          className="text-[30px] font-semibold"
          style={{ letterSpacing: "-0.03em" }}
        >
          {t.koti.hello}
          {firstName ? `, ${firstName}` : ""} <span aria-hidden="true">👋</span>
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
          {restaurant.name}
        </p>
      </header>

      {/*
        Työpöydällä leimaus ja vuoro rinnakkain, puhelimessa allekkain.
        Leimaus on leveämpi myös rinnakkain: se on pääasia eikä puolikas.
      */}
      <div className="bd-app-rise bd-app-d1 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start lg:gap-5">
        <ClockCard
          todayEvents={todayEvents}
          timezone={zone}
          clockIn={clockInProps}
          t={t}
        />

        <div className="space-y-4">
          <NextShift
            nimet={nimet}
            shift={nextShift}
            today={today}
            t={t}
            locale={locale}
          />

          <Surface>
            <WeeklyHours workedMs={week.workedMs} t={t} />
          </Surface>
        </div>
      </div>

      {/*
        Omat tehtävät heti vuoron jälkeen.

        Työntekijä katsoo puhelinta kesken vuoron ja kysyy mitä pitää
        tehdä. Tehtävät ovat vastaus siihen, joten ne ovat ennen
        työyhteisöä ja historiaa.
      */}
      <div className="bd-app-rise bd-app-d2">
        <MyTasks tasks={tasks} today={today} t={t} />
      </div>

      <div className="bd-app-rise bd-app-d3">
        <Workplace colleagues={colleagues} birthdays={birthdays} t={t} />
      </div>

      <div className="bd-app-rise bd-app-d4">
        <RecentDays
          days={recent}
          timezone={zone}
          today={today}
          t={t}
          locale={locale}
        />
      </div>
    </div>
  );
}

/** Kaksi viikkoa taaksepäin ISO-aikaleimana. */
function twoWeeksBefore(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 14);
  return d.toISOString();
}

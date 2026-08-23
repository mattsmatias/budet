import { employeeContext } from "@/lib/restoflow/page-context";
import { monthStartDate, timeIn, weekStart, windowStartIso } from "@/lib/restoflow/clock-context";
import { fetchClockEvents } from "@/lib/restoflow/queries";
import {
  daySummaries,
  formatDuration,
  workedBetween,
  type DaySummary,
} from "@/lib/restoflow/timeclock";
import { RfIcon } from "@/components/restoflow/icons";
import { Empty, PageHeader, SectionTitle, Surface, Tag, shortDay } from "../ui";

export const metadata = { title: "Työaika" };

/**
 * Työaika.
 *
 * Tämä sivu vastaa yhteen kysymykseen: mitä olen tehnyt. Se ei vastaa
 * kysymykseen "voinko leimata sisään" — leimaus on Koti-sivulla, ja
 * täällä oli aiemmin toinen kello neljällä painikkeella. Kaksi tapaa
 * tehdä sama asia tarkoitti että käyttäjän piti valita niiden välillä,
 * ja väärä valinta ei ollut edes mahdollinen erottaa oikeasta.
 *
 * Historia luetaan clock_events-tapahtumista samalla koontifunktiolla
 * kuin etusivun kolmen päivän lista.
 */
export default async function TimePage() {
  const { user, restaurant, clockEvents, today, month, now } =
    await employeeContext("/app/tyoaika");

  const zone = restaurant.timezone;

  /*
   * Historia haetaan kuukauden alusta.
   *
   * Jaettu konteksti antaa leimaukset viikon alusta, mikä riittää
   * viikkosummaan. Kuukausisumma ja historialista tarvitsevat enemmän.
   */
  const events = await fetchClockEvents(restaurant.id, windowStartIso(monthStartDate(month)));
  const mine = events.filter((e) => e.userId === user.id);

  const week = workedBetween(clockEvents, weekStart(today), today, now, zone);
  const monthWorked = workedBetween(mine, monthStartDate(month), today, now, zone);
  const days = daySummaries(mine, now, zone);

  const open = days.find((d) => d.open);

  return (
    <div className="rf-enter space-y-6">
      <PageHeader title="Työaika" subtitle="Leimauksesi ja tehdyt tunnit" />

      <div className="grid grid-cols-2 gap-3">
        <Surface>
          <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            Tämä viikko
          </p>
          <p className="rf-tabular mt-1 text-[22px] font-semibold" suppressHydrationWarning>
            {formatDuration(week.workedMs)}
          </p>
        </Surface>

        <Surface>
          <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            Tämä kuukausi
          </p>
          <p className="rf-tabular mt-1 text-[22px] font-semibold" suppressHydrationWarning>
            {formatDuration(monthWorked.workedMs)}
          </p>
        </Surface>
      </div>

      {/*
        Avoin työaika kerrotaan mutta sitä ei voi sulkea täältä.
        Uloskirjaus on Koti-sivulla, ja toinen painike tässä olisi taas
        se sama kaksi tapaa tehdä sama asia.
      */}
      {open ? (
        <Surface>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="rf-pulse-dot"
                  style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--rf-green)" }}
                />
                <p className="text-[15px] font-medium">Avoin työaika</p>
              </div>
              <p className="mt-0.5 text-[13px]" style={{ color: "var(--rf-text-3)" }}>
                {shortDay(open.date)}
                {open.firstIn ? ` · aloitettu ${timeIn(zone, open.firstIn)}` : ""}
              </p>
            </div>

            <a
              href="/app"
              className="rf-press inline-flex shrink-0 items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-semibold"
              style={{
                background: "var(--rf-inset)",
                color: "var(--rf-text)",
                borderRadius: 12,
              }}
            >
              Avaa leimaus
              <RfIcon name="chevron" size={14} />
            </a>
          </div>
        </Surface>
      ) : null}

      <section className="space-y-2">
        <SectionTitle>Historia</SectionTitle>

        {days.length === 0 ? (
          <Empty
            title="Ei vielä leimauksia"
            description="Työaikasi näkyvät täällä, kun olet tehnyt ensimmäisen leimauksen Koti-sivulla."
          />
        ) : (
          <div className="space-y-2">
            {days.map((day) => (
              <DayRow key={day.date} day={day} timezone={zone} today={today} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Yksi päivä historiassa.
 *
 * Yhden jakson päivä näyttää yhden rivin. Useamman jakson päivä näyttää
 * jaksot erikseen ja summan alla — muuten tunnin tauko katoaisi
 * lukijalta, joka näkisi vain "09:00 → 17:00, 7 h" ja ihmettelisi.
 */
function DayRow({
  day,
  timezone,
  today,
}: {
  day: DaySummary;
  timezone: string;
  today: string;
}) {
  const many = day.segments.length > 1;

  return (
    <Surface>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[15px] font-medium">
          {shortDay(day.date)}
          {day.date === today ? (
            <span className="ml-2 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
              tänään
            </span>
          ) : null}
        </p>

        <p className="rf-tabular text-[15px] font-semibold" suppressHydrationWarning>
          {formatDuration(day.workedMs)}
        </p>
      </div>

      {day.segments.length === 0 ? (
        <p className="mt-1 text-[13px]" style={{ color: "var(--rf-text-3)" }}>
          Ei vielä leimausta
        </p>
      ) : many ? (
        <>
          <ul className="mt-2 space-y-1">
            {day.segments.map((segment, index) => (
              <li
                key={index}
                className="flex items-baseline justify-between gap-4 text-[13px]"
                style={{ color: "var(--rf-text-2)" }}
              >
                <span className="rf-tabular">
                  {timeIn(timezone, new Date(segment.startMs).toISOString())}
                  {" → "}
                  {timeIn(timezone, new Date(segment.endMs).toISOString())}
                </span>
                <span className="rf-tabular shrink-0">
                  {formatDuration(segment.endMs - segment.startMs)}
                </span>
              </li>
            ))}
          </ul>

          {day.breakMs > 0 ? (
            <p className="mt-2 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
              Taukoa {formatDuration(day.breakMs)} — ei lasketa työaikaan.
            </p>
          ) : null}
        </>
      ) : (
        <p className="rf-tabular mt-1 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {day.firstIn ? timeIn(timezone, day.firstIn) : "—"}
          {" → "}
          {day.lastOut ? timeIn(timezone, day.lastOut) : "?"}
        </p>
      )}

      {day.open ? (
        <div className="mt-2">
          <Tag tone="warn">Uloskirjaus puuttuu</Tag>
        </div>
      ) : null}
    </Surface>
  );
}

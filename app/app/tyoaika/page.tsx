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
import { resolveLocale } from "@/lib/i18n/resolve";
import { workerText, type WorkerText } from "@/lib/i18n/worker-text";
import { fill } from "@/lib/i18n/auth-text";
import type { AppLocale } from "@/lib/i18n/app-locales";

export async function generateMetadata() {
  const t = workerText(await resolveLocale());
  return { title: t.tyoaika.title };
}

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

  /*
   * Käynnissä oleva työaika on vain tämän päivän avoin päivä.
   *
   * Ennen tässä oli days.find((d) => d.open), joka nappasi minkä
   * tahansa avoimen päivän. Unohtunut uloskirjaus kolmen päivän takaa
   * näkyi vihreänä sykkivänä "Avoin työaika" -kortilla ja kasvavana
   * kellona — samaan aikaan kun Koti-sivu sanoi ettei käyttäjä ole
   * töissä. Kaksi sivua väitti eri asiaa samasta hetkestä.
   */
  const locale = await resolveLocale();
  const t = workerText(locale);

  const running = days.find((d) => d.open && !d.stale);
  const unclosed = days.filter((d) => d.stale);

  return (
    <div className="rf-enter space-y-6">
      <PageHeader title={t.tyoaika.title} subtitle={t.tyoaika.subtitle} />

      <div className="grid grid-cols-2 gap-3">
        <Surface>
          <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            {t.yleinen.thisWeek}
          </p>
          <p className="rf-tabular mt-1 text-[22px] font-semibold" suppressHydrationWarning>
            {formatDuration(week.workedMs)}
          </p>
        </Surface>

        <Surface>
          <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            {t.yleinen.thisMonth}
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
      {running ? (
        <Surface>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="rf-pulse-dot"
                  style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--rf-green)" }}
                />
                <p className="text-[15px] font-medium">{t.tyoaika.open}</p>
              </div>
              {/*
                Aloitusaika on käynnissä olevan jakson alku, ei päivän
                ensimmäinen leimaus. Aamulla alkanut ja välillä suljettu
                päivä kertoisi muuten väärän kellonajan.
              */}
              <p className="mt-0.5 text-[13px]" style={{ color: "var(--rf-text-3)" }}>
                {shortDay(running.date, locale)}
                {running.segments.length > 0
                  ? ` · ${fill(t.tyoaika.startedAt, { aika: timeIn(
                      zone,
                      new Date(running.segments[running.segments.length - 1].startMs).toISOString(),
                    ) })}`
                  : ""}
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

      {/*
        Unohtunut uloskirjaus ei ole leimausasia vaan korjausasia.
        Työntekijä ei voi sulkea mennyttä päivää itse: nyt tehty
        uloskirjaus kirjaisi tämän hetken, ja työaikaa syntyisi
        vuorokausia. Siksi tästä ei ole linkkiä leimaukseen.
      */}
      {unclosed.length > 0 ? (
        <Surface>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0" style={{ color: "var(--rf-amber-text)" }}>
              <RfIcon name="alert" size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-medium">
                {unclosed.length === 1
                  ? t.tyoaika.missingOutOneDay
                  : fill(t.tyoaika.missingOutMany, {
                      maara: String(unclosed.length),
                    })}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
                {unclosed.map((d) => shortDay(d.date, locale)).join(", ")}.{" "}
                {t.tyoaika.managerFixes}
              </p>
            </div>
          </div>
        </Surface>
      ) : null}

      <section className="space-y-2">
        <SectionTitle>{t.tyoaika.history}</SectionTitle>

        {days.length === 0 ? (
          <Empty
            title={t.tyoaika.emptyTitle}
            description={t.tyoaika.emptyBody}
          />
        ) : (
          <div className="space-y-2">
            {days.map((day) => (
              <DayRow
                key={day.date}
                day={day}
                timezone={zone}
                today={today}
                t={t}
                locale={locale}
              />
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
  t,
  locale,
}: {
  day: DaySummary;
  timezone: string;
  today: string;
  t: WorkerText;
  locale: AppLocale;
}) {
  const many = day.segments.length > 1;

  const stale = day.stale;

  return (
    <Surface>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[15px] font-medium">
          {shortDay(day.date, locale)}
          {day.date === today ? (
            <span className="ml-2 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
              {t.yleinen.today.toLocaleLowerCase(locale)}
            </span>
          ) : null}
        </p>

        <p className="rf-tabular text-[15px] font-semibold" suppressHydrationWarning>
          {stale ? "—" : formatDuration(day.workedMs)}
        </p>
      </div>

      {day.segments.length === 0 ? (
        <p className="mt-1 text-[13px]" style={{ color: "var(--rf-text-3)" }}>
          {t.tyoaika.noStamp}
        </p>
      ) : many ? (
        <>
          <ul className="mt-2 space-y-1">
            {day.segments.map((segment, index) => {
              /*
               * Käynnissä oleva jakso päättyy nykyhetkeen, mutta sitä
               * hetkeä ei ole leimattu. Kellonaika siinä väittäisi että
               * työntekijä on kirjautunut ulos.
               */
              const running = day.open && index === day.segments.length - 1;

              return (
                <li
                  key={index}
                  className="flex items-baseline justify-between gap-4 text-[13px]"
                  style={{ color: "var(--rf-text-2)" }}
                >
                  <span className="rf-tabular">
                    {timeIn(timezone, new Date(segment.startMs).toISOString())}
                    {" → "}
                    {running
                      ? stale
                        ? "?"
                        : "nyt"
                      : timeIn(timezone, new Date(segment.endMs).toISOString())}
                  </span>
                  <span className="rf-tabular shrink-0" suppressHydrationWarning>
                    {running && stale ? "—" : formatDuration(segment.endMs - segment.startMs)}
                  </span>
                </li>
              );
            })}
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
          {day.open
            ? stale
              ? "?"
              : "nyt"
            : day.lastOut
              ? timeIn(timezone, day.lastOut)
              : "?"}
        </p>
      )}

      {/*
        Käynnissä oleva päivä ja unohtunut leimaus ovat eri asioita.
        Tämän päivän avoin työaika on normaali tila; eilinen avoin
        työaika on virhe joka pitää korjata.
      */}
      {day.open ? (
        <div className="mt-2">
          {day.date === today ? (
            <Tag tone="ok">{t.yleinen.running}</Tag>
          ) : (
            <Tag tone="warn">{t.yleinen.missingOut}</Tag>
          )}
        </div>
      ) : null}
    </Surface>
  );
}

import { employeeContext } from "@/lib/restoflow/page-context";
import { weekEnd, weekStart } from "@/lib/restoflow/clock-context";
import { datesInRange } from "@/lib/restoflow/timeclock";
import { SHIFT_STATUS_LABELS, type Shift } from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";
import { AbsenceReporter } from "./absence";
import { OpenShifts } from "./open-shifts";
import { Empty, PageHeader, SectionTitle, Surface, Tag, shortDate } from "../ui";

import { resolveLocale } from "@/lib/i18n/resolve";
import { workerText } from "@/lib/i18n/worker-text";
import { fill } from "@/lib/i18n/auth-text";

export async function generateMetadata() {
  const t = workerText(await resolveLocale());
  return { title: t.vuorot.title };
}

/** Montako viikkoa eteenpäin listataan. */
const WEEKS_AHEAD = 4;

/**
 * Vuorot.
 *
 * Vastaa kysymykseen "milloin olen töissä". Ei kalenteriruudukkoa vaan
 * lista: ruudukko näyttää kuukauden muodon, mutta työntekijä ei kysy
 * mikä päivä on tiistai — hän kysyy milloin hänen pitää tulla.
 *
 * Vapaapäivät ovat mukana hiljaisina riveinä. Ilman niitä listasta ei
 * näe onko keskiviikko vapaa vai puuttuuko se vain, ja juuri se ero on
 * se mitä viikkoa selatessa haetaan.
 *
 * VUOROA EI KUITATA.
 *
 * Kuittausvaihe poistettiin migraatiossa 0011: esihenkilön merkitsemä
 * vuoro on heti voimassa. Siksi täällä ei ole "Vahvista vuoro"
 * -painiketta. Este ilmoitetaan poissaololla, joka on eri asia kuin
 * vuoron kiistäminen.
 */
export default async function ShiftsPage() {
  const { shifts, absences, claimable, today } = await employeeContext("/app/vuorot");
  const locale = await resolveLocale();
  const t = workerText(locale);

  /*
   * Peruttu vuoro ei ole vuoro.
   *
   * Se ei kuulu viikkonäkymään työvuorona — sinne jäädessään se
   * näyttäisi voimassa olevalta ja joku tulisi töihin turhaan. Peruutus
   * kerrotaan omana ilmoituksenaan yläreunassa.
   */
  const live = shifts.filter((shift) => shift.cancelledAt === null);
  const byDate = new Map(live.map((s) => [s.date, s]));

  /*
   * Perutut tulevat vuorot.
   *
   * Näytetään vaikka päivä on jo mennyt tästä eteenpäin: peruutus on
   * tieto jonka työntekijä tarvitsee juuri siltä päivältä jolle hän
   * oli varautunut.
   */
  const cancelled = shifts.filter(
    (shift) => shift.cancelledAt !== null && shift.date >= today,
  );
  const absenceDates = new Set(
    absences.flatMap((a) => datesInRange(a.date, a.endDate ?? a.date)),
  );

  /*
   * Muuttuneet vuorot nostetaan ylös.
   *
   * Muutos on ainoa asia tällä sivulla joka vaatii huomiota heti:
   * työntekijä on saattanut suunnitella päivänsä vanhan ajan mukaan.
   */
  const changed = live.filter((s) => s.status === "changed" && s.date >= today);

  const weeks = buildWeeks(today, WEEKS_AHEAD);
  const hasAny = weeks.some((week) => week.days.some((d) => byDate.has(d)));

  return (
    <div className="rf-enter space-y-6">
      <PageHeader title={t.vuorot.title} subtitle={t.vuorot.subtitle} />

      {changed.length > 0 ? (
        <div className="space-y-2">
          {changed.map((shift) => (
            <Surface key={shift.id}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0" style={{ color: "var(--rf-blue)" }}>
                  <RfIcon name="alert" size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-medium">{t.vuorot.changed}</p>
                  <p className="rf-tabular mt-1 text-[14px]">
                    <span style={{ color: "var(--rf-text-3)" }}>{shortDate(shift.date)} </span>
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
            </Surface>
          ))}
        </div>
      ) : null}

      {cancelled.length > 0 ? (
        <div className="space-y-2">
          {cancelled.map((shift) => (
            <Surface key={shift.id}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0" style={{ color: "var(--rf-amber-text)" }}>
                  <RfIcon name="alert" size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-medium">{t.vuorot.cancelled}</p>
                  <p className="rf-tabular mt-1 text-[14px]">
                    <span style={{ color: "var(--rf-text-3)" }}>{shortDate(shift.date)} </span>
                    <s style={{ color: "var(--rf-text-3)" }}>
                      {shift.startTime}–{shift.endTime}
                    </s>
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
                    Et ole tänä aikana töissä. Kysy esihenkilöltä jos tämä tuli
                    yllätyksenä.
                  </p>
                </div>
              </div>
            </Surface>
          ))}
        </div>
      ) : null}

      <OpenShifts shifts={claimable} t={t} locale={locale} />

      {!hasAny ? (
        <Empty
          title={t.vuorot.emptyTitle}
          description={t.vuorot.emptyBody}
        />
      ) : (
        weeks.map((week) => {
          const shiftsThisWeek = week.days.filter((d) => byDate.has(d)).length;
          if (shiftsThisWeek === 0 && week.index > 0) return null;

          return (
            <section key={week.days[0]} className="space-y-2">
              <SectionTitle>
                {week.index === 0
                  ? t.yleinen.thisWeek
                  : fill(t.yleinen.week, { numero: week.label })}
              </SectionTitle>

              <Surface padded={false}>
                <div className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
                  {week.days.map((date) => (
                    <DayLine
                      key={date}
                      date={date}
                      shift={byDate.get(date)}
                      today={today}
                      absent={absenceDates.has(date)}
                    />
                  ))}
                </div>
              </Surface>
            </section>
          );
        })
      )}

      <section className="space-y-2">
        <SectionTitle>Poissaolot</SectionTitle>
        <AbsenceReporter defaultDate={today} absences={absences} />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

const WEEKDAYS = ["Su", "Ma", "Ti", "Ke", "To", "Pe", "La"];

function DayLine({
  date,
  shift,
  today,
  absent,
}: {
  date: string;
  shift: Shift | undefined;
  today: string;
  absent: boolean;
}) {
  const isToday = date === today;
  const past = date < today;
  const d = new Date(`${date}T12:00:00Z`);

  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{
        // Tämä päivä saa hienovaraisen taustan, ei reunusta eikä väriä.
        background: isToday ? "var(--rf-inset)" : "transparent",
        opacity: past && !isToday ? 0.55 : 1,
      }}
    >
      <div className="w-[3.25rem] shrink-0">
        <p
          className="text-[13px] font-semibold"
          style={{ color: isToday ? "var(--rf-blue)" : "var(--rf-text-2)" }}
        >
          {WEEKDAYS[d.getUTCDay()]}
        </p>
        <p className="rf-tabular text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {shortDate(date)}
        </p>
      </div>

      {shift ? (
        <>
          <div className="min-w-0 flex-1">
            <p className="rf-tabular text-[15px] font-medium">
              {shift.startTime}–{shift.endTime}
            </p>
            {shift.location ? (
              <p className="mt-0.5 truncate text-[13px]" style={{ color: "var(--rf-text-3)" }}>
                {shift.location}
              </p>
            ) : null}
          </div>

          <div className="shrink-0">
            {absent ? (
              <Tag tone="warn">Poissaolo</Tag>
            ) : shift.status === "accepted" ? (
              <Tag tone="ok">
                <RfIcon name="check" size={12} />
                Vahvistettu
              </Tag>
            ) : (
              <Tag tone={shift.status === "changed" ? "info" : "neutral"}>
                {SHIFT_STATUS_LABELS[shift.status]}
              </Tag>
            )}
          </div>
        </>
      ) : (
        <p className="flex-1 text-[14px]" style={{ color: "var(--rf-text-3)" }}>
          {absent ? "Poissaolo" : "Vapaa"}
        </p>
      )}
    </div>
  );
}

/** Viikot tästä päivästä eteenpäin, maanantaista sunnuntaihin. */
function buildWeeks(today: string, count: number) {
  const weeks: { index: number; label: string; days: string[] }[] = [];

  for (let i = 0; i < count; i += 1) {
    const start = addDays(weekStart(today), i * 7);
    const days = datesInRange(start, weekEnd(start));
    weeks.push({ index: i, label: shortDate(start), days });
  }

  return weeks;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  allowedActions,
  computeWorked,
  currentState,
  formatClock,
  formatDuration,
  formatTimeOfDay,
} from "@/lib/restoflow/timeclock";
import {
  CLOCK_EVENT_LABELS,
  CLOCK_STATE_LABELS,
  type ClockEvent,
  type ClockEventType,
} from "@/lib/restoflow/types";
import { Card, Icon, ICONS, SectionLabel } from "@/components/restoflow/ui";

/**
 * Työaikakello.
 *
 * Tila johdetaan tapahtumista samalla funktiolla jota palvelinkin käyttää —
 * ei erillistä selainlogiikkaa, joka voisi ajautua eri tulokseen.
 *
 * Laskuri tikittää sekunnin välein, mutta laskenta ei nojaa tikitykseen:
 * se lasketaan aina uudelleen tapahtumista ja nykyhetkestä. Näin taustalle
 * jäänyt välilehti ei jää jälkeen.
 */
export function TimeClock({
  initialEvents,
  weekWorkedMs,
  demoNow,
}: {
  initialEvents: ClockEvent[];
  weekWorkedMs: number;
  demoNow: string;
}) {
  const [events, setEvents] = useState<ClockEvent[]>(initialEvents);

  // Demon aika kulkee oikeassa tahdissa demoNow-hetkestä eteenpäin, jotta
  // laskuri näyttää uskottavalta ilman että aineisto sidotaan oikeaan kelloon.
  const [offsetMs, setOffsetMs] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setOffsetMs(Date.now() - start), 1000);
    return () => clearInterval(id);
  }, []);

  const nowIso = useMemo(
    () => new Date(Date.parse(demoNow) + offsetMs).toISOString(),
    [demoNow, offsetMs],
  );

  const state = currentState(events);
  const worked = computeWorked(events, nowIso);
  const actions = allowedActions(state);

  function record(type: ClockEventType) {
    setEvents((prev) => [
      ...prev,
      { id: `local-${prev.length}`, employeeId: "emp-ali", type, at: nowIso },
    ]);
  }

  const tone =
    state === "working" ? "ok" : state === "on_break" ? "warn" : "neutral";
  const toneColor =
    tone === "ok"
      ? "var(--rf-green)"
      : tone === "warn"
        ? "var(--rf-amber)"
        : "var(--rf-text-3)";

  return (
    <div className="space-y-5">
      {/* Tila */}
      <Card>
        <div className="flex items-center justify-center gap-2.5">
          <span
            aria-hidden="true"
            className={state === "working" ? "rf-pulse-dot" : ""}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: toneColor,
            }}
          />
          <p className="text-[17px] font-semibold">{CLOCK_STATE_LABELS[state]}</p>
        </div>

        {/* Laskuri. suppressHydrationWarning: palvelin ja selain laskevat
            eri hetkestä, mikä on tarkoitus eikä virhe. */}
        <p
          className="rf-tabular mt-5 text-center text-[52px] font-semibold leading-none"
          style={{ letterSpacing: "-0.03em" }}
          suppressHydrationWarning
        >
          {formatClock(worked.workedMs)}
        </p>

        <p className="mt-2 text-center text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {state === "off"
            ? "Päivän kertymä"
            : state === "on_break"
              ? "Työaika ei kerry tauolla"
              : "Työaika kertyy"}
        </p>

        {/* Toiminnot. Vain sallitut siirtymät näkyvät — poistettu painike ei
            voi tuottaa mahdotonta tapahtumajonoa. */}
        <div className="mt-6 grid gap-2.5" style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}>
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => record(action)}
              className="rf-press py-4 text-[15px] font-semibold uppercase tracking-wide"
              style={{
                background:
                  action === "in"
                    ? "var(--rf-green)"
                    : action === "out"
                      ? "var(--rf-red)"
                      : "var(--rf-inset)",
                color:
                  action === "in" || action === "out" ? "#fff" : "var(--rf-text)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              {ACTION_LABELS[action]}
            </button>
          ))}
        </div>
      </Card>

      {/* Päivän tapahtumat */}
      <section>
        <SectionLabel>Päivän tapahtumat</SectionLabel>
        <Card padded={false}>
          {events.length === 0 ? (
            <p className="px-5 py-6 text-center text-[14px]" style={{ color: "var(--rf-text-2)" }}>
              Ei tapahtumia tänään.
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
              {[...events].reverse().map((event) => (
                <li key={event.id} className="flex items-center gap-3 px-5 py-3">
                  <span
                    aria-hidden="true"
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: EVENT_COLORS[event.type],
                    }}
                  />
                  <span className="rf-tabular text-[15px] font-medium">
                    {formatTimeOfDay(event.at)}
                  </span>
                  <span className="text-[15px]" style={{ color: "var(--rf-text-2)" }}>
                    {CLOCK_EVENT_LABELS[event.type]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Yhteenveto */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            Päivän työaika
          </p>
          <p className="rf-tabular mt-1.5 text-[20px] font-semibold" suppressHydrationWarning>
            {formatDuration(worked.workedMs)}
          </p>
        </Card>
        <Card>
          <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            Viikon työaika
          </p>
          <p className="rf-tabular mt-1.5 text-[20px] font-semibold">
            {formatDuration(weekWorkedMs)}
          </p>
        </Card>
      </div>

      {worked.breakMs > 0 ? (
        <p className="px-1 text-center text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          <Icon path={ICONS.clock} size={12} /> Taukoa {formatDuration(worked.breakMs)} —
          ei lasketa työaikaan.
        </p>
      ) : null}
    </div>
  );
}

const ACTION_LABELS: Record<ClockEventType, string> = {
  in: "Sisään",
  break_start: "Tauko",
  break_end: "Jatka",
  out: "Ulos",
};

const EVENT_COLORS: Record<ClockEventType, string> = {
  in: "var(--rf-green)",
  break_start: "var(--rf-amber)",
  break_end: "var(--rf-blue)",
  out: "var(--rf-red)",
};

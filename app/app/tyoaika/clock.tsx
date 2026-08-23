"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { recordClockEvent, type ActionState } from "../actions";
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
import { RfIcon } from "@/components/restoflow/icons";
import { Card, SectionLabel } from "@/components/restoflow/ui";

const initial: ActionState = {};

/**
 * Työaikakello.
 *
 * Tila johdetaan tapahtumista samalla funktiolla jota palvelin ja
 * tietokantafunktio käyttävät — ei erillistä selainlogiikkaa joka voisi
 * ajautua eri tulokseen.
 *
 * Laskuri tikittää sekunnin välein, mutta laskenta ei nojaa tikitykseen:
 * se lasketaan aina uudelleen tapahtumista ja nykyhetkestä. Taustalle
 * jäänyt välilehti ei siis jää jälkeen.
 */
export function TimeClock({
  todayEvents,
  weekWorkedMs,
  timezone,
}: {
  todayEvents: ClockEvent[];
  weekWorkedMs: number;
  /** Ravintolan aikavyöhyke: leimauksen kellonaika näytetään siinä ajassa. */
  timezone: string;
}) {
  const [state, action] = useActionState(recordClockEvent, initial);

  // Tikitys pakottaa uudelleenpiirron; itse aika luetaan kellosta.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = new Date().toISOString();
  const clockState = currentState(todayEvents);
  const worked = computeWorked(todayEvents, now);
  const actions = allowedActions(clockState);

  const dotColor =
    clockState === "working"
      ? "var(--rf-green)"
      : clockState === "on_break"
        ? "var(--rf-amber)"
        : "var(--rf-text-3)";

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      <Card>
        <div className="flex items-center justify-center gap-2.5">
          <span
            aria-hidden="true"
            className={clockState === "working" ? "rf-pulse-dot" : ""}
            style={{ width: 10, height: 10, borderRadius: "50%", background: dotColor }}
          />
          <p className="text-[17px] font-semibold">{CLOCK_STATE_LABELS[clockState]}</p>
        </div>

        {/* suppressHydrationWarning: palvelin ja selain laskevat eri
            hetkestä, mikä on tarkoitus eikä virhe. */}
        <p
          className="rf-tabular mt-5 text-center text-[52px] font-semibold leading-none"
          style={{ letterSpacing: "-0.03em" }}
          suppressHydrationWarning
        >
          {formatClock(worked.workedMs)}
        </p>

        <p className="mt-2 text-center text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {clockState === "off"
            ? "Päivän kertymä"
            : clockState === "on_break"
              ? "Työaika ei kerry tauolla"
              : "Työaika kertyy"}
        </p>

        {/* Vain sallitut siirtymät näkyvät. Poistettu painike ei voi tuottaa
            mahdotonta tapahtumajonoa, ja palvelin tarkistaa saman uudelleen. */}
        <form
          action={action}
          className="mt-6 grid gap-2.5"
          style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}
        >
          {actions.map((type) => (
            <ActionButton key={type} type={type} />
          ))}
        </form>

        {state.error ? (
          <p
            role="alert"
            className="mt-4 px-3.5 py-2.5 text-[13px] leading-relaxed"
            style={{
              background: "var(--rf-red-bg)",
              color: "var(--rf-red-text)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            {state.error}
          </p>
        ) : null}
      </Card>

      <div className="space-y-5">
        <section>
          <SectionLabel>Päivän tapahtumat</SectionLabel>
          <Card padded={false}>
            {todayEvents.length === 0 ? (
              <p
                className="px-5 py-6 text-center text-[14px]"
                style={{ color: "var(--rf-text-2)" }}
              >
                Ei tapahtumia tänään.
              </p>
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
                {[...todayEvents].reverse().map((event) => (
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
                      {formatTimeOfDay(event.at, timezone)}
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
              {formatDuration(weekWorkedMs + worked.workedMs)}
            </p>
          </Card>
        </div>

        {worked.breakMs > 0 ? (
          <p
            className="flex items-center justify-center gap-1.5 px-1 text-center text-[12px]"
            style={{ color: "var(--rf-text-3)" }}
            suppressHydrationWarning
          >
            <RfIcon name="clock" size={13} />
            Taukoa {formatDuration(worked.breakMs)} — ei lasketa työaikaan.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ActionButton({ type }: { type: ClockEventType }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name="type"
      value={type}
      disabled={pending}
      className="rf-press py-4 text-[15px] font-semibold uppercase tracking-wide disabled:opacity-50"
      style={{
        background:
          type === "in"
            ? "var(--rf-green)"
            : type === "out"
              ? "var(--rf-red)"
              : "var(--rf-inset)",
        color: type === "in" || type === "out" ? "#fff" : "var(--rf-text)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {ACTION_LABELS[type]}
    </button>
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

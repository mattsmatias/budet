"use client";

import { useEffect, useState } from "react";
import {
  SERVICE_STATE_LABELS,
  clockLabel,
  hourMarks,
  positionOn,
  type ServiceBar,
  type ServiceDay,
  type ServiceState,
} from "@/lib/restoflow/service-day";

/**
 * Palvelupäivä.
 *
 * Yksi vaakasuora aikajana, kaista per asema, palkki per vuoro. Väri
 * kertoo tilan ja liike kertoo että se on nyt.
 *
 * TÄMÄ EI OLE KAAVIO VAAN TILANNEKUVA.
 *
 * Siinä ei ole akselia eikä lukuja, koska kysymys johon se vastaa ei
 * ole "paljonko" vaan "kuka ja missä mennään". Tarkat kellonajat ovat
 * palkin sisällä ja loput Työvuorot-sivulla.
 *
 * NYT-VIIVA LIIKKUU.
 *
 * Se päivittyy minuutin välein. Sekunnin välein päivittyvä viiva
 * kuluttaisi virtaa eikä liikkuisi silmälle näkyvästi; minuutti on
 * pienin yksikkö jolla tällä janalla on merkitystä.
 */
export function ServiceDayBoard({
  day,
  live,
}: {
  day: ServiceDay;
  /** Kuluva päivä: nyt-viiva ja tikitys. */
  live: boolean;
}) {
  const [nowMin, setNowMin] = useState(day.nowMin);

  useEffect(() => {
    if (!live) return;

    const tick = () => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    };

    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [live]);

  const marks = hourMarks(day, 2);
  const nowLeft = nowMin === null ? null : positionOn(day, nowMin) * 100;

  return (
    <section
      aria-label="Palvelupäivä"
      className="rf-enter overflow-hidden"
      style={{
        background: "var(--rf-card)",
        border: "1px solid var(--rf-line)",
        borderRadius: "var(--rf-r-card)",
      }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="flex items-center gap-2.5">
          {live ? <LiveDot /> : null}
          <h2 className="text-[17px] font-bold tracking-[-0.02em]">
            {live ? "Päivä käynnissä" : "Päivän vuorot"}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Count value={day.onFloor} label="töissä" tone="working" />
          <Count value={day.upcoming} label="tulossa" tone="upcoming" />
          {day.attention > 0 ? (
            <Count value={day.attention} label="huomiota" tone="late" />
          ) : null}
        </div>
      </header>

      <div className="relative mt-5 px-5 pb-5 sm:px-6 sm:pb-6">
        {/* Tasatunnit taustaviivoina. Ne ovat mitta-asteikko eikä
            sisältöä, joten ne ovat hiuksenohuita ja vaaleita. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-5 top-0 bottom-14 sm:inset-x-6">
          {marks.map((mark) => (
            <span
              key={mark}
              className="absolute top-0 bottom-0 w-px"
              style={{
                left: `${positionOn(day, mark) * 100}%`,
                background: "var(--rf-line)",
              }}
            />
          ))}
        </div>

        {nowLeft !== null ? <NowLine left={nowLeft} /> : null}

        <div className="relative space-y-3">
          {day.lanes.map((lane, laneIndex) => (
            <div key={lane.position}>
              <p
                className="mb-1.5 text-[10.5px] font-bold uppercase"
                style={{ color: "var(--rf-text-3)", letterSpacing: "0.08em" }}
              >
                {lane.label}
              </p>

              <div className="relative h-11">
                {lane.bars.map((bar, index) => (
                  <Bar
                    key={bar.shiftId}
                    bar={bar}
                    day={day}
                    delay={laneIndex * 90 + index * 60}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Kellonajat janan alle. */}
        <div className="relative mt-3 h-4">
          {marks.map((mark) => (
            <span
              key={mark}
              className="rf-tabular absolute -translate-x-1/2 text-[11px]"
              style={{ left: `${positionOn(day, mark) * 100}%`, color: "var(--rf-text-3)" }}
            >
              {clockLabel(mark)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Bar({
  bar,
  day,
  delay,
}: {
  bar: ServiceBar;
  day: ServiceDay;
  delay: number;
}) {
  const left = positionOn(day, bar.startMin) * 100;
  const right = positionOn(day, bar.endMin) * 100;
  const skin = SKINS[bar.state];

  return (
    <div
      className="rf-bar-grow absolute inset-y-0 flex items-center gap-2 overflow-hidden px-2.5"
      style={{
        left: `${left}%`,
        width: `${Math.max(right - left, 6)}%`,
        background: skin.bg,
        border: `1px solid ${skin.border}`,
        borderRadius: 12,
        animationDelay: `${delay}ms`,
      }}
      title={`${bar.name} · ${bar.label} · ${SERVICE_STATE_LABELS[bar.state]}`}
    >
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center text-[10px] font-bold"
        style={{ background: skin.chip, color: skin.text, borderRadius: "50%" }}
      >
        {bar.initials}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold" style={{ color: skin.text }}>
          {bar.name}
        </span>
        <span
          className="rf-tabular block truncate text-[10.5px] font-medium"
          style={{ color: skin.text, opacity: 0.72 }}
        >
          {bar.label}
        </span>
      </span>

      {/* Käynnissä oleva vuoro hengittää. Se on ainoa liike janalla,
          joten se ei kilpaile mistään. */}
      {bar.state === "working" ? (
        <span
          aria-hidden="true"
          className="rf-pulse-dot mr-0.5 shrink-0"
          style={{ width: 7, height: 7, borderRadius: "50%", background: skin.text }}
        />
      ) : null}

      {bar.state === "late" || bar.state === "overrun" ? (
        <span
          aria-hidden="true"
          className="mr-0.5 shrink-0 text-[13px] font-bold"
          style={{ color: skin.text }}
        >
          !
        </span>
      ) : null}
    </div>
  );
}

function NowLine({ left }: { left: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-0 bottom-14 z-10 w-px"
      style={{
        left: `calc(1.25rem + (100% - 2.5rem) * ${left / 100})`,
        background: "var(--rf-ink)",
        transition: "left 800ms cubic-bezier(0.32, 0.72, 0, 1)",
      }}
    >
      <span
        className="absolute -left-[3px] -top-[3px] h-1.5 w-1.5 rounded-full"
        style={{ background: "var(--rf-ink)" }}
      />
    </div>
  );
}

function LiveDot() {
  return (
    <span aria-hidden="true" className="relative flex h-2.5 w-2.5 shrink-0">
      <span
        className="rf-ping absolute inset-0 rounded-full"
        style={{ background: "var(--rf-green)" }}
      />
      <span
        className="relative h-2.5 w-2.5 rounded-full"
        style={{ background: "var(--rf-green)" }}
      />
    </span>
  );
}

function Count({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: ServiceState;
}) {
  const skin = SKINS[tone];

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-semibold"
      style={{ background: skin.bg, color: skin.text, borderRadius: "var(--rf-r-pill)" }}
    >
      <span className="rf-tabular font-bold">{value}</span>
      {label}
    </span>
  );
}

/**
 * Tilan värit.
 *
 * Vihreä = menossa, keltainen = tarkista, harmaa = tehty tai tulossa.
 * Sama merkitys kuin muualla Budetissa: väri ei ole koriste vaan
 * kertoo pitääkö reagoida.
 */
const SKINS: Record<ServiceState, { bg: string; border: string; chip: string; text: string }> = {
  upcoming: {
    bg: "var(--rf-inset)",
    border: "transparent",
    chip: "rgba(255,255,255,0.75)",
    text: "var(--rf-text-2)",
  },
  working: {
    bg: "var(--rf-green-bg)",
    border: "rgba(22,163,106,0.28)",
    chip: "rgba(255,255,255,0.75)",
    text: "var(--rf-green-text)",
  },
  break: {
    bg: "var(--rf-accent-bg)",
    border: "rgba(49,91,255,0.24)",
    chip: "rgba(255,255,255,0.8)",
    text: "var(--rf-accent-strong)",
  },
  late: {
    bg: "var(--rf-amber-bg)",
    border: "rgba(245,158,11,0.4)",
    chip: "rgba(255,255,255,0.8)",
    text: "var(--rf-amber-text)",
  },
  overrun: {
    bg: "var(--rf-amber-bg)",
    border: "rgba(245,158,11,0.4)",
    chip: "rgba(255,255,255,0.8)",
    text: "var(--rf-amber-text)",
  },
  done: {
    bg: "var(--rf-inset)",
    border: "transparent",
    chip: "rgba(255,255,255,0.75)",
    text: "var(--rf-text-3)",
  },
  missed: {
    bg: "var(--rf-red-bg)",
    border: "rgba(239,68,68,0.3)",
    chip: "rgba(255,255,255,0.8)",
    text: "var(--rf-red-text)",
  },
};

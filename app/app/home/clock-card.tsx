"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { recordClockEvent, type ActionState } from "../actions";
import {
  computeWorked,
  currentState,
  formatDuration,
  formatHoursMinutes,
} from "@/lib/restoflow/timeclock";
import { timeIn } from "@/lib/restoflow/clock-context";
import type { ClockEvent, ClockEventType } from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";

const initial: ActionState = {};

/**
 * Kuinka kauan onnistumisnäkymä jää ruudulle.
 *
 * Kaksi ja puoli sekuntia. Onnistuminen korvaa kortin, eli päätoiminto
 * on sen ajan poissa — neljä sekuntia oli mitattuna liian pitkä: kortti
 * ehti tuntua jumittuneelta ennen kuin se palasi.
 */
const SUCCESS_MS = 2500;

/**
 * Työajan leimaus.
 *
 * Tämä on koko työntekijänäkymän tärkein elementti, ja se on tarkoitus
 * nähdä siitä: kortti on suuri, tila luettavissa yhdellä silmäyksellä ja
 * toiminto yhden painalluksen päässä.
 *
 * Kolme ratkaisua.
 *
 * 1. YKSI PÄÄTOIMINTO KERRALLAAN.
 *    Sisään tai ulos on aina se mitä käyttäjä on tullut tekemään. Tauko
 *    on toissijainen ja siksi pienempi. Neljä samankokoista painiketta
 *    pakottaisi lukemaan ne joka kerta.
 *
 * 2. TILA VAHVISTETAAN PALVELIMELTA, EI OLETETA.
 *    Onnistumisnäkymä syntyy vasta kun palvelin on vastannut. Optimistinen
 *    "leimattu" olisi väärä tieto silloin kun se eniten haittaa — ja
 *    työaika on juuri se asia jossa väärä tieto maksaa rahaa.
 *
 * 3. KELLO LASKETAAN AINA UUDELLEEN.
 *    Tikitys pakottaa piirron, mutta aika luetaan tapahtumista ja
 *    nykyhetkestä. Taustalle jäänyt välilehti ei jää jälkeen.
 */
export function ClockCard({
  todayEvents,
  timezone,
  clockIn,
}: {
  todayEvents: ClockEvent[];
  timezone: string;
  /**
   * Saako sisään leimata, ja jos ei niin miksi.
   *
   * Päätös tehdään palvelimella samasta säännöstä jonka tietokanta
   * lopulta ratkaisee. Kortti ei arvaa vaan näyttää tuloksen.
   */
  clockIn:
    | { kind: "open"; shift: string }
    | { kind: "too-early"; shift: string; opensAt: string }
    | { kind: "no-shift"; next: string | null };
}) {
  const [state, action] = useActionState(recordClockEvent, initial);
  const [, setTick] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  /*
   * Kaksi painallusta samalla hetkellä on yksi leimaus.
   *
   * Painike menee estotilaan vasta kun React on piirtänyt uudelleen,
   * eikä se ehdi kahden peräkkäisen napautuksen väliin. Tietokanta
   * hylkää toisen leimauksen — mutta käyttäjä näkisi silti
   * virheilmoituksen tekemästään oikeasta asiasta.
   */
  const submitting = useRef(false);
  useEffect(() => {
    submitting.current = false;
  }, [state]);

  /*
   * Virheen jälkeen tila haetaan uudelleen, ei arvata.
   *
   * Jos leimaus meni läpi mutta jokin muu epäonnistui, ruudulla oleva
   * tila on vanha. Väärä tila on tässä näkymässä pahempi kuin
   * virheilmoitus: käyttäjä leimaisi uudelleen.
   */
  useEffect(() => {
    if (state.error) router.refresh();
  }, [state.error, router]);

  /*
   * Onnistuminen näkyy hetken ja väistyy.
   *
   * Pysyvä kuittaus jäisi ruudulle seuraavaan latauksen asti ja
   * kertoisi menneestä silloin kun käyttäjä katsoo nykyhetkeä.
   */
  const [celebrating, setCelebrating] = useState<ActionState["clocked"]>(undefined);
  const lastSeen = useRef<string | null>(null);

  useEffect(() => {
    if (!state.clocked || state.clocked.at === lastSeen.current) return;
    lastSeen.current = state.clocked.at;
    setCelebrating(state.clocked);

    const id = setTimeout(() => setCelebrating(undefined), SUCCESS_MS);
    return () => clearTimeout(id);
  }, [state.clocked]);

  const now = new Date().toISOString();
  const clockState = currentState(todayEvents);
  const worked = computeWorked(todayEvents, now);
  /*
   * Aloitusaika on käynnissä olevan jakson alku, ei päivän ensimmäinen
   * sisääntulo.
   *
   * Jos työntekijä leimaa ulos ja takaisin sisään, päivän ensimmäinen
   * leimaus on aamulta ja kertoisi väärän ajan. computeWorked tietää
   * kumpi jakso on käynnissä.
   */
  const startedAt = worked.runningSince;

  if (celebrating) {
    return (
      <Surface active={celebrating.type !== "out"}>
        <Success
          type={celebrating.type}
          at={celebrating.at}
          timezone={timezone}
          workedMs={worked.workedMs}
        />
      </Surface>
    );
  }

  const working = clockState === "working";
  const onBreak = clockState === "on_break";

  return (
    <Surface active={working}>
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={working ? "rf-pulse-dot" : ""}
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: working
              ? "var(--rf-green)"
              : onBreak
                ? "var(--rf-amber)"
                : "var(--rf-text-3)",
          }}
        />
        <p
          className="text-[12px] font-semibold uppercase"
          style={{ letterSpacing: "0.07em", color: "var(--rf-text-2)" }}
        >
          {working
            ? "Työ käynnissä"
            : onBreak
              ? "Tauolla"
              : clockIn.kind === "no-shift"
                ? "Ei työvuoroa"
                : "Et ole töissä"}
        </p>
      </div>

      <p className="mt-1 text-[13px]" style={{ color: "var(--rf-text-3)" }}>
        {working && startedAt
          ? `Aloitettu ${timeIn(timezone, startedAt)}`
          : onBreak
            ? "Työaika ei kerry tauolla"
            : clockIn.kind === "open"
              ? `Työvuoro ${clockIn.shift}`
              : "Tänään"}
      </p>

      {/* suppressHydrationWarning: palvelin ja selain laskevat eri
          hetkestä. Se on tarkoitus eikä virhe. */}
      <p
        className="rf-tabular mt-4 text-[56px] font-semibold leading-none"
        style={{ letterSpacing: "-0.035em" }}
        suppressHydrationWarning
      >
        {formatHoursMinutes(worked.workedMs)}
      </p>

      {state.error ? (
        <div
          role="alert"
          className="mt-5 px-4 py-3 text-[13px] leading-relaxed"
          style={{
            background: "var(--rf-red-bg)",
            color: "var(--rf-red-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {state.error}
        </div>
      ) : null}

      {/*
        Este selitetään ennen painiketta.
        Harmaa painike ilman syytä on arvoitus, ja arvoituksen edessä
        käyttäjä painaa uudelleen.
      */}
      {!working && !onBreak && clockIn.kind !== "open" ? (
        <p
          className="mt-5 px-4 py-3 text-[13px] leading-relaxed"
          style={{
            background: "var(--rf-inset)",
            color: "var(--rf-text-2)",
            borderRadius: 12,
          }}
        >
          {clockIn.kind === "too-early"
            ? `Sisäänleimaus avautuu klo ${clockIn.opensAt}. Työvuoro ${clockIn.shift}.`
            : clockIn.next
              ? `Sinulle ei ole työvuoroa juuri nyt. Seuraava vuoro: ${clockIn.next}.`
              : "Sinulle ei ole suunniteltu työvuoroa. Esihenkilö lisää vuorot."}
        </p>
      ) : null}

      <form
        action={action}
        onSubmit={(event) => {
          if (submitting.current) {
            event.preventDefault();
            return;
          }
          submitting.current = true;
        }}
        className="mt-6 space-y-2.5"
      >
        <PrimaryAction
          working={working || onBreak}
          blocked={!working && !onBreak && clockIn.kind !== "open"}
        />

        {/* Tauko on toissijainen: pienempi, hillitympi, oman rivinsä. */}
        {working ? <SecondaryAction type="break_start" label="Aloita tauko" /> : null}
        {onBreak ? <SecondaryAction type="break_end" label="Jatka työtä" /> : null}
      </form>
    </Surface>
  );
}

// ---------------------------------------------------------------------------

/**
 * Kortin pinta.
 *
 * Aktiivinen työaika saa hienovaraisen vihreän vivahteen reunassa ja
 * taustassa. Kokonaan vihreä kortti huutaisi; tässä riittää että silmä
 * huomaa eron ohi kulkiessaan.
 */
function Surface({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <section
      aria-label="Työajan leimaus"
      className="px-5 py-6 sm:px-7 sm:py-7"
      style={{
        background: active
          ? "linear-gradient(180deg, var(--rf-green-bg) 0%, var(--rf-card) 55%)"
          : "var(--rf-card)",
        border: `1px solid ${active ? "var(--rf-green-line, var(--rf-line))" : "var(--rf-line)"}`,
        borderRadius: 20,
        boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 8px 24px -12px rgba(16,24,40,0.10)",
      }}
    >
      {children}
    </section>
  );
}

function Success({
  type,
  at,
  timezone,
  workedMs,
}: {
  type: ClockEventType;
  at: string;
  timezone: string;
  workedMs: number;
}) {
  const ended = type === "out";

  return (
    <div className="rf-enter">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-7 w-7 items-center justify-center"
          style={{ background: "var(--rf-green)", color: "#fff", borderRadius: "50%" }}
        >
          <RfIcon name="check" size={16} />
        </span>
        <p className="text-[17px] font-semibold">{SUCCESS_TITLES[type]}</p>
      </div>

      <p className="rf-tabular mt-4 text-[44px] font-semibold leading-none" style={{ letterSpacing: "-0.03em" }}>
        {timeIn(timezone, at)}
      </p>

      {ended ? (
        <div className="mt-5">
          <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            Tämän päivän työaika
          </p>
          <p className="rf-tabular mt-0.5 text-[24px] font-semibold" suppressHydrationWarning>
            {formatDuration(workedMs)}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-[15px]" style={{ color: "var(--rf-text-2)" }}>
          {SUCCESS_NOTES[type]}
        </p>
      )}
    </div>
  );
}

const SUCCESS_TITLES: Record<ClockEventType, string> = {
  in: "Työvuoro aloitettu",
  break_start: "Tauko alkoi",
  break_end: "Takaisin töissä",
  out: "Työvuoro päättyi",
};

const SUCCESS_NOTES: Record<ClockEventType, string> = {
  in: "Hyvää työvuoroa!",
  break_start: "Työaika ei kerry tauon aikana.",
  break_end: "Työaika kertyy taas.",
  out: "",
};

/**
 * Päätoiminto.
 *
 * Kosketuskohde on 60 pikseliä korkea. Peukalolla osuttava painike on
 * tämän näkymän koko tarkoitus, eikä 44 pikselin vähimmäismitta ole
 * kunnianhimoinen tavoite silloin kun kyseessä on ainoa asia jota
 * käyttäjä tuli tekemään.
 */
function PrimaryAction({
  working,
  blocked,
}: {
  working: boolean;
  blocked: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name="type"
      value={working ? "out" : "in"}
      disabled={pending || blocked}
      className="rf-press flex w-full items-center justify-center gap-2.5 text-[17px] font-semibold disabled:opacity-40"
      style={{
        minHeight: 60,
        background: blocked
          ? "var(--rf-inset)"
          : working
            ? "var(--rf-text)"
            : "var(--rf-accent)",
        color: blocked ? "var(--rf-text-3)" : "#fff",
        borderRadius: 14,
      }}
    >
      {pending ? (
        "Kirjataan…"
      ) : (
        <>
          <RfIcon name={working ? "check" : "clock"} size={20} />
          {working ? "Lopeta työvuoro" : "Aloita työvuoro"}
        </>
      )}
    </button>
  );
}

function SecondaryAction({ type, label }: { type: ClockEventType; label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name="type"
      value={type}
      disabled={pending}
      className="rf-press flex w-full items-center justify-center gap-2 text-[15px] font-medium disabled:opacity-60"
      style={{
        minHeight: 48,
        background: "var(--rf-inset)",
        color: "var(--rf-text)",
        borderRadius: 12,
      }}
    >
      {label}
    </button>
  );
}

"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { claimOpenShift, type ActionState } from "../actions";
import { shiftLengthMinutes } from "@/lib/restoflow/shift-window";
import { formatHoursMinutes } from "@/lib/restoflow/timeclock";
import type { OpenShift } from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";
import { SectionTitle, Surface, shortDay } from "../ui";
import type { WorkerText } from "@/lib/i18n/worker-text";
import type { AppLocale } from "@/lib/i18n/app-locales";
import { fill } from "@/lib/i18n/auth-text";

const initial: ActionState = {};

/**
 * Avoimet vuorot.
 *
 * Vuoro jolle ei ole tekijää. Esihenkilö saa siitä hälytyksen, mutta
 * hälytys ei tee työtä — joku on otettava vuoro.
 *
 * OTTAMINEN ON PÄÄTÖS, EI SELAILUA.
 *
 * Yksi painallus avaa vahvistuksen joka toistaa päivän, kellonajat ja
 * keston. Suoraan ottava painike olisi nopeampi, mutta väärä osuma
 * puhelimen ruudulla sitoisi ihmisen työvuoroon josta hän ei pääse irti
 * kuin ilmoittamalla poissaolon.
 *
 * OTETTUA VUOROA EI PERUTA TÄÄLTÄ.
 *
 * Otettu vuoro on vuoro. Este ilmoitetaan poissaololla, joka kertoo
 * esihenkilölle syyn — erillinen "vapauta vuoro" tekisi otetusta
 * vuorosta varauksen, jonka voi purkaa hiljaa edellisenä iltana.
 */
export function OpenShifts({
  shifts,
  t,
  locale,
}: {
  shifts: OpenShift[];
  t: WorkerText;
  locale: AppLocale;
}) {
  const [state, action] = useActionState(claimOpenShift, initial);
  const [confirming, setConfirming] = useState<string | null>(null);

  /*
   * Onnistuminen ei tarvitse omaa ilmoitusta.
   *
   * Otettu vuoro katoaa tästä listasta ja ilmestyy viikkolistaan alle.
   * Se on vahvempi kuittaus kuin vihreä palkki, koska se on itse
   * lopputulos eikä kertomus siitä.
   */
  if (shifts.length === 0 && !state.error) return null;

  return (
    <section className="space-y-2">
      <SectionTitle>{t.vuorot.openShifts}</SectionTitle>

      {state.error ? (
        <p
          role="alert"
          className="px-3.5 py-2.5 text-[13px] leading-relaxed"
          style={{
            background: "var(--rf-red-bg)",
            color: "var(--rf-red-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {state.error}
        </p>
      ) : null}

      {shifts.length === 0 ? null : (
        <>
          <Surface padded={false}>
            <div className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
              {shifts.map((shift) => (
                <Row
                  key={shift.id}
                  shift={shift}
                  action={action}
                  confirming={confirming === shift.id}
                  onAsk={() => setConfirming(shift.id)}
                  t={t}
                  locale={locale}
                  onCancel={() => setConfirming(null)}
                />
              ))}
            </div>
          </Surface>

          <p className="px-1 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
            {t.vuorot.takenNote}
          </p>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function Row({
  shift,
  action,
  confirming,
  onAsk,
  onCancel,
  t,
  locale,
}: {
  shift: OpenShift;
  action: (formData: FormData) => void;
  confirming: boolean;
  onAsk: () => void;
  onCancel: () => void;
  t: WorkerText;
  locale: AppLocale;
}) {
  const length = formatHoursMinutes(shiftLengthMinutes(shift) * 60_000);

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium">{shortDay(shift.date, locale)}</p>
          <p className="rf-tabular mt-0.5 text-[15px]">
            {shift.startTime}–{shift.endTime}
            <span className="ml-2 text-[13px]" style={{ color: "var(--rf-text-3)" }}>
              {length}
            </span>
          </p>
        </div>

        {confirming ? null : (
          <button
            type="button"
            onClick={onAsk}
            className="rf-press rf-hit shrink-0 px-3.5 py-2 text-[13px] font-semibold"
            style={{
              background: "var(--rf-inset)",
              color: "var(--rf-text)",
              borderRadius: 10,
            }}
          >
            {t.vuorot.takeShift}
          </button>
        )}
      </div>

      {confirming ? (
        <div
          className="mt-3 px-3.5 py-3"
          style={{ background: "var(--rf-inset)", borderRadius: 12 }}
        >
          <p className="text-[13px] leading-relaxed">
            {fill(t.vuorot.confirmTake, {
              paiva: shortDay(shift.date, locale),
              ajat: `${shift.startTime}–${shift.endTime}`,
            })}
          </p>

          <div className="mt-3 flex gap-2">
            <ClaimForm shiftId={shift.id} action={action} />

            <button
              type="button"
              onClick={onCancel}
              className="rf-press rf-hit px-3.5 py-2.5 text-[13px] font-medium"
              style={{ color: "var(--rf-text-2)" }}
            >
              {t.vuorot.cancel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ClaimForm({
  shiftId,
  action,
}: {
  shiftId: string;
  action: (formData: FormData) => void;
}) {
  /*
   * Kaksi painallusta samalla hetkellä on yksi pyyntö.
   *
   * Painike menee estotilaan vasta kun React on piirtänyt uudelleen,
   * eikä se ehdi kahden peräkkäisen napautuksen väliin. Kanta hylkää
   * toisen — mutta käyttäjä näkisi "joku ehti ensin" omasta
   * onnistuneesta painalluksestaan.
   */
  const submitting = useRef(false);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (submitting.current) {
          event.preventDefault();
          return;
        }
        submitting.current = true;
      }}
    >
      <input type="hidden" name="shiftId" value={shiftId} />
      <Confirm />
    </form>
  );
}

function Confirm() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold"
      style={{
        background: pending ? "var(--rf-text-3)" : "var(--rf-blue)",
        color: "#fff",
        borderRadius: 10,
      }}
    >
      {pending ? "Otetaan…" : "Vahvista"}
      {pending ? null : <RfIcon name="check" size={14} />}
    </button>
  );
}

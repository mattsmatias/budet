"use client";

import { useActionState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import type { AdminState } from "../actions";
import { setPayrollEnabled } from "../actions";

const initial: AdminState = {};

/**
 * Palkkaosion kytkin.
 *
 * YKSI PAINIKE, EI VALINTARUUTUA JA TALLENNUSTA.
 *
 * Kytkimessä on kaksi tilaa ja tallennettavaa on yksi bitti. Erillinen
 * "Tallenna" tekisi siitä kaksi vaihetta ja jättäisi välitilan jossa
 * ruutu on rastittu mutta mitään ei ole tapahtunut — ja juuri siinä
 * tilassa ihminen sulkee sivun.
 *
 * Teksti kertoo mitä painike tekee, ei mikä tila on päällä. "Ota
 * käyttöön" on lupaus seuraavasta, kun taas rastittu ruutu on väite
 * nykyisestä, ja niitä kahta luetaan eri suuntiin.
 *
 * Mitään ei poisteta. Sen sanominen tässä on tärkeämpää kuin se
 * näyttää: ilman sitä pois kytkeminen tuntuu siltä että työntekijät
 * katoavat, eikä kukaan kokeile.
 */
export function PayrollToggle({
  t,
  enabled,
}: {
  t: AdminText;
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState(setPayrollEnabled, initial);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />

      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--rf-r-stat)] p-3.5"
        style={{ background: "var(--rf-inset)" }}
      >
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold">
            {enabled ? t.asetus.payrollIsOn : t.asetus.payrollIsOff}
          </p>
          <p
            className="mt-0.5 text-[12.5px] leading-relaxed"
            style={{ color: "var(--rf-text-2)" }}
          >
            {enabled ? t.asetus.payrollOnHint : t.asetus.payrollOffHint}
          </p>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rf-press rf-touch shrink-0 px-4 text-[13px] font-semibold disabled:opacity-60"
          style={{
            borderRadius: 980,
            background: enabled ? "var(--rf-card)" : "var(--rf-accent)",
            color: enabled ? "var(--rf-text)" : "#fff",
            boxShadow: enabled ? "var(--rf-shadow-sm)" : "none",
          }}
        >
          {enabled ? t.asetus.payrollTurnOff : t.asetus.payrollTurnOn}
        </button>
      </div>

      {state.error ? (
        <p className="text-[12.5px]" style={{ color: "var(--rf-red-text)" }}>
          {state.error}
        </p>
      ) : null}

      {state.notice ? (
        <p className="text-[12.5px]" style={{ color: "var(--rf-green-text)" }}>
          {state.notice}
        </p>
      ) : null}
    </form>
  );
}

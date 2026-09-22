"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AdminText } from "@/lib/i18n/admin-text";
import type { AdminState } from "@/app/admin/actions";
import { endShift, startShift } from "@/app/admin/palkat/actions";
import { RfIcon } from "@/components/restoflow/icons";

const initial: AdminState = {};

/**
 * Yksi painike, kaksi tilaa.
 *
 * Vuorossa oleva näkee lopetuksen, muut aloituksen. Kaksi painiketta
 * vierekkäin tarkoittaisi että toinen niistä on aina väärä valinta, ja
 * väärä painallus tässä tarkoittaa väärää työaikaa.
 *
 * Painike on iso ja keskellä: sitä painetaan kiireessä, usein märillä
 * käsillä ja puhelin toisessa kädessä.
 */
export function ClockButton({
  t,
  working,
}: {
  t: AdminText;
  working: boolean;
}) {
  const [state, action] = useActionState(
    working ? endShift : startShift,
    initial,
  );

  return (
    <form action={action} className="space-y-3">
      <Painike t={t} working={working} />

      {state.error ? (
        <p
          role="alert"
          className="px-4 py-3 text-center text-[13px] font-semibold"
          style={{
            background: "var(--rf-red-bg)",
            color: "var(--rf-red-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function Painike({ t, working }: { t: AdminText; working: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press flex w-full flex-col items-center gap-3 py-12 text-[19px] font-bold disabled:opacity-60"
      style={{
        background: working ? "var(--rf-inset)" : "var(--rf-accent)",
        color: working ? "var(--rf-text-1)" : "var(--rf-on-accent)",
        borderRadius: "var(--rf-r-card)",
        boxShadow: working ? undefined : "var(--rf-shadow-lg)",
      }}
    >
      <RfIcon name={working ? "check" : "clock"} size={40} />
      {working ? t.tyo.end : t.tyo.start}
    </button>
  );
}

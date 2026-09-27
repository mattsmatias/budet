"use client";

import { useActionState } from "react";
import { markErrorsSeen } from "../actions";
import type { DevState } from "../actions";

const initial: DevState = {};

/**
 * Merkitse nähdyiksi.
 *
 * Virheitä ei poisteta: rivi on tapahtuma, ja tapahtunutta ei
 * siivota pois siksi että se on luettu. Merkintä kertoo vain että
 * joku on katsonut, jotta seuraavalla kerralla näkee mikä on uutta.
 */
export function MarkSeen() {
  const [state, action] = useActionState(markErrorsSeen, initial);

  return (
    <form action={action}>
      <button
        type="submit"
        className="rf-press px-3 text-[12.5px] font-bold"
        style={{
          height: 36,
          background: "var(--rf-inset)",
          border: "1px solid var(--rf-line-strong)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        {state.notice ?? "Merkitse nähdyiksi"}
      </button>
    </form>
  );
}

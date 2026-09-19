"use client";

import { useActionState } from "react";
import { setContactHandled, type DevState } from "../actions";

const initial: DevState = {};

/** Hoidettu / avoin. Erillinen painike, jotta muutos on tarkoituksellinen. */
export function HandledToggle({
  id,
  handled,
}: {
  id: string;
  handled: boolean;
}) {
  const [state, action, pending] = useActionState(setContactHandled, initial);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="handled" value={handled ? "false" : "true"} />

      <button
        type="submit"
        disabled={pending}
        className="rf-press px-3 py-1.5 text-[12.5px] font-bold"
        style={{
          background: handled ? "var(--rf-inset)" : "var(--rf-accent)",
          color: handled ? "var(--rf-text)" : "var(--rf-on-accent)",
          border: handled
            ? "1px solid var(--rf-line-strong)"
            : "1px solid transparent",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        {handled ? "Palauta avoimeksi" : "Merkitse hoidetuksi"}
      </button>

      {state.error ? (
        <span className="text-[12px]" style={{ color: "var(--rf-red-text)" }}>
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

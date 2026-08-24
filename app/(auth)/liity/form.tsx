"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { checkInvite } from "./actions";
import type { InviteState } from "./invite";

const initial: InviteState = {};

/**
 * Koodikenttä.
 *
 * Isot kirjaimet ja väljä kirjainväli: koodi luetaan viestistä tai
 * paperilta merkki kerrallaan, ja tiivis pikkuteksti tekee nollasta ja
 * O-kirjaimesta saman näköisiä.
 */
export function CodeForm() {
  const [state, action] = useActionState(checkInvite, initial);

  return (
    <form action={action} className="mt-6 space-y-3">
      <label className="block">
        <span className="block text-[13px] font-medium" style={{ color: "var(--rf-text-2)" }}>
          Kutsukoodi
        </span>
        <input
          name="code"
          required
          autoFocus
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="ABCD1234"
          className="mt-1.5 w-full px-4 py-3.5 text-[19px] font-semibold uppercase"
          style={{
            background: "var(--rf-card)",
            border: "1px solid var(--rf-line-strong)",
            borderRadius: "var(--rf-r-control)",
            letterSpacing: "0.14em",
          }}
        />
      </label>

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

      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press w-full text-[16px] font-semibold disabled:opacity-50"
      style={{
        minHeight: 52,
        background: "var(--rf-accent)",
        color: "#fff",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {pending ? "Tarkistetaan…" : "Jatka"}
    </button>
  );
}

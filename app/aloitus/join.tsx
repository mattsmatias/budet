"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { acceptInvitation, type AdminState } from "@/app/admin/actions";

const initial: AdminState = {};

/**
 * Liittyminen kutsukoodilla.
 *
 * Koodi kirjoitetaan käsin puhelimella, joten kenttä pakottaa isot
 * kirjaimet ja väljän kirjainvälin — pienet kirjaimet ja tiheä teksti
 * tuottavat kirjoitusvirheitä.
 */
export function JoinForm() {
  const [state, action] = useActionState(acceptInvitation, initial);
  const [code, setCode] = useState("");

  if (state.notice) {
    return (
      <div
        className="px-4 py-3.5 text-[14px] leading-relaxed"
        style={{
          background: "var(--rf-green-bg)",
          color: "var(--rf-green-text)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <p className="font-semibold">{state.notice}</p>
        <a
          href="/admin"
          className="mt-3 inline-block font-medium underline underline-offset-4"
        >
          Jatka sovellukseen
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="join-code" className="block text-[13px] font-medium">
          Kutsukoodi
        </label>
        <input
          id="join-code"
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          maxLength={8}
          placeholder="ABCD2345"
          className="rf-tabular mt-1.5 w-full px-3.5 py-3 text-center text-[22px] font-semibold uppercase tracking-[0.16em] outline-none"
          style={{
            background: "var(--rf-inset)",
            borderRadius: "var(--rf-r-control)",
          }}
        />
        <p className="mt-1.5 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          Saat koodin ravintolan omistajalta. Kahdeksan merkkiä.
        </p>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="px-3.5 py-2.5 text-[13px]"
          style={{
            background: "var(--rf-red-bg)",
            color: "var(--rf-red-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {state.error}
        </p>
      ) : null}

      <Submit disabled={code.length < 8} />
    </form>
  );
}

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rf-press w-full py-3 text-[15px] font-semibold disabled:opacity-40"
      style={{
        background: "var(--rf-text)",
        color: "#fff",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {pending ? "Liitytään…" : "Liity ravintolaan"}
    </button>
  );
}

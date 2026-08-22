"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createRestaurant, type SetupState } from "./actions";

const initial: SetupState = {};

const TIMEZONES = [
  ["Europe/Helsinki", "Helsinki (UTC+2)"],
  ["Europe/Stockholm", "Tukholma (UTC+1)"],
  ["Europe/Copenhagen", "Kööpenhamina (UTC+1)"],
  ["Europe/Oslo", "Oslo (UTC+1)"],
  ["Europe/Tallinn", "Tallinna (UTC+2)"],
];

export function SetupForm() {
  const [state, action] = useActionState(createRestaurant, initial);

  return (
    <form action={action} className="mt-7 space-y-4">
      <div>
        <label htmlFor="name" className="block text-[13px] font-medium">
          Ravintolan nimi
        </label>
        <input
          id="name"
          name="name"
          required
          autoComplete="organization"
          placeholder="Ravintola Linnea"
          className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
          style={{
            background: "var(--rf-inset)",
            borderRadius: "var(--rf-r-control)",
          }}
        />
      </div>

      <div>
        <label htmlFor="timezone" className="block text-[13px] font-medium">
          Aikavyöhyke
        </label>
        <select
          id="timezone"
          name="timezone"
          defaultValue="Europe/Helsinki"
          className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
          style={{
            background: "var(--rf-inset)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {TIMEZONES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          Työaika lasketaan tässä ajassa.
        </p>
      </div>

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
      className="rf-press w-full py-3 text-[15px] font-semibold disabled:opacity-50"
      style={{
        background: "var(--rf-accent)",
        color: "var(--rf-on-accent)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {pending ? "Luodaan…" : "Luo ravintola"}
    </button>
  );
}

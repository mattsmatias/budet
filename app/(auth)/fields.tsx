"use client";

import { useFormStatus } from "react-dom";
import type { FormState } from "./actions";

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
}) {
  const id = `f-${name}`;

  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
        style={{
          background: "var(--rf-inset)",
          borderRadius: "var(--rf-r-control)",
          color: "var(--rf-text)",
        }}
      />
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Message({ state }: { state: FormState }) {
  if (state.error) {
    return (
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
    );
  }

  if (state.notice) {
    return (
      <p
        role="status"
        className="px-3.5 py-2.5 text-[13px] leading-relaxed"
        style={{
          background: "var(--rf-green-bg)",
          color: "var(--rf-green-text)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        {state.notice}
      </p>
    );
  }

  return null;
}

export function Submit({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press w-full py-3 text-[15px] font-semibold disabled:opacity-50"
      style={{
        background: "var(--rf-text)",
        color: "#fff",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {pending ? busy : idle}
    </button>
  );
}

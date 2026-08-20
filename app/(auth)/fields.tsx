"use client";

import { useFormStatus } from "react-dom";
import type { FormState } from "./actions";

export function AuthField({
  label,
  name,
  type = "text",
  autoComplete,
  required,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
  hint?: string;
}) {
  const id = `field-${name}`;
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-navy-100">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        defaultValue={defaultValue}
        aria-describedby={hintId}
        className="mt-1.5 w-full rounded-md border border-navy-600 bg-navy-800 px-3 py-2 text-sm text-navy-50 placeholder:text-navy-400 focus:border-gold-400"
      />
      {hint ? (
        <p id={hintId} className="mt-1 text-xs text-navy-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function AuthMessage({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-md bg-risk-100 px-3 py-2 text-sm text-risk-600">
        {state.error}
      </p>
    );
  }
  if (state.notice) {
    return (
      <p role="status" className="rounded-md bg-ok-100 px-3 py-2 text-sm text-ok-600">
        {state.notice}
      </p>
    );
  }
  return null;
}

export function SubmitButton({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-gold-400 px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-gold-300 disabled:opacity-60"
    >
      {pending ? busy : idle}
    </button>
  );
}

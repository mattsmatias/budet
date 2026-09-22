"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "./actions";

const ICONS = {
  mail: "M3.5 6.5h17v11h-17zM3.8 7l8.2 6 8.2-6",
  lock: "M6.5 11h11v9h-11zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0",
} as const;

/**
 * Lomakekenttä.
 *
 * Kuvake kertoo kentän tarkoituksen jo ennen otsikon lukemista, ja
 * kohdistus näkyy tunnusvärin renkaana. Salasanakenttään voi pyytää
 * näytä/piilota-painikkeen: puhelimella kirjoitusvirhe on yleinen, ja
 * sen näkeminen on nopeampi kuin uusi yritys.
 */
export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required,
  hint,
  icon,
  reveal,
  aside,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  icon?: keyof typeof ICONS;
  /** Näytä/piilota-painikkeen tekstit ruudunlukijalle. */
  reveal?: { show: string; hide: string };
  /** Otsikkorivin oikeaan reunaan, esim. unohtuneen salasanan linkki. */
  aside?: ReactNode;
}) {
  const id = `f-${name}`;
  const [shown, setShown] = useState(false);
  const inputType = reveal && shown ? "text" : type;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="block text-[13px] font-semibold">
          {label}
        </label>
        {aside}
      </div>
      <div className="rf-auth-field mt-1.5">
        {icon ? (
          <svg
            className="rf-auth-field-icon"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            aria-hidden="true"
          >
            <path
              d={ICONS[icon]}
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
        <input
          id={id}
          name={name}
          type={inputType}
          autoComplete={autoComplete}
          required={required}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={`rf-auth-input ${icon ? "ps-11" : "ps-3.5"} ${reveal ? "pe-12" : "pe-3.5"}`}
        />
        {reveal ? (
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-label={shown ? reveal.hide : reveal.show}
            aria-pressed={shown}
            className="rf-auth-reveal"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
              <path
                d={
                  shown
                    ? "M3 3l18 18M10.6 5.2A9.8 9.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7a13 13 0 0 1-2.6 3.8M6.2 6.6C4.3 8 3 10 2.5 12c1 2.5 4.5 7 9.5 7 1.6 0 3-.4 4.3-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2"
                    : "M2.5 12C3.5 9.5 7 5 12 5s8.5 4.5 9.5 7c-1 2.5-4.5 7-9.5 7s-8.5-4.5-9.5-7ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                }
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
      </div>
      {hint ? (
        <p
          id={`${id}-hint`}
          className="mt-1 text-[12px]"
          style={{ color: "var(--rf-text-3)" }}
        >
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
      className="rf-press rf-auth-submit w-full py-3.5 text-[15px] font-semibold"
    >
      {pending ? <span className="rf-auth-spinner" aria-hidden="true" /> : null}
      {pending ? busy : idle}
      {pending ? null : (
        <span className="rf-auth-arrow" aria-hidden="true">
          →
        </span>
      )}
    </button>
  );
}

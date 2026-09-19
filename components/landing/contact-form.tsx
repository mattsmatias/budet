"use client";

import { useActionState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/locales";
import { submitContact, type ContactState } from "./contact-actions";

const INITIAL: ContactState = { status: "idle" };

/**
 * Yhteydenottolomake.
 *
 * Kolme pakollista kenttää ja kaksi vapaaehtoista. Enempää ei tarvita
 * siihen, että voimme soittaa takaisin ja luoda tunnukset — jokainen
 * lisäkenttä on syy jättää lomake kesken.
 */
export function ContactForm({
  t,
  locale,
}: {
  t: Dictionary["contact"];
  locale: Locale;
}) {
  const [state, action, pending] = useActionState(submitContact, INITIAL);

  if (state.status === "sent") {
    return (
      <div className="bd-contact-card bd-contact-sent" role="status">
        <span className="bd-contact-sent-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
            />
          </svg>
        </span>
        <p className="mt-4 text-[20px] font-extrabold tracking-[-0.02em]">
          {t.sentTitle}
        </p>
        <p
          className="mt-2 text-[15px] leading-relaxed"
          style={{ color: "var(--bd-text-2)" }}
        >
          {t.sentBody}
        </p>
      </div>
    );
  }

  const error =
    state.status === "error"
      ? {
          required: t.errRequired,
          email: t.errEmail,
          rate: t.errRate,
          generic: t.errGeneric,
        }[state.code]
      : null;

  return (
    <form action={action} className="bd-contact-card" noValidate>
      <input type="hidden" name="locale" value={locale} />

      {/* Piilokenttä boteille. Ihminen ei näe eikä täytä sitä. */}
      <div aria-hidden="true" className="bd-honeypot">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.name} name="name" autoComplete="name" required />
        <Field
          label={t.restaurant}
          name="restaurant"
          autoComplete="organization"
          required
        />
        <Field
          label={t.email}
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <Field label={t.phone} name="phone" type="tel" autoComplete="tel" />
      </div>

      <label className="mt-4 block">
        <span className="bd-label">{t.message}</span>
        <textarea
          name="message"
          rows={4}
          maxLength={2000}
          placeholder={t.messagePlaceholder}
          className="bd-input resize-y"
        />
      </label>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-[10px] px-3.5 py-2.5 text-[14px]"
          style={{
            background: "var(--bd-accent-bg)",
            color: "var(--bd-accent-strong)",
          }}
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="bd-btn bd-btn-primary mt-5 w-full"
      >
        {pending ? t.sending : t.submit}
        {pending ? null : (
          <span className="bd-arrow" aria-hidden="true">
            →
          </span>
        )}
      </button>

      <p
        className="mt-3 text-center text-[12.5px]"
        style={{ color: "var(--bd-text-3)" }}
      >
        {t.privacy}
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="bd-label">
        {label}
        {required ? (
          <span aria-hidden="true" style={{ color: "var(--bd-accent)" }}>
            {" "}
            *
          </span>
        ) : null}
      </span>
      <input
        type={type}
        name={name}
        autoComplete={autoComplete}
        required={required}
        maxLength={name === "phone" ? 40 : 200}
        className="bd-input"
      />
    </label>
  );
}

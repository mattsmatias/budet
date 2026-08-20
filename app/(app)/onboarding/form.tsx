"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createOrganization, type OnboardingState } from "./actions";

const initial: OnboardingState = {};

const COUNTRIES = [
  ["FI", "Suomi"],
  ["SE", "Ruotsi"],
  ["DK", "Tanska"],
  ["DE", "Saksa"],
  ["EE", "Viro"],
  ["ES", "Espanja"],
];

const SOFTWARE = ["Procountor", "Netvisor", "e-conomic", "Fennoa", "Muu", "Ei mitään"];

export function OnboardingForm() {
  const [state, formAction] = useActionState(createOrganization, initial);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <Field label="Organisaation nimi" name="name" required autoComplete="organization" />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Maa" name="country" options={COUNTRIES} />
        <Select
          label="Tyyppi"
          name="kind"
          options={[
            ["company", "Yritys"],
            ["accounting_firm", "Tilitoimisto"],
          ]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Y-tunnus" name="businessId" hint="Valinnainen" />
        <Field label="ALV-tunniste" name="vatId" hint="Valinnainen, esim. FI12345678" />
      </div>

      <Select
        label="Kirjanpito-ohjelma"
        name="accountingSoftware"
        options={SOFTWARE.map((s) => [s, s] as [string, string])}
      />

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="vatRegistered"
          defaultChecked
          className="mt-0.5 h-4 w-4 rounded border-line"
        />
        <span>
          Organisaatio on ALV-rekisterissä
          <span className="mt-0.5 block text-xs text-muted">
            Vaikuttaa siihen mitä sääntöjä sovelletaan.
          </span>
        </span>
      </label>

      {state.error ? (
        <p role="alert" className="rounded-md bg-risk-100 px-3 py-2 text-sm text-risk-600">
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
      className="w-full rounded-md bg-gold-400 px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-gold-300 disabled:opacity-60"
    >
      {pending ? "Luodaan…" : "Luo organisaatio"}
    </button>
  );
}

function Field({
  label,
  name,
  required,
  hint,
  autoComplete,
}: {
  label: string;
  name: string;
  required?: boolean;
  hint?: string;
  autoComplete?: string;
}) {
  const id = `ob-${name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        required={required}
        autoComplete={autoComplete}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-1.5 w-full rounded-md border border-line bg-background px-3 py-2 text-sm"
      />
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Select({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: [string, string][] | string[][];
}) {
  const id = `ob-${name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        name={name}
        className="mt-1.5 w-full rounded-md border border-line bg-background px-3 py-2 text-sm"
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

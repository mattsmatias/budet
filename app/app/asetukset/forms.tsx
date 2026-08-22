"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { changePassword, updateProfile, type ActionState } from "../actions";

const initial: ActionState = {};

export function ProfileForm({ fullName }: { fullName: string }) {
  const [state, action] = useActionState(updateProfile, initial);

  return (
    <form action={action} className="mt-3 space-y-3">
      <Field
        label="Nimi"
        name="fullName"
        defaultValue={fullName}
        autoComplete="name"
        required
      />

      <Feedback state={state} />
      <Submit idle="Tallenna nimi" busy="Tallennetaan…" />

      <p className="text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
        Nimi näkyy esihenkilölle työvuoroissa ja työaikakirjauksissa.
      </p>
    </form>
  );
}

/**
 * Salasanan vaihto.
 *
 * Vanhaa salasanaa ei kysytä: Supabase vaatii voimassa olevan
 * istunnon, joten kutsuja on jo todistanut olevansa kirjautunut.
 * Kysytty mutta tarkistamaton vanha salasana olisi teatteria.
 */
export function PasswordForm() {
  const [state, action] = useActionState(changePassword, initial);

  return (
    <form action={action} className="mt-3 space-y-3">
      <Field
        label="Uusi salasana"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="Vähintään 8 merkkiä."
      />

      <Field
        label="Uusi salasana uudelleen"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
      />

      <Feedback state={state} />
      <Submit idle="Vaihda salasana" busy="Vaihdetaan…" />
    </form>
  );
}

// ---------------------------------------------------------------------------

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  autoComplete,
  required,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
}) {
  const id = `p-${name}`;

  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        required={required}
        className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
        style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
      />
      {hint ? (
        <p className="mt-1 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Feedback({ state }: { state: ActionState }) {
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
        className="px-3.5 py-2.5 text-[13px] font-medium"
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

function Submit({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press w-full py-2.5 text-[14px] font-semibold disabled:opacity-50"
      style={{ background: "var(--rf-text)", color: "var(--rf-on-accent)", borderRadius: "var(--rf-r-control)" }}
    >
      {pending ? busy : idle}
    </button>
  );
}

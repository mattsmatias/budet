"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  changePassword,
  updateBirthday,
  updateProfile,
  type ActionState,
} from "../actions";
import type { WorkerText } from "@/lib/i18n/worker-text";

const initial: ActionState = {};

export function ProfileForm({
  fullName,
  t,
}: {
  fullName: string;
  t: WorkerText;
}) {
  const [state, action] = useActionState(updateProfile, initial);

  return (
    <form action={action} className="mt-3 space-y-3">
      <Field
        label={t.asetukset.name}
        name="fullName"
        defaultValue={fullName}
        autoComplete="name"
        required
      />

      <Feedback state={state} />
      <Submit idle={t.asetukset.saveName} busy={t.yleinen.saving} />

      <p
        className="text-[12px] leading-relaxed"
        style={{ color: "var(--rf-text-3)" }}
      >
        {t.asetukset.nameHint}
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
export function PasswordForm({ t }: { t: WorkerText }) {
  const [state, action] = useActionState(changePassword, initial);

  return (
    <form action={action} className="mt-3 space-y-3">
      <Field
        label={t.asetukset.newPassword}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint={t.yleinen.min8}
      />

      <Field
        label={t.asetukset.newPasswordAgain}
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
      />

      <Feedback state={state} />
      <Submit idle={t.asetukset.changePassword} busy={t.asetukset.changing} />
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
        style={{
          background: "var(--rf-inset)",
          borderRadius: "var(--rf-r-control)",
        }}
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
      style={{
        background: "var(--rf-accent)",
        color: "var(--rf-on-accent)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {pending ? busy : idle}
    </button>
  );
}

/**
 * Syntymäpäivä työyhteisöä varten.
 *
 * Selaimen date-kenttä vaatii vuoden, mutta sitä ei tallenneta.
 * Vaihtoehto olisi kaksi erillistä valikkoa päivälle ja kuukaudelle;
 * se olisi tarkempi mutta hitaampi täyttää, ja kenttä täytetään kerran.
 */
export function BirthdayForm({
  birthDay,
  birthMonth,
  t,
}: {
  birthDay: number | null;
  birthMonth: number | null;
  t: WorkerText;
}) {
  const [state, action] = useActionState(updateBirthday, initial);

  // Vuosi on kentän pakko, ei tieto. 2000 on karkausvuosi, joten 29.2.
  // kelpaa myös.
  const current =
    birthDay && birthMonth
      ? `2000-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`
      : "";

  return (
    <form action={action} className="mt-3 space-y-3">
      <label className="block">
        <span
          className="block text-[13px] font-medium"
          style={{ color: "var(--rf-text-2)" }}
        >
          {t.asetukset.birthday}
        </span>
        <input
          type="date"
          name="birthday"
          defaultValue={current}
          className="mt-1.5 w-full px-3.5 py-2.5 text-[15px]"
          style={{
            background: "var(--rf-card)",
            border: "1px solid var(--rf-line-strong)",
            borderRadius: "var(--rf-r-control)",
          }}
        />
      </label>

      <Feedback state={state} />
      <Submit idle={t.asetukset.saveBirthday} busy={t.yleinen.saving} />

      <p
        className="text-[12px] leading-relaxed"
        style={{ color: "var(--rf-text-3)" }}
      >
        {t.asetukset.birthdayNote}
      </p>
    </form>
  );
}

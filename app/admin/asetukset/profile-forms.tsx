"use client";

import { useActionState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import { changePassword, updateProfile } from "@/app/app/actions";
import type { AdminState } from "../actions";
import { CONTROL, CONTROL_STYLE, Field, SaveRow } from "./form-parts";

/**
 * Oman tunnuksen asetukset.
 *
 * Toiminnot ovat työntekijäpuolen moduulissa eikä niitä monisteta
 * tänne: nimi ja salasana ovat samat riippumatta siitä kummasta
 * näkymästä ne vaihdetaan, ja kaksi kopiota samasta toiminnosta
 * ajautuisi erilleen ensimmäisen korjauksen kohdalla.
 */
const initial: AdminState = {};

export function NameForm({ t, fullName }: { t: AdminText; fullName: string }) {
  const [state, action] = useActionState(updateProfile, initial);

  return (
    <form action={action} className="space-y-4">
      <Field
        label={t.asetus.yourName}
        htmlFor="rf-fullname"
        hint={t.asetus.yourNameHint}
      >
        <input
          id="rf-fullname"
          name="fullName"
          defaultValue={fullName}
          required
          maxLength={120}
          autoComplete="name"
          className={CONTROL}
          style={CONTROL_STYLE}
        />
      </Field>

      <SaveRow t={t} state={state} />
    </form>
  );
}

export function PasswordForm({ t }: { t: AdminText }) {
  const [state, action] = useActionState(changePassword, initial);

  return (
    <form action={action} className="space-y-4">
      <Field
        label={t.asetus.newPassword}
        htmlFor="rf-pw"
        hint={t.asetus.newPasswordHint}
      >
        <input
          id="rf-pw"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={CONTROL}
          style={CONTROL_STYLE}
        />
      </Field>

      <Field label={t.asetus.newPasswordAgain} htmlFor="rf-pw2">
        <input
          id="rf-pw2"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={CONTROL}
          style={CONTROL_STYLE}
        />
      </Field>

      <SaveRow t={t} state={state} label={t.asetus.changePassword} />
    </form>
  );
}

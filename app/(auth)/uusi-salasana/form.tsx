"use client";

import { useActionState } from "react";
import { setNewPassword, type FormState } from "../actions";
import { Field, Message, Submit } from "../fields";
import type { AuthText } from "@/lib/i18n/auth-text";

const initial: FormState = {};

export function NewPasswordForm({ t }: { t: AuthText }) {
  const [state, action] = useActionState(setNewPassword, initial);

  return (
    <form action={action} className="mt-6 space-y-4">
      <Field
        label={t.kentat.newPassword}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint={t.kentat.min8}
      />

      <Field
        label={t.kentat.newPasswordAgain}
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
      />

      <Message state={state} />

      <Submit idle={t.uusiSalasana.idle} busy={t.uusiSalasana.busy} />
    </form>
  );
}

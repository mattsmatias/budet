"use client";

import { useActionState } from "react";
import { signUp, type FormState } from "../actions";
import { Field, Message, Submit } from "../fields";
import type { AuthText } from "@/lib/i18n/auth-text";

const initial: FormState = {};

export function SignUpForm({ joining, t }: { joining?: boolean; t: AuthText }) {
  const [state, action] = useActionState(signUp, initial);

  return (
    <form action={action} className="mt-7 space-y-4">
      {joining ? <input type="hidden" name="tila" value="liity" /> : null}
      <Field
        label={t.kentat.name}
        name="fullName"
        autoComplete="name"
        required
      />
      <Field
        label={t.kentat.email}
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <Field
        label={t.kentat.password}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint={t.kentat.min8}
      />
      <Message state={state} />
      <Submit idle={t.rekisteroidy.idle} busy={t.rekisteroidy.busy} />
    </form>
  );
}

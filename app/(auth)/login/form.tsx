"use client";

import { useActionState } from "react";
import { signIn, type FormState } from "../actions";
import { AuthField, AuthMessage, SubmitButton } from "../fields";

const initial: FormState = {};

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signIn, initial);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />

      <AuthField
        label="Sähköposti"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <AuthField
        label="Salasana"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />

      <AuthMessage state={state} />
      <SubmitButton idle="Kirjaudu" busy="Kirjaudutaan…" />
    </form>
  );
}

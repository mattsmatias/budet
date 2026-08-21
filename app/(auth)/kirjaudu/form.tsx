"use client";

import { useActionState } from "react";
import { signIn, type FormState } from "../actions";
import { Field, Message, Submit } from "../fields";

const initial: FormState = {};

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, initial);

  return (
    <form action={action} className="mt-7 space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Sähköposti" name="email" type="email" autoComplete="email" required />
      <Field
        label="Salasana"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <Message state={state} />
      <Submit idle="Kirjaudu" busy="Kirjaudutaan…" />
    </form>
  );
}

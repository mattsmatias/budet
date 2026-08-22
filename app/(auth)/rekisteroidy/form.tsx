"use client";

import { useActionState } from "react";
import { signUp, type FormState } from "../actions";
import { Field, Message, Submit } from "../fields";

const initial: FormState = {};

export function SignUpForm({ joining }: { joining?: boolean }) {
  const [state, action] = useActionState(signUp, initial);

  return (
    <form action={action} className="mt-7 space-y-4">
      {joining ? <input type="hidden" name="tila" value="liity" /> : null}
      <Field label="Nimi" name="fullName" autoComplete="name" required />
      <Field label="Sähköposti" name="email" type="email" autoComplete="email" required />
      <Field
        label="Salasana"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="Vähintään 8 merkkiä."
      />
      <Message state={state} />
      <Submit idle="Luo tunnus" busy="Luodaan…" />
    </form>
  );
}

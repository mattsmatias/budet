"use client";

import { useActionState } from "react";
import { setNewPassword, type FormState } from "../actions";
import { Field, Message, Submit } from "../fields";

const initial: FormState = {};

export function NewPasswordForm() {
  const [state, action] = useActionState(setNewPassword, initial);

  return (
    <form action={action} className="mt-6 space-y-4">
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

      <Message state={state} />

      <Submit idle="Aseta salasana" busy="Tallennetaan…" />
    </form>
  );
}

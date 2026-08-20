"use client";

import { useActionState } from "react";
import { signUp, type FormState } from "../actions";
import { AuthField, AuthMessage, SubmitButton } from "../fields";

const initial: FormState = {};

export function SignUpForm() {
  const [state, formAction] = useActionState(signUp, initial);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <AuthField label="Nimi" name="fullName" autoComplete="name" required />
      <AuthField label="Sähköposti" name="email" type="email" autoComplete="email" required />
      <AuthField
        label="Salasana"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="Vähintään 8 merkkiä."
      />

      <AuthMessage state={state} />
      <SubmitButton idle="Luo tunnus" busy="Luodaan…" />

      <p className="text-xs leading-relaxed text-navy-400">
        Luomalla tunnuksen hyväksyt käyttöehdot ja tietosuojaselosteen.
      </p>
    </form>
  );
}

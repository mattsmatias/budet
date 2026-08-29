"use client";

import { useActionState } from "react";
import { signIn, type FormState } from "../actions";
import { Field, Message, Submit } from "../fields";
import type { AuthText } from "@/lib/i18n/auth-text";

const initial: FormState = {};

/**
 * Tekstit tulevat propsina, ei omasta hausta.
 *
 * Lomake on selainkomponentti; kielen ratkaisu lukee evästeen ja
 * profiilin ja kuuluu palvelimelle. Sivu hakee tekstit kerran ja antaa
 * ne tänne — sama kuvio kuin julkisilla sivuilla.
 */
export function SignInForm({ next, t }: { next: string; t: AuthText }) {
  const [state, action] = useActionState(signIn, initial);

  return (
    <form action={action} className="mt-7 space-y-4">
      <input type="hidden" name="next" value={next} />
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
        autoComplete="current-password"
        required
      />
      <Message state={state} />
      <Submit idle={t.kirjaudu.idle} busy={t.kirjaudu.busy} />
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { requestPasswordReset, type FormState } from "../actions";
import { Field, Message, Submit } from "../fields";

const initial: FormState = {};

export function ResetRequestForm() {
  const [state, action] = useActionState(requestPasswordReset, initial);

  return (
    <form action={action} className="mt-6 space-y-4">
      <Field
        label="Sähköposti"
        name="email"
        type="email"
        autoComplete="email"
        required
      />

      <Message state={state} />

      <Submit idle="Lähetä palautuslinkki" busy="Lähetetään…" />

      <p className="text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
        Vastaus on sama riippumatta siitä onko osoitteella tiliä. Näin
        kukaan ei voi selvittää kokeilemalla kenellä on tunnus.
      </p>
    </form>
  );
}

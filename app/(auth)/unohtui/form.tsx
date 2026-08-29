"use client";

import { useActionState } from "react";
import { requestPasswordReset, type FormState } from "../actions";
import { Field, Message, Submit } from "../fields";
import type { AuthText } from "@/lib/i18n/auth-text";

const initial: FormState = {};

export function ResetRequestForm({ t }: { t: AuthText }) {
  const [state, action] = useActionState(requestPasswordReset, initial);

  return (
    <form action={action} className="mt-6 space-y-4">
      <Field
        label={t.kentat.email}
        name="email"
        type="email"
        autoComplete="email"
        required
      />

      <Message state={state} />

      <Submit idle={t.unohtui.idle} busy={t.unohtui.busy} />

      <p
        className="text-[12px] leading-relaxed"
        style={{ color: "var(--rf-text-3)" }}
      >
        {t.unohtui.privacyNote}
      </p>
    </form>
  );
}

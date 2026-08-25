"use client";

import { useActionState } from "react";
import { changePassword, updateProfile } from "@/app/app/actions";
import type { AdminState } from "../actions";
import { CONTROL, CONTROL_STYLE, Field, SaveRow } from "./form-parts";

/**
 * Oman tunnuksen asetukset.
 *
 * Toiminnot ovat työntekijäpuolen moduulissa eikä niitä monisteta
 * tänne: nimi ja salasana ovat samat riippumatta siitä kummasta
 * näkymästä ne vaihdetaan, ja kaksi kopiota samasta toiminnosta
 * ajautuisi erilleen ensimmäisen korjauksen kohdalla.
 */
const initial: AdminState = {};

export function NameForm({ fullName }: { fullName: string }) {
  const [state, action] = useActionState(updateProfile, initial);

  return (
    <form action={action} className="space-y-4">
      <Field
        label="Nimesi"
        htmlFor="rf-fullname"
        hint="Näkyy vuorolistassa, kuittien kirjaajana ja työyhteisössä. Sama nimi kaikkialla — ei erillistä näyttönimeä."
      >
        <input
          id="rf-fullname"
          name="fullName"
          defaultValue={fullName}
          required
          maxLength={120}
          autoComplete="name"
          className={CONTROL}
          style={CONTROL_STYLE}
        />
      </Field>

      <SaveRow state={state} />
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, initial);

  return (
    <form action={action} className="space-y-4">
      <Field
        label="Uusi salasana"
        htmlFor="rf-pw"
        hint="Vähintään kahdeksan merkkiä. Vanhaa salasanaa ei kysytä, koska olet jo kirjautuneena — jos istunto on vanhentunut, vaihto ei onnistu."
      >
        <input
          id="rf-pw"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={CONTROL}
          style={CONTROL_STYLE}
        />
      </Field>

      <Field label="Uusi salasana uudelleen" htmlFor="rf-pw2">
        <input
          id="rf-pw2"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={CONTROL}
          style={CONTROL_STYLE}
        />
      </Field>

      <SaveRow state={state} label="Vaihda salasana" />
    </form>
  );
}

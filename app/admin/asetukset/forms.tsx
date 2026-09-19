"use client";

import { useActionState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import { updateRestaurant, type AdminState } from "../actions";
import { CONTROL, CONTROL_STYLE, Field, SaveRow } from "./form-parts";

const initial: AdminState = {};

/**
 * Aikavyöhykkeet joita ravintola voi valita.
 *
 * Lyhyt lista täydellisen IANA-luettelon sijaan: sadan vaihtoehdon
 * pudotusvalikosta oikean löytäminen on vaikeampaa kuin kahdeksan.
 * Kanta hyväksyy minkä tahansa kelvollisen vyöhykkeen, joten listaa voi
 * laajentaa ilman migraatiota.
 */
const TIMEZONES = [
  "Europe/Helsinki",
  "Europe/Stockholm",
  "Europe/Oslo",
  "Europe/Copenhagen",
  "Europe/Tallinn",
  "Europe/Riga",
  "Europe/London",
  "Europe/Berlin",
] as const;

export function RestaurantForm({
  t,
  name,
  timezone,
}: {
  t: AdminText;
  name: string;
  timezone: string;
}) {
  const [state, action] = useActionState(updateRestaurant, initial);

  return (
    <form action={action} className="space-y-4">
      <Field label={t.asetus.restaurantName} htmlFor="rf-name">
        <input
          id="rf-name"
          name="name"
          defaultValue={name}
          required
          maxLength={120}
          className={CONTROL}
          style={CONTROL_STYLE}
        />
      </Field>

      <Field
        label={t.asetus.timezone}
        htmlFor="rf-tz"
        hint={t.asetus.timezoneHint}
      >
        <select
          id="rf-tz"
          name="timezone"
          defaultValue={timezone}
          className={CONTROL}
          style={CONTROL_STYLE}
        >
          {(TIMEZONES as readonly string[]).includes(timezone) ? null : (
            <option value={timezone}>{timezone}</option>
          )}
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </Field>

      <SaveRow t={t} state={state} />
    </form>
  );
}

// ---------------------------------------------------------------------------

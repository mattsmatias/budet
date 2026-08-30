"use client";

import { useActionState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import {
  updateRestaurant,
  updateShiftRules,
  type AdminState,
} from "../actions";
import { CONTROL, CONTROL_STYLE, Field, SaveRow, Toggle } from "./form-parts";

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

/**
 * Vuoro- ja leimaussäännöt.
 *
 * Kaksi asetusta jotka koskevat samaa asiaa: mitä työntekijä saa tehdä
 * omalle vuorolleen. Ne olivat eri paikoissa — toinen ravintolan
 * lomakkeessa, toista ei voinut muuttaa lainkaan.
 */
export function ShiftRulesForm({
  t,
  clockInEarlyMinutes,
  openShiftClaiming,
}: {
  t: AdminText;
  clockInEarlyMinutes: number;
  openShiftClaiming: boolean;
}) {
  const [state, action] = useActionState(updateShiftRules, initial);

  return (
    <form action={action} className="space-y-4">
      <Field
        label={t.asetus.clockWindow}
        htmlFor="rf-early"
        hint={t.asetus.clockWindowHint}
      >
        <div className="flex items-center gap-3">
          <input
            id="rf-early"
            name="clockInEarlyMinutes"
            type="number"
            min={0}
            max={240}
            step={5}
            defaultValue={clockInEarlyMinutes}
            required
            className={`${CONTROL} rf-tabular max-w-[8rem]`}
            style={CONTROL_STYLE}
          />
          <span className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            minuuttia
          </span>
        </div>
      </Field>

      <Toggle
        name="openShiftClaiming"
        defaultChecked={openShiftClaiming}
        label={t.asetus.openShiftPickup}
        hint={t.asetus.openShiftPickupHint}
      />

      <SaveRow t={t} state={state} />
    </form>
  );
}

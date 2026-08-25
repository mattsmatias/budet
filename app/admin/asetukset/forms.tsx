"use client";

import { useActionState } from "react";
import { updateRestaurant, updateShiftRules, type AdminState } from "../actions";
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
  name,
  timezone,
}: {
  name: string;
  timezone: string;
}) {
  const [state, action] = useActionState(updateRestaurant, initial);

  return (
    <form action={action} className="space-y-4">
      <Field label="Ravintolan nimi" htmlFor="rf-name">
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
        label="Aikavyöhyke"
        htmlFor="rf-tz"
        hint="Työaika, vuorojen päivät ja kuukausirajat lasketaan tässä ajassa. Palvelin käy UTC:ssä, joten väärä vyöhyke siirtäisi yövuorot väärälle päivälle."
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

      <SaveRow state={state} />
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
  clockInEarlyMinutes,
  openShiftClaiming,
}: {
  clockInEarlyMinutes: number;
  openShiftClaiming: boolean;
}) {
  const [state, action] = useActionState(updateShiftRules, initial);

  return (
    <form action={action} className="space-y-4">
      <Field
        label="Leimausikkuna ennen vuoroa"
        htmlFor="rf-early"
        hint="Kuinka monta minuuttia ennen vuoron alkua sisään saa leimata. Täsmälleen alkuhetkellä painaminen olisi kohtuuton vaatimus — töihin tullaan hetkeä ennen. Nolla tarkoittaa ettei etukäteen voi leimata lainkaan."
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
        label="Työntekijä voi ottaa avoimen vuoron"
        hint="Työntekijä näkee oman asemansa avoimet vuorot ja voi ottaa niistä yhden itselleen. Päällekkäiset vuorot estyvät. Ilman tätä avoimet vuorot näkyvät vain sinulle."
      />

      <SaveRow state={state} />
    </form>
  );
}

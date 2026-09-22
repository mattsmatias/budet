"use client";

import { useActionState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import type { AdminState } from "../actions";
import { updatePayrollSettings } from "./payroll-actions";
import { CONTROL, CONTROL_STYLE, Field, SaveRow } from "./form-parts";
import { formatPercent, type PayrollSettings } from "@/lib/restoflow/payroll";

const initial: AdminState = {};

/** 1080 → "18:00". */
function kello(minuutit: number): string {
  const h = Math.floor(minuutit / 60);
  const m = minuutit % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Palkkakulujen asetukset.
 *
 * Prosentit ovat prosentteja kentässä ja osuuksia kannassa: käyttäjä
 * kirjoittaa 23 eikä 0,23. Yksikkö on kentän vieressä, koska ilman
 * sitä sama luku tarkoittaisi kahta eri asiaa.
 *
 * Tyhjä kenttä on nolla eikä virhe. Yritys jolla ei ole iltalisää ei
 * joudu keksimään sille arvoa.
 */
export function PayrollForm({
  t,
  settings,
}: {
  t: AdminText;
  settings: PayrollSettings;
}) {
  const [state, action] = useActionState(updatePayrollSettings, initial);

  return (
    <form action={action} className="space-y-4">
      <p
        className="text-[13px] leading-relaxed"
        style={{ color: "var(--rf-text-2)" }}
      >
        {t.palkkaAs.lead}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Percent
          t={t}
          label={t.palkkaAs.sideCost}
          hint={t.palkkaAs.sideCostHint}
          name="sideCost"
          value={settings.sideCostRate}
        />
        <Percent
          t={t}
          label={t.palkkaAs.holiday}
          hint={t.palkkaAs.holidayHint}
          name="holiday"
          value={settings.holidayRate}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Percent
          t={t}
          label={t.palkkaAs.evening}
          name="evening"
          value={settings.eveningRate}
        />
        <Percent
          t={t}
          label={t.palkkaAs.saturday}
          name="saturday"
          value={settings.saturdayRate}
        />
        <Percent
          t={t}
          label={t.palkkaAs.sunday}
          hint={t.palkkaAs.sundayHint}
          name="sunday"
          value={settings.sundayRate}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.palkkaAs.eveningStart} htmlFor="rf-evening-start">
          <input
            id="rf-evening-start"
            name="eveningStart"
            defaultValue={kello(settings.eveningStartMinute)}
            inputMode="numeric"
            placeholder="18:00"
            className={CONTROL}
            style={CONTROL_STYLE}
          />
        </Field>

        <Field label={t.palkkaAs.eveningEnd} htmlFor="rf-evening-end">
          <input
            id="rf-evening-end"
            name="eveningEnd"
            defaultValue={kello(settings.eveningEndMinute)}
            inputMode="numeric"
            placeholder="06:00"
            className={CONTROL}
            style={CONTROL_STYLE}
          />
        </Field>
      </div>

      <SaveRow t={t} state={state} />

      <div
        className="space-y-2 border-t pt-4 text-[12px] leading-relaxed"
        style={{ borderColor: "var(--rf-line)", color: "var(--rf-text-3)" }}
      >
        <p>{t.palkkaAs.stacking}</p>
        <p>{t.palkkaAs.notPayroll}</p>
      </div>
    </form>
  );
}

function Percent({
  t,
  label,
  hint,
  name,
  value,
}: {
  t: AdminText;
  label: string;
  hint?: string;
  name: string;
  value: number;
}) {
  void t;

  return (
    <Field label={label} htmlFor={`rf-${name}`} hint={hint}>
      <div className="flex items-center gap-2">
        <input
          id={`rf-${name}`}
          name={name}
          defaultValue={formatPercent(value)}
          inputMode="decimal"
          placeholder="0"
          className={CONTROL}
          style={CONTROL_STYLE}
        />
        <span
          className="shrink-0 text-[14px] font-semibold"
          style={{ color: "var(--rf-text-3)" }}
        >
          %
        </span>
      </div>
    </Field>
  );
}

"use client";

import { useActionState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import type { AdminState } from "../actions";
import { updatePayrollSettings } from "./payroll-actions";
import { CONTROL, CONTROL_STYLE, Field, SaveRow } from "./form-parts";
import {
  formatEuroPerHour,
  formatPercent,
  type PayrollSettings,
  type Supplement,
} from "@/lib/restoflow/payroll";

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
 * EURO JA PROSENTTI RINNAKKAIN.
 *
 * Ravintola-alan iltalisä on euroja tunnilta, sunnuntaikorotus
 * prosentti. Kumpikin kenttä on jokaisella lisällä, ja ne lasketaan
 * yhteen — käyttäjä täyttää sen jota hänen työehtosopimuksensa käyttää
 * eikä joudu kääntämään euroja prosenteiksi.
 *
 * Tyhjä kenttä on nolla eikä virhe: yritys jolla ei ole yölisää ei
 * joudu keksimään sille arvoa.
 */
export function PayrollForm({
  t,
  settings,
  tes,
  industry,
}: {
  t: AdminText;
  settings: PayrollSettings;
  /** Yritykselle maaritetty sopimus, tai null. */
  tes: { name: string; valid: string } | null;
  industry: string;
}) {
  const [state, action] = useActionState(updatePayrollSettings, initial);

  return (
    <form action={action} className="space-y-5">
      <p
        className="text-[13px] leading-relaxed"
        style={{ color: "var(--rf-text-2)" }}
      >
        {t.palkkaAs.lead}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t.palkkaAs.sideCost}
          htmlFor="rf-sideCost"
          hint={t.palkkaAs.sideCostHint}
        >
          <Unit suffix="%">
            <input
              id="rf-sideCost"
              name="sideCost"
              defaultValue={formatPercent(settings.sideCostRate)}
              inputMode="decimal"
              placeholder="0"
              className={CONTROL}
              style={CONTROL_STYLE}
            />
          </Unit>
        </Field>

        <Field
          label={t.palkkaAs.holiday}
          htmlFor="rf-holiday"
          hint={t.palkkaAs.holidayHint}
        >
          <Unit suffix="%">
            <input
              id="rf-holiday"
              name="holiday"
              defaultValue={formatPercent(settings.holidayRate)}
              inputMode="decimal"
              placeholder="0"
              className={CONTROL}
              style={CONTROL_STYLE}
            />
          </Unit>
        </Field>
      </div>

      {/*
        Sopimus on luettavaa, ei muokattavaa.

        Yritysasiakas ei syota TES-lisia: han ei tieda oman
        sopimuksensa iltalisaa senttina, ja vaarin syotetty luku
        nayttaisi tarkalta koko kuukauden ajan. Lisat tulevat
        sopimuksesta, sivukulut ja lomakustannus yritykselta.
      */}
      {tes ? (
        <div
          className="space-y-1.5 p-3.5"
          style={{
            background: "var(--rf-inset)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <p className="text-[12.5px]" style={{ color: "var(--rf-text-3)" }}>
            {t.palkkaAs.industry}
          </p>
          <p className="text-[14px] font-semibold">{industry}</p>

          <p
            className="pt-1.5 text-[12.5px]"
            style={{ color: "var(--rf-text-3)" }}
          >
            {t.palkkaAs.tesTitle}
          </p>
          <p className="text-[14px] font-semibold">{tes.name}</p>

          <p
            className="pt-1.5 text-[12.5px]"
            style={{ color: "var(--rf-text-3)" }}
          >
            {t.palkkaAs.tesValid}
          </p>
          <p className="rf-tabular text-[14px] font-semibold">
            {tes.valid}
          </p>

          <p
            className="pt-2 text-[12px] leading-relaxed"
            style={{ color: "var(--rf-text-3)" }}
          >
            {t.palkkaAs.tesManaged}
          </p>
        </div>
      ) : null}

      <div hidden={Boolean(tes)}>
        <h3 className="text-[13.5px] font-bold">{t.palkkaAs.supplements}</h3>
        <p
          className="mt-1 text-[12px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          {t.palkkaAs.supplementsHint}
        </p>

        <div className="mt-3 space-y-4">
          <SupplementRow
            label={t.palkkaAs.evening}
            name="evening"
            value={settings.evening}
          />
          <SupplementRow
            label={t.palkkaAs.night}
            name="night"
            value={settings.night}
          />
          <SupplementRow
            label={t.palkkaAs.saturday}
            name="saturday"
            value={settings.saturday}
          />
          <SupplementRow
            label={t.palkkaAs.sunday}
            name="sunday"
            value={settings.sunday}
            hint={t.palkkaAs.sundayHint}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2" hidden={Boolean(tes)}>
        <Clock
          label={t.palkkaAs.eveningStart}
          name="eveningStart"
          value={settings.eveningStartMinute}
        />
        <Clock
          label={t.palkkaAs.eveningEnd}
          name="eveningEnd"
          value={settings.eveningEndMinute}
        />
        <Clock
          label={t.palkkaAs.nightStart}
          name="nightStart"
          value={settings.nightStartMinute}
        />
        <Clock
          label={t.palkkaAs.nightEnd}
          name="nightEnd"
          value={settings.nightEndMinute}
        />
      </div>

      <SaveRow t={t} state={state} />

      <div
        className="space-y-2 border-t pt-4 text-[12px] leading-relaxed"
        style={{ borderColor: "var(--rf-line)", color: "var(--rf-text-3)" }}
      >
        {/*
          Kate ei vaita tuntevansa tyoehtosopimusta.

          Aiemmin tassa luki etta lisat eivat kerry paallekkain. Se ei
          ole yleinen saanto vaan riippuu sovellettavasta TES:sta, ja
          vaarin esitettyna se antaisi juridisesti vaaran kuvan.
        */}
        {tes ? null : <p>{t.palkkaAs.userDefined}</p>}
        <p>{t.palkkaAs.notPayroll}</p>
      </div>
    </form>
  );
}

/** Yksi lisä: euroa tunnilta ja prosenttia rinnakkain. */
function SupplementRow({
  label,
  name,
  value,
  hint,
}: {
  label: string;
  name: string;
  value: Supplement;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-[13px] font-semibold">{label}</p>

      <div className="mt-1.5 grid grid-cols-2 gap-3">
        <Unit suffix="€/h">
          <input
            name={`${name}Cents`}
            defaultValue={formatEuroPerHour(value.cents)}
            inputMode="decimal"
            placeholder="0,00"
            aria-label={`${label} €/h`}
            className={CONTROL}
            style={CONTROL_STYLE}
          />
        </Unit>

        <Unit suffix="%">
          <input
            name={`${name}Rate`}
            defaultValue={formatPercent(value.rate)}
            inputMode="decimal"
            placeholder="0"
            aria-label={`${label} %`}
            className={CONTROL}
            style={CONTROL_STYLE}
          />
        </Unit>
      </div>

      {hint ? (
        <p
          className="mt-1.5 text-[12px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Clock({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: number;
}) {
  return (
    <Field label={label} htmlFor={`rf-${name}`}>
      <input
        id={`rf-${name}`}
        name={name}
        defaultValue={kello(value)}
        inputMode="numeric"
        placeholder="18:00"
        className={CONTROL}
        style={CONTROL_STYLE}
      />
    </Field>
  );
}

/** Yksikkö kentän vieressä: ilman sitä sama luku tarkoittaisi kahta asiaa. */
function Unit({
  suffix,
  children,
}: {
  suffix: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {children}
      <span
        className="shrink-0 text-[13px] font-semibold"
        style={{ color: "var(--rf-text-3)" }}
      >
        {suffix}
      </span>
    </div>
  );
}

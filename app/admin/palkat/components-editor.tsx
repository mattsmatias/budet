"use client";

import { useActionState, useState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { useFormStatus } from "react-dom";
import {
  deactivatePayComponent,
  savePayComponent,
  type PayrollState,
} from "./actions";
import type { PayComponent } from "@/lib/restoflow/payroll";
import { RfIcon } from "@/components/restoflow/icons";
import { Card } from "@/components/restoflow/ui";
import { formatMoney } from "@/lib/money";

const initial: PayrollState = {};

/*
 * Viikonpaivien lyhenteet.
 *
 * Tehdas eika vakio: moduulitason taulukko lukitsisi lyhenteet
 * suomeksi jo latautuessa, ennen kuin kieli on tiedossa.
 */
const paivat = (t: AdminText) => [
  { value: 1, label: t.palkka.mon },
  { value: 2, label: t.palkka.tue },
  { value: 3, label: t.palkka.wed },
  { value: 4, label: t.palkka.thu },
  { value: 5, label: t.palkka.fri },
  { value: 6, label: t.palkka.sat },
  { value: 7, label: t.palkka.sun },
];

/**
 * Palkkalajit.
 *
 * Yhtään lajia ei ole valmiina. Keksitty iltalisä olisi väärä palkka, ja
 * väärä palkka on pahempi kuin puuttuva ominaisuus — oikeat arvot tulevat
 * työehtosopimuksesta jota Kate ei tunne.
 */
export function PayComponents({
  t,
  components,
}: {
  t: AdminText;
  components: PayComponent[];
}) {
  const [state, action] = useActionState(savePayComponent, initial);
  const [open, setOpen] = useState(false);

  const active = components.filter((c) => c.active);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold tracking-[-0.0075em]">
            {t.palkka.components}
          </h2>
          <p
            className="mt-1 text-[13px] leading-relaxed"
            style={{ color: "var(--rf-text-2)" }}
          >
            {t.palkka.componentsIntro}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="rf-press inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-semibold"
          style={{
            background: "var(--rf-card)",
            border: "1px solid var(--rf-line-strong)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <RfIcon name="plus" size={15} />
          {t.palkka.addComponent}
        </button>
      </div>

      {active.length === 0 ? (
        <p className="mt-4 text-[13px]" style={{ color: "var(--rf-text-3)" }}>
          {t.palkka.noComponents}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {active.map((component) => (
            <li
              key={component.id}
              className="flex flex-wrap items-center gap-3 px-3.5 py-3"
              style={{
                background: "var(--rf-inset)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium">
                  {component.name}
                </span>
                <span
                  className="block text-[12px]"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  {describe(component, t)}
                </span>
              </span>

              <form action={deactivatePayComponent}>
                <input type="hidden" name="componentId" value={component.id} />
                <button
                  type="submit"
                  aria-label={fill(t.palkka.disableNamed, {
                    nimi: component.name,
                  })}
                  className="rf-press rf-icon-btn rf-hit flex h-7 w-7 items-center justify-center rounded-[7px]"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  <RfIcon name="trash" size={14} />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {state.error ? (
        <p className="mt-3 text-[13px]" style={{ color: "var(--rf-red-text)" }}>
          {state.error}
        </p>
      ) : null}

      {open ? (
        <form action={action} className="rf-enter mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.palkka.nameLabel}>
              <input
                name="name"
                required
                placeholder={t.palkka.eveningSupp}
                className={inputClass}
              />
            </Field>

            <Field label={t.palkka.typeLabel}>
              <select name="code" defaultValue="evening" className={inputClass}>
                <option value="evening">{t.palkka.eveningSupp}</option>
                <option value="night">{t.palkka.nightSupp}</option>
                <option value="saturday">{t.palkka.saturdaySupp}</option>
                <option value="sunday">{t.palkka.sundaySupp}</option>
                <option value="overtime">{t.palkka.overtime}</option>
                <option value="other">{t.palkka.otherSupp}</option>
              </select>
            </Field>

            <Field label={t.palkka.unitLabel}>
              <select
                name="unit"
                defaultValue="per_hour"
                className={inputClass}
              >
                <option value="per_hour">{t.palkka.unitPerHour}</option>
                <option value="percent">{t.palkka.unitPercent}</option>
                <option value="fixed">{t.palkka.unitFixed}</option>
              </select>
            </Field>

            <Field label={t.palkka.valueLabel}>
              <input
                name="value"
                required
                inputMode="decimal"
                placeholder="1,50"
                className={inputClass}
              />
            </Field>

            <Field label={t.palkka.startsAt} hint="Tyhjä = koko vuorokausi">
              <input name="from" type="time" className={inputClass} />
            </Field>

            <Field label={t.palkka.endsAt} hint={t.palkka.overnightHint}>
              <input name="to" type="time" className={inputClass} />
            </Field>
          </div>

          <fieldset>
            <legend
              className="text-[12px] font-medium"
              style={{ color: "var(--rf-text-2)" }}
            >
              {t.palkka.weekdaysHint}
            </legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {paivat(t).map((day) => (
                <label
                  key={day.value}
                  className="rf-press inline-flex cursor-pointer items-center gap-1.5 px-3 py-2 text-[13px]"
                  style={{
                    background: "var(--rf-card)",
                    border: "1px solid var(--rf-line)",
                    borderRadius: "var(--rf-r-control)",
                  }}
                >
                  <input type="checkbox" name="weekdays" value={day.value} />
                  {day.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex items-center gap-2.5 text-[13px]">
            <input type="checkbox" name="stackable" defaultChecked />
            {t.palkka.canCombine}
          </label>

          <p
            className="text-[12px] leading-relaxed"
            style={{ color: "var(--rf-text-3)" }}
          >
            {t.palkka.combineHint}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.palkka.validFrom}>
              <input name="validFrom" type="date" className={inputClass} />
            </Field>
            <Field label={t.palkka.validUntil} hint="Tyhjä = toistaiseksi">
              <input name="validTo" type="date" className={inputClass} />
            </Field>
          </div>

          <SaveButton t={t} />
        </form>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------

const inputClass =
  "w-full px-3 py-2.5 text-[14px] [border-radius:var(--rf-r-control)] " +
  "[background:var(--rf-card)] [border:1px_solid_var(--rf-line-strong)]";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="block text-[12px] font-medium"
        style={{ color: "var(--rf-text-2)" }}
      >
        {label}
      </span>
      <span className="mt-1 block">{children}</span>
      {hint ? (
        <span
          className="mt-1 block text-[11px]"
          style={{ color: "var(--rf-text-3)" }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function SaveButton({ t }: { t: AdminText }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press px-4 py-2.5 text-[14px] font-semibold disabled:opacity-45"
      style={{
        background: "var(--rf-accent)",
        color: "#fff",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {pending ? t.palkka.savingEllipsis : t.palkka.saveComponent}
    </button>
  );
}

/** "1,50 € / h · ma–pe 18:00–23:00" */
function describe(component: PayComponent, t: AdminText): string {
  const amount =
    component.unit === "percent"
      ? `+${component.value} %`
      : component.unit === "per_hour"
        ? fill(t.palkka.perHour, { summa: formatMoney(component.value) })
        : fill(t.palkka.oneOff, { summa: formatMoney(component.value) });

  const days =
    component.weekdays.length === 0
      ? t.palkka.allDays
      : component.weekdays
          .slice()
          .sort((a, b) => a - b)
          .map((d) => paivat(t).find((x) => x.value === d)?.label ?? d)
          .join(", ");

  const window =
    component.fromMinute === null || component.toMinute === null
      ? "koko vuorokausi"
      : `${clock(component.fromMinute)}–${clock(component.toMinute)}`;

  const stack = component.stackable ? "" : " · ei yhdisty";

  return `${amount} · ${days} · ${window}${stack}`;
}

function clock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

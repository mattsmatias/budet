"use client";

import { useActionState, useState } from "react";
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

const DAYS = [
  { value: 1, label: "Ma" },
  { value: 2, label: "Ti" },
  { value: 3, label: "Ke" },
  { value: 4, label: "To" },
  { value: 5, label: "Pe" },
  { value: 6, label: "La" },
  { value: 7, label: "Su" },
];

/**
 * Palkkalajit.
 *
 * Yhtään lajia ei ole valmiina. Keksitty iltalisä olisi väärä palkka, ja
 * väärä palkka on pahempi kuin puuttuva ominaisuus — oikeat arvot tulevat
 * työehtosopimuksesta jota Budet ei tunne.
 */
export function PayComponents({ components }: { components: PayComponent[] }) {
  const [state, action] = useActionState(savePayComponent, initial);
  const [open, setOpen] = useState(false);

  const active = components.filter((c) => c.active);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold">Palkkalajit</h2>
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
            Ilta-, yö- ja viikonloppulisät. Budet ei tunne työehtosopimusta,
            joten arvot syötetään itse.
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
          Lisää palkkalaji
        </button>
      </div>

      {active.length === 0 ? (
        <p className="mt-4 text-[13px]" style={{ color: "var(--rf-text-3)" }}>
          Ei palkkalajeja. Peruspalkka lasketaan silti tuntipalkasta.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {active.map((component) => (
            <li
              key={component.id}
              className="flex flex-wrap items-center gap-3 px-3.5 py-3"
              style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium">{component.name}</span>
                <span className="block text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                  {describe(component)}
                </span>
              </span>

              <form action={deactivatePayComponent}>
                <input type="hidden" name="componentId" value={component.id} />
                <button
                  type="submit"
                  aria-label={`Poista käytöstä: ${component.name}`}
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
            <Field label="Nimi">
              <input name="name" required placeholder="Iltalisä" className={inputClass} />
            </Field>

            <Field label="Tyyppi">
              <select name="code" defaultValue="evening" className={inputClass}>
                <option value="evening">Iltalisä</option>
                <option value="night">Yölisä</option>
                <option value="saturday">Lauantailisä</option>
                <option value="sunday">Sunnuntailisä</option>
                <option value="overtime">Ylityö</option>
                <option value="other">Muu lisä</option>
              </select>
            </Field>

            <Field label="Yksikkö">
              <select name="unit" defaultValue="per_hour" className={inputClass}>
                <option value="per_hour">€ tunnilta</option>
                <option value="percent">% peruspalkasta</option>
                <option value="fixed">€ kertakorvaus</option>
              </select>
            </Field>

            <Field label="Arvo">
              <input
                name="value"
                required
                inputMode="decimal"
                placeholder="1,50"
                className={inputClass}
              />
            </Field>

            <Field label="Alkaa klo" hint="Tyhjä = koko vuorokausi">
              <input name="from" type="time" className={inputClass} />
            </Field>

            <Field label="Päättyy klo" hint="Yön yli käy: 23:00 → 06:00">
              <input name="to" type="time" className={inputClass} />
            </Field>
          </div>

          <fieldset>
            <legend className="text-[12px] font-medium" style={{ color: "var(--rf-text-2)" }}>
              Viikonpäivät — valitsematta jättäminen tarkoittaa kaikkia
            </legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DAYS.map((day) => (
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
            Voi yhdistyä muihin lisiin
          </label>

          <p className="text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
            Jos lisä ei yhdisty, samalta minuutilta maksetaan vain arvokkain.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Voimassa alkaen">
              <input name="validFrom" type="date" className={inputClass} />
            </Field>
            <Field label="Voimassa asti" hint="Tyhjä = toistaiseksi">
              <input name="validTo" type="date" className={inputClass} />
            </Field>
          </div>

          <SaveButton />
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
      <span className="block text-[12px] font-medium" style={{ color: "var(--rf-text-2)" }}>
        {label}
      </span>
      <span className="mt-1 block">{children}</span>
      {hint ? (
        <span className="mt-1 block text-[11px]" style={{ color: "var(--rf-text-3)" }}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function SaveButton() {
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
      {pending ? "Tallennetaan…" : "Tallenna palkkalaji"}
    </button>
  );
}

/** "1,50 € / h · ma–pe 18:00–23:00" */
function describe(component: PayComponent): string {
  const amount =
    component.unit === "percent"
      ? `+${component.value} %`
      : component.unit === "per_hour"
        ? `${formatMoney(component.value)} / h`
        : `${formatMoney(component.value)} kertakorvaus`;

  const days =
    component.weekdays.length === 0
      ? "kaikki päivät"
      : component.weekdays
          .slice()
          .sort((a, b) => a - b)
          .map((d) => DAYS.find((x) => x.value === d)?.label ?? d)
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

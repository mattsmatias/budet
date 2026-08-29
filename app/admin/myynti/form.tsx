"use client";

import { useActionState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import { useFormStatus } from "react-dom";
import { saveDailySales, type SalesState } from "./actions";

const initial: SalesState = {};

/**
 * Myynnin kirjaus.
 *
 * Yksi pakollinen kenttä. Tavoite on vapaaehtoinen, koska ilman sitä
 * päivä vertautuu saman viikonpäivän historiaan — se on parempi
 * vertailukohta kuin tavoite jota ei ole harkittu.
 *
 * inputMode="decimal" avaa puhelimessa numeronäppäimistön. Myynti
 * kirjataan illan päätteeksi puhelimella, ja väärä näppäimistö on siinä
 * hetkessä yllättävän suuri este.
 */
export function SalesForm({
  t,
  defaultDate,
  defaultNet,
  defaultTarget,
  compact,
}: {
  t: AdminText;
  defaultDate: string;
  defaultNet: string;
  defaultTarget: string;
  compact?: boolean;
}) {
  const [state, action] = useActionState(saveDailySales, initial);

  return (
    <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="date" value={defaultDate} />

      <div
        className={
          compact
            ? "flex flex-wrap items-end gap-3"
            : "grid gap-3 sm:grid-cols-2"
        }
      >
        <Field
          label={t.myynti.netSales}
          hint={compact ? undefined : t.myynti.reportSum}
        >
          <input
            name="net"
            required
            inputMode="decimal"
            autoComplete="off"
            defaultValue={defaultNet}
            placeholder="2 430,00"
            className={inputClass}
          />
        </Field>

        {compact ? null : (
          <Field label={t.myynti.target} hint={t.myynti.targetHint}>
            <input
              name="target"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={defaultTarget}
              placeholder="2 670,00"
              className={inputClass}
            />
          </Field>
        )}

        {compact ? <Submit t={t} /> : null}
      </div>

      {state.error ? (
        <p
          role="alert"
          className="text-[13px]"
          style={{ color: "var(--rf-red-text)" }}
        >
          {state.error}
        </p>
      ) : null}

      {state.notice ? (
        <p className="text-[13px]" style={{ color: "var(--rf-green-text)" }}>
          {state.notice}
        </p>
      ) : null}

      {compact ? null : <Submit t={t} />}
    </form>
  );
}

// ---------------------------------------------------------------------------

const inputClass =
  "w-full min-w-[9rem] px-3.5 py-2.5 text-[15px] [border-radius:var(--rf-r-control)] " +
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
          className="mt-1 block text-[11px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function Submit({ t }: { t: AdminText }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press px-4 py-2.5 text-[14px] font-semibold disabled:opacity-50"
      style={{
        minHeight: 44,
        background: "var(--rf-accent)",
        color: "#fff",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {pending ? t.myynti.savingEllipsis : t.myynti.saveSales}
    </button>
  );
}

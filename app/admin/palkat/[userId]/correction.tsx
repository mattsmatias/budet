"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { correctWorkTime, removeCorrection, type PayrollState } from "../actions";
import { RfIcon } from "@/components/restoflow/icons";

const initial: PayrollState = {};

/**
 * Yksi työpäivä palkkalaskelmassa, ja sen korjaus.
 *
 * Rivi kertoo ensin mitä tapahtui: päivä, kellonajat, kesto, summa.
 * Korjaus on rivin takana eikä sen vieressä, koska korjaaminen on
 * poikkeus eikä päivittäinen toimi — näkyvä lomake jokaisella rivillä
 * tekisi erittelystä lomakekokoelman.
 *
 * Korjattu päivä sanoo sen ääneen ja näyttää syyn. Palkkalaskelmassa
 * oleva luku jota kukaan ei osaa selittää on pahempi kuin puuttuva luku.
 */
export function CorrectionRow({
  date,
  label,
  times,
  duration,
  amount,
  extras,
  userId,
  corrected,
  correction,
  canManage,
  startOpen,
}: {
  date: string;
  label: string;
  times: string;
  duration: string;
  amount: string;
  extras: { name: string; duration: string; amount: string }[];
  userId: string;
  corrected: boolean;
  correction: {
    id: string;
    reason: string;
    createdAt: string;
    hadOriginal: boolean;
  } | null;
  canManage: boolean;
  startOpen?: boolean;
}) {
  const [state, action] = useActionState(correctWorkTime, initial);
  const [open, setOpen] = useState(Boolean(startOpen));

  return (
    <div
      className="px-3.5 py-3"
      style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="text-[14px] font-medium">
            {label}
            {corrected ? (
              <span
                className="ml-2 text-[11px] font-semibold uppercase"
                style={{ color: "var(--rf-amber-text)", letterSpacing: "0.04em" }}
              >
                Korjattu
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            {times} · {duration}
          </p>
        </div>

        <p className="rf-tabular shrink-0 text-[14px] font-semibold">{amount}</p>
      </div>

      {extras.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {extras.map((extra) => (
            <li
              key={extra.name}
              className="flex items-baseline justify-between gap-4 text-[12px]"
              style={{ color: "var(--rf-text-2)" }}
            >
              <span>
                {extra.name} · {extra.duration}
              </span>
              <span className="rf-tabular shrink-0">{extra.amount}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {correction ? (
        <p
          className="mt-2 text-[12px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          Syy: {correction.reason}
        </p>
      ) : null}

      {canManage ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="rf-press -my-3 py-3 text-[12px] font-medium"
            style={{ color: "var(--rf-blue)" }}
          >
            {open ? "Peruuta" : corrected ? "Muuta korjausta" : "Korjaa toteutunut aika"}
          </button>

          {correction ? (
            <form action={removeCorrection}>
              <input type="hidden" name="correctionId" value={correction.id} />
              <button
                type="submit"
                className="rf-press -my-3 py-3 text-[12px] font-medium"
                style={{ color: "var(--rf-text-3)" }}
              >
                Palauta leimaukset
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {state.error ? (
        <p className="mt-2 text-[12px]" style={{ color: "var(--rf-red-text)" }}>
          {state.error}
        </p>
      ) : null}

      {open && canManage ? (
        <form action={action} className="rf-enter mt-3 space-y-3">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="date" value={date} />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Sisään">
              <input name="from" type="time" required className={inputClass} />
            </Field>
            <Field label="Ulos">
              <input name="to" type="time" required className={inputClass} />
            </Field>
            <Field label="Tauko (min)">
              <input
                name="breakMinutes"
                type="number"
                min={0}
                defaultValue={0}
                className={inputClass}
              />
            </Field>
          </div>

          <label className="block">
            <span className="block text-[12px] font-medium" style={{ color: "var(--rf-text-2)" }}>
              Miksi aikaa korjataan?
            </span>
            <input
              name="reason"
              required
              placeholder="Ulosleima unohtui"
              className={`mt-1 ${inputClass}`}
            />
          </label>

          <p className="text-[11px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
            Alkuperäisiä leimauksia ei muuteta. Korjaus tallennetaan omana
            merkintänään, ja siihen jää nimesi, aika ja perustelu.
          </p>

          <SaveButton />
        </form>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

const inputClass =
  "w-full px-3 py-2.5 text-[14px] [border-radius:var(--rf-r-control)] " +
  "[background:var(--rf-card)] [border:1px_solid_var(--rf-line-strong)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium" style={{ color: "var(--rf-text-2)" }}>
        {label}
      </span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold disabled:opacity-45"
      style={{
        background: "var(--rf-accent)",
        color: "#fff",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <RfIcon name="check" size={15} />
      {pending ? "Tallennetaan…" : "Tallenna korjaus"}
    </button>
  );
}

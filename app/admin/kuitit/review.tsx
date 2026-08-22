"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteReceipt, reviewReceipt, type AdminState } from "../actions";
import {
  CATEGORY_LABELS,
  PAYMENT_LABELS,
  REVIEW_REASON_LABELS,
  type Receipt,
} from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";
import { Pill } from "@/components/restoflow/ui";

const initial: AdminState = {};

/**
 * Kuitin tarkistus.
 *
 * Korjaukset ja hyväksyntä lähetetään samalla kertaa. Erillisenä
 * muokkauksena ja hyväksyntänä kuitti voisi jäädä tilaan jossa se on
 * hyväksytty mutta vanhoilla arvoilla.
 */
export function ReviewPanel({ receipt }: { receipt: Receipt }) {
  const [state, action] = useActionState(reviewReceipt, initial);
  const [open, setOpen] = useState(false);

  if (state.notice) {
    return (
      <p
        role="status"
        className="mt-3 px-3.5 py-2.5 text-[13px] font-medium"
        style={{
          background: "var(--rf-green-bg)",
          color: "var(--rf-green-text)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        {state.notice}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rf-press mt-3 flex w-full items-center justify-center gap-2 py-2.5 text-[14px] font-semibold"
        style={{
          background: "var(--rf-accent)",
          color: "var(--rf-on-accent)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <RfIcon name="check" size={16} />
        Tarkista
      </button>
    );
  }

  return (
    <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="receiptId" value={receipt.id} />

      <Field label="Toimittaja" name="supplier" defaultValue={receipt.supplierName} />
      <Field label="Päivämäärä" name="date" type="date" defaultValue={receipt.date} />

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Yhteensä"
          name="total"
          inputMode="decimal"
          defaultValue={euros(receipt.totalCents)}
        />
        <Field
          label="ALV"
          name="vat"
          inputMode="decimal"
          defaultValue={receipt.vatCents === null ? "" : euros(receipt.vatCents)}
          warn={receipt.vatCents === null}
        />
      </div>

      <SelectField
        label="Kategoria"
        name="category"
        defaultValue={receipt.category}
        options={Object.entries(CATEGORY_LABELS)}
      />
      <SelectField
        label="Maksutapa"
        name="payment"
        defaultValue={receipt.paymentMethod}
        options={Object.entries(PAYMENT_LABELS)}
      />

      {receipt.reviewReasons.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {receipt.reviewReasons.map((r) => (
            <Pill key={r} tone="warn" dot>
              {REVIEW_REASON_LABELS[r]}
            </Pill>
          ))}
        </div>
      ) : null}

      {state.error ? (
        <p
          role="alert"
          className="px-3.5 py-2.5 text-[13px]"
          style={{
            background: "var(--rf-red-bg)",
            color: "var(--rf-red-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-3">
        <ActionButton
          value="approve"
          label="Hyväksy"
          background="var(--rf-green)"
          color="#fff"
        />
        <ActionButton
          value="reject"
          label="Jätä jonoon"
          background="var(--rf-inset)"
          color="var(--rf-text)"
        />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rf-press py-2.5 text-[14px] font-semibold"
          style={{
            background: "var(--rf-inset)",
            color: "var(--rf-text-2)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          Peruuta
        </button>
      </div>

      <p className="text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
        Kategorian muutos kirjataan toimittajalle. Kun sama korjaus toistuu,
        Budet ehdottaa sitä jatkossa.
      </p>
    </form>
  );
}

/**
 * Kaksoiskappaleen poisto.
 *
 * Erillinen lomake, koska poisto on peruuttamaton eikä se saa olla
 * klikkauksen päässä tarkistuksesta.
 */
export function DeleteReceipt({ receiptId }: { receiptId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rf-press px-3 py-1.5 text-[13px] font-medium"
        style={{
          background: "var(--rf-inset)",
          color: "var(--rf-text-2)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        Poista
      </button>
    );
  }

  return (
    <form action={deleteReceipt} className="flex items-center gap-2">
      <input type="hidden" name="receiptId" value={receiptId} />
      <button
        type="submit"
        className="rf-press px-3 py-1.5 text-[13px] font-semibold"
        style={{
          background: "var(--rf-red)",
          color: "var(--rf-on-accent)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        Poista lopullisesti
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rf-press px-3 py-1.5 text-[13px] font-medium"
        style={{ color: "var(--rf-text-2)" }}
      >
        Peruuta
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------

function euros(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function ActionButton({
  value,
  label,
  background,
  color,
}: {
  value: string;
  label: string;
  background: string;
  color: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name="action"
      value={value}
      disabled={pending}
      className="rf-press py-2.5 text-[14px] font-semibold disabled:opacity-50"
      style={{ background, color, borderRadius: "var(--rf-r-control)" }}
    >
      {pending ? "…" : label}
    </button>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  inputMode,
  warn,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  inputMode?: "decimal";
  warn?: boolean;
}) {
  const id = `r-${name}`;

  return (
    <div>
      <label htmlFor={id} className="block text-[12px]" style={{ color: "var(--rf-text-2)" }}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        defaultValue={defaultValue}
        className="mt-1 w-full px-3 py-2 text-[16px] outline-none"
        style={{
          background: warn ? "var(--rf-amber-bg)" : "var(--rf-inset)",
          borderRadius: "var(--rf-r-control)",
        }}
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: [string, string][];
}) {
  const id = `r-${name}`;

  return (
    <div>
      <label htmlFor={id} className="block text-[12px]" style={{ color: "var(--rf-text-2)" }}>
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full px-3 py-2 text-[16px] outline-none"
        style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

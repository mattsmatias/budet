"use client";

import { useActionState, useState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import type { AppLocale } from "@/lib/i18n/app-locales";
import { formatMonth } from "@/lib/restoflow/expenses";
import { useFormStatus } from "react-dom";
import { closeMonth, reopenMonth, type AdminState } from "../actions";
import { RfIcon } from "@/components/restoflow/icons";

const initial: AdminState = {};

/**
 * Kuukauden sulkeminen ja avaaminen.
 *
 * Sulkeminen on omistajan päätös eikä automaattinen: kirjanpitoon
 * lähetetty kuukausi lukitaan silloin kun se on oikeasti lähetetty, ei
 * kalenterin mukaan.
 */
export function MonthClosing({
  t,
  closedMonths,
  selectableMonths,
  locale,
}: {
  t: AdminText;
  closedMonths: string[];
  selectableMonths: string[];
  /** Kayttoliittyman kieli: kuukauden nimi tulee siita. */
  locale: AppLocale;
}) {
  const [state, action] = useActionState(closeMonth, initial);
  const open = selectableMonths.filter((m) => !closedMonths.includes(m));

  return (
    <div className="mt-4 space-y-4">
      {closedMonths.length > 0 ? (
        <ul className="space-y-2">
          {closedMonths.map((month) => (
            <li
              key={month}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5"
              style={{
                background: "var(--rf-inset)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              <span className="flex items-center gap-2 text-[14px] font-medium">
                <span style={{ color: "var(--rf-green-text)" }}>
                  <RfIcon name="check" size={16} />
                </span>
                {formatMonth(month, locale)}
              </span>
              <ReopenButton t={t} month={month} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {t.asetus.noClosedMonths}
        </p>
      )}

      {open.length > 0 ? (
        <form action={action} className="space-y-3">
          <div>
            <label htmlFor="rf-month" className="block text-[13px] font-medium">
              {t.asetus.closeMonth}
            </label>
            <select
              id="rf-month"
              name="month"
              defaultValue={open[0]}
              className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
              style={{
                background: "var(--rf-inset)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              {open.map((m) => (
                <option key={m} value={m}>
                  {formatMonth(m, locale)}
                </option>
              ))}
            </select>
          </div>

          <input
            name="note"
            placeholder={t.asetus.notePlaceholder}
            maxLength={200}
            className="w-full px-3.5 py-2.5 text-[16px] outline-none"
            style={{
              background: "var(--rf-inset)",
              borderRadius: "var(--rf-r-control)",
            }}
          />

          <Feedback state={state} />

          <Submit t={t} label={t.asetus.closeMonth} />

          <p
            className="text-[12px] leading-relaxed"
            style={{ color: "var(--rf-text-3)" }}
          >
            {t.asetus.closedMonthRules}
          </p>
        </form>
      ) : (
        <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {t.asetus.nothingToClose}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ReopenButton({ t, month }: { t: AdminText; month: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rf-press px-3 py-1.5 text-[13px] font-medium"
        style={{
          background: "var(--rf-card)",
          color: "var(--rf-text-2)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        {t.asetus.open}
      </button>
    );
  }

  return (
    <form action={reopenMonth} className="flex items-center gap-2">
      <input type="hidden" name="month" value={month} />
      <button
        type="submit"
        className="rf-press px-3 py-1.5 text-[13px] font-semibold"
        style={{
          background: "var(--rf-amber)",
          color: "var(--rf-on-accent)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        {t.asetus.reopen}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-[13px]"
        style={{ color: "var(--rf-text-2)" }}
      >
        {t.asetus.cancel}
      </button>
    </form>
  );
}

function Feedback({ state }: { state: AdminState }) {
  if (state.error) {
    return (
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
    );
  }

  if (state.notice) {
    return (
      <p
        role="status"
        className="px-3.5 py-2.5 text-[13px] font-medium"
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

  return null;
}

function Submit({ t, label }: { t: AdminText; label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press w-full py-2.5 text-[14px] font-semibold disabled:opacity-50 md:w-auto md:px-5"
      style={{
        background: "var(--rf-accent)",
        color: "var(--rf-on-accent)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {pending ? t.asetus.savingEllipsis : label}
    </button>
  );
}

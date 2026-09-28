"use client";

import { useActionState, useId } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import type { AdminState } from "../../actions";
import { markInvoicePaid } from "../actions";
import { CONTROL, CONTROL_STYLE } from "../../asetukset/form-parts";

const initial: AdminState = {};

/**
 * Maksumerkintä.
 *
 * PÄIVÄ KYSYTÄÄN, EI OLETETA.
 *
 * Tiliote kertoo milloin raha tuli, ja se on harvoin sama päivä kuin
 * se jona joku ehtii merkitä sen. Kenttä on esitäytetty tälle
 * päivälle, koska useimmiten se riittää — mutta sitä voi muuttaa, ja
 * juuri se erottaa kirjanpidon muistiinpanosta.
 */
export function PaidForm({
  t,
  id,
  tanaan,
}: {
  t: AdminText;
  id: string;
  tanaan: string;
}) {
  const [state, action, pending] = useActionState(markInvoicePaid, initial);
  const kentta = useId();

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor={kentta}
            className="block text-[12.5px] font-semibold"
          >
            {t.laskut.paidOn}
          </label>
          <input
            id={kentta}
            name="paidOn"
            type="date"
            defaultValue={tanaan}
            max={tanaan}
            className={`${CONTROL} rf-tabular mt-1`}
            style={{ ...CONTROL_STYLE, maxWidth: 190 }}
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rf-press rf-touch px-4 text-[13px] font-bold disabled:opacity-60"
          style={{
            borderRadius: 980,
            background: "var(--rf-accent)",
            color: "var(--rf-on-accent)",
          }}
        >
          {t.laskut.markPaid}
        </button>
      </div>

      <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
        {t.laskut.paidOnHint}
      </p>

      {state.error ? (
        <p className="text-[12.5px]" style={{ color: "var(--rf-red-text)" }}>
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

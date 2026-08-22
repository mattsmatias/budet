"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { setMerchant, type AdminState } from "../../actions";
import { RfIcon } from "@/components/restoflow/icons";

const initial: AdminState = {};

/**
 * Kaupan valinta käsin.
 *
 * Kun tunnistus ei osu, käyttäjä kertoo mikä kauppa on kyseessä. Valinta
 * tallennetaan toimipisteelle eikä kuitille, joten se korjaa kerralla
 * kaikki saman kaupan kuitit — myös ne jotka on jo tallennettu ja ne
 * jotka tulevat myöhemmin.
 *
 * Valinta merkitään vahvistetuksi. Sen jälkeen automaattinen tunnistus
 * ei enää koske siihen: muuten seuraava kuitti samasta kaupasta kumoaisi
 * korjauksen, ja käyttäjä korjaisi saman asian uudelleen ja uudelleen.
 */
export function MerchantPicker({
  supplierId,
  supplierName,
  current,
  merchants,
}: {
  supplierId: string;
  supplierName: string;
  current: string | null;
  merchants: { id: string; name: string; category: string }[];
}) {
  const [state, action] = useActionState(setMerchant, initial);
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
        className="rf-press mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium"
        style={{ color: "var(--rf-blue)" }}
      >
        <RfIcon name="settings" size={14} />
        {current ? "Vaihda kauppa" : "Valitse kauppa"}
      </button>
    );
  }

  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="supplierId" value={supplierId} />

      <label htmlFor="merchant" className="block text-[13px] font-medium">
        Mikä kauppa {supplierName} on?
      </label>

      <select
        id="merchant"
        name="merchantId"
        defaultValue={current ?? ""}
        className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none md:text-[14px]"
        style={{
          background: "var(--rf-inset)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <option value="">Ei mikään näistä</option>
        {merchants.map((merchant) => (
          <option key={merchant.id} value={merchant.id}>
            {merchant.name}
          </option>
        ))}
      </select>

      <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
        Valinta koskee kaikkia tämän kaupan kuitteja, myös aiempia.
      </p>

      {state.error ? (
        <p
          role="alert"
          className="mt-2 px-3.5 py-2.5 text-[13px]"
          style={{
            background: "var(--rf-red-bg)",
            color: "var(--rf-red-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {state.error}
        </p>
      ) : null}

      <div className="mt-3 flex gap-2.5">
        <Save />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rf-press px-4 py-2 text-[14px] font-medium"
          style={{
            background: "var(--rf-inset)",
            color: "var(--rf-text-2)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          Peruuta
        </button>
      </div>
    </form>
  );
}

function Save() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press px-4 py-2 text-[14px] font-semibold disabled:opacity-50"
      style={{
        background: "var(--rf-accent)",
        color: "var(--rf-on-accent)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {pending ? "Tallennetaan…" : "Tallenna"}
    </button>
  );
}

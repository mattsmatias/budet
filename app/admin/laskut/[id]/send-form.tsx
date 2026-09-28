"use client";

import { useActionState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import type { AdminState } from "../../actions";
import { sendInvoice } from "../actions";

const initial: AdminState = {};

/**
 * Laskun lähetys.
 *
 * PAINIKE VAIN LUONNOKSELLE.
 *
 * Lähetetty lasku on tosite, ja sen lähettäminen uudelleen tekisi
 * samasta laskusta kaksi. Kanta estäisi sen joka tapauksessa, mutta
 * painike jota ei voi painaa väärin on parempi kuin virheilmoitus.
 *
 * Ilman vastaanottajan sähköpostia painiketta ei näytetä lainkaan
 * vaan kerrotaan mikä puuttuu ja missä se korjataan — YTJ ei anna
 * sähköpostia, joten se on juuri se kenttä joka jää täyttämättä.
 */
export function SendForm({
  t,
  id,
  osoite,
}: {
  t: AdminText;
  id: string;
  osoite: string | null;
}) {
  const [state, action, pending] = useActionState(sendInvoice, initial);

  if (!osoite) {
    return (
      <p className="text-[12.5px]" style={{ color: "var(--rf-amber-text)" }}>
        {t.laskut.sendNoEmail}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={id} />

      <button
        type="submit"
        disabled={pending}
        className="rf-press rf-touch px-4 text-[13px] font-bold disabled:opacity-60"
        style={{
          display: "inline-flex",
          alignItems: "center",
          borderRadius: 980,
          background: "var(--rf-accent)",
          color: "var(--rf-on-accent)",
        }}
      >
        {t.laskut.send}
      </button>

      <span className="text-[12.5px]" style={{ color: "var(--rf-text-3)" }}>
        {osoite}
      </span>

      {state.error ? (
        <span className="text-[12.5px]" style={{ color: "var(--rf-red-text)" }}>
          {state.error}
        </span>
      ) : null}

      {state.notice ? (
        <span
          className="text-[12.5px] font-semibold"
          style={{ color: "var(--rf-green-text)" }}
        >
          {state.notice}
        </span>
      ) : null}
    </form>
  );
}

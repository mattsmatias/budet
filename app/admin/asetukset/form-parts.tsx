"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { AdminState } from "../actions";

/**
 * Asetuslomakkeen palaset.
 *
 * Jokainen osio on oma lomakkeensa, ja ilman yhteisiä paloja ne
 * ajautuisivat erilleen: toisessa kentän otsikko olisi 13 px ja
 * toisessa 14, toisessa tallennuspainike oikealla ja toisessa
 * vasemmalla. Asetussivu on juuri se paikka jossa sellainen huomataan,
 * koska osiot vaihtuvat samassa kehyksessä.
 */

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  /** Mitä asetus tekee. Näkyy kentän alla, ei sen sisällä. */
  hint?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[13px] font-semibold">
        {label}
      </label>

      <div className="mt-1.5">{children}</div>

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

/**
 * Tekstikentän ja valikon yhteinen ulkoasu.
 *
 * 16 px eikä pienempi: Safari zoomaa alle 16 pikselin kenttään
 * napautettaessa, eikä sivu palaa entiselleen sen jälkeen.
 */
export const CONTROL =
  "w-full px-3.5 py-2.5 text-[16px] outline-none focus-visible:ring-2";

export const CONTROL_STYLE: React.CSSProperties = {
  background: "var(--rf-inset)",
  border: "1px solid var(--rf-line)",
  borderRadius: "var(--rf-r-control)",
};

/**
 * Katkaisin.
 *
 * Koko rivi on klikattava eikä vain ruutu: 18 pikselin maali on
 * puhelimessa liian pieni, ja selitysteksti on joka tapauksessa se
 * mitä luetaan ennen valintaa.
 */
export function Toggle({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint: string;
  defaultChecked: boolean;
}) {
  return (
    <label
      className="rf-press flex cursor-pointer items-start gap-3 px-3.5 py-3"
      style={{
        background: "var(--rf-inset)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-[18px] shrink-0 cursor-pointer"
        style={{ accentColor: "var(--rf-accent)" }}
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold">{label}</span>
        <span
          className="mt-0.5 block text-[12px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          {hint}
        </span>
      </span>
    </label>
  );
}

/**
 * Palaute ja tallennus samalla rivillä.
 *
 * Viesti ilmestyy painikkeen viereen eikä sen yläpuolelle: yläpuolella
 * se työntäisi painikkeen alaspäin juuri kun siihen ollaan
 * osumassa uudestaan.
 */
export function SaveRow({
  state,
  label = "Tallenna",
}: {
  state: AdminState;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-1">
      <Submit label={label} />
      <Feedback state={state} />
    </div>
  );
}

export function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press inline-flex shrink-0 items-center justify-center whitespace-nowrap px-[15px] py-[9px] text-[13px] font-bold disabled:opacity-50"
      style={{
        background: "var(--rf-accent)",
        color: "var(--rf-on-accent)",
        borderRadius: "var(--rf-r-control)",
        minHeight: 36,
      }}
    >
      {pending ? "Tallennetaan…" : label}
    </button>
  );
}

export function Feedback({ state }: { state: AdminState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="text-[12.5px] font-semibold"
        style={{ color: "var(--rf-red-text)" }}
      >
        {state.error}
      </p>
    );
  }

  if (state.notice) {
    return (
      <p
        role="status"
        className="text-[12.5px] font-semibold"
        style={{ color: "var(--rf-green-text)" }}
      >
        {state.notice}
      </p>
    );
  }

  return null;
}

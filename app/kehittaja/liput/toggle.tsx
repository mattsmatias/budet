"use client";

import { useActionState } from "react";
import { setFlag, type DevState } from "../actions";

const initial: DevState = {};

/**
 * Globaali lippukytkin.
 *
 * KYTKIN ON LOMAKE, EI VALINTARUUTU.
 *
 * Valintaruutu joka tallentaa itsensä muuttuu vahingossa: yksi
 * harhainen klikkaus sammuttaa ominaisuuden kaikilta asiakkailta.
 * Erillinen painike tekee muutoksesta tarkoituksellisen, ja teksti
 * kertoo mitä painallus tekee.
 */
export function FlagToggle({
  flagKey,
  enabled,
  overrides,
}: {
  flagKey: string;
  enabled: boolean;
  overrides: number;
}) {
  const [state, action] = useActionState(setFlag, initial);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="key" value={flagKey} />
      <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />

      <button
        type="submit"
        className="rf-press px-3 py-1.5 text-[12.5px] font-bold"
        style={{
          background: enabled ? "var(--rf-inset)" : "var(--rf-accent)",
          color: enabled ? "var(--rf-text)" : "var(--rf-on-accent)",
          border: enabled ? "1px solid var(--rf-line-strong)" : "1px solid transparent",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        {enabled ? "Sammuta kaikilta" : "Ota käyttöön kaikille"}
      </button>

      {overrides > 0 ? (
        <span className="text-[12px]" style={{ color: "var(--rf-amber-text)" }}>
          {overrides === 1
            ? "1 ravintolalla on poikkeus — se ei muutu"
            : `${overrides} ravintolalla on poikkeus — ne eivät muutu`}
        </span>
      ) : null}

      {state.error ? (
        <span className="text-[12px]" style={{ color: "var(--rf-red-text)" }}>
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

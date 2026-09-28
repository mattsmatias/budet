"use client";

import { useActionState } from "react";
import { respondToFeedback, type DevState } from "../actions";

const initial: DevState = {};

const TILAT: { arvo: string; nimi: string }[] = [
  { arvo: "new", nimi: "Vastaanotettu" },
  { arvo: "in_progress", nimi: "Työn alla" },
  { arvo: "done", nimi: "Korjattu" },
  { arvo: "declined", nimi: "Ei toteuteta" },
];

/**
 * Vastaus ja tila samassa lähetyksessä.
 *
 * Teksti näkyy asiakkaalle sellaisenaan, joten kentän vieressä lukee
 * se — muuten tähän kirjoitetaan muistiinpano, ja muistiinpano
 * lähtee asiakkaalle.
 */
export function RespondForm({
  id,
  status,
  reply,
}: {
  id: string;
  status: string;
  reply: string | null;
}) {
  const [state, action, pending] = useActionState(respondToFeedback, initial);

  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="id" value={id} />

      <div className="flex flex-wrap items-center gap-2">
        {TILAT.map((tila) => (
          <label
            key={tila.arvo}
            className="rf-press cursor-pointer px-3 py-1.5 text-[12.5px] font-semibold"
            style={{
              borderRadius: "var(--rf-r-control)",
              background:
                tila.arvo === status ? "var(--rf-accent)" : "var(--rf-inset)",
              color:
                tila.arvo === status
                  ? "var(--rf-on-accent)"
                  : "var(--rf-text-2)",
            }}
          >
            <input
              type="radio"
              name="status"
              value={tila.arvo}
              defaultChecked={tila.arvo === status}
              className="sr-only"
            />
            {tila.nimi}
          </label>
        ))}
      </div>

      <div>
        <label
          htmlFor={`reply-${id}`}
          className="block text-[12.5px] font-semibold"
        >
          Vastaus — tämä näkyy asiakkaalle sellaisenaan
        </label>
        <textarea
          id={`reply-${id}`}
          name="reply"
          rows={3}
          maxLength={2000}
          defaultValue={reply ?? ""}
          placeholder="Tyhjä ei pyyhi aiempaa vastausta."
          className="mt-1.5 w-full px-3 py-2 text-[13px] outline-none focus-visible:ring-2"
          style={{
            background: "var(--rf-inset)",
            borderRadius: "var(--rf-r-control)",
            border: "1px solid var(--rf-line)",
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rf-press px-4 py-1.5 text-[12.5px] font-bold disabled:opacity-60"
          style={{
            borderRadius: "var(--rf-r-control)",
            background: "var(--rf-accent)",
            color: "var(--rf-on-accent)",
          }}
        >
          Tallenna
        </button>

        {state.error ? (
          <span className="text-[12px]" style={{ color: "var(--rf-red-text)" }}>
            {state.error}
          </span>
        ) : null}

        {state.notice ? (
          <span
            className="text-[12px] font-semibold"
            style={{ color: "var(--rf-green-text)" }}
          >
            {state.notice}
          </span>
        ) : null}
      </div>
    </form>
  );
}

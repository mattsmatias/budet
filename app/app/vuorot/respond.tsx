"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { respondToShift, type ActionState } from "../actions";

const initial: ActionState = {};

/**
 * Vuoron kuittaus.
 *
 * Kaksi painiketta samassa lomakkeessa: vastaus kulkee painikkeen arvona,
 * joten piilokenttää ei tarvita eikä tila voi ajautua painikkeen kanssa
 * eri linjalle.
 */
export function ShiftResponse({ shiftId }: { shiftId: string }) {
  const [state, action] = useActionState(respondToShift, initial);

  if (state.notice) {
    return (
      <p
        role="status"
        className="mt-3 px-3.5 py-2.5 text-center text-[13px] font-medium"
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

  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="shiftId" value={shiftId} />
      <div className="grid grid-cols-2 gap-2.5">
        <Button
          value="accepted"
          label="Hyväksy"
          background="var(--rf-green)"
          color="#fff"
        />
        <Button
          value="declined"
          label="En pääse"
          background="var(--rf-inset)"
          color="var(--rf-red-text)"
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="mt-3 px-3.5 py-2.5 text-[13px]"
          style={{
            background: "var(--rf-red-bg)",
            color: "var(--rf-red-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function Button({
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
      name="answer"
      value={value}
      disabled={pending}
      className="rf-press py-3 text-[15px] font-semibold disabled:opacity-50"
      style={{ background, color, borderRadius: "var(--rf-r-control)" }}
    >
      {label}
    </button>
  );
}

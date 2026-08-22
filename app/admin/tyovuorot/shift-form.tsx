"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteShift, saveShift, type AdminState } from "../actions";
import {
  POSITION_LABELS,
  type Shift,
  type StaffPosition,
  type User,
} from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";
import { Card } from "@/components/restoflow/ui";

const initial: AdminState = {};
const POSITIONS: StaffPosition[] = ["waiter", "kitchen", "manager", "cleaning"];

/**
 * Vuoron luonti ja muokkaus.
 *
 * Tekijän voi jättää tyhjäksi: silloin syntyy avoin vuoro johon kuka
 * tahansa voi tarttua. Avoimen vuoron on oltava mahdollinen, koska
 * työvuorolista tehdään usein ennen kuin tiedetään kuka on käytettävissä.
 */
export function ShiftForm({
  users,
  shift,
  defaultDate,
  onDone,
}: {
  users: User[];
  shift?: Shift;
  defaultDate: string;
  onDone?: () => void;
}) {
  const [state, action] = useActionState(saveShift, initial);

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

  return (
    <form action={action} className="space-y-3">
      {shift ? <input type="hidden" name="shiftId" value={shift.id} /> : null}

      <div>
        <label htmlFor="shift-user" className="block text-[13px] font-medium">
          Tekijä
        </label>
        <select
          id="shift-user"
          name="userId"
          defaultValue={shift?.userId ?? ""}
          className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
          style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
        >
          <option value="">Avoin vuoro</option>
          {users
            .filter((u) => u.position !== null)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.position ? ` · ${POSITION_LABELS[u.position]}` : ""}
              </option>
            ))}
        </select>
        <p className="mt-1 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          Tekijä saa vuoron hyväksyttäväkseen. Avoin vuoro näkyy kaikille.
        </p>
      </div>

      <div>
        <label htmlFor="shift-position" className="block text-[13px] font-medium">
          Tehtävä
        </label>
        <select
          id="shift-position"
          name="position"
          defaultValue=""
          className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
          style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
        >
          <option value="">—</option>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {POSITION_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      <Input
        label="Päivä"
        name="date"
        type="date"
        defaultValue={shift?.date ?? defaultDate}
        required
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Alkaa"
          name="start"
          type="time"
          defaultValue={shift?.startTime ?? "14:00"}
          required
        />
        <Input
          label="Päättyy"
          name="end"
          type="time"
          defaultValue={shift?.endTime ?? "22:00"}
          required
        />
      </div>

      <Input
        label="Paikka"
        name="location"
        defaultValue={shift?.location ?? ""}
        placeholder="Sali"
      />

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

      <div className="grid grid-cols-2 gap-2.5">
        <Save label={shift ? "Tallenna" : "Luo vuoro"} />
        {onDone ? (
          <button
            type="button"
            onClick={onDone}
            className="rf-press py-2.5 text-[14px] font-semibold"
            style={{
              background: "var(--rf-inset)",
              color: "var(--rf-text)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            Peruuta
          </button>
        ) : null}
      </div>

      {shift ? (
        <p className="text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
          Jos muutat hyväksytyn vuoron aikoja, tekijän on hyväksyttävä se
          uudelleen. Vanhat ajat näytetään hänelle.
        </p>
      ) : null}
    </form>
  );
}

/** Uuden vuoron avaava painike. */
export function NewShiftButton({
  users,
  defaultDate,
}: {
  users: User[];
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rf-press flex w-full items-center justify-center gap-2 py-3 text-[15px] font-semibold md:w-auto md:px-5"
        style={{
          background: "var(--rf-accent)",
          color: "var(--rf-on-accent)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <RfIcon name="plus" size={17} />
        Uusi työvuoro
      </button>
    );
  }

  return (
    <Card>
      <p className="mb-3 text-[15px] font-semibold">Uusi työvuoro</p>
      <ShiftForm users={users} defaultDate={defaultDate} onDone={() => setOpen(false)} />
    </Card>
  );
}

/** Vuoron muokkaus ja poisto. */
export function EditShift({
  users,
  shift,
}: {
  users: User[];
  shift: Shift;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rf-press px-3 py-1.5 text-[13px] font-medium"
        style={{
          background: "var(--rf-inset)",
          color: "var(--rf-text-2)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        Muokkaa
      </button>
    );
  }

  return (
    <div className="mt-3 w-full basis-full border-t pt-3" style={{ borderColor: "var(--rf-line)" }}>
      <ShiftForm
        users={users}
        shift={shift}
        defaultDate={shift.date}
        onDone={() => setOpen(false)}
      />

      <div className="mt-3">
        {confirming ? (
          <form action={deleteShift} className="flex items-center gap-2">
            <input type="hidden" name="shiftId" value={shift.id} />
            <button
              type="submit"
              className="rf-press px-3 py-1.5 text-[13px] font-semibold"
              style={{
                background: "var(--rf-red)",
                color: "var(--rf-on-accent)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              Poista vuoro
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-[13px]"
              style={{ color: "var(--rf-text-2)" }}
            >
              Peruuta
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-[13px] underline underline-offset-4"
            style={{ color: "var(--rf-red-text)" }}
          >
            Poista vuoro
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Input({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const id = `sh-${name}`;

  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
        style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
      />
    </div>
  );
}

function Save({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press py-2.5 text-[14px] font-semibold disabled:opacity-50"
      style={{
        background: "var(--rf-accent)",
        color: "var(--rf-on-accent)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {pending ? "Tallennetaan…" : label}
    </button>
  );
}

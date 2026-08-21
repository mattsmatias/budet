"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createInvitation,
  updateMembership,
  type AdminState,
} from "../actions";
import {
  POSITION_LABELS,
  ROLE_LABELS,
  type Role,
  type StaffPosition,
  type User,
} from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, Pill } from "@/components/restoflow/ui";

const initial: AdminState = {};

const ROLES: Role[] = ["owner", "manager", "employee", "accountant"];
const POSITIONS: StaffPosition[] = ["waiter", "kitchen", "manager", "cleaning"];

// ---------------------------------------------------------------------------
// Kutsuminen
// ---------------------------------------------------------------------------

/**
 * Kutsukoodin luonti.
 *
 * Koodi näytetään kerran. Kannassa on vain tiiviste, joten sitä ei voi
 * hakea myöhemmin — kadonnut koodi mitätöidään ja luodaan uusi.
 */
export function InviteForm() {
  const [state, action] = useActionState(createInvitation, initial);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("employee");

  if (state.code) {
    return (
      <Card>
        <p className="text-[15px] font-semibold">Kutsukoodi luotu</p>
        <p
          className="mt-1.5 text-[13px] leading-relaxed"
          style={{ color: "var(--rf-text-2)" }}
        >
          Anna tämä koodi työntekijälle. Hän luo tunnuksen ja syöttää koodin
          liittyäkseen. Koodi näytetään vain nyt.
        </p>

        <p
          className="rf-tabular mt-4 select-all py-4 text-center text-[28px] font-semibold tracking-[0.14em]"
          style={{
            background: "var(--rf-inset)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {state.code}
        </p>

        <p className="mt-3 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          Voimassa 14 päivää · yksi käyttökerta
        </p>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rf-press mt-4 w-full py-3 text-[15px] font-semibold"
          style={{
            background: "var(--rf-inset)",
            color: "var(--rf-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          Valmis
        </button>
      </Card>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rf-press flex w-full items-center justify-center gap-2 py-3.5 text-[15px] font-semibold"
        style={{
          background: "var(--rf-text)",
          color: "#fff",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <RfIcon name="plus" size={18} />
        Kutsu käyttäjä
      </button>
    );
  }

  return (
    <Card>
      <form action={action} className="space-y-4">
        <p className="text-[15px] font-semibold">Kutsu käyttäjä</p>

        <Select label="Rooli" name="role" value={role} onChange={(v) => setRole(v as Role)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>

        <p className="text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
          {ROLE_HINTS[role]}
        </p>

        {role !== "accountant" ? (
          <>
            <Select label="Tehtävä" name="position" defaultValue="waiter">
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {POSITION_LABELS[p]}
                </option>
              ))}
            </Select>

            <Input
              label="Tuntipalkka"
              name="hourlyRate"
              inputMode="decimal"
              placeholder="14,50"
              suffix="€/h"
              hint="Käytetään henkilöstökulujen laskentaan. Voi jättää tyhjäksi."
            />
          </>
        ) : (
          <input type="hidden" name="position" value="" />
        )}

        <Input
          label="Nimilappu"
          name="label"
          placeholder="Uusi tarjoilija"
          hint="Vain sinulle, jotta tunnistat kutsun listasta."
        />

        {state.error ? <ErrorText>{state.error}</ErrorText> : null}

        <div className="grid grid-cols-2 gap-2.5">
          <Submit label="Luo koodi" busy="Luodaan…" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rf-press py-3 text-[15px] font-semibold"
            style={{
              background: "var(--rf-inset)",
              color: "var(--rf-text)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            Peruuta
          </button>
        </div>
      </form>
    </Card>
  );
}

const ROLE_HINTS: Record<Role, string> = {
  owner: "Näkee ja muokkaa kaiken, mukaan lukien budjetit ja käyttäjät.",
  manager: "Näkee kaiken ja hallitsee vuoroja ja kuitteja, muttei budjetteja.",
  employee: "Näkee vain omat vuoronsa, oman työaikansa ja lisäämänsä kuitit.",
  accountant: "Näkee kulut, ALV:t ja raportit — ei tuntipalkkoja eikä työvuoroja.",
};

// ---------------------------------------------------------------------------
// Jäsenen muokkaus
// ---------------------------------------------------------------------------

export function MemberForm({ user }: { user: User }) {
  const [state, action] = useActionState(updateMembership, initial);
  const [open, setOpen] = useState(false);

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
    <form action={action} className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: "var(--rf-line)" }}>
      <input type="hidden" name="userId" value={user.id} />

      <Select label="Rooli" name="role" defaultValue={user.role}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </Select>

      <Select label="Tehtävä" name="position" defaultValue={user.position ?? ""}>
        <option value="">—</option>
        {POSITIONS.map((p) => (
          <option key={p} value={p}>
            {POSITION_LABELS[p]}
          </option>
        ))}
      </Select>

      <Input
        label="Tuntipalkka"
        name="hourlyRate"
        inputMode="decimal"
        suffix="€/h"
        defaultValue={
          user.hourlyRateCents === null
            ? ""
            : (user.hourlyRateCents / 100).toFixed(2).replace(".", ",")
        }
      />

      {state.error ? <ErrorText>{state.error}</ErrorText> : null}
      {state.notice ? (
        <p className="text-[13px]" style={{ color: "var(--rf-green-text)" }}>
          {state.notice}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5">
        <Submit label="Tallenna" busy="Tallennetaan…" />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rf-press py-3 text-[15px] font-semibold"
          style={{
            background: "var(--rf-inset)",
            color: "var(--rf-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          Sulje
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Jaetut kentät
// ---------------------------------------------------------------------------

export function Input({
  label,
  name,
  defaultValue,
  placeholder,
  suffix,
  hint,
  inputMode,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  suffix?: string;
  hint?: string;
  inputMode?: "decimal" | "text";
  type?: string;
  required?: boolean;
}) {
  const id = `f-${name}-${label}`;

  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium">
        {label}
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          id={id}
          name={name}
          type={type}
          inputMode={inputMode}
          defaultValue={defaultValue}
          placeholder={placeholder}
          required={required}
          className="w-full px-3.5 py-2.5 text-[16px] outline-none"
          style={{
            background: "var(--rf-inset)",
            borderRadius: "var(--rf-r-control)",
          }}
        />
        {suffix ? (
          <span className="shrink-0 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p className="mt-1 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Select({
  label,
  name,
  children,
  defaultValue,
  value,
  onChange,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const id = `s-${name}-${label}`;

  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={onChange ? undefined : defaultValue}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
        style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
      >
        {children}
      </select>
    </div>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="px-3.5 py-2.5 text-[13px] leading-relaxed"
      style={{
        background: "var(--rf-red-bg)",
        color: "var(--rf-red-text)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {children}
    </p>
  );
}

export function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press py-3 text-[15px] font-semibold disabled:opacity-50"
      style={{
        background: "var(--rf-text)",
        color: "#fff",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {pending ? busy : label}
    </button>
  );
}

export function StatusPill({ role }: { role: Role }) {
  return (
    <Pill tone={role === "owner" ? "info" : role === "accountant" ? "neutral" : "neutral"}>
      {ROLE_LABELS[role]}
    </Pill>
  );
}

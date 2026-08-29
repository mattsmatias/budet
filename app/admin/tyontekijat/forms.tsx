"use client";

import { useActionState, useState } from "react";
import { type Labels } from "@/lib/i18n/labels";
import { useFormStatus } from "react-dom";
import {
  createInvitation,
  updateMembership,
  type AdminState,
} from "../actions";
import {
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
export function InviteForm({ nimet }: { nimet: Labels }) {
  const [state, action] = useActionState(createInvitation, initial);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("employee");

  if (state.code) {
    return <InviteCode nimet={nimet} code={state.code} role={role} />;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        /*
         * Ei koko rivin levyinen palkki.
         *
         * Se oli sivun näyttävin elementti — leveämpi ja punaisempi
         * kuin yksikään avainluku — vaikka käyttäjän kutsuminen on
         * harvinaisin asia mitä tällä sivulla tehdään. Nyt se on
         * saman kokoinen kuin muiden sivujen päätoiminto.
         */
        className="rf-press inline-flex items-center justify-center gap-2 whitespace-nowrap px-[15px] py-[9px] text-[13px] font-bold"
        style={{
          background: "var(--rf-accent)",
          color: "var(--rf-on-accent)",
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

        <Select
          label="Rooli"
          name="role"
          value={role}
          onChange={(v) => setRole(v as Role)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {nimet.roles[r]}
            </option>
          ))}
        </Select>

        <p
          className="text-[12px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          {ROLE_HINTS[role]}
        </p>

        {role !== "accountant" ? (
          <>
            <Select label="Tehtävä" name="position" defaultValue="waiter">
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {nimet.positions[p]}
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
  accountant:
    "Näkee kulut, ALV:t ja raportit — ei tuntipalkkoja eikä työvuoroja.",
};

// ---------------------------------------------------------------------------
// Jäsenen muokkaus
// ---------------------------------------------------------------------------

export function MemberForm({ nimet, user }: { nimet: Labels; user: User }) {
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
    <form
      action={action}
      className="mt-3 space-y-3 border-t pt-3"
      style={{ borderColor: "var(--rf-line)" }}
    >
      <input type="hidden" name="userId" value={user.id} />

      <Select label="Rooli" name="role" defaultValue={user.role}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {nimet.roles[r]}
          </option>
        ))}
      </Select>

      <Select
        label="Tehtävä"
        name="position"
        defaultValue={user.position ?? ""}
      >
        <option value="">—</option>
        {POSITIONS.map((p) => (
          <option key={p} value={p}>
            {nimet.positions[p]}
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
          <span
            className="shrink-0 text-[14px]"
            style={{ color: "var(--rf-text-2)" }}
          >
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
        style={{
          background: "var(--rf-inset)",
          borderRadius: "var(--rf-r-control)",
        }}
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
        background: "var(--rf-accent)",
        color: "var(--rf-on-accent)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {pending ? busy : label}
    </button>
  );
}

export function StatusPill({ nimet, role }: { nimet: Labels; role: Role }) {
  return (
    <Pill
      tone={
        role === "owner"
          ? "info"
          : role === "accountant"
            ? "neutral"
            : "neutral"
      }
    >
      {nimet.roles[role]}
    </Pill>
  );
}

// ---------------------------------------------------------------------------

/**
 * Luotu kutsukoodi ja ohje sen käyttöön.
 *
 * Pelkkä koodi ei riitä. Kutsuttu ei tiedä mihin osoitteeseen mennä
 * eikä että hänen pitää ensin luoda oma tunnus — omistaja joutuisi
 * selittämään sen joka kerta itse, ja selittäisi eri tavalla joka
 * kerta. Ohje on siksi valmiina ja kopioitavissa yhtenä viestinä.
 *
 * Osoite luetaan selaimesta eikä asetuksista: se on aina se osoite
 * jossa omistaja oikeasti on, myös testiympäristössä.
 */
function InviteCode({
  nimet,
  code,
  role,
}: {
  nimet: Labels;
  code: string;
  role: Role;
}) {
  const [copied, setCopied] = useState<"code" | "message" | null>(null);
  const [failed, setFailed] = useState(false);

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const message =
    `Sinut on kutsuttu Kateen (${nimet.roles[role].toLowerCase()}).

` +
    `1. Mene osoitteeseen ${origin}/rekisteroidy?tila=liity
` +
    `2. Luo tunnus omalla sähköpostillasi
` +
    `3. Valitse "Liity koodilla"
` +
    `4. Syötä koodi: ${code}

` +
    `Koodi on voimassa 14 päivää ja toimii kerran.`;

  async function copy(text: string, what: "code" | "message") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setFailed(false);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      // Leikepöytä ei ole käytettävissä esimerkiksi ilman HTTPS:ää.
      // Kerrotaan se, koska hiljaa epäonnistuva kopiointi saa
      // käyttäjän liittämään vanhaa sisältöä huomaamatta.
      setFailed(true);
    }
  }

  return (
    <Card>
      <p className="text-[15px] font-semibold">Kutsukoodi luotu</p>
      <p
        className="mt-1.5 text-[13px] leading-relaxed"
        style={{ color: "var(--rf-text-2)" }}
      >
        Koodi näytetään vain nyt. Kannassa on siitä vain tiiviste, joten sitä ei
        voi hakea myöhemmin.
      </p>

      <p
        className="rf-tabular mt-4 select-all py-4 text-center text-[28px] font-semibold tracking-[0.14em]"
        style={{
          background: "var(--rf-inset)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        {code}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => copy(code, "code")}
          className="rf-press py-2.5 text-[14px] font-semibold"
          style={{
            background: "var(--rf-inset)",
            color: "var(--rf-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {copied === "code" ? "Kopioitu" : "Kopioi koodi"}
        </button>

        <button
          type="button"
          onClick={() => copy(message, "message")}
          className="rf-press py-2.5 text-[14px] font-semibold"
          style={{
            background: "var(--rf-accent)",
            color: "var(--rf-on-accent)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {copied === "message" ? "Kopioitu" : "Kopioi ohje"}
        </button>
      </div>

      {failed ? (
        <p
          className="mt-2 text-[12px]"
          style={{ color: "var(--rf-amber-text)" }}
        >
          Kopiointi ei onnistunut tässä selaimessa. Valitse teksti ja kopioi
          käsin.
        </p>
      ) : null}

      <div
        className="mt-4 border-t pt-4"
        style={{ borderColor: "var(--rf-line)" }}
      >
        <p className="text-[13px] font-semibold">Näin kutsuttu pääsee sisään</p>

        <ol className="mt-2 space-y-2">
          {[
            <>
              Menee osoitteeseen{" "}
              <span className="rf-tabular font-medium">
                {origin}/rekisteroidy?tila=liity
              </span>
            </>,
            <>Luo tunnuksen omalla sähköpostillaan</>,
            <>
              Valitsee <strong>Liity koodilla</strong>
            </>,
            <>Syöttää koodin ja hyväksyy kutsun</>,
          ].map((step, index) => (
            <li
              key={index}
              className="flex gap-2.5 text-[13px] leading-relaxed"
            >
              <span
                aria-hidden="true"
                className="rf-tabular flex h-5 w-5 shrink-0 items-center justify-center text-[11px] font-semibold"
                style={{
                  background: "var(--rf-accent-bg)",
                  color: "var(--rf-accent-strong)",
                  borderRadius: "50%",
                }}
              >
                {index + 1}
              </span>
              <span style={{ color: "var(--rf-text-2)" }}>{step}</span>
            </li>
          ))}
        </ol>

        <p
          className="mt-3 text-[12px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          Kate ei lähetä sähköpostia — anna koodi hänelle itse. Voimassa 14
          päivää, yksi käyttökerta.
        </p>
      </div>

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

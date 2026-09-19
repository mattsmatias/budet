"use client";

/**
 * Käyttäjät: kuka pääsee Kateen.
 *
 * Tämä on pääsynhallintaa, ei henkilöstöhallintoa. Kate näyttää
 * ravintolan rahan omistajalle, esihenkilölle ja kirjanpitäjälle;
 * palkat maksetaan palkkapalvelussa. Siksi tässä ei ole tehtävänimikettä
 * eikä tuntipalkkaa — vain rooli, joka ratkaisee mitä käyttäjä näkee.
 *
 * Kirjanpitäjän kutsuminen on tämän osion tärkein syy olla olemassa:
 * ilman sitä raportit pitäisi lähettää käsin joka kuukausi.
 */

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { fill } from "@/lib/i18n/auth-text";
import type { AdminText } from "@/lib/i18n/admin-text";
import type { Labels } from "@/lib/i18n/labels";
import type { Role } from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";
import { Card } from "@/components/restoflow/ui";
import {
  createInvitation,
  updateMembership,
  type AdminState,
} from "../actions";

const initial: AdminState = {};

/** Roolit joihin voi kutsua. Työntekijärooli ei ole enää mukana. */
const ROLES: Role[] = ["owner", "manager", "accountant"];

const roolienSelitteet = (t: AdminText): Record<Role, string> => ({
  owner: t.tiimi.roleOwner,
  manager: t.tiimi.roleManager,
  employee: t.tiimi.roleEmployee,
  accountant: t.tiimi.roleAccountant,
});

// ---------------------------------------------------------------------------
// Kutsuminen
// ---------------------------------------------------------------------------

/**
 * Kutsukoodin luonti.
 *
 * Koodi näytetään kerran. Kannassa on vain tiiviste, joten sitä ei voi
 * hakea myöhemmin — kadonnut koodi mitätöidään ja luodaan uusi.
 *
 * Oletusrooli on kirjanpitäjä, koska se on yleisin syy kutsua joku
 * Kateen: omistaja ja esihenkilö ovat usein sama ihminen.
 */
export function InviteForm({ t, nimet }: { t: AdminText; nimet: Labels }) {
  const [state, action] = useActionState(createInvitation, initial);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("accountant");

  if (state.code) {
    return <InviteCode t={t} nimet={nimet} code={state.code} role={role} />;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rf-press inline-flex items-center justify-center gap-2 whitespace-nowrap px-[15px] py-[9px] text-[13px] font-bold"
        style={{
          background: "var(--rf-accent)",
          color: "var(--rf-on-accent)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <RfIcon name="plus" size={18} />
        {t.tiimi.inviteUser}
      </button>
    );
  }

  return (
    <Card>
      <form action={action} className="space-y-4">
        <p className="text-[15px] font-semibold">{t.tiimi.inviteUser}</p>

        <Select
          label={t.tiimi.role}
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
          {roolienSelitteet(t)[role]}
        </p>

        <Input
          label={t.tiimi.nameTag}
          name="label"
          hint={t.tiimi.nameTagHint}
        />

        {state.error ? <ErrorText>{state.error}</ErrorText> : null}

        <div className="grid grid-cols-2 gap-2.5">
          <Submit label={t.tiimi.createCode} busy={t.tiimi.creating} />
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
            {t.tiimi.cancel}
          </button>
        </div>
      </form>
    </Card>
  );
}

/**
 * Luotu kutsukoodi ja ohje sen käyttöön.
 *
 * Pelkkä koodi ei riitä. Kutsuttu ei tiedä mihin osoitteeseen mennä
 * eikä että hänen pitää ensin luoda oma tunnus — omistaja joutuisi
 * selittämään sen joka kerta itse. Ohje on siksi valmiina ja
 * kopioitavissa yhtenä viestinä.
 *
 * Osoite luetaan selaimesta eikä asetuksista: se on aina se osoite
 * jossa omistaja oikeasti on, myös testiympäristössä.
 */
function InviteCode({
  t,
  nimet,
  code,
  role,
}: {
  t: AdminText;
  nimet: Labels;
  code: string;
  role: Role;
}) {
  const [copied, setCopied] = useState<"code" | "message" | null>(null);
  const [failed, setFailed] = useState(false);

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const message = [
    fill(t.tiimi.inviteLine1, { rooli: nimet.roles[role].toLowerCase() }),
    "",
    fill(t.tiimi.inviteLine2, { osoite: origin }),
    t.tiimi.inviteLine3,
    t.tiimi.inviteLine4,
    fill(t.tiimi.inviteLine5, { koodi: code }),
    "",
    t.tiimi.inviteLine6,
  ].join("\n");

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
      <p className="text-[15px] font-semibold">{t.tiimi.codeCreated}</p>
      <p
        className="mt-1.5 text-[13px] leading-relaxed"
        style={{ color: "var(--rf-text-2)" }}
      >
        {t.tiimi.codeShownOnce}
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
          {copied === "code" ? t.tiimi.copied : t.tiimi.copyCode}
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
          {copied === "message" ? t.tiimi.copied : t.tiimi.copyInstructions}
        </button>
      </div>

      {failed ? (
        <p
          className="mt-2 text-[12px]"
          style={{ color: "var(--rf-amber-text)" }}
        >
          {t.tiimi.copyFailed}
        </p>
      ) : null}

      <div
        className="mt-4 border-t pt-4"
        style={{ borderColor: "var(--rf-line)" }}
      >
        <p className="text-[13px] font-semibold">{t.tiimi.howToJoin}</p>

        <ol className="mt-2 space-y-2">
          {[
            <>
              {fill(t.tiimi.goesToAddress, {
                osoite: `${origin}/rekisteroidy?tila=liity`,
              })}
            </>,
            <>{t.tiimi.createsAccount}</>,
            <>
              {t.tiimi.chooses}
              <strong>{t.tiimi.joinWithCode}</strong>
            </>,
            <>{t.tiimi.entersCode}</>,
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
          {t.tiimi.noEmailSent}
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
        {t.tiimi.done}
      </button>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Roolin muutos ja pääsyn poisto
// ---------------------------------------------------------------------------

/**
 * Käyttäjän rooli.
 *
 * Nykyinen rooli näkyy valinnoissa myös silloin kun sitä ei enää
 * tarjota kutsuissa — muuten vanhan työntekijäkäyttäjän rooli
 * vaihtuisi hiljaa ensimmäiseen vaihtoehtoon pelkästä avaamisesta.
 *
 * Kanta vaatii että ravintolassa on aina omistaja. Viimeisen
 * omistajan roolin muutos palauttaa siitä kertovan virheen.
 */
export function MemberForm({
  t,
  nimet,
  userId,
  role,
  self,
}: {
  t: AdminText;
  nimet: Labels;
  userId: string;
  role: Role;
  /** Oma tunnus: omaa pääsyä ei voi poistaa täältä. */
  self: boolean;
}) {
  const [state, action] = useActionState(updateMembership, initial);
  const [open, setOpen] = useState(false);

  const vaihtoehdot = ROLES.includes(role) ? ROLES : [role, ...ROLES];

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
        {t.tiimi.edit}
      </button>
    );
  }

  return (
    <div
      className="mt-3 w-full space-y-3 border-t pt-3"
      style={{ borderColor: "var(--rf-line)" }}
    >
      <form action={action} className="space-y-3">
        <input type="hidden" name="userId" value={userId} />

        <Select label={t.tiimi.role} name="role" defaultValue={role}>
          {vaihtoehdot.map((r) => (
            <option key={r} value={r}>
              {nimet.roles[r]}
            </option>
          ))}
        </Select>

        {state.error ? <ErrorText>{state.error}</ErrorText> : null}
        {state.notice ? (
          <p className="text-[13px]" style={{ color: "var(--rf-green-text)" }}>
            {state.notice}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2.5">
          <Submit label={t.tiimi.save} busy={t.tiimi.savingEllipsis} />
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
            {t.tiimi.close}
          </button>
        </div>
      </form>

      {self ? null : (
        <form action={action}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="active" value="false" />
          <button
            type="submit"
            className="rf-press px-3 py-1.5 text-[13px] font-medium"
            style={{
              background: "var(--rf-red-bg)",
              color: "var(--rf-red-text)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            {t.asetus.removeAccess}
          </button>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kentät
// ---------------------------------------------------------------------------

function Input({
  label,
  name,
  hint,
}: {
  label: string;
  name: string;
  hint?: string;
}) {
  const id = `f-${name}`;

  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        maxLength={80}
        className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
        style={{
          background: "var(--rf-inset)",
          borderRadius: "var(--rf-r-control)",
        }}
      />
      {hint ? (
        <p className="mt-1 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Select({
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

function ErrorText({ children }: { children: React.ReactNode }) {
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

function Submit({ label, busy }: { label: string; busy: string }) {
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

"use client";

/**
 * Kirjanpidon painikkeet.
 *
 * PALAUTE KUULUU PAINIKKEEN VIEREEN.
 *
 * Nämä muodostavat tai kirjaavat tositteita, ja tulos on luku jonka
 * käyttäjä haluaa nähdä heti: "6 kirjausesitystä muodostettu". Sivun
 * yläreunan ilmoituspalkki olisi eri paikassa kuin teko.
 */

import { useActionState } from "react";
import { fill } from "@/lib/i18n/auth-text";
import type { AdminText } from "@/lib/i18n/admin-text";
import { useFormStatus } from "react-dom";
import { RfIcon, type IconName } from "@/components/restoflow/icons";
import type { AdminState } from "../actions";
import {
  closeMonth,
  correctEntry,
  postAll,
  postEntry,
  rejectEntry,
  syncMonth,
} from "./actions";

const alku: AdminState = {};

function Painike({
  label,
  pending,
  icon,
  tone = "quiet",
}: {
  label: string;
  pending: string;
  icon?: IconName;
  tone?: "primary" | "quiet" | "danger";
}) {
  const status = useFormStatus();

  const tyyli =
    tone === "primary"
      ? {
          background: "var(--rf-accent)",
          color: "var(--rf-on-accent)",
          border: "1px solid transparent",
        }
      : tone === "danger"
        ? {
            background: "var(--rf-card)",
            color: "var(--rf-red-text)",
            border: "1px solid var(--rf-line-strong)",
          }
        : {
            background: "var(--rf-inset)",
            color: "var(--rf-text)",
            border: "1px solid var(--rf-line-strong)",
          };

  return (
    <button
      type="submit"
      disabled={status.pending}
      className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
      style={{
        ...tyyli,
        borderRadius: "var(--rf-r-control)",
        opacity: status.pending ? 0.6 : 1,
      }}
    >
      {icon ? <RfIcon name={icon} size={15} /> : null}
      {status.pending ? pending : label}
    </button>
  );
}

function Viesti({ state }: { state: AdminState }) {
  if (!state.error && !state.notice) return null;

  return (
    <p
      role={state.error ? "alert" : "status"}
      className="text-[12.5px] leading-relaxed"
      style={{ color: state.error ? "var(--rf-red-text)" : "var(--rf-text-2)" }}
    >
      {state.error ?? state.notice}
    </p>
  );
}

/** Muodosta kuukauden kirjausesitykset lähteistä. */
export function SyncButton({ t, month }: { t: AdminText; month: string }) {
  const [state, action] = useActionState(syncMonth, alku);

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="kuukausi" value={month} />
      <Painike
        label={t.kirja.fetchEvents}
        pending={t.kirja.fetching}
        icon="download"
        tone="primary"
      />
      <Viesti state={state} />
    </form>
  );
}

/** Hyväksy kaikki kuukauden esitykset. */
export function PostAllButton({
  t,
  month,
  count,
}: {
  t: AdminText;
  month: string;
  count: number;
}) {
  const [state, action] = useActionState(postAll, alku);

  if (count === 0) return null;

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="kuukausi" value={month} />
      <Painike
        label={fill(t.kirja.postAllCount, { maara: String(count) })}
        pending={t.kirja.posting}
        icon="check"
      />
      <Viesti state={state} />
    </form>
  );
}

export function PostEntryButton({ t, id }: { t: AdminText; id: string }) {
  const [state, action] = useActionState(postEntry, alku);

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <Painike label={t.kirja.post} pending="…" />
      <Viesti state={state} />
    </form>
  );
}

export function RejectEntryButton({ t, id }: { t: AdminText; id: string }) {
  const [state, action] = useActionState(rejectEntry, alku);

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <Painike label={t.kirja.reject} pending="…" tone="danger" />
      <Viesti state={state} />
    </form>
  );
}

/**
 * Korjaustosite.
 *
 * Syy on pakollinen ja kysytään samassa lomakkeessa: erillinen
 * vahvistusikkuna kysyisi saman asian kahdesti, ja syy ilman
 * korjausta ei tarkoita mitään.
 */
export function CorrectEntryForm({ t, id }: { t: AdminText; id: string }) {
  const [state, action] = useActionState(correctEntry, alku);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input
        name="syy"
        required
        maxLength={200}
        placeholder={t.kirja.correctionReason}
        className="min-w-0 flex-1 px-3 py-2 text-[13px]"
        style={{
          background: "var(--rf-card)",
          border: "1px solid var(--rf-line-strong)",
          borderRadius: "var(--rf-r-control)",
        }}
      />
      <Painike label={t.kirja.makeCorrection} pending="…" />
      <Viesti state={state} />
    </form>
  );
}

/**
 * Kuukauden sulku.
 *
 * Kanta kieltäytyy jos täsmäytys ei mene läpi, joten painike saa olla
 * näkyvissä aina: sen painaminen kertoo tarkalleen mikä estää.
 * Piilotettu painike jättäisi arvailtavaksi miksi mitään ei tapahdu.
 */
export function CloseMonthForm({ t, month }: { t: AdminText; month: string }) {
  const [state, action] = useActionState(closeMonth, alku);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="kuukausi" value={month} />
      <input
        name="merkinta"
        maxLength={200}
        placeholder={t.kirja.correctionPlaceholder}
        className="min-w-0 flex-1 px-3 py-2 text-[13px]"
        style={{
          background: "var(--rf-card)",
          border: "1px solid var(--rf-line-strong)",
          borderRadius: "var(--rf-r-control)",
        }}
      />
      <Painike label={t.kirja.closeMonth} pending={t.kirja.closing} />
      <Viesti state={state} />
    </form>
  );
}

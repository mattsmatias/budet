"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  copyLunchDay,
  copyLunchWeek,
  publishLunchWeek,
  setLunchWeekStatus,
  type LunchState,
} from "./actions";
import { RfIcon } from "@/components/restoflow/icons";
import { Button } from "@/components/restoflow/ui";

const initial: LunchState = {};

function Notice({ state }: { state: LunchState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="mt-2 px-3 py-2 text-[12px]"
        style={{
          background: "var(--rf-red-bg)",
          color: "var(--rf-red-text)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        {state.error}
      </p>
    );
  }

  if (state.notice) {
    return (
      <p
        role="status"
        className="mt-2 px-3 py-2 text-[12px] font-medium"
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

  return null;
}

// ---------------------------------------------------------------------------
// Julkaisu
// ---------------------------------------------------------------------------

/**
 * Julkaisu vahvistuksella.
 *
 * Julkaisu muuttaa sitä mitä ovessa olevan QR-koodin takaa näkyy, joten
 * se kysytään erikseen. Vahvistuksessa lukee viikko: väärän viikon
 * julkaiseminen on juuri se virhe joka tässä halutaan estää.
 */
export function PublishWeek({
  menuId,
  weekLabel,
  disabled,
  label,
}: {
  menuId: string | null;
  weekLabel: string;
  disabled: boolean;
  label: string;
}) {
  const [state, action] = useActionState(publishLunchWeek, initial);
  const [asking, setAsking] = useState(false);

  if (menuId === null) return null;

  if (!asking) {
    return (
      <div>
        <Button
          type="button"
          tone="primary"
          disabled={disabled}
          onClick={() => setAsking(true)}
          icon={<RfIcon name="check" size={16} />}
        >
          {label}
        </Button>
        <Notice state={state} />
      </div>
    );
  }

  return (
    <div
      className="px-3.5 py-3"
      style={{
        background: "var(--rf-inset)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <p className="text-[13px] font-medium">Julkaistaanko viikon lounaslista?</p>
      <p className="mt-0.5 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {weekLabel}
      </p>

      <form action={action} className="mt-3 flex gap-2">
        <input type="hidden" name="menuId" value={menuId} />
        <PublishSubmit />
        <Button type="button" tone="ghost" size="sm" onClick={() => setAsking(false)}>
          Peruuta
        </Button>
      </form>

      <Notice state={state} />
    </div>
  );
}

function PublishSubmit() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" tone="primary" size="sm" disabled={pending}>
      {pending ? "Julkaistaan…" : "Julkaise"}
    </Button>
  );
}

/** Arkistointi ja palautus luonnokseksi. */
export function WeekStatusButton({
  menuId,
  status,
}: {
  menuId: string;
  status: "draft" | "archived";
}) {
  const [state, action] = useActionState(setLunchWeekStatus, initial);
  const { } = state;

  return (
    <form action={action}>
      <input type="hidden" name="menuId" value={menuId} />
      <input type="hidden" name="status" value={status} />

      <Button type="submit" tone="ghost" size="sm">
        {status === "archived" ? "Arkistoi" : "Palauta luonnokseksi"}
      </Button>

      <Notice state={state} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Kopiointi
// ---------------------------------------------------------------------------

export function CopyPreviousWeek({
  fromWeek,
  toWeek,
  fromLabel,
  toLabel,
  tone = "ghost",
}: {
  fromWeek: string;
  toWeek: string;
  fromLabel: string;
  toLabel: string;
  tone?: "ghost" | "primary";
}) {
  const [state, action] = useActionState(copyLunchWeek, initial);
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <div>
        <Button
          type="button"
          tone={tone}
          onClick={() => setAsking(true)}
          icon={<RfIcon name="file" size={16} />}
        >
          Kopioi viime viikko
        </Button>
        <Notice state={state} />
      </div>
    );
  }

  return (
    <div
      className="px-3.5 py-3"
      style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
    >
      <p className="text-[13px] font-medium">Kopioidaanko lounaslista?</p>
      <p className="mt-0.5 text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
        {fromLabel} → {toLabel}
      </p>
      <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
        Kohdeviikon nykyinen sisältö korvataan. Kopio on luonnos eikä se
        julkaise mitään.
      </p>

      <form action={action} className="mt-3 flex gap-2">
        <input type="hidden" name="fromWeek" value={fromWeek} />
        <input type="hidden" name="toWeek" value={toWeek} />
        <CopySubmit />
        <Button type="button" tone="ghost" size="sm" onClick={() => setAsking(false)}>
          Peruuta
        </Button>
      </form>

      <Notice state={state} />
    </div>
  );
}

function CopySubmit() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" tone="primary" size="sm" disabled={pending}>
      {pending ? "Kopioidaan…" : "Kopioi"}
    </Button>
  );
}

/** Päivän kopiointi toiseen päivään samalla viikolla. */
export function CopyDay({
  dayId,
  dayLabel,
  targets,
}: {
  dayId: string;
  dayLabel: string;
  targets: { id: string; label: string }[];
}) {
  const [state, action] = useActionState(copyLunchDay, initial);
  const [open, setOpen] = useState(false);

  if (targets.length === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        // -my-3 py-3: kosketusalue 18 -> 42 px ilman että mikään siirtyy.
        className="rf-press -my-3 py-3 text-[12px] font-medium"
        style={{ color: "var(--rf-text-3)" }}
      >
        Kopioi toiseen päivään
      </button>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="fromDay" value={dayId} />

      <label htmlFor={`copy-${dayId}`} className="block text-[12px] font-medium">
        {`Kopioi ${dayLabel} päivään`}
      </label>

      <select
        id={`copy-${dayId}`}
        name="toDay"
        required
        defaultValue=""
        className="w-full px-3 py-2 text-[14px] outline-none"
        style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
      >
        <option value="" disabled>
          Valitse päivä…
        </option>
        {targets.map((target) => (
          <option key={target.id} value={target.id}>
            {target.label}
          </option>
        ))}
      </select>

      <p className="text-[11px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
        Kohdepäivän nykyinen sisältö korvataan.
      </p>

      <div className="flex gap-2">
        <Button type="submit" tone="secondary" size="sm">
          Kopioi
        </Button>
        <Button type="button" tone="ghost" size="sm" onClick={() => setOpen(false)}>
          Peruuta
        </Button>
      </div>

      <Notice state={state} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Jakaminen
// ---------------------------------------------------------------------------

/** Julkisen osoitteen kopiointi leikepöydälle. */
export function CopyPublicLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code
        className="min-w-0 flex-1 truncate px-3 py-2 text-[12px]"
        style={{
          background: "var(--rf-inset)",
          borderRadius: "var(--rf-r-control)",
          color: "var(--rf-text-2)",
        }}
      >
        {url}
      </code>

      <Button
        type="button"
        tone="secondary"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Leikepöytä voi olla estetty. Osoite on näkyvissä yllä,
            // joten sen voi valita käsin — parempi kuin virheilmoitus
            // jolle ei voi tehdä mitään.
            setCopied(false);
          }
        }}
      >
        {copied ? "Kopioitu" : "Kopioi linkki"}
      </Button>
    </div>
  );
}

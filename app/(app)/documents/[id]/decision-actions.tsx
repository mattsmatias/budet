"use client";

/**
 * Dokumentin toimintopainikkeet.
 *
 * Estetty painike kertoo miksi se on estetty. Tarkistusta vaativan
 * dokumentin hyväksyntä avaa ohituslomakkeen perusteluineen sen sijaan
 * että se joko epäonnistuisi hiljaisesti tai menisi läpi huomaamatta.
 */

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  approveDocument,
  rejectDocument,
  rerunDecision,
  type ActionState,
} from "./actions";

const initial: ActionState = {};

export function DecisionActions({
  documentId,
  needsReview,
  status,
  enabled,
}: {
  documentId: string;
  needsReview: boolean;
  status: string;
  enabled: boolean;
}) {
  const [approveState, approve] = useActionState(approveDocument, initial);
  const [rejectState, reject] = useActionState(rejectDocument, initial);
  const [rerunState, rerun] = useActionState(rerunDecision, initial);

  const [showOverride, setShowOverride] = useState(false);
  const [showReject, setShowReject] = useState(false);

  const locked = status === "exported";
  const done = status === "approved" || status === "rejected";

  if (!enabled) {
    return (
      <p className="text-sm text-muted">
        Kirjaudu sisään käsitelläksesi dokumentteja.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {needsReview ? (
          <button
            type="button"
            onClick={() => setShowOverride((v) => !v)}
            disabled={locked}
            className="rounded-md border border-warn-500/40 bg-warn-100 px-3.5 py-2 text-sm font-semibold text-warn-600 disabled:opacity-50"
          >
            Hyväksy ohituksella…
          </button>
        ) : (
          <form action={approve}>
            <input type="hidden" name="documentId" value={documentId} />
            <Submit
              label={status === "approved" ? "Hyväksytty" : "Hyväksy"}
              busy="Hyväksytään…"
              disabled={locked || status === "approved"}
              primary
            />
          </form>
        )}

        <button
          type="button"
          onClick={() => setShowReject((v) => !v)}
          disabled={locked || done}
          className="rounded-md border border-line px-3.5 py-2 text-sm font-semibold hover:border-navy-300 disabled:opacity-50"
        >
          Hylkää…
        </button>

        <form action={rerun}>
          <input type="hidden" name="documentId" value={documentId} />
          <Submit label="Aja uudelleen" busy="Ajetaan…" disabled={locked} />
        </form>
      </div>

      {showOverride ? (
        <form action={approve} className="rounded-md border border-line p-3.5">
          <input type="hidden" name="documentId" value={documentId} />
          <input type="hidden" name="override" value="on" />
          <label htmlFor="override-reason" className="block text-sm font-medium">
            Perustelu ohitukselle
          </label>
          <p className="mt-1 text-xs text-muted">
            Dokumentti odottaa tarkistusta. Perustelu tallennetaan audit trailiin
            eikä sitä voi jälkikäteen muuttaa.
          </p>
          <textarea
            id="override-reason"
            name="overrideReason"
            rows={2}
            required
            minLength={5}
            className="mt-2 w-full rounded-md border border-line bg-background px-3 py-2 text-sm"
          />
          <div className="mt-2 flex gap-2">
            <Submit label="Hyväksy ohituksella" busy="Hyväksytään…" primary />
            <button
              type="button"
              onClick={() => setShowOverride(false)}
              className="rounded-md border border-line px-3 py-2 text-sm"
            >
              Peruuta
            </button>
          </div>
        </form>
      ) : null}

      {showReject ? (
        <form action={reject} className="rounded-md border border-line p-3.5">
          <input type="hidden" name="documentId" value={documentId} />
          <label htmlFor="reject-reason" className="block text-sm font-medium">
            Hylkäyksen syy
          </label>
          <textarea
            id="reject-reason"
            name="reason"
            rows={2}
            required
            minLength={3}
            className="mt-2 w-full rounded-md border border-line bg-background px-3 py-2 text-sm"
          />
          <div className="mt-2 flex gap-2">
            <Submit label="Hylkää" busy="Hylätään…" />
            <button
              type="button"
              onClick={() => setShowReject(false)}
              className="rounded-md border border-line px-3 py-2 text-sm"
            >
              Peruuta
            </button>
          </div>
        </form>
      ) : null}

      <Messages states={[approveState, rejectState, rerunState]} />
    </div>
  );
}

function Messages({ states }: { states: ActionState[] }) {
  const error = states.find((s) => s.error)?.error;
  const notice = states.find((s) => s.notice)?.notice;

  if (error) {
    return (
      <p role="alert" className="rounded-md bg-risk-100 px-3 py-2 text-sm text-risk-600">
        {error}
      </p>
    );
  }
  if (notice) {
    return (
      <p role="status" className="rounded-md bg-ok-100 px-3 py-2 text-sm text-ok-600">
        {notice}
      </p>
    );
  }
  return null;
}

function Submit({
  label,
  busy,
  disabled,
  primary,
}: {
  label: string;
  busy: string;
  disabled?: boolean;
  primary?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={[
        "rounded-md px-3.5 py-2 text-sm font-semibold disabled:opacity-50",
        primary
          ? "bg-gold-400 text-navy-900 hover:bg-gold-300"
          : "border border-line hover:border-navy-300",
      ].join(" ")}
    >
      {pending ? busy : label}
    </button>
  );
}

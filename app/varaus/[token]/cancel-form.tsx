"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/restoflow/ui";
import { RfIcon } from "@/components/restoflow/icons";
import { cancelReservation, type CancelState } from "./actions";

/**
 * Peruutuspainike.
 *
 * Kysyy varmistuksen, koska peruutus on lopullinen eikä asiakas voi
 * ottaa aikaa takaisin — se voi olla mennyt toiselle sekunneissa.
 * Vahvistus on tässä eikä selaimen confirm-ikkunassa: se näyttää
 * sivun omalta ja toimii puhelimessa.
 */

const initial: CancelState = {};

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      tone="danger"
      disabled={pending}
      icon={<RfIcon name="trash" size={16} />}
    >
      {pending ? busy : label}
    </Button>
  );
}

export function CancelForm({
  token,
  labels,
}: {
  token: string;
  labels: {
    cancel: string;
    cancelling: string;
    cancelled: string;
    cancelledBody: string;
    failed: string;
    already: string;
    past: string;
    notFound: string;
    /** Sisältää {tunnit}. */
    cutoff: string;
  };
}) {
  const [state, action] = useActionState(cancelReservation, initial);

  if (state.done) {
    return (
      <div
        role="status"
        className="mt-6 p-5"
        style={{
          border: "1px solid var(--rf-line)",
          borderRadius: "var(--rf-r-card)",
        }}
      >
        <p className="text-[16px] font-semibold">{labels.cancelled}</p>
        <p className="mt-1 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
          {labels.cancelledBody}
        </p>
      </div>
    );
  }

  const message =
    state.error === "already"
      ? labels.already
      : state.error === "past"
        ? labels.past
        : state.error === "cutoff"
          ? labels.cutoff.replace(
              "{tunnit}",
              String(state.cutoffHours ?? 24),
            )
          : state.error === "not_found"
            ? labels.notFound
            : state.error
              ? labels.failed
              : null;

  return (
    <form action={action} className="mt-6">
      <input type="hidden" name="token" value={token} />
      <Submit label={labels.cancel} busy={labels.cancelling} />

      {message ? (
        <p
          role="alert"
          className="mt-3 text-[14px]"
          style={{ color: "var(--rf-red-text)" }}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}

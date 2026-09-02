"use client";

import { useActionState, useState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { useFormStatus } from "react-dom";
import { publishShifts, type AdminState } from "../actions";
import { RfIcon } from "@/components/restoflow/icons";

const initial: AdminState = {};

/**
 * Kuukauden luonnosten julkaisu.
 *
 * VAHVISTUS KERTOO MITÄ LUVATAAN.
 *
 * "Oletko varma" -kysymykseen vastataan lukematta. Luvut vastaavat
 * siihen mitä julkaisu oikeasti tekee: kuinka monelle ihmiselle,
 * montako vuoroa ja kuinka monta tuntia luvataan. Ne on nähtävä ennen
 * kuin työntekijöiden kalenterit täyttyvät.
 *
 * Julkaisu on peruuttamaton siinä mielessä, että vuoro on nähty.
 * Perua voi, mutta peruutus on oma tekonsa josta työntekijä saa
 * tiedon — ei paluu edelliseen tilaan.
 */
export function PublishBar({
  t,
  month,
  monthLabel,
  drafts,
  people,
  hours,
}: {
  t: AdminText;
  month: string;
  monthLabel: string;
  /** Julkaisemattomien vuorojen määrä tässä kuussa. */
  drafts: number;
  /** Montako eri ihmistä luonnoksissa on. */
  people: number;
  /** Luonnosten suunniteltu työaika luettavana. */
  hours: string;
}) {
  const [state, action] = useActionState(publishShifts, initial);
  const [confirming, setConfirming] = useState(false);

  if (state.notice) {
    return (
      <p
        role="status"
        className="flex items-start gap-2.5 px-3.5 py-3 text-[13px] font-medium"
        style={{
          background: "var(--rf-green-bg)",
          color: "var(--rf-green-text)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <span className="mt-px shrink-0">
          <RfIcon name="check" size={16} />
        </span>
        {state.notice}
      </p>
    );
  }

  if (drafts === 0) return null;

  return (
    <div
      className="px-3.5 py-3"
      style={{
        background: "var(--rf-amber-bg)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-[13.5px] font-bold"
            style={{ color: "var(--rf-amber-text)" }}
          >
            {fill(
              drafts === 1 ? t.vuoro.unpublishedOne : t.vuoro.unpublishedMany,
              { maara: String(drafts) },
            )}
          </p>
          <p
            className="mt-0.5 text-[12.5px] leading-relaxed"
            style={{ color: "var(--rf-amber-text)" }}
          >
            {t.vuoro.draftNotVisible}
          </p>
        </div>

        {confirming ? null : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rf-press inline-flex shrink-0 items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
            style={{
              background: "var(--rf-accent)",
              color: "var(--rf-on-accent)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            <RfIcon name="check" size={15} />
            {t.vuoro.publishShifts}
          </button>
        )}
      </div>

      {confirming ? (
        <form
          action={action}
          className="mt-3 border-t pt-3"
          style={{ borderColor: "var(--rf-line-strong)" }}
        >
          <input type="hidden" name="month" value={month} />

          <p
            className="text-[13px] font-bold"
            style={{ color: "var(--rf-amber-text)" }}
          >
            {fill(t.vuoro.publishAsk, { kuukausi: monthLabel })}
          </p>

          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[12.5px]">
            <Luku
              label={people === 1 ? t.vuoro.personOne : t.vuoro.personMany}
              value={String(people)}
            />
            <Luku
              label={
                drafts === 1 ? t.vuoro.shiftWordOne : t.vuoro.shiftWordMany
              }
              value={String(drafts)}
            />
            <Luku label={t.vuoro.plannedTime} value={hours} />
          </dl>

          {state.error ? (
            <p
              role="alert"
              className="mt-2 text-[12.5px]"
              style={{ color: "var(--rf-red-text)" }}
            >
              {state.error}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <Julkaise t={t} />
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rf-press px-3.5 py-2 text-[13px] font-medium"
              style={{ color: "var(--rf-amber-text)" }}
            >
              {t.vuoro.cancel}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function Luku({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt
        className="text-[11.5px]"
        style={{ color: "var(--rf-amber-text)", opacity: 0.8 }}
      >
        {label}
      </dt>
      <dd
        className="rf-tabular text-[15px] font-bold"
        style={{ color: "var(--rf-amber-text)" }}
      >
        {value}
      </dd>
    </div>
  );
}

function Julkaise({ t }: { t: AdminText }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press px-4 py-2 text-[13px] font-bold"
      style={{
        background: "var(--rf-accent)",
        color: "var(--rf-on-accent)",
        borderRadius: "var(--rf-r-control)",
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? t.vuoro.publishing : t.vuoro.publish}
    </button>
  );
}

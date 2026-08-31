"use client";

import { useActionState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { useFormStatus } from "react-dom";
import {
  approvePeriod,
  reopenPeriod,
  setPayDate,
  type PayrollState,
} from "./actions";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, Pill } from "@/components/restoflow/ui";

/**
 * Tallennuspainike omana komponenttinaan.
 *
 * useFormStatus lukee sen lomakkeen tilan jonka sisällä komponentti on,
 * eikä se toimi samassa komponentissa jossa lomake määritellään.
 */
function SaveDateButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press h-[38px] px-3.5 text-[13px] font-semibold"
      style={{
        background: "var(--rf-inset)",
        color: "var(--rf-text)",
        borderRadius: "var(--rf-r-control)",
        opacity: pending ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  );
}

const initial: PayrollState = {};

/**
 * Kauden hyväksyntä ja maksu.
 *
 * Hyväksyntä on portti eikä painike: se ei aukea ennen kuin jokainen
 * laskelma on tarkistettu eikä kaudella ole varoituksia. Ehto näytetään
 * ennen painiketta, jotta harmaana oleva nappi ei jää arvoitukseksi.
 */
export function PeriodActions({
  t,
  startsOn,
  endsOn,
  approvedCount,
  totalCount,
  issueCount,
  locked,
  payDate,
}: {
  t: AdminText;
  startsOn: string;
  endsOn: string;
  approvedCount: number;
  totalCount: number;
  issueCount: number;
  locked: boolean;
  /** Kauden maksupäivä, tai null jos sitä ei ole vielä asetettu. */
  payDate: string | null;
}) {
  const [approveState, approve] = useActionState(approvePeriod, initial);
  const [reopenState, reopen] = useActionState(reopenPeriod, initial);
  const [dateState, saveDate] = useActionState(setPayDate, initial);

  const state =
    approveState.error || approveState.notice ? approveState : reopenState;
  const ready =
    issueCount === 0 && totalCount > 0 && approvedCount >= totalCount;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold tracking-[-0.0075em]">
            {t.palkka.periodApproval}
          </h2>
          <p
            className="mt-1 text-[13px] leading-relaxed"
            style={{ color: "var(--rf-text-2)" }}
          >
            {locked
              ? t.palkka.periodLockedNote
              : fill(t.palkka.approvedOf, {
                  hyvaksytty: String(approvedCount),
                  kaikki: String(totalCount),
                }) +
                (issueCount > 0
                  ? " " +
                    fill(t.palkka.issueCount, { maara: String(issueCount) })
                  : "")}
          </p>
        </div>

        <Pill tone={locked ? "ok" : ready ? "info" : "neutral"}>
          {locked
            ? t.palkka.approvedWord
            : ready
              ? t.palkka.readyForApproval
              : t.palkka.inProgress}
        </Pill>
      </div>

      {/*
        Maksupäivä ennen hyväksyntää.
        ------------------------------------------------------------------

        Verohallinnon ohje on yksiselitteinen: sovellettava verokortti
        määräytyy suorituksen maksupäivästä. Kesäkuussa tehty työ joka
        maksetaan heinäkuussa kuuluu heinäkuun kortille, ja joulukuun
        työ joka maksetaan tammikuussa kuuluu uuteen verovuoteen.

        Siksi tämä on oma kenttänsä eikä pääteltävissä kauden lopusta.
        Ilman sitä hyväksyntä ei etene: laskettu ennakonpidätys ilman
        perustetta on huonompi kuin laskematon.

        Kentän tila kertoo miksi hyväksyntä on kiinni. Pelkkä harmaa
        nappi olisi arvoitus.
      */}
      {locked ? null : (
        <form
          action={saveDate}
          className="mt-4 flex flex-wrap items-end gap-2 pt-3"
          style={{ borderTop: "1px solid var(--rf-line)" }}
        >
          <input type="hidden" name="startsOn" value={startsOn} />
          <input type="hidden" name="endsOn" value={endsOn} />

          <label className="block">
            <span className="text-[13px] font-semibold">
              {t.palkka.payDate}
            </span>
            <input
              type="date"
              name="payDate"
              required
              defaultValue={payDate ?? ""}
              className="mt-1 h-[38px] px-2.5 text-[14px] outline-none"
              style={{
                background: "var(--rf-inset)",
                border: "1px solid var(--rf-line)",
                borderRadius: "var(--rf-r-field)",
                color: "var(--rf-text)",
              }}
            />
          </label>

          <SaveDateButton label={t.palkka.periodSaveDate} />

          {dateState.error ? (
            <p
              className="w-full text-[13px]"
              style={{ color: "var(--rf-red-text)" }}
              role="alert"
            >
              {dateState.error}
            </p>
          ) : null}

          {dateState.notice ? (
            <p
              className="w-full text-[13px]"
              style={{ color: "var(--rf-green-text)" }}
              role="status"
            >
              {dateState.notice}
            </p>
          ) : null}

          {payDate === null ? (
            <p
              className="w-full text-[12.5px]"
              style={{ color: "var(--rf-text-3)" }}
            >
              {t.palkka.payDateMissing}
            </p>
          ) : null}
        </form>
      )}

      {state.error ? (
        <p className="mt-3 text-[13px]" style={{ color: "var(--rf-red-text)" }}>
          {state.error}
        </p>
      ) : null}

      {state.notice ? (
        <p
          className="mt-3 text-[13px]"
          style={{ color: "var(--rf-green-text)" }}
        >
          {state.notice}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {locked ? (
          <form action={reopen}>
            <input type="hidden" name="startsOn" value={startsOn} />
            <input type="hidden" name="endsOn" value={endsOn} />
            <Submit
              tone="ghost"
              label={t.palkka.openPeriod}
              pending={t.palkka.opening}
            />
          </form>
        ) : (
          <form action={approve}>
            <input type="hidden" name="startsOn" value={startsOn} />
            <input type="hidden" name="endsOn" value={endsOn} />
            <Submit
              tone="primary"
              label={t.palkka.approvePeriod}
              pending={t.palkka.approving}
              disabled={!ready}
            />
          </form>
        )}

        <PayButton t={t} locked={locked} />
      </div>

      <p
        className="mt-3 text-[12px] leading-relaxed"
        style={{ color: "var(--rf-text-3)" }}
      >
        {t.palkka.grossNote}
      </p>
    </Card>
  );
}

/**
 * Maksupainike sanoo suoraan ettei se maksa.
 *
 * Painike joka näyttää maksavan mutta ei maksa on lupaus jota se ei
 * pidä. Rakenne on valmis maksupalveluintegraatiolle, mutta siihen asti
 * tämä kertoo tilanteen sen sijaan että vihjaisisi muuta.
 */
function PayButton({ t, locked }: { t: AdminText; locked: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-2 px-4 py-2.5 text-[14px] font-medium"
      style={{
        background: "var(--rf-inset)",
        color: "var(--rf-text-3)",
        border: "1px solid var(--rf-line)",
        borderRadius: "var(--rf-r-control)",
      }}
      title={t.palkka.payoutComing}
    >
      <RfIcon name="payroll" size={16} />
      {t.palkka.payWages}
      <span className="text-[11px]">{t.palkka.notYetAvailable}</span>
      <span className="sr-only">
        {locked ? t.palkka.payoutComing : t.palkka.approveFirstThenPay}
      </span>
    </span>
  );
}

function Submit({
  label,
  pending: pendingLabel,
  tone,
  disabled,
}: {
  label: string;
  pending: string;
  tone: "primary" | "ghost";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rf-press inline-flex items-center gap-2 px-4 py-2.5 text-[14px] font-semibold disabled:opacity-45"
      style={{
        background: tone === "primary" ? "var(--rf-accent)" : "var(--rf-card)",
        color: tone === "primary" ? "#fff" : "var(--rf-text)",
        border: tone === "primary" ? "none" : "1px solid var(--rf-line-strong)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

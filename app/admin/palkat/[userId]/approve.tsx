"use client";

import { useActionState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import { useFormStatus } from "react-dom";
import { approvePayslip, cancelPayslip, type PayrollState } from "../actions";
import { RfIcon } from "@/components/restoflow/icons";
import { Card } from "@/components/restoflow/ui";

const initial: PayrollState = {};

/**
 * Palkkalaskelman hyväksyntä.
 *
 * Hyväksyntä laskee palkan uudelleen palvelimella ja jäädyttää sen
 * riveineen. Selaimesta ei lähetetä yhtään summaa: jos lähetettäisiin,
 * palkan voisi asettaa lomakekentästä.
 */
export function ApprovePayslip({
  t,
  userId,
  startsOn,
  endsOn,
  blocked,
  approved,
  locked,
  changed,
}: {
  t: AdminText;
  userId: string;
  startsOn: string;
  endsOn: string;
  blocked: boolean;
  approved: boolean;
  locked: boolean;
  changed: boolean;
}) {
  const [state, action] = useActionState(approvePayslip, initial);
  const [cancelState, cancel] = useActionState(cancelPayslip, initial);

  return (
    <Card>
      {/*
        Hyväksynnän jälkeen muuttunut laskelma sanoo sen ääneen.
        Ilman tätä hyväksytty palkka voisi erota siitä mitä ruudulla
        näkyy, eikä kukaan huomaisi ennen maksupäivää.
      */}
      {changed ? (
        <p
          className="mb-3 flex items-start gap-2.5 text-[13px] leading-relaxed"
          style={{ color: "var(--rf-amber-text)" }}
        >
          <RfIcon name="alert" size={15} />
          {t.palkka.changedAfterApproval}
        </p>
      ) : null}

      {state.error ? (
        <p className="mb-3 text-[13px]" style={{ color: "var(--rf-red-text)" }}>
          {state.error}
        </p>
      ) : null}

      {state.notice ? (
        <p
          className="mb-3 text-[13px]"
          style={{ color: "var(--rf-green-text)" }}
        >
          {state.notice}
        </p>
      ) : null}

      {locked ? (
        <p
          className="text-[13px] leading-relaxed"
          style={{ color: "var(--rf-text-2)" }}
        >
          {t.palkka.periodLockedOpenFromPay}
        </p>
      ) : (
        <form action={action} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="startsOn" value={startsOn} />
          <input type="hidden" name="endsOn" value={endsOn} />

          <Submit
            t={t}
            label={
              approved && !changed ? t.palkka.approvedWord : t.palkka.approvePay
            }
            disabled={blocked || (approved && !changed)}
          />

          {blocked ? (
            <span className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
              {t.palkka.fixIssuesFirst}
            </span>
          ) : null}
        </form>
      )}

      {/*
        Peruminen näkyy vain hyväksytylle laskelmalle.

        Luonnosta ei tarvitse perua: se ei kerrytä mitään eikä sitä ole
        maksettu. Peruminen on korjaus jo tehtyyn päätökseen, ja siksi
        se vaatii syyn — peruttu palkka ilman perustelua on luku jota
        kukaan ei osaa selittää.

        Tämä ei ole palkanmaksun peruminen. Kate ei maksa palkkoja.
      */}
      {approved && !locked ? (
        <form
          action={cancel}
          className="mt-4 space-y-2 pt-3"
          style={{ borderTop: "1px solid var(--rf-line)" }}
        >
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="startsOn" value={startsOn} />
          <input type="hidden" name="endsOn" value={endsOn} />

          <label className="block">
            <span className="text-[13px] font-semibold">
              {t.palkka.cancelReason}
            </span>
            <input
              name="reason"
              required
              maxLength={500}
              className="mt-1 h-[38px] w-full px-2.5 text-[14px] outline-none"
              style={{
                background: "var(--rf-inset)",
                border: "1px solid var(--rf-line)",
                borderRadius: "var(--rf-r-field)",
                color: "var(--rf-text)",
              }}
            />
          </label>

          {cancelState.error ? (
            <p
              className="text-[13px]"
              style={{ color: "var(--rf-red-text)" }}
              role="alert"
            >
              {cancelState.error}
            </p>
          ) : null}

          {cancelState.notice ? (
            <p
              className="text-[13px]"
              style={{ color: "var(--rf-green-text)" }}
              role="status"
            >
              {cancelState.notice}
            </p>
          ) : null}

          <CancelButton label={t.palkka.cancelSlip} />
        </form>
      ) : null}
    </Card>
  );
}

/**
 * Peruutuspainike omana komponenttinaan.
 *
 * useFormStatus lukee sen lomakkeen tilan jonka sisällä komponentti
 * on, eikä toimi samassa komponentissa jossa lomake määritellään.
 */
function CancelButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press px-3.5 py-2 text-[13px] font-semibold disabled:opacity-45"
      style={{
        background: "var(--rf-red-bg)",
        color: "var(--rf-red-text)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {label}
    </button>
  );
}

function Submit({
  t,
  label,
  disabled,
}: {
  t: AdminText;
  label: string;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rf-press inline-flex items-center gap-2 px-4 py-2.5 text-[14px] font-semibold disabled:opacity-45"
      style={{
        background: "var(--rf-accent)",
        color: "#fff",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <RfIcon name="check" size={16} />
      {pending ? t.palkka.approving : label}
    </button>
  );
}

"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { approvePayslip, type PayrollState } from "../actions";
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
  userId,
  startsOn,
  endsOn,
  blocked,
  approved,
  locked,
  changed,
}: {
  userId: string;
  startsOn: string;
  endsOn: string;
  blocked: boolean;
  approved: boolean;
  locked: boolean;
  changed: boolean;
}) {
  const [state, action] = useActionState(approvePayslip, initial);

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
          Työaikaa on muutettu hyväksynnän jälkeen. Tallennettu summa ei enää
          vastaa laskelmaa, joten se on hyväksyttävä uudelleen.
        </p>
      ) : null}

      {state.error ? (
        <p className="mb-3 text-[13px]" style={{ color: "var(--rf-red-text)" }}>
          {state.error}
        </p>
      ) : null}

      {state.notice ? (
        <p className="mb-3 text-[13px]" style={{ color: "var(--rf-green-text)" }}>
          {state.notice}
        </p>
      ) : null}

      {locked ? (
        <p className="text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
          Palkkakausi on hyväksytty ja lukittu. Avaa kausi Palkat-sivulta jos
          laskelmaa pitää muuttaa.
        </p>
      ) : (
        <form action={action} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="startsOn" value={startsOn} />
          <input type="hidden" name="endsOn" value={endsOn} />

          <Submit
            label={approved && !changed ? "Hyväksytty" : "Hyväksy palkka"}
            disabled={blocked || (approved && !changed)}
          />

          {blocked ? (
            <span className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
              Korjaa ensin tarkistettavat kohdat.
            </span>
          ) : null}
        </form>
      )}
    </Card>
  );
}

function Submit({ label, disabled }: { label: string; disabled: boolean }) {
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
      {pending ? "Hyväksytään…" : label}
    </button>
  );
}

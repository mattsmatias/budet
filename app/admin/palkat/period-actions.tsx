"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { approvePeriod, reopenPeriod, type PayrollState } from "./actions";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, Pill } from "@/components/restoflow/ui";

const initial: PayrollState = {};

/**
 * Kauden hyväksyntä ja maksu.
 *
 * Hyväksyntä on portti eikä painike: se ei aukea ennen kuin jokainen
 * laskelma on tarkistettu eikä kaudella ole varoituksia. Ehto näytetään
 * ennen painiketta, jotta harmaana oleva nappi ei jää arvoitukseksi.
 */
export function PeriodActions({
  startsOn,
  endsOn,
  approvedCount,
  totalCount,
  issueCount,
  locked,
}: {
  startsOn: string;
  endsOn: string;
  approvedCount: number;
  totalCount: number;
  issueCount: number;
  locked: boolean;
}) {
  const [approveState, approve] = useActionState(approvePeriod, initial);
  const [reopenState, reopen] = useActionState(reopenPeriod, initial);

  const state = approveState.error || approveState.notice ? approveState : reopenState;
  const ready = issueCount === 0 && totalCount > 0 && approvedCount >= totalCount;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold tracking-[-0.0075em]">Palkkakauden hyväksyntä</h2>
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
            {locked
              ? "Kausi on hyväksytty ja lukittu. Laskelmat eivät muutu ennen kuin kausi avataan."
              : `Hyväksytty ${approvedCount}/${totalCount} laskelmaa.` +
                (issueCount > 0 ? ` Tarkistettavia kohtia ${issueCount}.` : "")}
          </p>
        </div>

        <Pill tone={locked ? "ok" : ready ? "info" : "neutral"}>
          {locked ? "Hyväksytty" : ready ? "Valmis hyväksyttäväksi" : "Kesken"}
        </Pill>
      </div>

      {state.error ? (
        <p className="mt-3 text-[13px]" style={{ color: "var(--rf-red-text)" }}>
          {state.error}
        </p>
      ) : null}

      {state.notice ? (
        <p className="mt-3 text-[13px]" style={{ color: "var(--rf-green-text)" }}>
          {state.notice}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {locked ? (
          <form action={reopen}>
            <input type="hidden" name="startsOn" value={startsOn} />
            <input type="hidden" name="endsOn" value={endsOn} />
            <Submit tone="ghost" label="Avaa kausi" pending="Avataan…" />
          </form>
        ) : (
          <form action={approve}>
            <input type="hidden" name="startsOn" value={startsOn} />
            <input type="hidden" name="endsOn" value={endsOn} />
            <Submit
              tone="primary"
              label="Hyväksy palkkakausi"
              pending="Hyväksytään…"
              disabled={!ready}
            />
          </form>
        )}

        <PayButton locked={locked} />
      </div>

      <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
        Bruttopalkka ei sisällä ennakonpidätystä, muita vähennyksiä eikä
        työnantajan sivukuluja. Budet ei ole palkkahallinto-ohjelma eikä
        korvaa sellaista.
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
function PayButton({ locked }: { locked: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-2 px-4 py-2.5 text-[14px] font-medium"
      style={{
        background: "var(--rf-inset)",
        color: "var(--rf-text-3)",
        border: "1px solid var(--rf-line)",
        borderRadius: "var(--rf-r-control)",
      }}
      title="Palkanmaksu tulee käyttöön maksupalveluintegraation kautta."
    >
      <RfIcon name="payroll" size={16} />
      Maksa palkat
      <span className="text-[11px]">— ei vielä käytössä</span>
      <span className="sr-only">
        {locked
          ? "Palkanmaksu tulee käyttöön maksupalveluintegraation kautta."
          : "Hyväksy kausi ensin. Palkanmaksu tulee käyttöön maksupalveluintegraation kautta."}
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

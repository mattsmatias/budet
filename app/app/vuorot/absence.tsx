"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { cancelAbsence, reportAbsence, type ActionState } from "../actions";
import { ABSENCE_LABELS, type Absence, type AbsenceKind } from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, Pill } from "@/components/restoflow/ui";

const initial: ActionState = {};

const KINDS: AbsenceKind[] = ["sick", "cannot_attend", "other"];

/**
 * Poissaolon ilmoittaminen.
 *
 * Ilmoitus ei peru vuoroa eikä hyväksy poissaoloa — se kertoo
 * esihenkilölle. Automaattinen peruminen näyttäisi siltä että asia on
 * hoidettu, vaikka kukaan ei ole vielä etsinyt tilalle tekijää.
 */
export function AbsenceReporter({
  defaultDate,
  absences,
}: {
  defaultDate: string;
  absences: Absence[];
}) {
  const [state, action] = useActionState(reportAbsence, initial);
  const [open, setOpen] = useState(false);

  return (
    <section>
      {absences.length > 0 ? (
        <Card padded={false}>
          <ul className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
            {absences.map((absence) => (
              <li
                key={absence.id}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-medium">
                    {formatShortDate(absence.date)}
                  </p>
                  <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                    {absence.note || "Ei lisätietoa"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Pill tone="warn">{ABSENCE_LABELS[absence.kind]}</Pill>
                  <CancelButton id={absence.id} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {state.notice ? (
        <p
          role="status"
          className="mt-3 px-3.5 py-2.5 text-[13px] font-medium"
          style={{
            background: "var(--rf-green-bg)",
            color: "var(--rf-green-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {state.notice}
        </p>
      ) : null}

      {open ? (
        <Card className="mt-3">
          <p className="text-[15px] font-semibold">Ilmoita poissaolo</p>

          <form action={action} className="mt-3 space-y-3">
            <div>
              <label htmlFor="ab-date" className="block text-[13px] font-medium">
                Päivä
              </label>
              <input
                id="ab-date"
                name="date"
                type="date"
                defaultValue={defaultDate}
                required
                className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
                style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
              />
            </div>

            <div>
              <label htmlFor="ab-kind" className="block text-[13px] font-medium">
                Syy
              </label>
              <select
                id="ab-kind"
                name="kind"
                defaultValue="sick"
                className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
                style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
              >
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {ABSENCE_LABELS[kind]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ab-note" className="block text-[13px] font-medium">
                Lisätieto
              </label>
              <input
                id="ab-note"
                name="note"
                maxLength={300}
                placeholder="Vapaaehtoinen"
                className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
                style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
              />
              <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
                Älä kirjoita tähän terveystietoja. Esihenkilö tarvitsee vain
                tiedon siitä ettet pääse.
              </p>
            </div>

            {state.error ? (
              <p
                role="alert"
                className="px-3.5 py-2.5 text-[13px]"
                style={{
                  background: "var(--rf-red-bg)",
                  color: "var(--rf-red-text)",
                  borderRadius: "var(--rf-r-control)",
                }}
              >
                {state.error}
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-2.5">
              <Submit />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rf-press py-2.5 text-[14px] font-semibold"
                style={{
                  background: "var(--rf-inset)",
                  color: "var(--rf-text)",
                  borderRadius: "var(--rf-r-control)",
                }}
              >
                Peruuta
              </button>
            </div>

            <p className="text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
              Ilmoitus ei peru vuoroa. Se näkyy esihenkilölle, joka etsii
              tilalle tekijän.
            </p>
          </form>
        </Card>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rf-press mt-3 flex w-full items-center justify-center gap-2 py-3 text-[15px] font-semibold"
          style={{
            background: "var(--rf-card)",
            color: "var(--rf-text)",
            borderRadius: "var(--rf-r-control)",
            boxShadow: "var(--rf-shadow-sm)",
          }}
        >
          <RfIcon name="alert" size={17} />
          Ilmoita poissaolo
        </button>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function CancelButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label="Peru ilmoitus"
        className="rf-press p-1.5"
        style={{ color: "var(--rf-text-3)" }}
      >
        <RfIcon name="more" size={16} />
      </button>
    );
  }

  return (
    <form action={cancelAbsence}>
      <input type="hidden" name="absenceId" value={id} />
      <button
        type="submit"
        className="rf-press px-3 py-1.5 text-[12px] font-semibold"
        style={{
          background: "var(--rf-red-bg)",
          color: "var(--rf-red-text)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        Peru
      </button>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press py-2.5 text-[14px] font-semibold disabled:opacity-50"
      style={{ background: "var(--rf-accent)", color: "var(--rf-on-accent)", borderRadius: "var(--rf-r-control)" }}
    >
      {pending ? "Lähetetään…" : "Ilmoita"}
    </button>
  );
}

function formatShortDate(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(d)}.${Number(m)}.`;
}

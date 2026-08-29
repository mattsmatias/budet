"use client";

import { useActionState, useState } from "react";
import type { Labels } from "@/lib/i18n/labels";
import { useFormStatus } from "react-dom";
import { cancelAbsence, reportAbsence, type ActionState } from "../actions";
import { type Absence, type AbsenceKind } from "@/lib/restoflow/types";
import type { WorkerText } from "@/lib/i18n/worker-text";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, Pill } from "@/components/restoflow/ui";

const initial: ActionState = {};

/**
 * Poissaolon lajit kaannettyina.
 *
 * nimet.absences on jaettu vakio ja suomeksi; hallintanakyma kayttaa
 * sita yha. Tyontekijanakyma lukee omansa sanakirjasta.
 */
const lajit = (t: WorkerText): Record<Absence["kind"], string> => ({
  sick: t.poissaolo.kindSick,
  other: t.poissaolo.kindOther,
  cannot_attend: t.poissaolo.kindCannotAttend,
});

const KINDS: AbsenceKind[] = ["sick", "cannot_attend", "other"];

/**
 * Poissaolon ilmoittaminen.
 *
 * Ilmoitus ei peru vuoroa eikä hyväksy poissaoloa — se kertoo
 * esihenkilölle. Automaattinen peruminen näyttäisi siltä että asia on
 * hoidettu, vaikka kukaan ei ole vielä etsinyt tilalle tekijää.
 */
export function AbsenceReporter({
  nimet,
  defaultDate,
  absences,
  t,
}: {
  nimet: Labels;
  defaultDate: string;
  absences: Absence[];
  t: WorkerText;
}) {
  const [state, action] = useActionState(reportAbsence, initial);
  const [open, setOpen] = useState(false);

  // Alkupäivä on tilassa vain siksi, että loppupäivän min seuraa sitä.
  const [start, setStart] = useState(defaultDate);

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
                    {formatPeriod(absence.date, absence.endDate)}
                  </p>
                  <p
                    className="text-[12px]"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    {absence.kind === "sick"
                      ? absence.certificateSeenAt
                        ? t.poissaolo.certificateSeen
                        : t.poissaolo.certificateNotSeen
                      : absence.note || t.poissaolo.noExtra}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Pill tone="warn">{lajit(t)[absence.kind]}</Pill>
                  <CancelButton id={absence.id} t={t} />
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
          <p className="text-[15px] font-semibold">
            {t.asetukset.reportAbsence}
          </p>

          <form action={action} className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="ab-date"
                  className="block text-[13px] font-medium"
                >
                  {t.poissaolo.starts}
                </label>
                <input
                  id="ab-date"
                  name="date"
                  type="date"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                  required
                  className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
                  style={{
                    background: "var(--rf-inset)",
                    borderRadius: "var(--rf-r-control)",
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="ab-end"
                  className="block text-[13px] font-medium"
                >
                  {t.poissaolo.ends}
                </label>
                {/* min estää jakson joka päättyy ennen alkuaan jo
                    selaimessa. Sama tarkistus on palvelimella. */}
                <input
                  id="ab-end"
                  name="endDate"
                  type="date"
                  min={start}
                  className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
                  style={{
                    background: "var(--rf-inset)",
                    borderRadius: "var(--rf-r-control)",
                  }}
                />
              </div>
            </div>

            <p
              className="-mt-1 text-[12px] leading-relaxed"
              style={{ color: "var(--rf-text-3)" }}
            >
              {t.poissaolo.endHint}
            </p>

            <div>
              <label
                htmlFor="ab-kind"
                className="block text-[13px] font-medium"
              >
                Syy
              </label>
              <select
                id="ab-kind"
                name="kind"
                defaultValue="sick"
                className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
                style={{
                  background: "var(--rf-inset)",
                  borderRadius: "var(--rf-r-control)",
                }}
              >
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {nimet.absences[kind]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="ab-note"
                className="block text-[13px] font-medium"
              >
                {t.poissaolo.extraInfo}
              </label>
              <input
                id="ab-note"
                name="note"
                maxLength={300}
                placeholder="Vapaaehtoinen"
                className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
                style={{
                  background: "var(--rf-inset)",
                  borderRadius: "var(--rf-r-control)",
                }}
              />
              <p
                className="mt-1 text-[12px] leading-relaxed"
                style={{ color: "var(--rf-text-3)" }}
              >
                Älä kirjoita tähän terveystietoja. Esihenkilö tarvitsee vain
                tiedon siitä ettet pääse.
              </p>
            </div>

            {/* Todistusta ei pyydetä eikä liitetä tähän. Ilmoitus on
                tehtävä heti, ja todistus on olemassa vasta lääkärikäynnin
                jälkeen — usein päiviä myöhemmin. */}
            <div
              className="px-3.5 py-3 text-[12px] leading-relaxed"
              style={{
                background: "var(--rf-inset)",
                color: "var(--rf-text-2)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              <strong className="font-semibold">
                {t.poissaolo.sickNoteTitle}
              </strong>{" "}
              {t.poissaolo.sickNoteBody}
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
              <Submit t={t} />
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

            <p
              className="text-[12px] leading-relaxed"
              style={{ color: "var(--rf-text-3)" }}
            >
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

function CancelButton({ id, t }: { id: string; t: WorkerText }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={t.poissaolo.cancelReport}
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

function Submit({ t }: { t: WorkerText }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press py-2.5 text-[14px] font-semibold disabled:opacity-50"
      style={{
        background: "var(--rf-accent)",
        color: "var(--rf-on-accent)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {pending ? t.yleinen.sending : t.asetukset.report}
    </button>
  );
}

/**
 * Jakso sanoina.
 *
 * Yhden päivän poissaolossa väliviiva olisi harhaanjohtava: "26.8.–26.8."
 * näyttää kahdelta päivältä.
 */
function formatPeriod(start: string, end: string): string {
  if (start === end) return formatShortDate(start);
  return `${formatShortDate(start)}–${formatShortDate(end)}`;
}

function formatShortDate(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(d)}.${Number(m)}.`;
}

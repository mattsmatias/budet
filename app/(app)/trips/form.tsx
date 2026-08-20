"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { parseTrip, saveTrip, type TripState } from "./actions";
import { TRIP_REVIEW_LABELS } from "@/lib/trips/rules";
import { formatMoney } from "@/lib/money";

const initial: TripState = {};

const EXAMPLE =
  "Ajoin Helsingistä Tampereelle Acme-palaveriin, 174 km edestakaisin, 8 tuntia, ja söin lounaan";

export function TripForm({ enabled }: { enabled: boolean }) {
  const [parseState, runParse] = useActionState(parseTrip, initial);
  const [saveState, runSave] = useActionState(saveTrip, initial);

  const draft = parseState.draft;

  return (
    <div className="space-y-4">
      <form action={runParse} className="rounded-lg border border-line bg-surface p-4">
        <label htmlFor="trip-text" className="block text-sm font-medium">
          Kuvaile matka omin sanoin
        </label>
        <p className="mt-1 text-xs text-muted">
          Jäsennin poimii vain sen minkä tunnistaa varmasti. Se ei arvaa — loput
          täytät itse ennen tallennusta.
        </p>
        <textarea
          id="trip-text"
          name="text"
          rows={3}
          required
          disabled={!enabled}
          placeholder={EXAMPLE}
          defaultValue={draft?.raw}
          className="mt-2 w-full rounded-md border border-line bg-background px-3 py-2 text-sm"
        />
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="trip-date" className="block text-xs font-medium text-muted">
              Päivä
            </label>
            <input
              id="trip-date"
              type="date"
              name="date"
              defaultValue={draft?.date ?? new Date().toISOString().slice(0, 10)}
              disabled={!enabled}
              className="mt-1 rounded-md border border-line bg-background px-3 py-2 text-sm"
            />
          </div>
          <Submit label="Jäsennä" busy="Jäsennetään…" disabled={!enabled} />
        </div>

        {parseState.error ? (
          <p role="alert" className="mt-3 rounded-md bg-risk-100 px-3 py-2 text-sm text-risk-600">
            {parseState.error}
          </p>
        ) : null}
      </form>

      {draft ? (
        <form action={runSave} className="rounded-lg border border-line p-4">
          <h2 className="text-sm font-semibold">Vahvista tiedot</h2>
          {draft.missing.length > 0 ? (
            <p className="mt-1 text-xs text-warn-600">
              Jäsennin ei tunnistanut: {draft.missing.map(fieldLabel).join(", ")}.
              Täydennä ne alle.
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted">
              Kaikki kentät tunnistettiin. Tarkista silti ennen tallennusta.
            </p>
          )}

          <input type="hidden" name="raw" value={draft.raw} />
          <input type="hidden" name="date" value={draft.date} />

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Mistä" name="origin" defaultValue={draft.origin} />
            <Field label="Minne" name="destination" defaultValue={draft.destination} />
            <Field label="Tarkoitus" name="purpose" defaultValue={draft.purpose} />
            <Field
              label="Kilometrit"
              name="kilometers"
              type="number"
              step="0.1"
              defaultValue={String(draft.kilometers)}
            />
            <Field
              label="Kesto (h)"
              name="durationHours"
              type="number"
              step="0.5"
              defaultValue={String(draft.durationHours)}
            />
            <Field
              label="Tarjottuja aterioita"
              name="mealsProvided"
              type="number"
              min="0"
              max="2"
              defaultValue={String(draft.mealsProvided)}
            />
          </div>

          <div className="mt-4 rounded-md border border-line bg-surface p-3.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Laskelma
            </p>
            <dl className="mt-2 space-y-1.5 text-sm">
              <Row
                label={`Kilometrikorvaus (${draft.calculation.kilometers} km × ${(draft.calculation.mileageRateCents / 100).toFixed(2).replace(".", ",")} €)`}
                value={formatMoney(draft.calculation.mileageCents)}
              />
              <Row label="Päiväraha" value={formatMoney(draft.calculation.perDiemCents)} />
              {draft.calculation.mealDeductionCents > 0 ? (
                <Row
                  label="Ateriavähennys"
                  value={`−${formatMoney(draft.calculation.mealDeductionCents)}`}
                />
              ) : null}
              <div className="flex justify-between border-t border-line pt-1.5 font-semibold">
                <dt>Yhteensä</dt>
                <dd className="tabular">{formatMoney(draft.calculation.totalCents)}</dd>
              </div>
            </dl>

            <p className="mt-2 font-mono text-xs text-muted">
              {draft.calculation.mileageRuleId}@{draft.calculation.mileageRuleVersion}
              {draft.calculation.perDiemRuleId
                ? ` · ${draft.calculation.perDiemRuleId}@${draft.calculation.perDiemRuleVersion}`
                : ""}
            </p>

            {draft.calculation.reviewReasons.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {draft.calculation.reviewReasons.map((r) => (
                  <li
                    key={r}
                    className="rounded border border-warn-500/30 bg-warn-100 px-2 py-0.5 text-xs text-warn-600"
                  >
                    {TRIP_REVIEW_LABELS[r] ?? r}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="mt-4">
            <Submit label="Tallenna matka" busy="Tallennetaan…" primary disabled={!enabled} />
          </div>

          {saveState.error ? (
            <p role="alert" className="mt-3 rounded-md bg-risk-100 px-3 py-2 text-sm text-risk-600">
              {saveState.error}
            </p>
          ) : null}
          {saveState.notice ? (
            <p role="status" className="mt-3 rounded-md bg-ok-100 px-3 py-2 text-sm text-ok-600">
              {saveState.notice}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  step,
  min,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  step?: string;
  min?: string;
  max?: string;
}) {
  const id = `trip-${name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-muted">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        step={step}
        min={min}
        max={max}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-md border border-line bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}

function Submit({
  label,
  busy,
  primary,
  disabled,
}: {
  label: string;
  busy: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={[
        "rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50",
        primary
          ? "bg-gold-400 text-navy-900 hover:bg-gold-300"
          : "border border-line hover:border-navy-300",
      ].join(" ")}
    >
      {pending ? busy : label}
    </button>
  );
}

function fieldLabel(key: string): string {
  return (
    {
      kilometers: "kilometrit",
      durationHours: "kesto",
      origin: "lähtöpaikka",
      destination: "määränpää",
      purpose: "tarkoitus",
    }[key] ?? key
  );
}

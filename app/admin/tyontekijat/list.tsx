"use client";

import { useActionState, useState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import type { AdminState } from "../actions";
import { inviteEmployee, saveEmployee, setEmployeeActive } from "./actions";
import { inviteMessage } from "@/lib/restoflow/invite-message";
import { fill } from "@/lib/i18n/auth-text";
import { CONTROL, CONTROL_STYLE, Field, SaveRow } from "../asetukset/form-parts";
import { Card, Pill } from "@/components/restoflow/ui";
import { RfIcon } from "@/components/restoflow/icons";
import { formatMoney } from "@/lib/money";
import { formatHours, fullName } from "@/lib/restoflow/employees";
import type { EmployeeSummary } from "@/lib/restoflow/employees";

const initial: AdminState = {};

/**
 * Työntekijäluettelo ja lomake.
 *
 * Yksi lomake, kaksi tehtävää: tyhjänä se lisää, täytettynä se muokkaa.
 * Kaksi erillistä lomaketta olisi kaksi paikkaa jossa kenttä voi
 * unohtua, ja ne ajautuisivat erilleen ensimmäisellä muutoksella.
 */
export function EmployeeList({
  t,
  rows,
  locale,
}: {
  t: AdminText;
  rows: EmployeeSummary[];
  locale: string;
}) {
  /* Avoinna oleva muokkauslomake, tai null. */
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <Card key={row.employee.id}>
          {open === row.employee.id ? (
            <EmployeeForm
              t={t}
              employee={row}
              onClose={() => setOpen(null)}
            />
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">
                    {fullName(row.employee)}
                  </p>
                  <p
                    className="truncate text-[12.5px]"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    {row.employee.jobTitle ?? "—"} ·{" "}
                    {formatMoney(row.employee.hourlyCents)}/h
                  </p>
                  {/*
                    Sähköposti näkyviin ilman muokkaustilaa.

                    Juuri se ratkaisee liitoksen tunnukseen, ja
                    kirjoitusvirhe — test@ ja testi@ — on nähtävä
                    silmällä eikä vasta siitä että leimaus ei toimi.
                  */}
                  {row.employee.email ? (
                    <p
                      className="truncate text-[12px]"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      {row.employee.email}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  {row.working ? (
                    <Pill tone="ok" dot>
                      {t.tyo.working}
                    </Pill>
                  ) : null}
                  {!row.employee.active ? (
                    <Pill tone="neutral">{t.tyo.inactive}</Pill>
                  ) : null}
                  {row.employee.active && !row.employee.linked ? (
                    <Pill tone="warn">{t.tyo.notLinked}</Pill>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                <span className="text-[13px]">
                  <span style={{ color: "var(--rf-text-3)" }}>
                    {t.tyo.hoursThisMonth}{" "}
                  </span>
                  <span className="rf-tabular font-semibold">
                    {formatHours(row.minutes, locale)}
                  </span>
                </span>
                <span className="text-[13px]">
                  <span style={{ color: "var(--rf-text-3)" }}>
                    {t.tyo.estimatedPay}{" "}
                  </span>
                  <span className="rf-tabular font-semibold">
                    {formatMoney(row.payCents)}
                  </span>
                </span>
              </div>

              {row.employee.active && !row.employee.linked ? (
                <p
                  className="text-[12px] leading-relaxed"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  {t.tyo.notLinkedHint}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(row.employee.id)}
                  className="rf-press text-[12.5px] font-semibold underline-offset-4 hover:underline"
                >
                  {t.tyo.editTitle}
                </button>
                <ActiveToggle t={t} row={row} />
              </div>

              {row.employee.active && !row.employee.linked ? (
                <InviteRow t={t} row={row} />
              ) : null}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

/**
 * Käyttöönotto ja käytöstä poisto.
 *
 * Poistoa ei ole: tehdyt tunnit jäävät, ja rivin tuhoaminen muuttaisi
 * jo raportoidun kuukauden palkkakulun jälkikäteen.
 */
function ActiveToggle({ t, row }: { t: AdminText; row: EmployeeSummary }) {
  const [state, action] = useActionState(setEmployeeActive, initial);

  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="id" value={row.employee.id} />
      <input
        type="hidden"
        name="active"
        value={row.employee.active ? "0" : "1"}
      />
      <button
        type="submit"
        className="rf-press text-[12.5px] font-semibold underline-offset-4 hover:underline"
        style={{
          color: row.employee.active ? "var(--rf-red-text)" : undefined,
        }}
      >
        {row.employee.active ? t.tyo.deactivate : t.tyo.activate}
      </button>
      {state.error ? (
        <span
          role="alert"
          className="text-[12px] font-semibold"
          style={{ color: "var(--rf-red-text)" }}
        >
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

function EmployeeForm({
  t,
  employee,
  onClose,
}: {
  t: AdminText;
  employee?: EmployeeSummary;
  onClose: () => void;
}) {
  const [state, action] = useActionState(saveEmployee, initial);
  const e = employee?.employee;

  /* Sentit euroiksi kenttään: 1450 → "14,50". */
  const hourly = e ? (e.hourlyCents / 100).toFixed(2).replace(".", ",") : "";

  return (
    <form action={action} className="space-y-4">
      {e ? <input type="hidden" name="id" value={e.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.tyo.firstName} htmlFor="rf-first">
          <input
            id="rf-first"
            name="firstName"
            defaultValue={e?.firstName ?? ""}
            required
            maxLength={80}
            className={CONTROL}
            style={CONTROL_STYLE}
          />
        </Field>

        <Field label={t.tyo.lastName} htmlFor="rf-last">
          <input
            id="rf-last"
            name="lastName"
            defaultValue={e?.lastName ?? ""}
            required
            maxLength={80}
            className={CONTROL}
            style={CONTROL_STYLE}
          />
        </Field>
      </div>

      <Field label={t.tyo.email} htmlFor="rf-email" hint={t.tyo.emailHint}>
        <input
          id="rf-email"
          name="email"
          type="email"
          defaultValue={e?.email ?? ""}
          maxLength={160}
          autoComplete="off"
          className={CONTROL}
          style={CONTROL_STYLE}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t.tyo.jobTitle}
          htmlFor="rf-job"
          hint={t.tyo.jobTitleHint}
        >
          <input
            id="rf-job"
            name="jobTitle"
            defaultValue={e?.jobTitle ?? ""}
            maxLength={80}
            className={CONTROL}
            style={CONTROL_STYLE}
          />
        </Field>

        <Field
          label={t.tyo.hourly}
          htmlFor="rf-hourly"
          hint={t.tyo.hourlyHint}
        >
          <input
            id="rf-hourly"
            name="hourly"
            inputMode="decimal"
            defaultValue={hourly}
            placeholder="14,50"
            required
            className={CONTROL}
            style={CONTROL_STYLE}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2.5 text-[13px] font-semibold">
        <input
          type="checkbox"
          name="active"
          defaultChecked={e?.active ?? true}
          className="h-4 w-4"
        />
        {t.tyo.active}
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <SaveRow t={t} state={state} />
        <button
          type="button"
          onClick={onClose}
          className="rf-press text-[12.5px] font-semibold underline-offset-4 hover:underline"
          style={{ color: "var(--rf-text-2)" }}
        >
          {t.loput.cancel}
        </button>
      </div>
    </form>
  );
}

/**
 * Kutsu leimaamaan, kortilta.
 *
 * Koodi näkyy kerran ja katoaa kun sivu ladataan uudelleen — kannassa
 * on vain sen tiiviste. Siksi se on tässä isona ja kopioitavana heti,
 * eikä piilossa toisen napin takana.
 */
function InviteRow({ t, row }: { t: AdminText; row: EmployeeSummary }) {
  const [state, action] = useActionState(inviteEmployee, initial);
  const [copied, setCopied] = useState(false);

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  if (state.code) {
    const message = inviteMessage({
      t,
      origin,
      code: state.code,
      roleName: t.tyo.title,
    });

    return (
      <div
        className="mt-1 p-3.5"
        style={{
          background: "var(--rf-inset)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <p className="text-[12.5px] font-semibold">
          {fill(t.tyo.codeFor, { nimi: fullName(row.employee) })}
        </p>

        <p className="rf-tabular select-all py-3 text-center text-[24px] font-semibold tracking-[0.14em]">
          {state.code}
        </p>

        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(message);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
          className="rf-press w-full py-2.5 text-[13.5px] font-semibold"
          style={{
            background: "var(--rf-accent)",
            color: "var(--rf-on-accent)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {copied ? t.tiimi.copied : t.tiimi.copyInstructions}
        </button>

        <p
          className="mt-2.5 text-[12px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          {t.tyo.inviteHint}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={row.employee.id} />
      <button
        type="submit"
        className="rf-press inline-flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-bold"
        style={{
          background: "var(--rf-inset)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <RfIcon name="plus" size={14} />
        {t.tyo.invite}
      </button>

      {state.error ? (
        <span
          role="alert"
          className="text-[12px] font-semibold"
          style={{ color: "var(--rf-red-text)" }}
        >
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

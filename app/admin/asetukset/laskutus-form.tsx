"use client";

import { useActionState, useId, useState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import type { AdminState } from "../actions";
import { updateInvoicing } from "./laskutus-actions";
import { CONTROL, CONTROL_STYLE, Field, SaveRow } from "./form-parts";
import { alvNumero, muotoileIban } from "@/lib/restoflow/yritystunnus";

const initial: AdminState = {};

/**
 * Myyjän tiedot laskulle.
 *
 * ALV-NUMEROA EI KYSYTÄ.
 *
 * Suomessa se on FI ja Y-tunnus ilman viivaa, eli johdettavissa
 * suoraan. Kysytty kenttä olisi kenttä jonka voi täyttää väärin, ja
 * kaksi eri tunnusta samasta yrityksestä samalla laskulla on juuri se
 * virhe jota kukaan ei huomaa ennen kuin kirjanpitäjä kysyy.
 *
 * Siksi se näytetään laskettuna heti kentän alla: näin sen näkee
 * olevan oikein, muttei voi kirjoittaa väärin.
 */
export function InvoicingForm({
  t,
  arvot,
}: {
  t: AdminText;
  arvot: {
    businessId: string | null;
    iban: string | null;
    termsDays: number;
    invoiceNote: string | null;
  };
}) {
  const [state, action] = useActionState(updateInvoicing, initial);
  const [tunnus, setTunnus] = useState(arvot.businessId ?? "");
  const id = useId();

  const alv = alvNumero(tunnus);

  return (
    <form action={action} className="space-y-4">
      <p
        className="max-w-2xl text-[13px] leading-relaxed"
        style={{ color: "var(--rf-text-2)" }}
      >
        {t.laskutus.lead}
      </p>

      <Field
        label={t.laskutus.businessId}
        hint={t.laskutus.businessIdHint}
        htmlFor={`${id}-bid`}
      >
        <input
          id={`${id}-bid`}
          name="businessId"
          value={tunnus}
          onChange={(e) => setTunnus(e.target.value)}
          placeholder="1234567-8"
          inputMode="numeric"
          className={CONTROL}
          style={CONTROL_STYLE}
        />
      </Field>

      {/*
        ALV-numero näkyy vasta kun Y-tunnus on kelvollinen.

        Keskeneräisestä tunnuksesta johdettu numero vaihtuisi joka
        näppäilyllä ja näyttäisi siltä että kenttä arvaa.
      */}
      {alv ? (
        <p className="rf-tabular text-[12.5px]" style={{ color: "var(--rf-text-3)" }}>
          {t.laskutus.vatNumber}: <strong>{alv}</strong> — {t.laskutus.vatNumberHint}
        </p>
      ) : null}

      <Field
        label={t.laskutus.iban}
        hint={t.laskutus.ibanHint}
        htmlFor={`${id}-iban`}
      >
        <input
          id={`${id}-iban`}
          name="iban"
          defaultValue={arvot.iban ? muotoileIban(arvot.iban) : ""}
          placeholder="FI21 1234 5600 0007 85"
          autoComplete="off"
          className={`${CONTROL} rf-tabular`}
          style={CONTROL_STYLE}
        />
      </Field>

      <Field
        label={t.laskutus.terms}
        hint={t.laskutus.termsHint}
        htmlFor={`${id}-terms`}
      >
        <div className="flex items-center gap-2">
          <input
            id={`${id}-terms`}
            name="terms"
            type="number"
            min={0}
            max={365}
            defaultValue={arvot.termsDays}
            className={`${CONTROL} rf-tabular`}
            style={{ ...CONTROL_STYLE, maxWidth: 120 }}
          />
          <span className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            {t.laskutus.days}
          </span>
        </div>
      </Field>

      <Field
        label={t.laskutus.invoiceNote}
        hint={t.laskutus.invoiceNoteHint}
        htmlFor={`${id}-note`}
      >
        <textarea
          id={`${id}-note`}
          name="invoiceNote"
          rows={3}
          maxLength={500}
          defaultValue={arvot.invoiceNote ?? ""}
          className={CONTROL}
          style={{ ...CONTROL_STYLE, height: "auto", paddingTop: 10 }}
        />
      </Field>

      <SaveRow t={t} state={state} label={t.laskutus.save} />
    </form>
  );
}

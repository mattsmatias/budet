"use client";

import { useActionState, useState } from "react";
import type { Labels } from "@/lib/i18n/labels";
import type { AdminText } from "@/lib/i18n/admin-text";
import { useFormStatus } from "react-dom";
import {
  cancelShift,
  deleteShift,
  saveShift,
  type AdminState,
} from "../actions";
import { publicationOf } from "@/lib/restoflow/shift-planning";
import {
  type Shift,
  type StaffPosition,
  type User,
} from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";
import { Card } from "@/components/restoflow/ui";

const initial: AdminState = {};
const POSITIONS: StaffPosition[] = ["waiter", "kitchen", "manager", "cleaning"];

/**
 * Vuoron luonti ja muokkaus.
 *
 * Tekijän voi jättää tyhjäksi: silloin syntyy avoin vuoro johon kuka
 * tahansa voi tarttua. Avoimen vuoron on oltava mahdollinen, koska
 * työvuorolista tehdään usein ennen kuin tiedetään kuka on käytettävissä.
 */
export function ShiftForm({
  t,
  nimet,
  users,
  shift,
  defaultDate,
  onDone,
}: {
  t: AdminText;
  nimet: Labels;
  users: User[];
  shift?: Shift;
  defaultDate: string;
  onDone?: () => void;
}) {
  const [state, action] = useActionState(saveShift, initial);

  if (state.notice) {
    return (
      <p
        role="status"
        className="px-3.5 py-2.5 text-[13px] font-medium"
        style={{
          background: "var(--rf-green-bg)",
          color: "var(--rf-green-text)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        {state.notice}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      {shift ? <input type="hidden" name="shiftId" value={shift.id} /> : null}

      <div>
        <label htmlFor="shift-user" className="block text-[13px] font-medium">
          {t.vuoro.doer}
        </label>
        <select
          id="shift-user"
          name="userId"
          defaultValue={shift?.userId ?? ""}
          className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
          style={{
            background: "var(--rf-inset)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <option value="">{t.vuoro.openShift}</option>
          {users
            .filter((u) => u.position !== null)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.position ? ` · ${nimet.positions[u.position]}` : ""}
              </option>
            ))}
        </select>
        <p className="mt-1 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {t.vuoro.doerAccepts}
        </p>
      </div>

      <div>
        <label
          htmlFor="shift-position"
          className="block text-[13px] font-medium"
        >
          {t.vuoro.task}
        </label>
        <select
          id="shift-position"
          name="position"
          defaultValue=""
          className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
          style={{
            background: "var(--rf-inset)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <option value="">—</option>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {nimet.positions[p]}
            </option>
          ))}
        </select>
      </div>

      <Input
        label={t.vuoro.dayView}
        name="date"
        type="date"
        defaultValue={shift?.date ?? defaultDate}
        required
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label={t.vuoro.starts}
          name="start"
          type="time"
          defaultValue={shift?.startTime ?? "14:00"}
          required
        />
        <Input
          label={t.vuoro.ends}
          name="end"
          type="time"
          defaultValue={shift?.endTime ?? "22:00"}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/*
          Tauko vähennetään suunnitellusta työajasta.

          Erillään alku- ja loppuajasta, koska tauko ei ole vuoron
          reunoilla vaan sen sisällä: 10–18 puolen tunnin tauolla on
          yhä vuoro joka alkaa kymmeneltä. Palkkakulu lasketaan tauon
          jälkeisestä ajasta, joten unohtunut tauko näkyy euroina.
        */}
        <Input
          label={t.vuoro.breakMin}
          name="break"
          type="number"
          min={0}
          max={480}
          step={5}
          defaultValue={String(shift?.breakMinutes ?? 0)}
        />

        <Input
          label={t.vuoro.place}
          name="location"
          defaultValue={shift?.location ?? ""}
          placeholder={t.vuoro.hall}
        />
      </div>

      <Input
        label={t.vuoro.extraInfo}
        name="note"
        defaultValue={shift?.note ?? ""}
        placeholder={t.vuoro.extraPlaceholder}
      />

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
        <Save t={t} label={shift ? t.vuoro.save : t.vuoro.createShift} />
        {onDone ? (
          <button
            type="button"
            onClick={onDone}
            className="rf-press py-2.5 text-[14px] font-semibold"
            style={{
              background: "var(--rf-inset)",
              color: "var(--rf-text)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            {t.vuoro.cancel}
          </button>
        ) : null}
      </div>

      {shift ? (
        <p
          className="text-[12px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          {t.vuoro.changeNeedsReaccept}
        </p>
      ) : null}
    </form>
  );
}

/** Uuden vuoron avaava painike. */
export function NewShiftButton({
  t,
  nimet,
  users,
  defaultDate,
}: {
  t: AdminText;
  nimet: Labels;
  users: User[];
  defaultDate: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        /*
         * Samat mitat kuin viereisellä "Kuukauden lista" -painikkeella.
         *
         * Painikkeet ovat samalla rivillä, ja eri korkuisina ne
         * näyttivät siltä että toinen olisi jotenkin toista
         * tärkeämpi tai eri paikkaan kuuluva. Ero tehdään värillä:
         * tämä on korostusvärinen päätoiminto, viereinen ei.
         */
        className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
        style={{
          background: "var(--rf-accent)",
          color: "var(--rf-on-accent)",
          /*
           * Läpinäkyvä reunus, jotta laatikkomalli on sama.
           *
           * Viereisellä painikkeella on yhden pikselin reunus. Ilman
           * tätä tämä jäisi pikselin matalammaksi — ero jota ei
           * huomaa katsomalla mutta joka näkyy rivin epätasaisuutena.
           */
          border: "1px solid transparent",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <RfIcon name="plus" size={15} />
        {t.vuoro.newShift}
      </button>
    );
  }

  return (
    <Card>
      <p className="mb-3 text-[15px] font-semibold">{t.vuoro.newShift}</p>
      <ShiftForm
        t={t}
        nimet={nimet}
        users={users}
        defaultDate={defaultDate}
        onDone={() => setOpen(false)}
      />
    </Card>
  );
}

/** Vuoron muokkaus ja poisto. */
export function EditShift({
  t,
  nimet,
  users,
  shift,
}: {
  t: AdminText;
  nimet: Labels;
  users: User[];
  shift: Shift;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const tila = publicationOf(shift);
  const julkaistu = tila === "published";
  const peruttu = tila === "cancelled";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rf-press px-3 py-1.5 text-[13px] font-medium"
        style={{
          background: "var(--rf-inset)",
          color: "var(--rf-text-2)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        {t.vuoro.edit}
      </button>
    );
  }

  return (
    <div
      className="mt-3 w-full basis-full border-t pt-3"
      style={{ borderColor: "var(--rf-line)" }}
    >
      <ShiftForm
        t={t}
        nimet={nimet}
        users={users}
        shift={shift}
        defaultDate={shift.date}
        onDone={() => setOpen(false)}
      />

      {/*
        JULKAISTUA VUOROA EI POISTETA VAAN PERUTAAN.

        Poistettu rivi veisi mukanaan tiedon siitä että vuoro oli
        olemassa, ja juuri se tieto tarvitaan kun kysytään miksi joku
        ei ollut töissä. Luonnoksen saa poistaa: sitä ei ole luvattu
        kenellekään.
      */}
      <div className="mt-3">
        {peruttu ? (
          <p className="text-[12.5px]" style={{ color: "var(--rf-text-3)" }}>
            {t.vuoro.shiftCancelled}
          </p>
        ) : confirming ? (
          <form
            action={julkaistu ? cancelShift : deleteShift}
            className="flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="shiftId" value={shift.id} />
            <button
              type="submit"
              className="rf-press px-3 py-1.5 text-[13px] font-semibold"
              style={{
                background: "var(--rf-red)",
                color: "var(--rf-on-accent)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              {julkaistu ? t.vuoro.cancelShift : t.vuoro.deleteDraft}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-[13px]"
              style={{ color: "var(--rf-text-2)" }}
            >
              {t.vuoro.cancel}
            </button>
            <span
              className="basis-full text-[12px]"
              style={{ color: "var(--rf-text-3)" }}
            >
              {julkaistu ? t.vuoro.alreadySeen : t.vuoro.draftUnseen}
            </span>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-[13px] underline underline-offset-4"
            style={{ color: "var(--rf-red-text)" }}
          >
            {julkaistu ? t.vuoro.cancelShift : t.vuoro.deleteDraft}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Input({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required,
  min,
  max,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  /** Lukukentän rajat. Selain estää mahdottoman arvon jo syöttäessä. */
  min?: number;
  max?: number;
  step?: number;
}) {
  const id = `sh-${name}`;

  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        min={min}
        max={max}
        step={step}
        className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
        style={{
          background: "var(--rf-inset)",
          borderRadius: "var(--rf-r-control)",
        }}
      />
    </div>
  );
}

function Save({ t, label }: { t: AdminText; label: string }) {
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
      {pending ? t.vuoro.savingEllipsis : label}
    </button>
  );
}

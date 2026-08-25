"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  copyShiftNextWeek,
  copyShiftRange,
  createRecurringShifts,
} from "../planning-actions";
import type { AdminState } from "../../actions";
import { POSITION_LABELS, type Shift, type StaffPosition, type User } from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, CardHeader } from "@/components/restoflow/ui";

const initial: AdminState = {};
const POSITIONS: StaffPosition[] = ["waiter", "kitchen", "manager", "cleaning"];

const WEEKDAYS = [
  { value: 1, label: "Ma" },
  { value: 2, label: "Ti" },
  { value: 3, label: "Ke" },
  { value: 4, label: "To" },
  { value: 5, label: "Pe" },
  { value: 6, label: "La" },
  { value: 7, label: "Su" },
];

/**
 * Yhden vuoron kopiointi viikoksi eteenpäin.
 *
 * Sama viikonpäivä, sama kello, sama tekijä — ravintolan tavallisin
 * toisto. Lomaketta ei tarvita, koska kaikki tiedot ovat jo vuorossa.
 *
 * Kopio ei synny jos tekijällä on jo päällekkäinen vuoro. Kanta
 * tarkistaa sen, eikä painallus voi luoda kaksoisvuoroa vahingossa.
 */
export function CopyDay({ shift }: { shift: Shift }) {
  return (
    <form action={copyShiftNextWeek}>
      <input type="hidden" name="date" value={shift.date} />
      <button
        type="submit"
        title="Kopioi tämä päivä viikoksi eteenpäin"
        className="rf-press px-2.5 py-1.5 text-[13px] font-medium"
        style={{
          background: "var(--rf-inset)",
          color: "var(--rf-text-2)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        + 7 pv
      </button>
    </form>
  );
}

/**
 * Edellisen viikon tai kuukauden kopiointi.
 *
 * Siirtymä lasketaan päivinä ja on aina seitsemällä jaollinen, jotta
 * viikonpäivät säilyvät. Kuukauden kopiointi neljänä viikkona on
 * tarkoituksellista: kalenterikuukauden pituus siirtäisi maanantain
 * keskiviikoksi, ja ravintolan viikko on viikko eikä kuukausi.
 */
export function CopyRange({
  month,
  monthStart,
  monthEnd,
}: {
  month: string;
  monthStart: string;
  monthEnd: string;
}) {
  const [state, action] = useActionState(copyShiftRange, initial);
  const [open, setOpen] = useState(false);

  if (state.notice) {
    return (
      <p
        role="status"
        className="px-3.5 py-2.5 text-[12.5px] font-medium"
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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
        style={{
          background: "var(--rf-inset)",
          color: "var(--rf-text)",
          border: "1px solid var(--rf-line-strong)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <RfIcon name="calendar" size={15} />
        Kopioi vuoroja
      </button>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Kopioi vuoroja"
        subtitle="Kopiot syntyvät luonnoksina. Päällekkäiset ohitetaan."
      />

      <div className="space-y-2.5">
        <Vaihtoehto
          action={action}
          from={siirra(monthStart, -7)}
          to={siirra(monthEnd, -7)}
          offset={7}
          label="Kopioi edellinen viikko eteenpäin"
          hint="Jokainen vuoro seitsemän päivää eteenpäin"
        />

        <Vaihtoehto
          action={action}
          from={siirra(monthStart, -28)}
          to={siirra(monthStart, -1)}
          offset={28}
          label="Kopioi edelliset neljä viikkoa"
          hint={`Neljä viikkoa ennen ${month}-kuuta, neljä viikkoa eteenpäin`}
        />
      </div>

      {state.error ? (
        <p role="alert" className="mt-3 text-[12.5px]" style={{ color: "var(--rf-red-text)" }}>
          {state.error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-3 text-[13px]"
        style={{ color: "var(--rf-text-2)" }}
      >
        Sulje
      </button>
    </Card>
  );
}

function Vaihtoehto({
  action,
  from,
  to,
  offset,
  label,
  hint,
}: {
  action: (formData: FormData) => void;
  from: string;
  to: string;
  offset: number;
  label: string;
  hint: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <input type="hidden" name="offset" value={String(offset)} />

      <Painike label={label} hint={hint} />
    </form>
  );
}

function Painike({ label, hint }: { label: string; hint: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press flex w-full flex-col items-start px-3.5 py-2.5 text-left"
      style={{
        background: "var(--rf-inset)",
        borderRadius: "var(--rf-r-control)",
        opacity: pending ? 0.6 : 1,
      }}
    >
      <span className="text-[13.5px] font-semibold">
        {pending ? "Kopioidaan…" : label}
      </span>
      <span className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
        {hint}
      </span>
    </button>
  );
}

/**
 * Toistuva vuoro.
 *
 * "Ali tekee maanantaisin ja tiistaisin 10–18 syyskuun ajan." Yksi
 * lomake korvaa kymmenen erillistä vuoroa, ja juuri se on
 * kuukausisuunnittelun raskain kohta.
 */
export function RecurringForm({
  users,
  monthStart,
  monthEnd,
}: {
  users: User[];
  monthStart: string;
  monthEnd: string;
}) {
  const [state, action] = useActionState(createRecurringShifts, initial);
  const [open, setOpen] = useState(false);

  if (state.notice) {
    return (
      <p
        role="status"
        className="px-3.5 py-2.5 text-[12.5px] font-medium"
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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
        style={{
          background: "var(--rf-inset)",
          color: "var(--rf-text)",
          border: "1px solid var(--rf-line-strong)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <RfIcon name="clock" size={15} />
        Toistuva vuoro
      </button>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Toistuva vuoro"
        subtitle="Yksi lomake, koko jakso. Päällekkäiset ohitetaan."
      />

      <form action={action} className="space-y-3">
        <div>
          <label htmlFor="rec-user" className="block text-[13px] font-medium">
            Työntekijä
          </label>
          <select
            id="rec-user"
            name="userId"
            className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
            style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
          >
            <option value="">Avoin vuoro</option>
            {users
              .filter((u) => u.position !== null)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.position ? ` · ${POSITION_LABELS[u.position]}` : ""}
                </option>
              ))}
          </select>
        </div>

        <fieldset>
          <legend className="text-[13px] font-medium">Viikonpäivät</legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {WEEKDAYS.map((day) => (
              <label
                key={day.value}
                className="rf-press cursor-pointer px-3 py-2 text-[13px] font-semibold"
                style={{
                  background: "var(--rf-inset)",
                  borderRadius: "var(--rf-r-control)",
                }}
              >
                <input
                  type="checkbox"
                  name="weekday"
                  value={day.value}
                  className="mr-1.5 align-middle"
                />
                {day.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Kentta label="Alkaa" name="start" type="time" defaultValue="10:00" />
          <Kentta label="Päättyy" name="end" type="time" defaultValue="18:00" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Kentta label="Tauko (min)" name="break" type="number" defaultValue="30" />
          <div>
            <label htmlFor="rec-position" className="block text-[13px] font-medium">
              Tehtävä
            </label>
            <select
              id="rec-position"
              name="position"
              className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
              style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
            >
              <option value="">—</option>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {POSITION_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Kentta label="Jakso alkaa" name="from" type="date" defaultValue={monthStart} />
          <Kentta label="Jakso päättyy" name="to" type="date" defaultValue={monthEnd} />
        </div>

        {state.error ? (
          <p role="alert" className="text-[12.5px]" style={{ color: "var(--rf-red-text)" }}>
            {state.error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2.5">
          <Luo />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rf-press px-3.5 py-2 text-[13px] font-medium"
            style={{ color: "var(--rf-text-2)" }}
          >
            Peruuta
          </button>
        </div>
      </form>
    </Card>
  );
}

function Kentta({
  label,
  name,
  type,
  defaultValue,
}: {
  label: string;
  name: string;
  type: string;
  defaultValue: string;
}) {
  const id = `rec-${name}`;

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
        min={type === "number" ? 0 : undefined}
        className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
        style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
      />
    </div>
  );
}

function Luo() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press px-4 py-2.5 text-[13.5px] font-bold"
      style={{
        background: "var(--rf-accent)",
        color: "var(--rf-on-accent)",
        borderRadius: "var(--rf-r-control)",
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? "Luodaan…" : "Luo vuorot"}
    </button>
  );
}

/** "2026-09-01" + päiviä. Selaimessa, koska napit lasketaan tässä. */
function siirra(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { closeMonth, reopenMonth, updateSettings, type AdminState } from "../actions";
import { RfIcon } from "@/components/restoflow/icons";

const initial: AdminState = {};

/**
 * Aikavyöhykkeet joita ravintola voi valita.
 *
 * Lyhyt lista täydellisen IANA-luettelon sijaan: sadan vaihtoehdon
 * pudotusvalikosta oikean löytäminen on vaikeampaa kuin viiden. Kanta
 * hyväksyy minkä tahansa kelvollisen vyöhykkeen, joten listaa voi
 * laajentaa ilman migraatiota.
 */
const TIMEZONES = [
  "Europe/Helsinki",
  "Europe/Stockholm",
  "Europe/Oslo",
  "Europe/Copenhagen",
  "Europe/Tallinn",
  "Europe/Riga",
  "Europe/London",
  "Europe/Berlin",
] as const;

export function SettingsForm({
  name,
  timezone,
}: {
  name: string;
  timezone: string;
}) {
  const [state, action] = useActionState(updateSettings, initial);

  return (
    <form action={action} className="mt-4 space-y-3">
      <div>
        <label htmlFor="rf-name" className="block text-[13px] font-medium">
          Ravintolan nimi
        </label>
        <input
          id="rf-name"
          name="name"
          defaultValue={name}
          required
          maxLength={120}
          className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
          style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
        />
      </div>

      <div>
        <label htmlFor="rf-tz" className="block text-[13px] font-medium">
          Aikavyöhyke
        </label>
        <select
          id="rf-tz"
          name="timezone"
          defaultValue={timezone}
          className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
          style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
        >
          {(TIMEZONES as readonly string[]).includes(timezone) ? null : (
            <option value={timezone}>{timezone}</option>
          )}
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
          Työaika, vuorojen päivät ja kuukausirajat lasketaan tässä ajassa.
          Palvelin käy UTC:ssä, joten väärä vyöhyke siirtäisi yövuorot
          väärälle päivälle.
        </p>
      </div>

      <Feedback state={state} />

      <Submit label="Tallenna" />
    </form>
  );
}

/**
 * Kuukauden sulkeminen ja avaaminen.
 *
 * Sulkeminen on omistajan päätös eikä automaattinen: kirjanpitoon
 * lähetetty kuukausi lukitaan silloin kun se on oikeasti lähetetty, ei
 * kalenterin mukaan.
 */
export function MonthClosing({
  closedMonths,
  selectableMonths,
}: {
  closedMonths: string[];
  selectableMonths: string[];
}) {
  const [state, action] = useActionState(closeMonth, initial);
  const open = selectableMonths.filter((m) => !closedMonths.includes(m));

  return (
    <div className="mt-4 space-y-4">
      {closedMonths.length > 0 ? (
        <ul className="space-y-2">
          {closedMonths.map((month) => (
            <li
              key={month}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5"
              style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
            >
              <span className="flex items-center gap-2 text-[14px] font-medium">
                <span style={{ color: "var(--rf-green-text)" }}>
                  <RfIcon name="check" size={16} />
                </span>
                {formatMonth(month)}
              </span>
              <ReopenButton month={month} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          Yhtään kuukautta ei ole suljettu.
        </p>
      )}

      {open.length > 0 ? (
        <form action={action} className="space-y-3">
          <div>
            <label htmlFor="rf-month" className="block text-[13px] font-medium">
              Sulje kuukausi
            </label>
            <select
              id="rf-month"
              name="month"
              defaultValue={open[0]}
              className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
              style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
            >
              {open.map((m) => (
                <option key={m} value={m}>
                  {formatMonth(m)}
                </option>
              ))}
            </select>
          </div>

          <input
            name="note"
            placeholder="Merkintä, esim. lähetetty tilitoimistoon"
            maxLength={200}
            className="w-full px-3.5 py-2.5 text-[16px] outline-none"
            style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
          />

          <Feedback state={state} />

          <Submit label="Sulje kuukausi" />

          <p className="text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
            Suljetun kuukauden kuitteja ei voi lisätä, muuttaa eikä poistaa.
            Kuluvaa kuukautta ei voi sulkea. Avaaminen onnistuu tästä samasta
            näkymästä.
          </p>
        </form>
      ) : (
        <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          Ei suljettavia kuukausia — kuluvaa kuukautta ei voi sulkea.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ReopenButton({ month }: { month: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rf-press px-3 py-1.5 text-[13px] font-medium"
        style={{
          background: "var(--rf-card)",
          color: "var(--rf-text-2)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        Avaa
      </button>
    );
  }

  return (
    <form action={reopenMonth} className="flex items-center gap-2">
      <input type="hidden" name="month" value={month} />
      <button
        type="submit"
        className="rf-press px-3 py-1.5 text-[13px] font-semibold"
        style={{
          background: "var(--rf-amber)",
          color: "var(--rf-on-accent)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        Avaa uudelleen
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-[13px]"
        style={{ color: "var(--rf-text-2)" }}
      >
        Peruuta
      </button>
    </form>
  );
}

function Feedback({ state }: { state: AdminState }) {
  if (state.error) {
    return (
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
    );
  }

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

  return null;
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press w-full py-2.5 text-[14px] font-semibold disabled:opacity-50 md:w-auto md:px-5"
      style={{ background: "var(--rf-accent)", color: "var(--rf-on-accent)", borderRadius: "var(--rf-r-control)" }}
    >
      {pending ? "Tallennetaan…" : label}
    </button>
  );
}

function formatMonth(month: string): string {
  const NAMES = [
    "Tammikuu", "Helmikuu", "Maaliskuu", "Huhtikuu", "Toukokuu", "Kesäkuu",
    "Heinäkuu", "Elokuu", "Syyskuu", "Lokakuu", "Marraskuu", "Joulukuu",
  ];
  const [year, m] = month.split("-");
  return `${NAMES[Number(m) - 1]} ${year}`;
}

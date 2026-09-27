"use client";

import { useActionState, useState } from "react";
import {
  inviteKateStaff,
  removeKateStaff,
  revokeKateInvitation,
  type DevState,
} from "../actions";

/**
 * Katen työntekijöiden lomakkeet.
 *
 * Samat säännöt kuin muualla konsolissa: jokainen toiminto on oma
 * lomakkeensa, virhe ja kuittaus näkyvät sen vieressä, ja kutsukoodi
 * näytetään kerran koska kannassa on vain sen tiiviste.
 */

const initial: DevState = {};

const CONTROL_STYLE = {
  background: "var(--rf-card)",
  border: "1px solid var(--rf-line-strong)",
  borderRadius: "var(--rf-r-control)",
  color: "var(--rf-text)",
} as const;

/* Sama viestin muoto kuin konsolin muissa lomakkeissa. */
function Viesti({ state }: { state: DevState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="mt-2 text-[12.5px]"
        style={{ color: "var(--rf-red-text)" }}
      >
        {state.error}
      </p>
    );
  }
  if (state.notice) {
    return (
      <p className="mt-2 text-[12.5px]" style={{ color: "var(--rf-green-text)" }}>
        {state.notice}
      </p>
    );
  }
  return null;
}

export function InviteKateForm() {
  const [state, action] = useActionState(inviteKateStaff, initial);

  return (
    <div className="px-5 pb-5 pt-1">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <label className="block min-w-[12rem] flex-1">
          <span className="block text-[12.5px] font-semibold">
            Työntekijän nimi
            <span
              className="ms-1 font-normal"
              style={{ color: "var(--rf-text-3)" }}
            >
              vain meille
            </span>
          </span>
          <input
            name="label"
            placeholder="Matti Meikäläinen"
            className="mt-1.5 w-full px-2.5 text-[13px]"
            style={{ ...CONTROL_STYLE, height: 36 }}
          />
        </label>

        <button
          type="submit"
          className="rf-press px-3.5 py-2 text-[13px] font-bold"
          style={{
            background: "var(--rf-inset)",
            border: "1px solid var(--rf-line-strong)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          Luo koodi
        </button>
      </form>

      {state.code ? (
        <div className="mt-3">
          <p
            className="rf-tabular px-3.5 py-2.5 text-[18px] font-bold tracking-[0.14em]"
            style={{
              background: "var(--rf-inset)",
              border: "1px solid var(--rf-line-strong)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            {state.code}
          </p>
          <p
            className="mt-1.5 text-[12px]"
            style={{ color: "var(--rf-amber-text)" }}
          >
            Kopioi nyt — koodia ei voi hakea myöhemmin.
          </p>
        </div>
      ) : (
        <Viesti state={state} />
      )}
    </div>
  );
}

export function RevokeInvite({ id }: { id: string }) {
  const [state, action] = useActionState(revokeKateInvitation, initial);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rf-press px-2.5 py-1 text-[12px] font-semibold"
        style={{
          background: "var(--rf-inset)",
          border: "1px solid var(--rf-line-strong)",
          borderRadius: 8,
          color: "var(--rf-text-2)",
        }}
      >
        Peru
      </button>
      <Viesti state={state} />
    </form>
  );
}

/**
 * Oikeuden poisto kysyy varmistuksen.
 *
 * Painike on listassa jokaisella rivillä, ja väärä rivi on yhden
 * pikselin päässä oikeasta. Varmistus näyttää nimen, jotta poistaja
 * lukee kenestä on kysymys.
 */
export function RemoveStaff({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const [state, action] = useActionState(removeKateStaff, initial);
  const [varmistus, setVarmistus] = useState(false);

  if (!varmistus) {
    return (
      <>
        <button
          type="button"
          onClick={() => setVarmistus(true)}
          className="rf-press px-2.5 py-1 text-[12px] font-semibold"
          style={{
            background: "var(--rf-inset)",
            border: "1px solid var(--rf-line-strong)",
            borderRadius: 8,
            color: "var(--rf-text-2)",
          }}
        >
          Poista oikeus
        </button>
        <Viesti state={state} />
      </>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[12px]" style={{ color: "var(--rf-red-text)" }}>
        Poistetaanko {name}?
      </span>

      <button
        type="button"
        onClick={() => setVarmistus(false)}
        className="rf-press px-2.5 py-1 text-[12px] font-semibold"
        style={{ background: "var(--rf-card)", borderRadius: 8 }}
      >
        Peruuta
      </button>

      <form action={action}>
        <input type="hidden" name="user" value={userId} />
        <button
          type="submit"
          className="rf-press px-2.5 py-1 text-[12px] font-bold"
          style={{
            background: "var(--rf-red-text)",
            color: "#fff",
            borderRadius: 8,
          }}
        >
          Poista
        </button>
      </form>
    </div>
  );
}

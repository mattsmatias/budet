"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitReferral, type IlmoitusState } from "./actions";

/**
 * Ilmoituslomake.
 *
 * KOLME PAKOLLISTA KENTTÄÄ, LOPUT VAPAAEHTOISIA.
 *
 * Tapaaminen päättyy usein siihen että toinen lähtee kiireellä.
 * Yritys, yhteyshenkilö ja sähköposti riittävät siihen että häneen
 * saadaan yhteys; puhelin ja muistiinpano ovat siltä varalta että
 * niitä ehdittiin kysyä.
 *
 * LOMAKE TYHJENEE ITSESTÄÄN.
 *
 * Onnistuneen lähetyksen jälkeen kentät nollataan, koska seuraava
 * ilmoitus on eri yritys. Edellisen tiedot jäisivät muuten pohjalle
 * ja päätyisivät vahingossa seuraavaan riviin.
 */

const initial: IlmoitusState = {};

const KENTTA = {
  background: "var(--rf-card)",
  border: "1px solid var(--rf-line-strong)",
  borderRadius: "var(--rf-r-control)",
  color: "var(--rf-text)",
} as const;

function Laheta() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press px-4 text-[13.5px] font-bold"
      style={{
        height: 42,
        background: "var(--rf-accent)",
        color: "var(--rf-on-accent)",
        border: "1px solid transparent",
        borderRadius: "var(--rf-r-control)",
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? "Lähetetään…" : "Lähetä ilmoitus"}
    </button>
  );
}

function Kentta({
  name,
  label,
  placeholder,
  type = "text",
  required = false,
  hint,
}: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[12.5px] font-semibold">
        {label}
        {required ? null : (
          <span className="ms-1 font-normal" style={{ color: "var(--rf-text-3)" }}>
            valinnainen
          </span>
        )}
      </span>

      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className="mt-1.5 w-full px-3 text-[13.5px]"
        style={{ ...KENTTA, height: 42 }}
      />

      {hint ? (
        <span
          className="mt-1 block text-[12px]"
          style={{ color: "var(--rf-text-3)" }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function IlmoitusForm() {
  const [state, action] = useActionState(submitReferral, initial);

  return (
    <div>
      {state.done ? (
        <p
          className="mb-4 px-4 py-3 text-[13.5px] leading-relaxed"
          style={{
            background: "var(--rf-green-bg)",
            color: "var(--rf-green-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <strong>{state.done}</strong> on ilmoitettu. Se näkyy nyt Katen
          yhteydenotoissa nimelläsi, ja alta näet milloin se on otettu työn
          alle.
        </p>
      ) : null}

      {state.error ? (
        <p
          role="alert"
          className="mb-4 px-4 py-3 text-[13.5px] leading-relaxed"
          style={{
            background: "var(--rf-red-bg)",
            color: "var(--rf-red-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {state.error}
        </p>
      ) : null}

      {/* Avain vaihtuu jokaisen onnistuneen rivin jälkeen: kentät tyhjenevät. */}
      <form key={state.id ?? "uusi"} action={action} className="space-y-3.5">
        <Kentta
          name="restaurant"
          label="Yritys"
          placeholder="Ravintola Esimerkki"
          required
        />

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Kentta
            name="name"
            label="Yhteyshenkilö"
            placeholder="Matti Meikäläinen"
            required
          />
          <Kentta
            name="email"
            label="Sähköposti"
            type="email"
            placeholder="matti@esimerkki.fi"
            required
          />
        </div>

        <Kentta
          name="phone"
          label="Puhelin"
          type="tel"
          placeholder="040 123 4567"
        />

        <label className="block">
          <span className="block text-[12.5px] font-semibold">
            Muistiinpano
            <span
              className="ms-1 font-normal"
              style={{ color: "var(--rf-text-3)" }}
            >
              valinnainen
            </span>
          </span>
          <textarea
            name="message"
            rows={4}
            placeholder="Mitä sovittiin, mikä kiinnosti, milloin kannattaa soittaa."
            className="mt-1.5 w-full px-3 py-2.5 text-[13.5px] leading-relaxed"
            style={KENTTA}
          />
          <span
            className="mt-1 block text-[12px]"
            style={{ color: "var(--rf-text-3)" }}
          >
            Tämä näkyy Katen yhteydenotoissa sellaisenaan.
          </span>
        </label>

        <Laheta />
      </form>
    </div>
  );
}

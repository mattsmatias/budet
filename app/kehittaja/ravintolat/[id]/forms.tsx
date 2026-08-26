"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteRestaurant,
  inviteUser,
  setFlagFor,
  setMemberActive,
  setMemberRole,
  setPlan,
  setStatus,
  updateRestaurant,
  type DevState,
} from "../../actions";
import { PLAN_LABELS, STATUS_LABELS, type RestaurantDetail } from "@/lib/kehittaja/types";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, CardHeader, Pill } from "@/components/restoflow/ui";
import { CONTROL, CONTROL_STYLE } from "@/app/admin/asetukset/form-parts";

const initial: DevState = {};

const ROOLIT: Record<string, string> = {
  owner: "Omistaja",
  manager: "Esihenkilö",
  employee: "Työntekijä",
  accountant: "Kirjanpitäjä",
};

function Tallenna({ label = "Tallenna", tone = "accent" }: { label?: string; tone?: "accent" | "danger" | "quiet" }) {
  const { pending } = useFormStatus();

  const style =
    tone === "danger"
      ? { background: "var(--rf-red-text)", color: "#fff", border: "1px solid transparent" }
      : tone === "quiet"
        ? { background: "var(--rf-inset)", color: "var(--rf-text)", border: "1px solid var(--rf-line-strong)" }
        : { background: "var(--rf-accent)", color: "var(--rf-on-accent)", border: "1px solid transparent" };

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press px-4 py-2 text-[13px] font-bold"
      style={{ ...style, borderRadius: "var(--rf-r-control)", opacity: pending ? 0.6 : 1 }}
    >
      {pending ? "Tallennetaan…" : label}
    </button>
  );
}

function Viesti({ state }: { state: DevState }) {
  if (state.error) {
    return (
      <p role="alert" className="mt-2 text-[12.5px]" style={{ color: "var(--rf-red-text)" }}>
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

// ---------------------------------------------------------------------------
// Tila ja paketti
// ---------------------------------------------------------------------------

/**
 * Asiakkuuden tila.
 *
 * Muutos on lomake eikä pikavalinta: keskeytys katkaisee asiakkaan
 * käytön, ja sen pitää vaatia tietoinen painallus. Syykenttä on
 * mukana, koska "miksi tämä on keskeytetty" on ensimmäinen kysymys
 * kolmen kuukauden päästä.
 */
export function StatusForm({ id, current, trialEndsOn, note }: {
  id: string;
  current: string;
  trialEndsOn: string | null;
  note: string | null;
}) {
  const [state, action] = useActionState(setStatus, initial);
  const [valittu, setValittu] = useState(current);

  return (
    <Card>
      <CardHeader title="Asiakkuuden tila" subtitle="Muutos kirjataan Developer Consolen lokiin." />

      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="id" value={id} />

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="block text-[12.5px] font-semibold">Tila</span>
            <select
              name="status"
              value={valittu}
              onChange={(e) => setValittu(e.target.value)}
              className={`${CONTROL} mt-1.5`}
              style={CONTROL_STYLE}
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {valittu === "trial" ? (
            <label className="block">
              <span className="block text-[12.5px] font-semibold">Kokeilun pituus (päivää)</span>
              <input
                name="trialDays"
                type="number"
                defaultValue={14}
                className={`${CONTROL} mt-1.5`}
                style={CONTROL_STYLE}
              />
            </label>
          ) : (
            <div />
          )}
        </div>

        <label className="block">
          <span className="block text-[12.5px] font-semibold">
            Syy
            <span className="ml-1 font-normal" style={{ color: "var(--rf-text-3)" }}>
              valinnainen
            </span>
          </span>
          <input
            name="note"
            defaultValue={note ?? ""}
            placeholder="Esim. laskut maksamatta"
            className={`${CONTROL} mt-1.5`}
            style={CONTROL_STYLE}
          />
        </label>

        {valittu !== current && (valittu === "suspended" || valittu === "cancelled") ? (
          <p
            className="px-3.5 py-2.5 text-[12.5px] leading-relaxed"
            style={{
              background: "var(--rf-amber-bg)",
              color: "var(--rf-amber-text)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            {valittu === "suspended"
              ? "Keskeytys katkaisee ravintolan käytön. Dataa ei poisteta."
              : "Päättynyt asiakkuus säilyttää datan, mutta merkitsee asiakkuuden loppuneeksi."}
          </p>
        ) : null}

        {trialEndsOn && current === "trial" ? (
          <p className="text-[12.5px]" style={{ color: "var(--rf-text-2)" }}>
            Nykyinen kokeilu päättyy {trialEndsOn}.
          </p>
        ) : null}

        <Tallenna label="Päivitä tila" />
        <Viesti state={state} />
      </form>
    </Card>
  );
}

export function PlanForm({ id, current }: { id: string; current: string }) {
  const [state, action] = useActionState(setPlan, initial);

  return (
    <Card>
      <CardHeader title="Paketti" subtitle="Laskutus hoidetaan maksupalvelussa — tässä on vain paketin taso." />

      <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={id} />

        <label className="block min-w-[10rem] flex-1">
          <span className="block text-[12.5px] font-semibold">Paketti</span>
          <select name="plan" defaultValue={current} className={`${CONTROL} mt-1.5`} style={CONTROL_STYLE}>
            {Object.entries(PLAN_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <Tallenna label="Vaihda" tone="quiet" />
      </form>

      <Viesti state={state} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tiedot
// ---------------------------------------------------------------------------

export function DetailsForm({ r }: { r: RestaurantDetail["restaurant"] }) {
  const [state, action] = useActionState(updateRestaurant, initial);

  return (
    <Card>
      <CardHeader title="Yrityksen tiedot" subtitle="Muutokset kirjataan lokiin ennen ja jälkeen -arvoineen." />

      <form action={action} className="mt-3 space-y-3.5">
        <input type="hidden" name="id" value={r.id} />

        <Kentta label="Ravintolan nimi" name="name" defaultValue={r.name} required />

        <div className="grid gap-3 sm:grid-cols-2">
          <Kentta label="Virallinen nimi" name="legalName" defaultValue={r.legalName} />
          <Kentta label="Y-tunnus" name="businessId" defaultValue={r.businessId} placeholder="1234567-8" />
        </div>

        <Kentta label="Osoite" name="address" defaultValue={r.address} />

        <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
          <Kentta label="Postinumero" name="postalCode" defaultValue={r.postalCode} />
          <Kentta label="Kaupunki" name="city" defaultValue={r.city} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Kentta label="Puhelin" name="phone" defaultValue={r.phone} />
          <Kentta label="Sähköposti" name="email" defaultValue={r.email} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Kentta label="Verkkosivu" name="website" defaultValue={r.website} />
          <Kentta label="Toimiala" name="industry" defaultValue={r.industry} />
        </div>

        <Kentta label="Aikavyöhyke" name="timezone" defaultValue={r.timezone} />

        <label className="flex items-start gap-2.5 text-[13px]">
          <input type="checkbox" name="isTest" defaultChecked={r.isTestAccount} className="mt-0.5 h-4 w-4" />
          <span>
            Testiravintola
            <span className="mt-0.5 block text-[12px]" style={{ color: "var(--rf-text-3)" }}>
              Jätetään pois asiakasluvuista.
            </span>
          </span>
        </label>

        <Tallenna />
        <Viesti state={state} />
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Käyttäjät
// ---------------------------------------------------------------------------

export function UserRow({ user }: { user: RestaurantDetail["users"][number] & { membershipId?: string } }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold">
          {user.name ?? "Nimetön"}
          {user.active ? null : (
            <span className="ml-2 align-middle">
              <Pill tone="warn">Ei käytössä</Pill>
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-[12.5px]" style={{ color: "var(--rf-text-2)" }}>
          {user.email ?? "—"} · {ROOLIT[user.role] ?? user.role}
          {user.lastSignInAt
            ? ` · kirjautui ${new Date(user.lastSignInAt).toLocaleDateString("fi-FI")}`
            : " · ei kirjautunut"}
        </span>
      </span>
    </div>
  );
}

/**
 * Käyttäjän hallinta.
 *
 * VAHVISTUS VAIN SILLE MIKÄ KATKAISEE PÄÄSYN.
 *
 * Roolin vaihto on korjattavissa yhdellä klikkauksella takaisin.
 * Käytöstä poisto lukitsee ihmisen ulos kesken työvuoron, joten se
 * kysyy varmistuksen.
 */
export function UserControls({
  membershipId,
  name,
  role,
  active,
  restaurantName,
}: {
  membershipId: string;
  name: string;
  role: string;
  active: boolean;
  restaurantName: string;
}) {
  const [roleState, roleAction] = useActionState(setMemberRole, initial);
  const [activeState, activeAction] = useActionState(setMemberActive, initial);
  const [varmistus, setVarmistus] = useState(false);

  return (
    <div className="space-y-2 px-5 pb-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <form action={roleAction} className="flex items-center gap-2">
          <input type="hidden" name="membership" value={membershipId} />
          <select
            name="role"
            defaultValue={role}
            className="px-2.5 text-[12.5px]"
            style={{ ...CONTROL_STYLE, height: 32, borderRadius: 8 }}
          >
            {Object.entries(ROOLIT).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rf-press px-2.5 py-1.5 text-[12px] font-semibold"
            style={{
              background: "var(--rf-inset)",
              border: "1px solid var(--rf-line-strong)",
              borderRadius: 8,
            }}
          >
            Vaihda rooli
          </button>
        </form>

        {active ? (
          <button
            type="button"
            onClick={() => setVarmistus(true)}
            className="rf-press px-2.5 py-1.5 text-[12px] font-semibold"
            style={{ color: "var(--rf-red-text)", border: "1px solid var(--rf-line-strong)", borderRadius: 8 }}
          >
            Poista käytöstä
          </button>
        ) : (
          <form action={activeAction}>
            <input type="hidden" name="membership" value={membershipId} />
            <input type="hidden" name="active" value="true" />
            <button
              type="submit"
              className="rf-press px-2.5 py-1.5 text-[12px] font-semibold"
              style={{ background: "var(--rf-inset)", border: "1px solid var(--rf-line-strong)", borderRadius: 8 }}
            >
              Aktivoi
            </button>
          </form>
        )}
      </div>

      {varmistus ? (
        <div
          className="space-y-2 px-3.5 py-3"
          style={{ background: "var(--rf-red-bg)", borderRadius: "var(--rf-r-control)" }}
        >
          <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--rf-red-text)" }}>
            Olet poistamassa käyttäjän käytöstä.
            <br />
            <strong>{name}</strong> · {restaurantName}
            <br />
            Hän ei pääse kirjautumaan tähän ravintolaan. Tietoja ei poisteta.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setVarmistus(false)}
              className="rf-press px-3 py-1.5 text-[12.5px] font-semibold"
              style={{ background: "var(--rf-card)", borderRadius: 8 }}
            >
              Peruuta
            </button>

            <form action={activeAction}>
              <input type="hidden" name="membership" value={membershipId} />
              <input type="hidden" name="active" value="false" />
              <button
                type="submit"
                className="rf-press px-3 py-1.5 text-[12.5px] font-bold"
                style={{ background: "var(--rf-red-text)", color: "#fff", borderRadius: 8 }}
              >
                Poista käytöstä
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <Viesti state={roleState.error || roleState.notice ? roleState : activeState} />
    </div>
  );
}

export function InviteForm({ id }: { id: string }) {
  const [state, action] = useActionState(inviteUser, initial);

  return (
    <div className="px-5 pb-5 pt-1">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={id} />

        <label className="block">
          <span className="block text-[12.5px] font-semibold">Uusi kutsu</span>
          <select
            name="role"
            defaultValue="employee"
            className="mt-1.5 px-2.5 text-[13px]"
            style={{ ...CONTROL_STYLE, height: 36 }}
          >
            {Object.entries(ROOLIT).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-[10rem] flex-1">
          <span className="block text-[12.5px] font-semibold">
            Nimi
            <span className="ml-1 font-normal" style={{ color: "var(--rf-text-3)" }}>
              valinnainen
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
          Luo kutsu
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
          <p className="mt-1.5 text-[12px]" style={{ color: "var(--rf-amber-text)" }}>
            Kopioi nyt — koodia ei voi hakea myöhemmin.
          </p>
        </div>
      ) : (
        <Viesti state={state} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feature flagit
// ---------------------------------------------------------------------------

export function FlagRow({
  id,
  flag,
}: {
  id: string;
  flag: RestaurantDetail["flags"][number];
}) {
  const [state, action] = useActionState(setFlagFor, initial);

  const nykyinen = flag.override === null ? "oletus" : flag.override ? "true" : "false";

  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold">{flag.label}</span>
        <span className="block text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {flag.key} · oletus {flag.global ? "päällä" : "pois"}
        </span>
      </span>

      <form action={action} className="flex items-center gap-2">
        <input type="hidden" name="key" value={flag.key} />
        <input type="hidden" name="restaurant" value={id} />

        <select
          name="value"
          defaultValue={nykyinen}
          className="px-2.5 text-[12.5px]"
          style={{ ...CONTROL_STYLE, height: 32, borderRadius: 8 }}
        >
          <option value="oletus">Oletus ({flag.global ? "päällä" : "pois"})</option>
          <option value="true">Päällä</option>
          <option value="false">Pois</option>
        </select>

        <button
          type="submit"
          className="rf-press px-2.5 py-1.5 text-[12px] font-semibold"
          style={{ background: "var(--rf-inset)", border: "1px solid var(--rf-line-strong)", borderRadius: 8 }}
        >
          Aseta
        </button>
      </form>

      {state.error ? (
        <span className="w-full text-[12px]" style={{ color: "var(--rf-red-text)" }}>
          {state.error}
        </span>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Vaarallinen alue
// ---------------------------------------------------------------------------

/**
 * Pysyvä poisto.
 *
 * KOLME ESTETTÄ, EI YHTÄ.
 *
 * Osio on kiinni kunnes sen avaa. Avattuna se kertoo mitä katoaa.
 * Painike aktivoituu vasta kun ravintolan nimi on kirjoitettu
 * täsmälleen oikein — ja kanta tarkistaa saman uudelleen, joten
 * selaimen ohittaminen ei auta.
 *
 * Keskeytys ja arkistointi ovat tämän yläpuolella nimenomaan siksi
 * että ne ovat lähes aina oikea vastaus.
 */
export function DangerZone({
  id,
  name,
  counts,
}: {
  id: string;
  name: string;
  counts: { users: number; receipts: number; shifts: number; tasks: number };
}) {
  const [state, action] = useActionState(deleteRestaurant, initial);
  const [auki, setAuki] = useState(false);
  const [teksti, setTeksti] = useState("");

  const tasmaa = teksti.trim() === name;

  if (!auki) {
    return (
      <Card>
        <CardHeader
          title="Pysyvä poisto"
          subtitle="Lähes aina oikea vastaus on keskeytys tai arkistointi — ne säilyttävät tiedot."
        />
        <button
          type="button"
          onClick={() => setAuki(true)}
          className="rf-press mt-3 px-3.5 py-2 text-[13px] font-semibold"
          style={{
            color: "var(--rf-red-text)",
            border: "1px solid var(--rf-line-strong)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          Näytä poistotoiminto
        </button>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="mt-px shrink-0" style={{ color: "var(--rf-red-text)" }}>
          <RfIcon name="alert" size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold" style={{ color: "var(--rf-red-text)" }}>
            Poista ravintola pysyvästi
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
            Tämä poistaa ravintolan ja kaiken siihen liittyvän. Toimintoa ei voi
            perua.
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-1 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        <li className="flex justify-between gap-4">
          <span>Käyttäjien jäsenyydet</span>
          <span className="rf-tabular font-semibold">{counts.users}</span>
        </li>
        <li className="flex justify-between gap-4">
          <span>Kuitit</span>
          <span className="rf-tabular font-semibold">{counts.receipts}</span>
        </li>
        <li className="flex justify-between gap-4">
          <span>Työvuorot</span>
          <span className="rf-tabular font-semibold">{counts.shifts}</span>
        </li>
        <li className="flex justify-between gap-4">
          <span>Tehtävät</span>
          <span className="rf-tabular font-semibold">{counts.tasks}</span>
        </li>
      </ul>

      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="id" value={id} />

        <label className="block">
          <span className="block text-[12.5px] font-semibold">
            Kirjoita <strong>{name}</strong> vahvistaaksesi
          </span>
          <input
            name="confirm"
            value={teksti}
            onChange={(e) => setTeksti(e.target.value)}
            autoComplete="off"
            className={`${CONTROL} mt-1.5`}
            style={CONTROL_STYLE}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={!tasmaa}
            className="rf-press px-4 py-2 text-[13px] font-bold"
            style={{
              background: tasmaa ? "var(--rf-red-text)" : "var(--rf-inset)",
              color: tasmaa ? "#fff" : "var(--rf-text-3)",
              borderRadius: "var(--rf-r-control)",
              cursor: tasmaa ? "pointer" : "not-allowed",
            }}
          >
            Poista pysyvästi
          </button>

          <button
            type="button"
            onClick={() => {
              setAuki(false);
              setTeksti("");
            }}
            className="rf-press px-3.5 py-2 text-[13px] font-medium"
            style={{ color: "var(--rf-text-2)" }}
          >
            Peruuta
          </button>
        </div>

        <Viesti state={state} />
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function Kentta({
  label,
  name,
  defaultValue,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[12.5px] font-semibold">{label}</span>
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        className={`${CONTROL} mt-1.5`}
        style={CONTROL_STYLE}
      />
    </label>
  );
}

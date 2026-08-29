"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createRestaurant, type DevState } from "../../actions";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, CardHeader } from "@/components/restoflow/ui";
import { CONTROL, CONTROL_STYLE } from "@/app/admin/asetukset/form-parts";

const initial: DevState = {};

/**
 * Uuden ravintolan velho.
 *
 * KAKSI VAIHETTA, YKSI LOMAKE.
 *
 * Vaiheet ovat näkymiä samaan lomakkeeseen eivätkä erillisiä
 * lähetyksiä. Erillisinä ensimmäisen vaiheen ravintola olisi jo
 * kannassa kun toinen vaihe keskeytyy, ja jäljelle jäisi omistajaton
 * kuori. Yhdellä lähetyksellä joko molemmat syntyvät tai ei kumpikaan.
 *
 * Vain nimi on pakollinen. Y-tunnus ja osoite tiedetään usein vasta
 * myöhemmin, ja pakollinen kenttä jota ei tiedä täytetään roskalla.
 */
export function Wizard() {
  const [state, action] = useActionState(createRestaurant, initial);
  const [vaihe, setVaihe] = useState<1 | 2>(1);
  const [status, setStatus] = useState("active");

  // Luotu: näytetään kuittaus eikä lomaketta.
  if (state.restaurantId) {
    return <Valmis state={state} />;
  }

  return (
    <form action={action} className="space-y-4">
      <Askelmerkit vaihe={vaihe} />

      {/*
        Piilotettu vaihe pysyy DOM:issa.

        Jos vaihe 1 poistettaisiin renderistä, sen kenttien arvot
        katoaisivat lomakkeesta eikä lähetys sisältäisi ravintolan
        tietoja lainkaan.
      */}
      <div hidden={vaihe !== 1}>
        <Card>
          <CardHeader
            title="Ravintolan tiedot"
            subtitle="Vain nimi on pakollinen — loput voi täydentää myöhemmin."
          />

          <div className="mt-4 space-y-3.5">
            <Kentta label="Ravintolan nimi" name="name" required placeholder="Ravintola ABC" />

            <div className="grid gap-3 sm:grid-cols-2">
              <Kentta label="Virallinen yrityksen nimi" name="legalName" placeholder="Ravintola ABC Oy" />
              <Kentta label="Y-tunnus" name="businessId" placeholder="1234567-8" />
            </div>

            <Kentta label="Osoite" name="address" placeholder="Mannerheimintie 1" />

            <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
              <Kentta label="Postinumero" name="postalCode" placeholder="00100" />
              <Kentta label="Kaupunki" name="city" placeholder="Helsinki" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Kentta label="Puhelinnumero" name="phone" type="tel" placeholder="+358 40 123 4567" />
              <Kentta label="Sähköposti" name="email" type="email" placeholder="info@ravintola.fi" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Kentta label="Verkkosivu" name="website" placeholder="https://ravintola.fi" />
              <Kentta label="Toimiala" name="industry" placeholder="Ravintola" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Valinta
                label="Aikavyöhyke"
                name="timezone"
                defaultValue="Europe/Helsinki"
                options={{
                  "Europe/Helsinki": "Europe/Helsinki",
                  "Europe/Stockholm": "Europe/Stockholm",
                  "Europe/Oslo": "Europe/Oslo",
                }}
              />
              <Valinta
                label="Paketti"
                name="plan"
                defaultValue="free"
                options={{ free: "Free", pro: "Pro", business: "Business", enterprise: "Enterprise" }}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="block text-[12.5px] font-semibold">Tila</span>
                <select
                  name="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={`${CONTROL} mt-1.5`}
                  style={CONTROL_STYLE}
                >
                  <option value="active">Aktiivinen</option>
                  <option value="trial">Kokeilu</option>
                </select>
              </label>

              {status === "trial" ? (
                <Kentta
                  label="Kokeilun pituus (päivää)"
                  name="trialDays"
                  type="number"
                  defaultValue="14"
                />
              ) : (
                <div />
              )}
            </div>

            {/*
              Testiravintola on rajaus, ei asetus.

              Merkitty ravintola jätetään pois yleiskatsauksen
              asiakasluvuista, jotta omat kokeilut eivät näytä
              kasvulta.
            */}
            <label className="flex items-start gap-2.5 text-[13px]">
              <input type="checkbox" name="isTest" className="mt-0.5 h-4 w-4" />
              <span>
                Testiravintola
                <span className="mt-0.5 block text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                  Jätetään pois asiakasluvuista.
                </span>
              </span>
            </label>
          </div>
        </Card>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setVaihe(2)}
            className="rf-press px-4 py-2 text-[13px] font-bold"
            style={{
              background: "var(--rf-accent)",
              color: "var(--rf-on-accent)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            Jatka omistajaan →
          </button>

          <Link
            href="/kehittaja/ravintolat"
            className="rf-press px-3.5 py-2 text-[13px] font-medium"
            style={{ color: "var(--rf-text-2)" }}
          >
            Peruuta
          </Link>
        </div>
      </div>

      <div hidden={vaihe !== 2}>
        <Card>
          <CardHeader
            title="Omistajan tiedot"
            subtitle="Omistaja liittyy kutsukoodilla ja asettaa salasanansa itse."
          />

          <div className="mt-4 space-y-3.5">
            <Kentta
              label="Omistajan nimi"
              name="ownerName"
              placeholder="Matti Meikäläinen"
            />

            {/*
              MIKSI TÄSSÄ EI OLE SALASANAKENTTÄÄ.

              Kate ei tallenna salasanoja itse eikä ylläpitäjä aseta
              niitä kenenkään puolesta. Omistaja rekisteröityy itse ja
              lunastaa kutsukoodin, jolloin salasana syntyy vain hänen
              ja tunnistuspalvelun välillä.

              Koodista tallennetaan kantaan pelkkä tiiviste, joten sitä
              ei voi lukea jälkikäteen — myöskään minä en voi.
            */}
            <div
              className="flex items-start gap-3 px-4 py-3.5"
              style={{
                background: "var(--rf-blue-bg)",
                color: "var(--rf-blue-text)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              <span className="mt-px shrink-0">
                <RfIcon name="info" size={16} />
              </span>
              <p className="text-[12.5px] leading-relaxed">
                Salasanaa ei aseteta täällä. Ravintola saa kutsukoodin, jonka
                omistaja lunastaa rekisteröityessään — salasana jää vain hänen
                tietoonsa. Koodi näytetään kerran, koska kannassa on siitä vain
                tiiviste.
              </p>
            </div>
          </div>
        </Card>

        {state.error ? (
          <p
            role="alert"
            className="mt-3 text-[12.5px]"
            style={{ color: "var(--rf-red-text)" }}
          >
            {state.error}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Luo />

          <button
            type="button"
            onClick={() => setVaihe(1)}
            className="rf-press px-3.5 py-2 text-[13px] font-medium"
            style={{ color: "var(--rf-text-2)" }}
          >
            ← Takaisin
          </button>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

function Askelmerkit({ vaihe }: { vaihe: 1 | 2 }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-[12.5px]">
      {[
        { n: 1, label: "Ravintolan tiedot" },
        { n: 2, label: "Omistaja" },
      ].map((s) => {
        const active = vaihe === s.n;
        return (
          <li key={s.n} className="flex items-center gap-2">
            <span
              className="flex h-6 w-6 items-center justify-center text-[11.5px] font-bold"
              style={{
                background: active ? "var(--rf-accent)" : "var(--rf-inset)",
                color: active ? "var(--rf-on-accent)" : "var(--rf-text-3)",
                borderRadius: 999,
              }}
            >
              {s.n}
            </span>
            <span style={{ color: active ? "var(--rf-text)" : "var(--rf-text-3)", fontWeight: active ? 700 : 500 }}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Valmis({ state }: { state: DevState }) {
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center"
            style={{
              background: "var(--rf-green-bg)",
              color: "var(--rf-green-text)",
              borderRadius: 999,
            }}
          >
            <RfIcon name="check" size={18} />
          </span>

          <div className="min-w-0">
            <h2 className="text-[16px] font-bold tracking-[-0.01em]">Ravintola luotu</h2>
            <p className="mt-1 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
              {state.notice}
            </p>
          </div>
        </div>

        {state.code ? (
          <div className="mt-4">
            <p className="text-[12.5px] font-semibold">Omistajan kutsukoodi</p>

            <p
              className="rf-tabular mt-2 px-4 py-3 text-[22px] font-bold tracking-[0.14em]"
              style={{
                background: "var(--rf-inset)",
                borderRadius: "var(--rf-r-control)",
                border: "1px solid var(--rf-line-strong)",
              }}
            >
              {state.code}
            </p>

            {/*
              Varoitus on tässä eikä ohjetekstissä.

              Koodi on kannassa vain tiivisteenä. Jos tämän sivun
              sulkee lukematta koodia, sitä ei saa takaisin — silloin
              on luotava uusi kutsu.
            */}
            <p className="mt-2 text-[12px]" style={{ color: "var(--rf-amber-text)" }}>
              Kopioi koodi nyt. Sitä ei voi hakea myöhemmin, koska kannassa on
              vain tiiviste. Kadonneen tilalle luodaan uusi kutsu.
            </p>

            <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
              Omistaja rekisteröityy osoitteessa <strong>/rekisteroidy</strong> ja
              lunastaa koodin kohdassa <strong>/liity</strong>. Salasana jää vain
              hänen tietoonsa.
            </p>
          </div>
        ) : null}
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/kehittaja/ravintolat/${state.restaurantId}`}
          className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
          style={{
            background: "var(--rf-accent)",
            color: "var(--rf-on-accent)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          Avaa ravintola
        </Link>

        <Link
          href="/kehittaja/ravintolat/uusi"
          className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
          style={{
            background: "var(--rf-inset)",
            border: "1px solid var(--rf-line-strong)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          Luo toinen ravintola
        </Link>

        <Link
          href="/kehittaja/ravintolat"
          className="rf-press px-3.5 py-2 text-[13px] font-medium"
          style={{ color: "var(--rf-text-2)" }}
        >
          Kaikki ravintolat
        </Link>
      </div>
    </div>
  );
}

function Luo() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press px-4 py-2 text-[13px] font-bold"
      style={{
        background: "var(--rf-accent)",
        color: "var(--rf-on-accent)",
        borderRadius: "var(--rf-r-control)",
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? "Luodaan…" : "Luo ravintola ja kutsu"}
    </button>
  );
}

function Kentta({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[12.5px] font-semibold">
        {label}
        {required ? null : (
          <span className="ml-1 font-normal" style={{ color: "var(--rf-text-3)" }}>
            valinnainen
          </span>
        )}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={`${CONTROL} mt-1.5`}
        style={CONTROL_STYLE}
      />
    </label>
  );
}

function Valinta({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: Record<string, string>;
}) {
  return (
    <label className="block">
      <span className="block text-[12.5px] font-semibold">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className={`${CONTROL} mt-1.5`}
        style={CONTROL_STYLE}
      >
        {Object.entries(options).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

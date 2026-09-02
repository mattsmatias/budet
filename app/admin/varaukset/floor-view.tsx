"use client";

/**
 * Salinäkymä: kartta ja pöydän tiedot.
 *
 * Kartta oli palvelinkomponentti, koska se vain piirsi. Pöydän
 * napsauttaminen tekee siitä työkalun: valinta on selaimen tilaa, ja
 * sen kanssa tulevat myös ne kolme tekoa jotka pöydälle vuoron aikana
 * tehdään.
 *
 * ---------------------------------------------------------------------
 * SAMA KARTTA KUIN ASETUKSISSA
 * ---------------------------------------------------------------------
 *
 * Piirto on siirretty tänne sellaisenaan. Värit kertovat varaustilan,
 * ja ne ovat tässä tiedostossa eivätkä TableMarkissa: sama merkki
 * piirtää myös asetusten muokkaimessa, jossa varaustilaa ei ole
 * olemassa.
 */

import { useState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import type {
  Reservation,
  TableState,
  tableStates,
} from "@/lib/restoflow/reservations";
import { TableMark, ROOM_BACKGROUND } from "@/components/restoflow/table-mark";
import { ElementMark } from "@/components/restoflow/element-mark";
import {
  chairSpots,
  placementsFor,
  tableWidth,
  type FloorElement,
  type PlanTable,
} from "@/lib/restoflow/floor-plan";
import { TablePanel } from "./table-panel";

type States = ReturnType<typeof tableStates>;

export function FloorView({
  states,
  elements,
  areas,
  t,
}: {
  states: States;
  elements: FloorElement[];
  areas: { id: string; name: string }[];
  t: AdminText;
}) {
  /*
   * Valinta on pöydän tunniste, ei koko rivi.
   *
   * Rivi vanhentuisi heti kun palvelin lähettää tuoreen tilanteen:
   * seurue merkitään saapuneeksi, sivu päivittyy, ja paneeli näyttäisi
   * yhä sitä mitä siinä luki ennen painallusta.
   */
  const [valittu, setValittu] = useState<string | null>(null);

  const avattu = states.find((row) => row.table.id === valittu) ?? null;

  return (
    <div>
      <TableMap
        states={states}
        elements={elements}
        areas={areas}
        t={t}
        selected={valittu}
        onSelect={(id) =>
          setValittu((edellinen) => (edellinen === id ? null : id))
        }
      />

      {avattu ? (
        <TablePanel
          t={t}
          table={avattu.table}
          state={avattu.state}
          stateLabel={stateLabel(avattu.state, t)}
          reservation={avattu.reservation as Reservation | null}
          onClose={() => setValittu(null)}
        />
      ) : null}
    </div>
  );
}

function TableMap({
  states,
  elements,
  areas,
  t,
  selected,
  onSelect,
}: {
  states: States;
  elements: FloorElement[];
  areas: { id: string; name: string }[];
  t: AdminText;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const groups = [
    ...areas.map((area) => ({
      id: area.id,
      name: area.name,
      items: states.filter((s) => s.table.areaId === area.id),
      elements: elements.filter((e) => e.areaId === area.id),
    })),
    {
      id: "none",
      name: areas.length > 0 ? t.varaus.noArea : "",
      items: states.filter((s) => s.table.areaId === null),
      elements: elements.filter((e) => e.areaId === null),
    },
  ].filter((group) => group.items.length > 0 || group.elements.length > 0);

  /*
   * Onko karttaa järjestetty.
   *
   * Ilman järjestelyä pöydät piirretään ruudukkoon. Se toimii, muttei
   * ole sali — ja jos siitä ei kerrota, ravintoloitsija luulee Katen
   * arvanneen salin muodon väärin.
   */
  const arranged = states.some(
    (s) => s.table.posX !== null && s.table.posY !== null,
  );

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const sijainnit = new Map(
          placementsFor(group.items.map((s) => s.table) as PlanTable[]).map(
            (p) => [p.id, p],
          ),
        );

        return (
          <div key={group.id}>
            {group.name ? (
              <p
                className="mb-2 text-[12px] font-semibold uppercase tracking-[0.04em]"
                style={{ color: "var(--rf-text-3)" }}
              >
                {group.name}
              </p>
            ) : null}

            {/*
              Sali eikä lista.

              Sama kartta kuin asetuksissa järjestetty, samat mitat ja
              sama piirtotapa. Vuoron aikana katsotaan mikä pöytä on
              vapaa, ja siihen vastaa sijainti — ei aakkosjärjestys.
            */}
            <div
              className="relative w-full"
              style={{
                aspectRatio: "1.5",
                background: ROOM_BACKGROUND,
                backgroundColor: "var(--rf-inset)",
                border: "1px solid var(--rf-line)",
                borderRadius: "var(--rf-r-card)",
                overflow: "hidden",
              }}
            >
              {/*
                Kalusteet pöytien alla.

                Baaritiski ja keittiön ovi ovat ne kiintopisteet
                joiden avulla ihminen lukee tilaa. Ne ovat harmaita ja
                taustalla: kartalta luetaan pöytiä, ja värikäs
                baaritiski veisi huomion siltä.
              */}
              {group.elements.map((element) => (
                <span
                  key={element.id}
                  aria-hidden="true"
                  className="absolute"
                  style={{
                    left: `${element.posX}%`,
                    top: `${element.posY}%`,
                    width: `${element.width}%`,
                    height: `${element.height}%`,
                    transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
                  }}
                >
                  <ElementMark
                    kind={element.kind}
                    label={element.label}
                    rotation={element.rotation}
                  />
                </span>
              ))}

              {group.items.map(({ table, state, reservation }) => {
                const paikka = sijainnit.get(table.id);
                if (!paikka) return null;

                const colors = STATE_COLORS[state];

                return (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => onSelect(table.id)}
                    aria-pressed={selected === table.id}
                    className="absolute flex items-center justify-center"
                    style={{
                      left: `${paikka.x}%`,
                      top: `${paikka.y}%`,
                      width: `${table.width ?? tableWidth(table.seatsMax)}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                    /*
                     * Vieraan nimi ja kello osoittimen alle.
                     *
                     * Kartalle ne eivät mahdu, ja listassa ne ovat jo.
                     * Kartta vastaa kysymykseen "mikä pöytä", lista
                     * kysymykseen "kuka ja milloin".
                     */
                    title={
                      reservation
                        ? `${table.name} · ${reservation.time} ${reservation.guestName} · ${stateLabel(state, t)}`
                        : `${table.name} · ${stateLabel(state, t)}`
                    }
                  >
                    {/*
                      Tuolit kertovat paikkaluvun ilman lukua.

                      Sama piirros kuin muokkaimessa: kartan on
                      näytettävä samalta siellä missä se järjestettiin.
                    */}
                    {chairSpots(table.seatsMax, table.shape).map((spot, i) => (
                      <span
                        key={i}
                        aria-hidden="true"
                        className="absolute"
                        style={{
                          left: `${spot.x}%`,
                          top: `${spot.y}%`,
                          width: "17%",
                          aspectRatio: "1",
                          transform: "translate(-50%, -50%)",
                          background: "var(--rf-line-strong)",
                          borderRadius: "50%",
                          opacity: 0.45,
                        }}
                      />
                    ))}

                    <TableMark
                      selected={selected === table.id}
                      name={table.name}
                      shape={table.shape}
                      rotation={table.rotation}
                      widthPercent={100}
                      colors={{
                        bg: colors.bg,
                        border: colors.border,
                        text: colors.text,
                        dashed: state === "disabled",
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {arranged ? null : (
        <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {t.poytakartta.noPlan}
        </p>
      )}

      {/*
        Selite vain niistä tiloista jotka kartalla ovat.

        Väri ei kerro mitään ilman selitettä, mutta selite tilasta jota
        ei näy on yhtä lailla luettavaa jota ei tarvita. Kuuden rivin
        selite yhden pöydän kartan alla oli enemmän kuin kartta.
      */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
        {LEGEND_ORDER.filter((state) =>
          states.some((s) => s.state === state),
        ).map((state) => (
          <span
            key={state}
            className="inline-flex items-center gap-1.5 text-[11.5px]"
            style={{ color: "var(--rf-text-2)" }}
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ background: STATE_COLORS[state].border }}
            />
            {stateLabel(state, t)}
          </span>
        ))}
      </div>
    </div>
  );
}
/* Selitteen järjestys: vapaasta käytössä olevaan, lopuksi poissa. */
const LEGEND_ORDER = [
  "free",
  "billing",
  "reserved",
  "late",
  "seated",
  "cleaning",
  "disabled",
] as const;

const STATE_COLORS: Record<
  TableState,
  { bg: string; text: string; border: string }
> = {
  free: {
    bg: "var(--rf-green-bg)",
    text: "var(--rf-green-text)",
    border: "var(--rf-green)",
  },
  reserved: {
    bg: "var(--rf-blue-bg)",
    text: "var(--rf-blue-text)",
    border: "var(--rf-blue)",
  },
  late: {
    bg: "var(--rf-amber-bg)",
    text: "var(--rf-amber-text)",
    border: "var(--rf-amber)",
  },
  seated: {
    bg: "var(--rf-accent-bg)",
    text: "var(--rf-text)",
    border: "var(--rf-accent)",
  },
  /*
   * Laskua odottava on oma värinsä.
   *
   * Se ei ole "melkein vapaa" eikä "yhä varattu": se on se pöytä jota
   * katsotaan seuraavaksi. Keltainen erottaa sen molemmista ilman
   * että se huutaa kuin punainen.
   */
  billing: {
    bg: "var(--rf-amber-bg)",
    text: "var(--rf-amber-text)",
    border: "var(--rf-amber)",
  },
  cleaning: {
    bg: "var(--rf-inset)",
    text: "var(--rf-text-2)",
    border: "var(--rf-text-3)",
  },
  disabled: {
    bg: "transparent",
    text: "var(--rf-text-3)",
    border: "var(--rf-line)",
  },
};

function stateLabel(state: TableState, t: AdminText): string {
  const map: Record<TableState, string> = {
    free: t.varaus.stateFree,
    reserved: t.varaus.stateReserved,
    late: t.varaus.stateLate,
    seated: t.varaus.stateSeated,
    billing: t.varaus.stateBilling,
    cleaning: t.varaus.stateCleaning,
    disabled: t.varaus.stateDisabled,
  };
  return map[state];
}

// ---------------------------------------------------------------------------

"use client";

/**
 * Pöytäkartan muokkain.
 *
 * Raahaa pöydät sinne missä ne salissa ovat. Se on koko idea, ja
 * kaikki muu tässä tiedostossa palvelee sitä.
 *
 * ---------------------------------------------------------------------
 * TALLENNUS ON OMA TEKONSA
 * ---------------------------------------------------------------------
 *
 * Jokainen siirto ei tallennu. Kartan järjestely on yksi työ: pöytiä
 * siirretään kunnes sali näyttää oikealta, ja vasta sitten
 * tallennetaan. Automaattinen tallennus tarkoittaisi ettei siirtoa voi
 * perua, ja puolivalmis kartta olisi jo kannassa.
 *
 * Tallentamattomat muutokset sanotaan ääneen. Hiljaa hukkuva työ on
 * pahempi kuin ylimääräinen painallus.
 *
 * ---------------------------------------------------------------------
 * HIIRI, SORMI JA NÄPPÄIMISTÖ
 * ---------------------------------------------------------------------
 *
 * Pointer-tapahtumat kattavat hiiren ja kosketuksen samalla koodilla.
 * Näppäimistö on erikseen, koska raahaus ei ole näppäimistöele:
 * sarkaimella valitaan ja nuolilla siirretään.
 *
 * Ilman näppäimistöä kartta olisi ominaisuus jota osa ei voi käyttää
 * lainkaan — eikä pöytien järjestely ole se kohta jossa siitä
 * tingitään.
 */

import { useMemo, useRef, useState, useTransition } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { Button } from "@/components/restoflow/ui";
import {
  TableMark,
  PLAIN_COLORS,
  ROOM_BACKGROUND,
} from "@/components/restoflow/table-mark";
import {
  autoLayout,
  clampToRoom,
  placementsFor,
  roundPercent,
  tableWidth,
  type PlanTable,
  type TableShape,
} from "@/lib/restoflow/floor-plan";
import type { DiningArea, RestaurantTable } from "@/lib/restoflow/reservations";
import { saveFloorPlan } from "./actions";

/**
 * Kartan kuvasuhde.
 *
 * Sali on useimmiten leveämpi kuin syvä, ja 3:2 on lähempänä sitä kuin
 * neliö. Tarkka muoto ei ole tärkeä: pöydät ovat suhteessa toisiinsa,
 * ja se on se mitä kartalta luetaan.
 */
const ROOM_WIDTH_PER_HEIGHT = 3 / 2;

interface Position {
  x: number;
  y: number;
  shape: TableShape;
  rotation: number;
}

export function FloorPlanEditor({
  t,
  tables,
  areas,
}: {
  t: AdminText;
  tables: RestaurantTable[];
  areas: DiningArea[];
}) {
  const [positions, setPositions] = useState<Map<string, Position>>(() =>
    initialPositions(tables),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  /* Alue kerrallaan: terassi ja kabinetti ovat eri tiloja. */
  const [area, setArea] = useState<string | null>(null);

  const room = useRef<HTMLDivElement>(null);

  /*
   * Palvelimen tuoreet pöydät voittavat vain kun mitään ei ole kesken.
   *
   * Ilman tätä tallennuksen jälkeinen uudelleenlataus jättäisi
   * ruudulle vanhat paikat, ja käyttäjä luulisi tallennuksen
   * epäonnistuneen. Keskeneräisen työn päälle sitä ei kirjoiteta.
   */
  const avain = tables.map((table) => table.id).join("|");
  const [avainEnnen, setAvainEnnen] = useState(avain);

  if (avain !== avainEnnen && !dirty) {
    setAvainEnnen(avain);
    setPositions(initialPositions(tables));
  }

  const nakyvat = useMemo(
    () => tables.filter((table) => area === null || table.areaId === area),
    [tables, area],
  );

  const valittu = nakyvat.find((table) => table.id === selected) ?? null;

  function siirra(id: string, x: number, y: number): void {
    const table = tables.find((row) => row.id === id);
    const nykyinen = positions.get(id);
    if (!table || !nykyinen) return;

    const rajattu = clampToRoom(
      x,
      y,
      tableWidth(table.seatsMax),
      nykyinen.shape,
      ROOM_WIDTH_PER_HEIGHT,
      nykyinen.rotation,
    );

    setPositions((edellinen) => {
      const uusi = new Map(edellinen);
      uusi.set(id, {
        ...nykyinen,
        x: roundPercent(rajattu.x),
        y: roundPercent(rajattu.y),
      });
      return uusi;
    });

    setDirty(true);
    setNotice(null);
  }

  function muuta(id: string, muutos: Partial<Position>): void {
    const nykyinen = positions.get(id);
    if (!nykyinen) return;

    const table = tables.find((row) => row.id === id);
    const yhdistetty = { ...nykyinen, ...muutos };

    /*
     * Muodon vaihto voi työntää pöydän reunan yli.
     *
     * Pyöreästä pitkäksi kasvattaa leveyttä lähes kaksinkertaiseksi,
     * ja reunimmainen pöytä olisi puoliksi ulkona. Rajaus heti
     * muutoksen yhteydessä, ei vasta seuraavassa raahauksessa.
     */
    const rajattu = table
      ? clampToRoom(
          yhdistetty.x,
          yhdistetty.y,
          tableWidth(table.seatsMax),
          yhdistetty.shape,
          ROOM_WIDTH_PER_HEIGHT,
          yhdistetty.rotation,
        )
      : { x: yhdistetty.x, y: yhdistetty.y };

    setPositions((edellinen) => {
      const uusi = new Map(edellinen);
      uusi.set(id, {
        ...yhdistetty,
        x: roundPercent(rajattu.x),
        y: roundPercent(rajattu.y),
      });
      return uusi;
    });

    setDirty(true);
    setNotice(null);
  }

  /** Osoittimen paikka prosentteina kartasta. */
  function percentAt(event: React.PointerEvent | PointerEvent): {
    x: number;
    y: number;
  } | null {
    const box = room.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return null;

    return {
      x: ((event.clientX - box.left) / box.width) * 100,
      y: ((event.clientY - box.top) / box.height) * 100,
    };
  }

  /*
   * Raahaus kulkee osoittimen kaappauksella.
   *
   * setPointerCapture ohjaa kaikki saman osoittimen tapahtumat siihen
   * pöytään josta raahaus alkoi — myös silloin kun osoitin karkaa
   * kartan ulkopuolelle, ja reunaan asti raahaaminen on juuri se mitä
   * seinän vieressä olevalle pöydälle tehdään.
   *
   * Ensimmäinen toteutus kuunteli ikkunaa. Se toimi, mutta kuuntelija
   * jouduttiin tilaamaan uudelleen joka siirrolla, ja sulkeumassa
   * kulkeva sijainti ehti vanhentua kesken raahauksen. Kaappaus tekee
   * saman asian selaimen omalla mekanismilla ja ilman kuuntelijoita.
   *
   * Siirron alkukohta pysyy viitteessä eikä tilassa: se ei vaikuta
   * piirtoon, ja tilana se aiheuttaisi uuden renderöinnin jokaisesta
   * osoittimen liikkeestä.
   */
  const siirtoRef = useRef<{ id: string; dx: number; dy: number } | null>(null);

  function tallenna(): void {
    setError(null);

    const erä = tables
      .map((table) => {
        const paikka = positions.get(table.id);
        if (!paikka) return null;

        return {
          id: table.id,
          x: paikka.x,
          y: paikka.y,
          shape: paikka.shape,
          rotation: paikka.rotation,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    start(async () => {
      const tulos = await saveFloorPlan(erä);

      if (tulos.error) {
        setError(tulos.error);
        return;
      }

      setDirty(false);
      setNotice(tulos.notice ?? t.poytakartta.saved);
    });
  }

  if (tables.length === 0) {
    return (
      <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {t.poytakartta.noTables}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/*
        Ohjetta ei toisteta.

        Kortin otsikko kertoo jo mitä kartalla tehdään. Sama lause
        kahdesti peräkkäin saa lukijan epäilemään lukeneensa väärin.
      */}

      {/* --- Alueet ------------------------------------------------------- */}

      {areas.length > 0 ? (
        <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <AreaTab
            label={t.poytakartta.allAreas}
            on={area === null}
            onClick={() => setArea(null)}
          />
          {areas.map((row) => (
            <AreaTab
              key={row.id}
              label={row.name}
              on={area === row.id}
              onClick={() => setArea(row.id)}
            />
          ))}
        </nav>
      ) : null}

      {/* --- Sali ---------------------------------------------------------- */}

      <div
        ref={room}
        className="relative w-full touch-none select-none"
        style={{
          aspectRatio: String(ROOM_WIDTH_PER_HEIGHT),
          background: ROOM_BACKGROUND,
          backgroundColor: "var(--rf-inset)",
          border: "1px solid var(--rf-line-strong)",
          borderRadius: "var(--rf-r-card)",
          overflow: "hidden",
        }}
        onPointerDown={() => setSelected(null)}
      >
        {nakyvat.map((table) => {
          const paikka = positions.get(table.id);
          if (!paikka) return null;

          return (
            <button
              key={table.id}
              type="button"
              aria-label={`${table.name} · ${fill(t.poytakartta.seats, {
                maara: String(table.seatsMax),
              })}`}
              aria-pressed={selected === table.id}
              className="absolute flex cursor-grab items-center justify-center"
              style={{
                left: `${paikka.x}%`,
                top: `${paikka.y}%`,
                width: `${tableWidth(table.seatsMax)}%`,
                transform: "translate(-50%, -50%)",
                zIndex:
                  dragging === table.id ? 3 : selected === table.id ? 2 : 1,
                cursor: dragging === table.id ? "grabbing" : "grab",
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                event.preventDefault();

                const kohta = percentAt(event);
                if (!kohta) return;

                /*
                 * Kaappaus try-lohkossa.
                 *
                 * setPointerCapture heittää jos osoitin ehtii irrota
                 * tapahtuman ja käsittelijän välissä. Ilman suojaa
                 * raahaus ei alkaisi lainkaan.
                 */
                try {
                  event.currentTarget.setPointerCapture(event.pointerId);
                } catch {
                  /* Ei kaappausta; raahaus toimii silti pöydän päällä. */
                }

                siirtoRef.current = {
                  id: table.id,
                  dx: kohta.x - paikka.x,
                  dy: kohta.y - paikka.y,
                };

                setSelected(table.id);
                setDragging(table.id);
              }}
              onPointerMove={(event) => {
                const siirto = siirtoRef.current;
                if (!siirto || siirto.id !== table.id) return;

                const kohta = percentAt(event);
                if (!kohta) return;

                siirra(table.id, kohta.x - siirto.dx, kohta.y - siirto.dy);
              }}
              onPointerUp={() => {
                siirtoRef.current = null;
                setDragging(null);
              }}
              /*
               * Kaappauksen katoaminen päättää raahauksen.
               *
               * Selain voi ottaa kaappauksen pois esimerkiksi silloin
               * kun sivu vierii kesken eleen. Ilman tätä pöytä jäisi
               * kiinni osoittimeen vaikka sormi on jo nostettu.
               */
              onLostPointerCapture={() => {
                siirtoRef.current = null;
                setDragging(null);
              }}
              onPointerCancel={() => {
                siirtoRef.current = null;
                setDragging(null);
              }}
              onKeyDown={(event) => {
                /*
                 * Nuolet siirtävät prosentin kerrallaan, vaihdolla
                 * neljäsosan. Karkea askel riittää asetteluun,
                 * hieno viimeistelyyn.
                 */
                const askel = event.shiftKey ? 0.25 : 1;

                const suunnat: Record<string, [number, number]> = {
                  ArrowLeft: [-askel, 0],
                  ArrowRight: [askel, 0],
                  ArrowUp: [0, -askel],
                  ArrowDown: [0, askel],
                };

                const suunta = suunnat[event.key];
                if (!suunta) return;

                event.preventDefault();
                setSelected(table.id);
                siirra(table.id, paikka.x + suunta[0], paikka.y + suunta[1]);
              }}
              onFocus={() => setSelected(table.id)}
            >
              <TableMark
                name={table.name}
                shape={paikka.shape}
                rotation={paikka.rotation}
                widthPercent={100}
                colors={
                  table.active
                    ? PLAIN_COLORS
                    : {
                        bg: "var(--rf-inset)",
                        border: "var(--rf-line)",
                        text: "var(--rf-text-3)",
                        dashed: true,
                      }
                }
                selected={selected === table.id}
                dragging={dragging === table.id}
              />
            </button>
          );
        })}
      </div>

      <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
        {t.poytakartta.moveHint}
      </p>

      {/* --- Valitun pöydän muoto ------------------------------------------ */}

      {valittu ? (
        <div
          className="flex flex-wrap items-center gap-2 px-3 py-2"
          style={{
            background: "var(--rf-inset)",
            borderRadius: "var(--rf-r-card)",
          }}
        >
          <span className="text-[13px] font-semibold">
            {`${t.poytakartta.selected}: ${valittu.name}`}
          </span>

          <div className="ml-auto flex flex-wrap gap-1.5">
            {(
              [
                ["round", t.poytakartta.shapeRound],
                ["square", t.poytakartta.shapeSquare],
                ["rect", t.poytakartta.shapeRect],
              ] as [TableShape, string][]
            ).map(([shape, label]) => (
              <button
                key={shape}
                type="button"
                onClick={() => muuta(valittu.id, { shape })}
                aria-pressed={positions.get(valittu.id)?.shape === shape}
                className="rf-press px-3 py-1.5 text-[12.5px] font-semibold"
                style={{
                  background:
                    positions.get(valittu.id)?.shape === shape
                      ? "var(--rf-accent)"
                      : "var(--rf-card)",
                  color:
                    positions.get(valittu.id)?.shape === shape
                      ? "var(--rf-on-accent)"
                      : "var(--rf-text-2)",
                  borderRadius: "var(--rf-r-pill)",
                }}
              >
                {label}
              </button>
            ))}

            {/*
              Kääntäminen vain pitkälle pöydälle.

              Pyöreä näyttää samalta joka asennossa, ja sen
              kääntäminen olisi painike jolla ei tapahdu mitään.
            */}
            {positions.get(valittu.id)?.shape === "rect" ? (
              <Button
                tone="ghost"
                size="sm"
                type="button"
                onClick={() =>
                  muuta(valittu.id, {
                    rotation:
                      ((positions.get(valittu.id)?.rotation ?? 0) + 90) % 360,
                  })
                }
              >
                {t.poytakartta.rotate}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* --- Tallennus ----------------------------------------------------- */}

      {error ? (
        <p
          className="px-3 py-2 text-[13px] font-medium"
          role="alert"
          style={{
            background: "var(--rf-red-bg)",
            color: "var(--rf-red-text)",
            borderRadius: "var(--rf-r-card)",
          }}
        >
          {error}
        </p>
      ) : null}

      {notice ? (
        <p
          className="px-3 py-2 text-[13px] font-medium"
          role="status"
          style={{
            background: "var(--rf-green-bg)",
            color: "var(--rf-green-text)",
            borderRadius: "var(--rf-r-card)",
          }}
        >
          {notice}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          tone="primary"
          size="sm"
          type="button"
          disabled={!dirty || busy}
          onClick={tallenna}
        >
          {t.poytakartta.save}
        </Button>

        <Button
          tone="ghost"
          size="sm"
          type="button"
          disabled={!dirty || busy}
          onClick={() => {
            setPositions(initialPositions(tables));
            setDirty(false);
            setNotice(null);
            setError(null);
          }}
        >
          {t.poytakartta.reset}
        </Button>

        <Button
          tone="ghost"
          size="sm"
          type="button"
          disabled={busy}
          onClick={() => {
            /*
             * Ruudukko lähtöasetelmaksi.
             *
             * Kun sali on mennyt sekaisin, tästä pääsee takaisin
             * järjestykseen jossa kaikki on näkyvissä eikä mikään
             * ole toistensa päällä.
             */
            const tyhjennetyt = tables.map((table) => ({
              ...table,
              posX: null,
              posY: null,
            }));

            const ruudukko = autoLayout(tyhjennetyt as PlanTable[]);

            setPositions((edellinen) => {
              const uusi = new Map(edellinen);
              for (const [id, paikka] of ruudukko) {
                const nykyinen = uusi.get(id);
                if (nykyinen) uusi.set(id, { ...nykyinen, ...paikka });
              }
              return uusi;
            });

            setDirty(true);
            setNotice(null);
          }}
        >
          {t.poytakartta.autoArrange}
        </Button>

        {dirty ? (
          <span
            className="text-[12.5px]"
            style={{ color: "var(--rf-amber-text)" }}
          >
            {t.poytakartta.unsaved}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function AreaTab({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="rf-press shrink-0 px-3.5 py-1.5 text-[13px] font-semibold"
      style={{
        background: on ? "var(--rf-accent)" : "var(--rf-inset)",
        color: on ? "var(--rf-on-accent)" : "var(--rf-text-2)",
        borderRadius: "var(--rf-r-pill)",
      }}
    >
      {label}
    </button>
  );
}

/**
 * Lähtötila: tallennetut paikat, puuttuville ruudukko.
 *
 * placementsFor tekee saman kartan kuin salinäkymä piirtää, joten
 * muokkain avautuu siihen kuvaan jonka käyttäjä on jo nähnyt.
 */
function initialPositions(tables: RestaurantTable[]): Map<string, Position> {
  const sijainnit = placementsFor(tables as PlanTable[]);

  return new Map(
    sijainnit.map((paikka) => [
      paikka.id,
      {
        x: paikka.x,
        y: paikka.y,
        shape: paikka.shape,
        rotation: paikka.rotation,
      },
    ]),
  );
}

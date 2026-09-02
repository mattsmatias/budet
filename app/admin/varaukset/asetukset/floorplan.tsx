"use client";

/**
 * Salin pohjapiirroksen muokkain.
 *
 * Raahaa pöydät sinne missä ne salissa ovat, merkitse seinät ja
 * baaritiski, ja sali alkaa näyttää salilta. Se on koko idea, ja
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
 * ---------------------------------------------------------------------
 * KAKSI ERI OLIOTA, YKSI ELE
 * ---------------------------------------------------------------------
 *
 * Pöytä ja kaluste ovat eri asioita: pöydällä on paikkaluku ja tila,
 * kalusteella pituus. Raahaus on silti sama ele, ja se on toteutettu
 * kerran — osoittimen kaappauksella siihen elementtiin josta ele
 * alkoi.
 *
 * Kaappaus eikä ikkunakuuntelija: kuuntelija pitäisi tilata uudelleen
 * joka siirrolla, ja sulkeumassa kulkeva sijainti ehtisi vanhentua
 * kesken eleen.
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
import { ElementMark } from "@/components/restoflow/element-mark";
import {
  autoLayout,
  chairSpots,
  clampElement,
  clampToRoom,
  defaultElementSize,
  placementsFor,
  roundPercent,
  tableWidth,
  type ElementKind,
  type FloorElement,
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

const KINDS: ElementKind[] = [
  "wall",
  "bar",
  "kitchen",
  "wc",
  "door",
  "entrance",
  "other",
];

interface TablePos {
  x: number;
  y: number;
  shape: TableShape;
  rotation: number;
  /** Null = paikkaluvusta johdettu. */
  width: number | null;
}

interface EditorElement {
  /** Selaimen oma avain. Uudella kalusteella ei ole vielä tunnistetta. */
  key: string;
  id: string | null;
  areaId: string | null;
  kind: ElementKind;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

type Selection =
  { type: "table"; id: string } | { type: "element"; key: string } | null;

interface Drag {
  mode: "move" | "resize" | "pan";
  key: string;
  dx: number;
  dy: number;
  /** Lähtökoko koon muutokselle. */
  w: number;
  h: number;
}

export function FloorPlanEditor({
  t,
  tables,
  elements,
  areas,
}: {
  t: AdminText;
  tables: RestaurantTable[];
  elements: FloorElement[];
  areas: DiningArea[];
}) {
  const [positions, setPositions] = useState(() => initialPositions(tables));
  const [items, setItems] = useState<EditorElement[]>(() =>
    elements.map(toEditor),
  );

  const [selected, setSelected] = useState<Selection>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const [area, setArea] = useState<string | null>(null);
  const [showChairs, setShowChairs] = useState(true);

  /*
   * Zoomaus ja siirto ovat katselutilaa, eivät kartan tilaa.
   *
   * Niitä ei tallenneta: seuraava avaus alkaa kokonaisesta salista,
   * koska se on se näkymä josta työ aloitetaan. Tallennettu
   * zoomaustaso olisi tila jota kukaan ei pyytänyt eikä muista
   * asettaneensa.
   */
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const room = useRef<HTMLDivElement>(null);
  const eleRef = useRef<Drag | null>(null);

  /* Palvelimen tuoreet rivit voittavat vain kun mitään ei ole kesken. */
  const avain = `${tables.map((x) => x.id).join("|")}#${elements
    .map((x) => x.id)
    .join("|")}`;
  const [avainEnnen, setAvainEnnen] = useState(avain);

  if (avain !== avainEnnen && !dirty) {
    setAvainEnnen(avain);
    setPositions(initialPositions(tables));
    setItems(elements.map(toEditor));
  }

  const nakyvatPoydat = useMemo(
    () => tables.filter((table) => area === null || table.areaId === area),
    [tables, area],
  );

  const nakyvatKalusteet = useMemo(
    () => items.filter((item) => area === null || item.areaId === area),
    [items, area],
  );

  const valittuPoyta =
    selected?.type === "table"
      ? (nakyvatPoydat.find((x) => x.id === selected.id) ?? null)
      : null;

  const valittuKaluste =
    selected?.type === "element"
      ? (items.find((x) => x.key === selected.key) ?? null)
      : null;

  function muutos(): void {
    setDirty(true);
    setNotice(null);
  }

  /** Osoittimen paikka prosentteina kartasta. */
  function percentAt(
    event: React.PointerEvent,
  ): { x: number; y: number } | null {
    const box = room.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return null;

    return {
      x: ((event.clientX - box.left) / box.width) * 100,
      y: ((event.clientY - box.top) / box.height) * 100,
    };
  }

  function paataEle(): void {
    eleRef.current = null;
    setDragging(null);
  }

  // --- Pöydät --------------------------------------------------------------

  function siirraPoyta(id: string, x: number, y: number): void {
    const table = tables.find((row) => row.id === id);
    const nykyinen = positions.get(id);
    if (!table || !nykyinen) return;

    const rajattu = clampToRoom(
      x,
      y,
      nykyinen.width ?? tableWidth(table.seatsMax),
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

    muutos();
  }

  function muutaPoyta(id: string, muutokset: Partial<TablePos>): void {
    const nykyinen = positions.get(id);
    const table = tables.find((row) => row.id === id);
    if (!nykyinen) return;

    const yhdistetty = { ...nykyinen, ...muutokset };

    /*
     * Muodon tai koon muutos voi työntää pöydän reunan yli.
     *
     * Rajaus heti muutoksen yhteydessä, ei vasta seuraavassa
     * raahauksessa — muuten reunimmainen pöytä jäisi puoliksi ulos.
     */
    const rajattu = table
      ? clampToRoom(
          yhdistetty.x,
          yhdistetty.y,
          yhdistetty.width ?? tableWidth(table.seatsMax),
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

    muutos();
  }

  // --- Kalusteet -----------------------------------------------------------

  function muutaKaluste(key: string, muutokset: Partial<EditorElement>): void {
    setItems((edelliset) =>
      edelliset.map((item) => {
        if (item.key !== key) return item;

        const yhdistetty = { ...item, ...muutokset };
        const rajattu = clampElement(
          yhdistetty.x,
          yhdistetty.y,
          yhdistetty.width,
          yhdistetty.height,
        );

        return {
          ...yhdistetty,
          x: roundPercent(rajattu.x),
          y: roundPercent(rajattu.y),
        };
      }),
    );

    muutos();
  }

  function lisaaKaluste(kind: ElementKind): void {
    const koko = defaultElementSize(kind);

    const uusi: EditorElement = {
      key: `uusi-${crypto.randomUUID()}`,
      id: null,
      /* Uusi kaluste kuuluu siihen alueeseen jota katsotaan. */
      areaId: area,
      kind,
      label: "",
      x: 50,
      y: 50,
      width: koko.width,
      height: koko.height,
      rotation: 0,
    };

    setItems((edelliset) => [...edelliset, uusi]);
    setSelected({ type: "element", key: uusi.key });
    muutos();
  }

  function poistaKaluste(key: string): void {
    setItems((edelliset) => edelliset.filter((item) => item.key !== key));
    setSelected(null);
    muutos();
  }

  // --- Tallennus -----------------------------------------------------------

  function tallenna(): void {
    setError(null);

    const poydat = tables
      .map((table) => {
        const paikka = positions.get(table.id);
        if (!paikka) return null;

        return {
          id: table.id,
          x: paikka.x,
          y: paikka.y,
          shape: paikka.shape,
          rotation: paikka.rotation,
          width: paikka.width,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    /*
     * Kalusteet tallennetaan alueittain.
     *
     * Kanta poistaa ne joita listassa ei ole, joten lista on aina
     * yhden alueen kaikki kalusteet. Koko salin näkymässä alue on
     * null, ja silloin tallennetaan ne joilla aluetta ei ole.
     */
    const kalusteet = items
      .filter((item) => item.areaId === area)
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        label: item.label,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        rotation: item.rotation,
      }));

    start(async () => {
      const tulos = await saveFloorPlan({
        tables: poydat,
        elements: kalusteet,
        areaId: area,
      });

      if (tulos.error) {
        setError(tulos.error);
        return;
      }

      setDirty(false);
      setNotice(tulos.notice ?? t.poytakartta.saved);
    });
  }

  if (tables.length === 0 && items.length === 0) {
    return (
      <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {t.poytakartta.noTables}
      </p>
    );
  }

  const kalusteNimi: Record<ElementKind, string> = {
    wall: t.poytakartta.wall,
    bar: t.poytakartta.bar,
    kitchen: t.poytakartta.kitchen,
    wc: t.poytakartta.wc,
    door: t.poytakartta.door,
    entrance: t.poytakartta.entrance,
    other: t.poytakartta.other,
  };

  return (
    <div className="space-y-3">
      {/* --- Alueet ------------------------------------------------------- */}

      {areas.length > 0 ? (
        <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <Chip
            label={t.poytakartta.allAreas}
            on={area === null}
            onClick={() => setArea(null)}
          />
          {areas.map((row) => (
            <Chip
              key={row.id}
              label={row.name}
              on={area === row.id}
              onClick={() => setArea(row.id)}
            />
          ))}
        </nav>
      ) : null}

      {/* --- Työkalut ----------------------------------------------------- */}

      <div className="flex flex-wrap items-center gap-1.5">
        {KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => lisaaKaluste(kind)}
            className="rf-press px-2.5 py-1.5 text-[12.5px] font-semibold"
            style={{
              background: "var(--rf-inset)",
              color: "var(--rf-text-2)",
              borderRadius: "var(--rf-r-pill)",
            }}
          >
            {`+ ${kalusteNimi[kind]}`}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1.5">
          <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px]">
            <input
              type="checkbox"
              checked={showChairs}
              onChange={(event) => setShowChairs(event.target.checked)}
              className="h-3.5 w-3.5"
              style={{ accentColor: "var(--rf-accent)" }}
            />
            {t.poytakartta.showChairs}
          </label>

          <ZoomButton
            label={t.poytakartta.zoomOut}
            glyph="−"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
          />
          <ZoomButton
            label={t.poytakartta.zoomReset}
            glyph="⌂"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          />
          <ZoomButton
            label={t.poytakartta.zoomIn}
            glyph="+"
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
          />
        </div>
      </div>

      {/* --- Sali ---------------------------------------------------------- */}

      <div
        className="w-full overflow-hidden"
        style={{
          aspectRatio: String(ROOM_WIDTH_PER_HEIGHT),
          border: "1px solid var(--rf-line-strong)",
          borderRadius: "var(--rf-r-card)",
          background: "var(--rf-inset)",
        }}
      >
        <div
          ref={room}
          className="relative h-full w-full touch-none select-none"
          style={{
            background: ROOM_BACKGROUND,
            backgroundColor: "var(--rf-inset)",
            transform: `scale(${zoom}) translate(${pan.x}%, ${pan.y}%)`,
            transformOrigin: "center center",
            cursor: dragging === "pan" ? "grabbing" : "default",
          }}
          onPointerDown={(event) => {
            /*
             * Tyhjän kohdan raahaus siirtää karttaa.
             *
             * Erillinen siirtotila olisi painike jota pitää muistaa
             * painaa; tyhjä kohta on se paikka johon osoitin
             * luonnostaan menee kun mitään ei haluta valita.
             */
            if (event.target !== event.currentTarget) return;

            const kohta = percentAt(event);
            if (!kohta) return;

            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              /* Ei kaappausta; siirto toimii silti kartan päällä. */
            }

            eleRef.current = {
              mode: "pan",
              key: "",
              dx: kohta.x - pan.x,
              dy: kohta.y - pan.y,
              w: 0,
              h: 0,
            };

            setSelected(null);
            setDragging("pan");
          }}
          onPointerMove={(event) => {
            const ele = eleRef.current;
            if (!ele || ele.mode !== "pan") return;

            const kohta = percentAt(event);
            if (!kohta) return;

            setPan({
              x: Math.max(-60, Math.min(60, kohta.x - ele.dx)),
              y: Math.max(-60, Math.min(60, kohta.y - ele.dy)),
            });
          }}
          onPointerUp={paataEle}
          onLostPointerCapture={paataEle}
        >
          {/* --- Kalusteet pöytien alla --- */}

          {nakyvatKalusteet.map((item) => {
            const on =
              selected?.type === "element" && selected.key === item.key;

            return (
              <div
                key={item.key}
                className="absolute"
                style={{
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                  width: `${item.width}%`,
                  height: `${item.height}%`,
                  transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
                  zIndex: on ? 2 : 0,
                }}
              >
                <button
                  type="button"
                  aria-label={item.label || kalusteNimi[item.kind]}
                  aria-pressed={on}
                  className="h-full w-full"
                  style={{
                    cursor: dragging === item.key ? "grabbing" : "grab",
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    event.preventDefault();

                    const kohta = percentAt(event);
                    if (!kohta) return;

                    try {
                      event.currentTarget.setPointerCapture(event.pointerId);
                    } catch {
                      /* Ei kaappausta; raahaus toimii silti päällä. */
                    }

                    eleRef.current = {
                      mode: "move",
                      key: item.key,
                      dx: kohta.x - item.x,
                      dy: kohta.y - item.y,
                      w: item.width,
                      h: item.height,
                    };

                    setSelected({ type: "element", key: item.key });
                    setDragging(item.key);
                  }}
                  onPointerMove={(event) => {
                    const ele = eleRef.current;
                    if (!ele || ele.key !== item.key || ele.mode !== "move") {
                      return;
                    }

                    const kohta = percentAt(event);
                    if (!kohta) return;

                    muutaKaluste(item.key, {
                      x: kohta.x - ele.dx,
                      y: kohta.y - ele.dy,
                    });
                  }}
                  onPointerUp={paataEle}
                  onLostPointerCapture={paataEle}
                  onKeyDown={(event) =>
                    nuoli(event, (dx, dy) =>
                      muutaKaluste(item.key, {
                        x: item.x + dx,
                        y: item.y + dy,
                      }),
                    )
                  }
                  onFocus={() =>
                    setSelected({ type: "element", key: item.key })
                  }
                >
                  <ElementMark
                    kind={item.kind}
                    label={item.label}
                    rotation={item.rotation}
                    selected={on}
                  />
                </button>

                {/*
                  Kokokahva vain valitulle.

                  Kahva jokaisessa kalusteessa täyttäisi kartan
                  pisteillä, ja koon muuttaminen on harvinaisempaa kuin
                  siirtäminen.
                */}
                {on ? (
                  <button
                    type="button"
                    aria-label={t.poytakartta.size}
                    className="absolute"
                    style={{
                      right: -6,
                      bottom: -6,
                      width: 12,
                      height: 12,
                      background: "var(--rf-accent)",
                      borderRadius: 3,
                      cursor: "nwse-resize",
                      touchAction: "none",
                    }}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      event.preventDefault();

                      const kohta = percentAt(event);
                      if (!kohta) return;

                      try {
                        event.currentTarget.setPointerCapture(event.pointerId);
                      } catch {
                        /* Ei kaappausta. */
                      }

                      eleRef.current = {
                        mode: "resize",
                        key: item.key,
                        dx: kohta.x,
                        dy: kohta.y,
                        w: item.width,
                        h: item.height,
                      };
                    }}
                    onPointerMove={(event) => {
                      const ele = eleRef.current;
                      if (
                        !ele ||
                        ele.key !== item.key ||
                        ele.mode !== "resize"
                      ) {
                        return;
                      }

                      const kohta = percentAt(event);
                      if (!kohta) return;

                      /*
                       * Kahva on oikeassa alakulmassa, ja keskikohta
                       * pysyy paikallaan: liike kasvattaa kokoa
                       * molemmista reunoista, siis kaksinkertaisesti.
                       */
                      muutaKaluste(item.key, {
                        width: Math.max(
                          2,
                          Math.min(100, ele.w + (kohta.x - ele.dx) * 2),
                        ),
                        height: Math.max(
                          2,
                          Math.min(100, ele.h + (kohta.y - ele.dy) * 2),
                        ),
                      });
                    }}
                    onPointerUp={paataEle}
                    onLostPointerCapture={paataEle}
                    onKeyDown={(event) =>
                      nuoli(event, (dx, dy) =>
                        muutaKaluste(item.key, {
                          width: Math.max(
                            2,
                            Math.min(100, item.width + dx * 2),
                          ),
                          height: Math.max(
                            2,
                            Math.min(100, item.height + dy * 2),
                          ),
                        }),
                      )
                    }
                  />
                ) : null}
              </div>
            );
          })}

          {/* --- Pöydät --- */}

          {nakyvatPoydat.map((table) => {
            const paikka = positions.get(table.id);
            if (!paikka) return null;

            const leveys = paikka.width ?? tableWidth(table.seatsMax);
            const on = selected?.type === "table" && selected.id === table.id;

            return (
              <button
                key={table.id}
                type="button"
                aria-label={`${table.name} · ${fill(t.poytakartta.seats, {
                  maara: String(table.seatsMax),
                })}`}
                aria-pressed={on}
                className="absolute flex items-center justify-center"
                style={{
                  left: `${paikka.x}%`,
                  top: `${paikka.y}%`,
                  width: `${leveys}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: dragging === table.id ? 4 : on ? 3 : 1,
                  cursor: dragging === table.id ? "grabbing" : "grab",
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.preventDefault();

                  const kohta = percentAt(event);
                  if (!kohta) return;

                  try {
                    event.currentTarget.setPointerCapture(event.pointerId);
                  } catch {
                    /* Ei kaappausta; raahaus toimii silti pöydän päällä. */
                  }

                  eleRef.current = {
                    mode: "move",
                    key: table.id,
                    dx: kohta.x - paikka.x,
                    dy: kohta.y - paikka.y,
                    w: leveys,
                    h: 0,
                  };

                  setSelected({ type: "table", id: table.id });
                  setDragging(table.id);
                }}
                onPointerMove={(event) => {
                  const ele = eleRef.current;
                  if (!ele || ele.key !== table.id || ele.mode !== "move") {
                    return;
                  }

                  const kohta = percentAt(event);
                  if (!kohta) return;

                  siirraPoyta(table.id, kohta.x - ele.dx, kohta.y - ele.dy);
                }}
                onPointerUp={paataEle}
                onLostPointerCapture={paataEle}
                onKeyDown={(event) =>
                  nuoli(event, (dx, dy) =>
                    siirraPoyta(table.id, paikka.x + dx, paikka.y + dy),
                  )
                }
                onFocus={() => setSelected({ type: "table", id: table.id })}
              >
                {/*
                  Tuolit pöydän ympärillä.

                  Ne eivät ole tietoa vaan piirrosta: montako henkeä
                  pöytään mahtuu, ilman että lukua tarvitsee lukea.
                */}
                {showChairs
                  ? chairSpots(table.seatsMax, paikka.shape).map((spot, i) => (
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
                          opacity: 0.55,
                        }}
                      />
                    ))
                  : null}

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
                  selected={on}
                  dragging={dragging === table.id}
                />
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
        {`${t.poytakartta.moveHint} ${t.poytakartta.panHint}`}
      </p>

      {/* --- Valittu pöytä ------------------------------------------------- */}

      {valittuPoyta ? (
        <Panel>
          <span className="text-[13px] font-semibold">
            {`${t.poytakartta.selected}: ${valittuPoyta.name}`}
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {(
              [
                ["round", t.poytakartta.shapeRound],
                ["square", t.poytakartta.shapeSquare],
                ["rect", t.poytakartta.shapeRect],
              ] as [TableShape, string][]
            ).map(([shape, label]) => (
              <Chip
                key={shape}
                label={label}
                on={positions.get(valittuPoyta.id)?.shape === shape}
                onClick={() => muutaPoyta(valittuPoyta.id, { shape })}
              />
            ))}

            {/* Kääntäminen vain pitkälle: pyöreä näyttää samalta. */}
            {positions.get(valittuPoyta.id)?.shape === "rect" ? (
              <Button
                tone="ghost"
                size="sm"
                type="button"
                onClick={() =>
                  muutaPoyta(valittuPoyta.id, {
                    rotation:
                      ((positions.get(valittuPoyta.id)?.rotation ?? 0) + 90) %
                      360,
                  })
                }
              >
                {t.poytakartta.rotate}
              </Button>
            ) : null}
          </div>

          <label className="flex w-full items-center gap-2 text-[12.5px]">
            <span className="shrink-0">{t.poytakartta.size}</span>
            <input
              type="range"
              min={4}
              max={30}
              step={0.5}
              value={
                positions.get(valittuPoyta.id)?.width ??
                tableWidth(valittuPoyta.seatsMax)
              }
              onChange={(event) =>
                muutaPoyta(valittuPoyta.id, {
                  width: Number(event.target.value),
                })
              }
              className="min-w-0 flex-1"
              style={{ accentColor: "var(--rf-accent)" }}
            />

            {/*
              Paluu johdettuun kokoon.

              Ravintoloitsijan on päästävä takaisin ilman että hän
              arvaa mikä luku olisi ollut oikea — johdettu koko seuraa
              paikkalukua, käsin asetettu ei.
            */}
            {positions.get(valittuPoyta.id)?.width !== null ? (
              <Button
                tone="ghost"
                size="sm"
                type="button"
                onClick={() => muutaPoyta(valittuPoyta.id, { width: null })}
              >
                {t.poytakartta.sizeAuto}
              </Button>
            ) : null}
          </label>

          <p
            className="w-full text-[12px]"
            style={{ color: "var(--rf-text-3)" }}
          >
            {t.poytakartta.sizeAutoHint}
          </p>
        </Panel>
      ) : null}

      {/* --- Valittu kaluste ----------------------------------------------- */}

      {valittuKaluste ? (
        <Panel>
          <span className="text-[13px] font-semibold">
            {`${t.poytakartta.selectedElement}: ${kalusteNimi[valittuKaluste.kind]}`}
          </span>

          <label className="flex items-center gap-2 text-[12.5px]">
            <span className="shrink-0">{t.poytakartta.elementName}</span>
            <input
              value={valittuKaluste.label}
              maxLength={40}
              onChange={(event) =>
                muutaKaluste(valittuKaluste.key, { label: event.target.value })
              }
              className="h-[32px] w-40 px-2 text-[13px] outline-none"
              style={{
                background: "var(--rf-card)",
                border: "1px solid var(--rf-line)",
                borderRadius: "var(--rf-r-field)",
                color: "var(--rf-text)",
              }}
            />
          </label>

          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button
              tone="ghost"
              size="sm"
              type="button"
              onClick={() =>
                muutaKaluste(valittuKaluste.key, {
                  rotation: (valittuKaluste.rotation + 90) % 360,
                })
              }
            >
              {t.poytakartta.rotate}
            </Button>

            <Button
              tone="ghost"
              size="sm"
              type="button"
              onClick={() => poistaKaluste(valittuKaluste.key)}
            >
              {t.poytakartta.deleteElement}
            </Button>
          </div>

          <p
            className="w-full text-[12px]"
            style={{ color: "var(--rf-text-3)" }}
          >
            {t.poytakartta.resizeHint}
          </p>
        </Panel>
      ) : null}

      {/* --- Tallennus ----------------------------------------------------- */}

      {error ? (
        <Notice tone="error">{error}</Notice>
      ) : notice ? (
        <Notice tone="ok">{notice}</Notice>
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
            setItems(elements.map(toEditor));
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

            muutos();
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

/**
 * Nuolinäppäimet siirtävät valittua.
 *
 * Raahaus ei ole näppäimistöele. Ilman tätä kartta olisi ominaisuus
 * jota osa ei voi käyttää lainkaan, eikä pöytien järjestely ole se
 * kohta jossa siitä tingitään.
 */
function nuoli(
  event: React.KeyboardEvent,
  liikuta: (dx: number, dy: number) => void,
): void {
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
  liikuta(suunta[0], suunta[1]);
}

function Chip({
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
      className="rf-press shrink-0 px-3 py-1.5 text-[12.5px] font-semibold"
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

function ZoomButton({
  label,
  glyph,
  onClick,
}: {
  label: string;
  glyph: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rf-press flex h-8 w-8 items-center justify-center text-[15px] font-semibold"
      style={{
        background: "var(--rf-inset)",
        color: "var(--rf-text-2)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {glyph}
    </button>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 px-3 py-2"
      style={{
        background: "var(--rf-inset)",
        borderRadius: "var(--rf-r-card)",
      }}
    >
      {children}
    </div>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "ok" | "error";
  children: React.ReactNode;
}) {
  return (
    <p
      className="px-3 py-2 text-[13px] font-medium"
      role={tone === "error" ? "alert" : "status"}
      style={{
        background:
          tone === "error" ? "var(--rf-red-bg)" : "var(--rf-green-bg)",
        color: tone === "error" ? "var(--rf-red-text)" : "var(--rf-green-text)",
        borderRadius: "var(--rf-r-card)",
      }}
    >
      {children}
    </p>
  );
}

function toEditor(element: FloorElement): EditorElement {
  return {
    key: element.id,
    id: element.id,
    areaId: element.areaId,
    kind: element.kind,
    label: element.label,
    x: element.posX,
    y: element.posY,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
  };
}

/**
 * Lähtötila: tallennetut paikat, puuttuville ruudukko.
 *
 * placementsFor tekee saman kartan kuin salinäkymä piirtää, joten
 * muokkain avautuu siihen kuvaan jonka käyttäjä on jo nähnyt.
 */
function initialPositions(tables: RestaurantTable[]): Map<string, TablePos> {
  const sijainnit = placementsFor(tables as PlanTable[]);

  return new Map(
    sijainnit.map((paikka) => {
      const table = tables.find((row) => row.id === paikka.id);

      return [
        paikka.id,
        {
          x: paikka.x,
          y: paikka.y,
          shape: paikka.shape,
          rotation: paikka.rotation,
          width: table?.width ?? null,
        },
      ];
    }),
  );
}

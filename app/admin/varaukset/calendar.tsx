"use client";

/**
 * Illan aikajana: pöydät sarakkeina, aika ylhäältä alas.
 *
 * Lista kertoo kuka tulee ja milloin. Se ei kerro onko kello 19
 * ruuhkaa vai onko puoli salia tyhjänä, eikä sitä että pöytä 7 on
 * varattu kahdesti peräkkäin viidentoista minuutin välein.
 *
 * Aikajana kertoo molemmat yhdellä silmäyksellä, koska se piirtää
 * ajan pituutena eikä numerona.
 *
 * ---------------------------------------------------------------------
 * RAAHAUS ON KAKSI MUUTOSTA YHDELLÄ ELEELLÄ
 * ---------------------------------------------------------------------
 *
 * Sivusuunta vaihtaa pöydän, pystysuunta ajan. Salissa ne ovat sama
 * teko — "siirretään nuo puoli tuntia myöhemmäksi ja ikkunan viereen"
 * — eikä sitä pidä jakaa kahdeksi lomakkeeksi.
 *
 * ---------------------------------------------------------------------
 * PÄÄLLEKKÄISYYS TARKISTETAAN KAHDESTI
 * ---------------------------------------------------------------------
 *
 * Selain tarkistaa raahauksen aikana, jotta pudotuskohta voi kertoa
 * heti ettei siihen mahdu. Kanta tarkistaa tallennuksessa, koska
 * selaimen näkemä tilanne on aina hetken vanha — ja koska kaksi
 * tarjoilijaa voi raahata samaa pöytää yhtä aikaa.
 *
 * Kumpikaan ei riitä yksin. Pelkkä selaintarkistus olisi kohteliaisuus
 * jonka voi ohittaa; pelkkä kantatarkistus olisi virheilmoitus vasta
 * sen jälkeen kun ele on jo tehty.
 */

import { useRef, useState, useTransition } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import type { ReservationDay, Reservation } from "@/lib/restoflow/reservations";
import {
  axisFor,
  blockPosition,
  blocks,
  columnsFor,
  conflictFor,
  durationOf,
  minutesAt,
  minutesOf,
  reservationsInColumn,
  timeOf,
  type CalendarReservation,
  type CalendarTable,
} from "@/lib/restoflow/reservation-calendar";
import { updateReservation } from "./actions";

/** Sarakkeen vähimmäisleveys, jotta nimi ja kello mahtuvat. */
const COLUMN_WIDTH = 108;

/** Aikajanan korkeus. Riittää illalle ilman että sivu venyy metriksi. */
const AXIS_HEIGHT = 620;

type Tone = "confirmed" | "arrived" | "billing" | "past" | "void";

const TONES: Record<Tone, { bg: string; border: string; text: string }> = {
  confirmed: {
    bg: "var(--rf-blue-bg)",
    border: "var(--rf-blue)",
    text: "var(--rf-blue-text)",
  },
  arrived: {
    bg: "var(--rf-accent-bg)",
    border: "var(--rf-accent)",
    text: "var(--rf-accent-strong)",
  },
  billing: {
    bg: "var(--rf-amber-bg)",
    border: "var(--rf-amber)",
    text: "var(--rf-amber-text)",
  },
  past: {
    bg: "var(--rf-inset)",
    border: "var(--rf-line-strong)",
    text: "var(--rf-text-2)",
  },
  /*
   * Peruttu ja saapumatta jäänyt näkyvät haaleina.
   *
   * Ne eivät varaa pöytää, mutta ne kertovat että joku aikoi tulla —
   * ja illan lopussa juuri se on se tieto jota katsotaan.
   */
  void: {
    bg: "transparent",
    border: "var(--rf-line-strong)",
    text: "var(--rf-text-3)",
  },
};

function toneFor(reservation: Reservation): Tone {
  if (!blocks(reservation.status)) return "void";
  if (reservation.status === "completed") return "past";
  if (reservation.status === "arrived") {
    return reservation.billRequestedAt ? "billing" : "arrived";
  }
  return "confirmed";
}

interface Drag {
  id: string;
  /** Minuutit varauksen alusta osoittimeen: palkki ei hyppää sormeen. */
  offsetMinutes: number;
  durationMinutes: number;
}

export function ReservationCalendar({
  t,
  day,
  canManage,
}: {
  t: AdminText;
  day: ReservationDay;
  canManage: boolean;
}) {
  const [area, setArea] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [target, setTarget] = useState<{
    columnId: string | null;
    minutes: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const grid = useRef<HTMLDivElement>(null);

  const calendarRows: CalendarReservation[] = day.reservations.map((row) => ({
    id: row.id,
    time: row.time,
    endTime: row.endTime,
    status: row.status,
    partySize: row.partySize,
    guestName: row.guestName,
    tableIds: row.tableIds,
  }));

  const axis = axisFor(calendarRows, day.hours);

  const columns = columnsFor(day.tables as CalendarTable[], calendarRows, area);

  if (day.tables.length === 0) {
    return (
      <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {t.kalenteri.noTables}
      </p>
    );
  }

  /**
   * Osoittimen paikka sarakkeena ja minuuttina.
   *
   * Sarake luetaan vaakasijainnista eikä siitä minkä elementin päällä
   * ollaan: osoittimen kaappaus ohjaa kaikki tapahtumat siihen
   * palkkiin josta raahaus alkoi, joten naapurisarakkeen
   * pointermove ei koskaan laukea.
   */
  function pointAt(
    event: React.PointerEvent,
  ): { columnId: string | null; minutes: number } | null {
    const box = grid.current?.getBoundingClientRect();
    if (!box || box.height === 0 || columns.length === 0) return null;

    const index = Math.max(
      0,
      Math.min(
        columns.length - 1,
        Math.floor((event.clientX - box.left) / COLUMN_WIDTH),
      ),
    );

    const osuus = (event.clientY - box.top) / box.height;

    return { columnId: columns[index].id, minutes: minutesAt(osuus, axis) };
  }

  function pudota(): void {
    const kohde = target;
    const veto = drag;

    setDrag(null);
    setTarget(null);

    if (!kohde || !veto) return;

    const reservation = day.reservations.find((row) => row.id === veto.id);
    if (!reservation) return;

    const alku = Math.max(axis.from, kohde.minutes - veto.offsetMinutes);

    const tableIds = kohde.columnId === null ? [] : [kohde.columnId];

    /* Ei muutosta: ei myöskään kyselyä. */
    const samaAika = timeOf(alku) === reservation.time;
    const samaPoyta =
      tableIds.length === reservation.tableIds.length &&
      tableIds.every((id) => reservation.tableIds.includes(id));

    if (samaAika && samaPoyta) return;

    const este = conflictFor({
      reservation: {
        id: reservation.id,
        time: reservation.time,
        endTime: reservation.endTime,
        status: reservation.status,
        partySize: reservation.partySize,
        guestName: reservation.guestName,
        tableIds: reservation.tableIds,
      },
      tableIds,
      startMinutes: alku,
      durationMinutes: veto.durationMinutes,
      others: calendarRows,
      turnaroundMinutes: day.settings?.turnaroundMinutes ?? 0,
    });

    if (este) {
      setError(
        fill(t.kalenteri.conflict, {
          nimi: este.guestName,
          aika: este.time,
        }),
      );
      return;
    }

    setError(null);

    /*
     * Sama toiminto kuin lomakkeella.
     *
     * Raahaus on eri ele mutta sama muutos, ja oma kirjoituspolku
     * olisi toinen paikka jossa säännöt pitäisi muistaa. Kanta
     * tarkistaa päällekkäisyyden vielä kerran.
     */
    const form = new FormData();
    form.set("id", reservation.id);
    form.set("time", timeOf(alku));
    form.set("tablesTouched", "1");
    for (const id of tableIds) form.append("tableId", id);

    start(async () => {
      const tulos = await updateReservation({}, form);
      if (tulos.error) setError(tulos.error);
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-[12.5px]" style={{ color: "var(--rf-text-3)" }}>
        {t.kalenteri.hint}
      </p>

      {day.areas.length > 0 ? (
        <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <Chip
            label={t.poytakartta.allAreas}
            on={area === null}
            onClick={() => setArea(null)}
          />
          {day.areas.map((row) => (
            <Chip
              key={row.id}
              label={row.name}
              on={area === row.id}
              onClick={() => setArea(row.id)}
            />
          ))}
        </nav>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="px-3 py-2 text-[13px] font-medium"
          style={{
            background: "var(--rf-red-bg)",
            color: "var(--rf-red-text)",
            borderRadius: "var(--rf-r-card)",
          }}
        >
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <div
          className="flex"
          style={{ minWidth: `${56 + columns.length * COLUMN_WIDTH}px` }}
        >
          {/* --- Kellosarake --- */}

          <div className="shrink-0" style={{ width: 56 }}>
            {/* Tyhjä otsikko: kello ei ole pöytä. */}
            <div style={{ height: 30 }} />

            <div className="relative" style={{ height: AXIS_HEIGHT }}>
              {axis.ticks.map((tick) => (
                <span
                  key={tick}
                  className="absolute right-2 text-[11px]"
                  style={{
                    top: `${((tick - axis.from) / (axis.to - axis.from)) * 100}%`,
                    transform: "translateY(-50%)",
                    color: "var(--rf-text-3)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {timeOf(tick)}
                </span>
              ))}
            </div>
          </div>

          {/* --- Pöytäsarakkeet --- */}

          <div className="flex-1">
            <div className="flex">
              {columns.map((column) => (
                <div
                  key={column.id ?? "none"}
                  className="shrink-0 truncate px-1 text-center text-[12px] font-semibold"
                  style={{
                    width: COLUMN_WIDTH,
                    height: 30,
                    lineHeight: "30px",
                    color: column.active
                      ? "var(--rf-text-2)"
                      : "var(--rf-text-3)",
                  }}
                >
                  {column.id === null ? t.kalenteri.unassigned : column.name}
                </div>
              ))}
            </div>

            <div
              ref={grid}
              className="relative flex touch-none"
              style={{
                height: AXIS_HEIGHT,
                background: "var(--rf-inset)",
                borderRadius: "var(--rf-r-card)",
              }}
              onPointerUp={pudota}
              onPointerCancel={() => {
                setDrag(null);
                setTarget(null);
              }}
            >
              {/* Tuntiviivat koko leveydelle. */}
              {axis.ticks.map((tick) => (
                <span
                  key={tick}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 right-0"
                  style={{
                    top: `${((tick - axis.from) / (axis.to - axis.from)) * 100}%`,
                    borderTop: "1px solid var(--rf-line)",
                  }}
                />
              ))}

              {columns.map((column) => {
                const rows = reservationsInColumn(calendarRows, column.id);

                return (
                  <div
                    key={column.id ?? "none"}
                    className="relative h-full shrink-0"
                    style={{
                      width: COLUMN_WIDTH,
                      borderLeft: "1px solid var(--rf-line)",
                      background:
                        target?.columnId === column.id
                          ? "var(--rf-accent-bg)"
                          : "transparent",
                    }}
                    onPointerMove={(event) => {
                      if (!drag) return;
                      setTarget(pointAt(event));
                    }}
                  >
                    {rows.map((row) => {
                      const full = day.reservations.find(
                        (x) => x.id === row.id,
                      );
                      if (!full) return null;

                      const { top, height } = blockPosition(row, axis);
                      const tone = TONES[toneFor(full)];
                      const raahataan = drag?.id === row.id;

                      return (
                        <button
                          key={row.id}
                          type="button"
                          className="absolute overflow-hidden px-1.5 py-1 text-left"
                          style={{
                            top: `${top}%`,
                            height: `${height}%`,
                            left: 3,
                            right: 3,
                            background: tone.bg,
                            border: `1.5px solid ${tone.border}`,
                            color: tone.text,
                            borderRadius: "var(--rf-r-control)",
                            opacity: raahataan ? 0.4 : 1,
                            cursor: canManage ? "grab" : "pointer",
                            zIndex: raahataan ? 5 : 1,
                          }}
                          onPointerDown={(event) => {
                            if (!canManage) return;

                            const kohta = pointAt(event);
                            if (!kohta) return;

                            try {
                              event.currentTarget.setPointerCapture(
                                event.pointerId,
                              );
                            } catch {
                              /* Ei kaappausta; raahaus toimii silti. */
                            }

                            setDrag({
                              id: row.id,
                              offsetMinutes:
                                kohta.minutes - minutesOf(row.time),
                              durationMinutes: durationOf(
                                row.time,
                                row.endTime,
                              ),
                            });
                            setTarget(kohta);
                          }}
                          onPointerMove={(event) => {
                            if (!drag) return;
                            setTarget(pointAt(event));
                          }}
                          onPointerUp={pudota}
                          onLostPointerCapture={() => {
                            setDrag(null);
                            setTarget(null);
                          }}
                          onClick={() => {
                            /*
                             * Napsautus vie listariville.
                             *
                             * Kalenteri kertoo missä ilta menee, lista
                             * kuka ja millä numerolla. Sama tieto
                             * kahdesti piirrettynä olisi kaksi paikkaa
                             * jotka ajautuvat erilleen.
                             *
                             * Ei raahauksen jälkeen: pudotus ei ole
                             * napsautus, vaikka selain lähettää
                             * molemmat.
                             */
                            if (drag) return;

                            document
                              .getElementById(`varaus-${row.id}`)
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                          }}
                        >
                          <span className="block truncate text-[11.5px] font-bold">
                            {row.time}
                          </span>
                          <span className="block truncate text-[11.5px]">
                            {row.guestName}
                          </span>
                          <span className="block truncate text-[11px] opacity-80">
                            {fill(t.kalenteri.seats, {
                              maara: String(row.partySize),
                            })}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {/* --- Pudotuskohta --- */}

              {drag && target ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 right-0 px-1 text-[11px] font-semibold"
                  style={{
                    top: `${
                      ((Math.max(
                        axis.from,
                        target.minutes - drag.offsetMinutes,
                      ) -
                        axis.from) /
                        (axis.to - axis.from)) *
                      100
                    }%`,
                    borderTop: "2px solid var(--rf-accent)",
                    color: "var(--rf-accent-strong)",
                  }}
                >
                  {fill(t.kalenteri.dropHere, {
                    aika: timeOf(
                      Math.max(axis.from, target.minutes - drag.offsetMinutes),
                    ),
                  })}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {busy ? (
        <p className="text-[12.5px]" style={{ color: "var(--rf-text-3)" }}>
          {t.kalenteri.moving}
        </p>
      ) : null}

      {day.reservations.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {t.kalenteri.empty}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

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

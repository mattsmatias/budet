"use client";

import { useMemo, useState, useTransition } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { Button } from "@/components/restoflow/ui";
import {
  chunk,
  guessReservationColumns,
  guessTableColumns,
  parseDelimited,
  prepareReservations,
  prepareTables,
  type ImportReservation,
  type ImportTable,
  type Mapping,
  type Prepared,
  type ReservationField,
  type RowProblem,
  type TableField,
} from "@/lib/restoflow/reservation-import";
import {
  importReservations,
  importTables,
  type ImportResult,
} from "./actions";

type Kind = "reservations" | "tables";

/** Kannan rajat. Selain paloittelee tiedoston näihin. */
const CHUNKS: Record<Kind, number> = { reservations: 100, tables: 250 };

const VARAUS_KENTAT: ReservationField[] = [
  "date",
  "time",
  "partySize",
  "name",
  "phone",
  "email",
  "note",
  "allergies",
  "status",
  "tables",
];

const POYTA_KENTAT: TableField[] = [
  "name",
  "seatsMin",
  "seatsMax",
  "area",
  "shape",
];

/**
 * Tuonti kolmessa vaiheessa.
 *
 * VALITSE TIEDOSTO → TARKISTA MITÄ SIINÄ ON → TUO.
 *
 * Keskimmäinen vaihe on koko työkalun tarkoitus. Väärin tulkittu
 * päivämääräsarake ei näy virheenä vaan sadan varauksen siirtymisenä
 * väärälle kuukaudelle, eikä sitä huomaa kukaan ennen kuin seurue
 * ilmestyy ovelle iltana jona pöytää ei ole.
 *
 * Siksi esikatselu näyttää oikeat rivit oikeine arvoineen, ja
 * sarakkeiden tulkinta on muutettavissa: arvaus on hyvä mutta ei
 * koskaan varma, ja korjaus on yksi valikko eikä tiedoston muokkaus.
 *
 * ---------------------------------------------------------------------
 * MIKSI TIEDOSTO LUETAAN SELAIMESSA
 * ---------------------------------------------------------------------
 *
 * Tiedosto on täynnä asiakkaiden nimiä ja puhelinnumeroita. Se on jo
 * käyttäjän koneella, ja tulkinta on puhdasta laskentaa — palvelimelle
 * lähtee vasta se mitä oikeasti tallennetaan.
 */
export function Importer({ t }: { t: AdminText }) {
  const [kind, setKind] = useState<Kind>("reservations");
  const [rows, setRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState("");
  const [varausMap, setVarausMap] = useState<Mapping<ReservationField>>({});
  const [poytaMap, setPoytaMap] = useState<Mapping<TableField>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState<{ done: number; all: number } | null>(
    null,
  );
  const [busy, start] = useTransition();

  const headers = rows[0] ?? [];

  const valmis: Prepared<ImportReservation | ImportTable> | null = useMemo(() => {
    if (rows.length < 2) return null;

    return kind === "reservations"
      ? prepareReservations(rows, varausMap)
      : prepareTables(rows, poytaMap);
  }, [rows, kind, varausMap, poytaMap]);

  async function lue(file: File): Promise<void> {
    const teksti = await file.text();
    const luetut = parseDelimited(teksti);

    setFileName(file.name);
    setRows(luetut);
    setResult(null);
    setProgress(null);

    /* Arvaus molemmille, jotta tyypin vaihto ei vaadi uutta lukua. */
    const otsikot = luetut[0] ?? [];
    setVarausMap(guessReservationColumns(otsikot));
    setPoytaMap(guessTableColumns(otsikot));
  }

  function tuo(): void {
    if (!valmis || valmis.rows.length === 0) return;

    /*
     * Rivien tyyppi tiedetään valinnasta, ei sisällöstä.
     *
     * Sama esikatselu palvelee kumpaakin tuontia, joten rivit ovat
     * täällä kahden tyypin unioni. Kavennus tehdään kerran tässä eikä
     * jokaisessa kutsussa erikseen — muuten sama tarkistus olisi
     * kirjoitettuna kolmesti ja väärä yhdessä niistä.
     */
    const rivit = valmis.rows;

    start(async () => {
      const palat = chunk(rivit, CHUNKS[kind]);
      const yhteensa: ImportResult = {
        added: 0,
        skipped: 0,
        failed: 0,
        rows: [],
      };

      let tehty = 0;
      setProgress({ done: 0, all: valmis.rows.length });

      for (const pala of palat) {
        const vastaus =
          kind === "reservations"
            ? await importReservations(pala)
            : await importTables(pala);

        if (vastaus.error) {
          setResult({ ...yhteensa, error: vastaus.error });
          setProgress(null);
          return;
        }

        yhteensa.added += vastaus.added;
        yhteensa.skipped += vastaus.skipped;
        yhteensa.failed += vastaus.failed;

        /*
         * Rivinumerot jatkuvat palasta toiseen.
         *
         * Kanta numeroi rivit oman palansa sisällä. Ilman siirtoa
         * raportti sanoisi "rivi 3" kolme kertaa eri riveistä.
         */
        yhteensa.rows.push(
          ...vastaus.rows.map((rivi) => ({ ...rivi, row: rivi.row + tehty })),
        );

        tehty += pala.length;
        setProgress({ done: tehty, all: valmis.rows.length });
      }

      setResult(yhteensa);
      setProgress(null);
    });
  }

  return (
    <div className="space-y-5">
      {/* --- 1. Mitä tuodaan --- */}
      <div className="flex flex-wrap gap-1.5">
        {(["reservations", "tables"] as Kind[]).map((id) => {
          const on = id === kind;

          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setKind(id);
                setResult(null);
              }}
              className="rf-press px-3.5 py-2 text-[13px] font-bold"
              style={{
                background: on ? "var(--rf-accent-bg)" : "var(--rf-card)",
                color: on ? "var(--rf-accent-strong)" : "var(--rf-text-2)",
                border: "1px solid var(--rf-line)",
                borderRadius: 999,
              }}
            >
              {id === "reservations"
                ? t.varausTuonti.kindReservations
                : t.varausTuonti.kindTables}
            </button>
          );
        })}
      </div>

      {/* --- 2. Tiedosto --- */}
      <div>
        <label
          htmlFor="tuonti-tiedosto"
          className="block text-[13px] font-medium"
        >
          {t.varausTuonti.file}
        </label>
        <p className="mt-0.5 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {t.varausTuonti.fileHint}
        </p>
        <input
          id="tuonti-tiedosto"
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/plain"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void lue(file);
          }}
          className="mt-2 block w-full text-[13px]"
        />
        {fileName ? (
          <p
            className="mt-1.5 text-[12.5px]"
            style={{ color: "var(--rf-text-2)" }}
          >
            {fill(t.varausTuonti.fileRead, {
              nimi: fileName,
              rivit: String(Math.max(0, rows.length - 1)),
            })}
          </p>
        ) : null}
      </div>

      {/* --- 3. Sarakkeet --- */}
      {rows.length > 1 ? (
        <div>
          <h2 className="text-[15px] font-semibold">
            {t.varausTuonti.columnsTitle}
          </h2>
          <p
            className="mt-0.5 text-[12.5px]"
            style={{ color: "var(--rf-text-2)" }}
          >
            {t.varausTuonti.columnsHint}
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {kind === "reservations"
              ? VARAUS_KENTAT.map((kentta) => (
                  <ColumnPicker
                    key={kentta}
                    label={t.varausTuonti.fields[kentta]}
                    headers={headers}
                    value={varausMap[kentta]}
                    none={t.varausTuonti.columnNone}
                    onChange={(index) =>
                      setVarausMap((prev) => ({ ...prev, [kentta]: index }))
                    }
                  />
                ))
              : POYTA_KENTAT.map((kentta) => (
                  <ColumnPicker
                    key={kentta}
                    label={t.varausTuonti.fields[kentta]}
                    headers={headers}
                    value={poytaMap[kentta]}
                    none={t.varausTuonti.columnNone}
                    onChange={(index) =>
                      setPoytaMap((prev) => ({ ...prev, [kentta]: index }))
                    }
                  />
                ))}
          </div>
        </div>
      ) : null}

      {/* --- 4. Esikatselu --- */}
      {valmis ? (
        <div>
          <h2 className="text-[15px] font-semibold">
            {t.varausTuonti.previewTitle}
          </h2>
          <p
            className="mt-0.5 text-[12.5px]"
            style={{ color: "var(--rf-text-2)" }}
          >
            {fill(t.varausTuonti.previewCount, {
              kelpaa: String(valmis.rows.length),
              ohitetaan: String(valmis.problems.length),
            })}
          </p>

          {valmis.rows.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <tbody>
                  {valmis.rows.slice(0, 8).map((rivi, index) => (
                    <tr
                      key={index}
                      style={{ borderTop: "1px solid var(--rf-line)" }}
                    >
                      {kind === "reservations" ? (
                        <PreviewReservation row={rivi as ImportReservation} />
                      ) : (
                        <PreviewTable row={rivi as ImportTable} />
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {valmis.problems.length > 0 ? (
            <Problems t={t} problems={valmis.problems} />
          ) : null}

          <div className="mt-4 flex items-center gap-3">
            <Button
              type="button"
              tone="primary"
              onClick={tuo}
              disabled={busy || valmis.rows.length === 0}
            >
              {busy
                ? t.varausTuonti.importing
                : fill(t.varausTuonti.importAction, {
                    maara: String(valmis.rows.length),
                  })}
            </Button>

            {progress ? (
              <span
                className="rf-tabular text-[12.5px]"
                style={{ color: "var(--rf-text-2)" }}
              >
                {fill(t.varausTuonti.progress, {
                  tehty: String(progress.done),
                  kaikki: String(progress.all),
                })}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* --- 5. Tulos --- */}
      {result ? <Result t={t} result={result} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Osat
// ---------------------------------------------------------------------------

function ColumnPicker({
  label,
  headers,
  value,
  none,
  onChange,
}: {
  label: string;
  headers: string[];
  value: number | undefined;
  none: string;
  onChange: (index: number | undefined) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[12.5px] font-medium">{label}</span>
      <select
        value={value === undefined ? "" : String(value)}
        onChange={(event) =>
          onChange(event.target.value === "" ? undefined : Number(event.target.value))
        }
        className="mt-1 w-full px-3 py-2 text-[14px] outline-none"
        style={{
          background: "var(--rf-inset)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <option value="">{none}</option>
        {headers.map((header, index) => (
          <option key={`${header}-${index}`} value={index}>
            {header || `#${index + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}

function PreviewReservation({ row }: { row: ImportReservation }) {
  return (
    <>
      <td className="rf-tabular py-1.5 pr-3 whitespace-nowrap">
        {row.date} {row.time}
      </td>
      <td className="py-1.5 pr-3">{row.name}</td>
      <td className="rf-tabular py-1.5 pr-3">{row.partySize}</td>
      <td className="py-1.5 pr-3" style={{ color: "var(--rf-text-2)" }}>
        {row.tables?.join(", ") ?? ""}
      </td>
      <td className="py-1.5" style={{ color: "var(--rf-text-2)" }}>
        {row.allergies ?? ""}
      </td>
    </>
  );
}

function PreviewTable({ row }: { row: ImportTable }) {
  return (
    <>
      <td className="py-1.5 pr-3">{row.name}</td>
      <td className="rf-tabular py-1.5 pr-3">
        {row.seatsMin}–{row.seatsMax}
      </td>
      <td className="py-1.5" style={{ color: "var(--rf-text-2)" }}>
        {row.area ?? ""}
      </td>
    </>
  );
}

/**
 * Rivit joita ei tuoda.
 *
 * Rivinumero ja kenttä, ei "virhe tiedostossa". Tuhannen rivin
 * tiedostosta ei löydä puuttuvaa päivämäärää ilman rivinumeroa, ja
 * juuri se on ainoa asia jonka käyttäjä tästä listasta tarvitsee.
 */
function Problems({
  t,
  problems,
}: {
  t: AdminText;
  problems: RowProblem[];
}) {
  return (
    <div className="mt-3">
      <p className="text-[12.5px] font-semibold">
        {t.varausTuonti.problemsTitle}
      </p>
      <ul className="mt-1 space-y-0.5">
        {problems.slice(0, 12).map((problem) => (
          <li
            key={`${problem.line}-${problem.field}`}
            className="text-[12.5px]"
            style={{ color: "var(--rf-amber-text)" }}
          >
            {fill(t.varausTuonti.problemRow, {
              rivi: String(problem.line),
              kentta: t.varausTuonti.fields[
                problem.field as keyof AdminText["varausTuonti"]["fields"]
              ],
              arvo: problem.value || "—",
            })}
          </li>
        ))}
      </ul>

      {problems.length > 12 ? (
        <p className="mt-1 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {fill(t.varausTuonti.problemsMore, {
            maara: String(problems.length - 12),
          })}
        </p>
      ) : null}
    </div>
  );
}

function Result({ t, result }: { t: AdminText; result: ImportResult }) {
  const virheet = result.rows.filter((row) => !row.ok);
  const tuntemattomat = result.rows.filter((row) => row.unknownTables);

  return (
    <div
      role="status"
      className="p-4"
      style={{
        background: "var(--rf-inset)",
        borderRadius: "var(--rf-r-card)",
      }}
    >
      {result.error ? (
        <p className="text-[13px]" style={{ color: "var(--rf-red-text)" }}>
          {result.error}
        </p>
      ) : (
        <p className="text-[13px] font-semibold">
          {fill(t.varausTuonti.done, {
            lisatty: String(result.added),
            ohitettu: String(result.skipped),
            epaonnistui: String(result.failed),
          })}
        </p>
      )}

      {result.skipped > 0 ? (
        <p className="mt-1 text-[12.5px]" style={{ color: "var(--rf-text-2)" }}>
          {t.varausTuonti.skippedHint}
        </p>
      ) : null}

      {tuntemattomat.length > 0 ? (
        <p
          className="mt-1 text-[12.5px]"
          style={{ color: "var(--rf-amber-text)" }}
        >
          {fill(t.varausTuonti.unknownTables, {
            maara: String(tuntemattomat.length),
          })}
        </p>
      ) : null}

      {virheet.length > 0 ? (
        <ul className="mt-2 space-y-0.5">
          {virheet.slice(0, 12).map((rivi) => (
            <li
              key={rivi.row}
              className="text-[12.5px]"
              style={{ color: "var(--rf-amber-text)" }}
            >
              {fill(t.varausTuonti.failedRow, {
                rivi: String(rivi.row),
                syy: t.varausTuonti.reasons[
                  (rivi.error ?? "failed") as keyof AdminText["varausTuonti"]["reasons"]
                ],
              })}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

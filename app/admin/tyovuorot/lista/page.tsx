import Link from "next/link";
import { adminContext } from "@/lib/restoflow/page-context";
import { can } from "@/lib/restoflow/permissions";
import { ISO_MONTH } from "@/lib/restoflow/dates";
import { formatMonth } from "@/lib/restoflow/expenses";
import {
  ABSENCE_SHORT,
  buildRoster,
  formatPlannedHours,
  shiftLabel,
  weekdayName,
  type RosterCell,
  type RosterDay,
} from "@/lib/restoflow/roster";
import { publicationOf } from "@/lib/restoflow/shift-planning";
import { ABSENCE_LABELS, POSITION_LABELS } from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, EmptyState } from "@/components/restoflow/ui";
import { PrintButton } from "./print-button";
import { DayList } from "./day-list";

export const metadata = { title: "Työvuorolista" };

/**
 * Kuukauden työvuorolista.
 *
 * Ruudukko eikä aikajärjestyksessä oleva lista: työvuorosivulla on jo
 * jälkimmäinen, ja se vastaa kysymykseen "mitä seuraavaksi". Tämä
 * vastaa kysymykseen "kuka on töissä milloin" — sellaisena kuin se
 * kysytään kun listaa katsotaan seinältä tai jaetaan keittiöön.
 *
 * OMA SIVU, KOSKA SE TULOSTETAAN.
 *
 * Tulostettava näkymä ei voi olla osa sivua jolla on lomakkeita,
 * hälytyksiä ja vertailuja: paperille tulisi kaikki. Tässä on vain
 * lista, ja selaimen oma tulostus tekee siitä paperin tai PDF:n.
 */
export default async function RosterPage({
  searchParams,
}: PageProps<"/admin/tyovuorot/lista">) {
  const { users, shifts, openShifts, absences, month, role, restaurant } =
    await adminContext("/admin/tyovuorot");

  if (!can(role, "shifts.view.all")) return null;

  const params = await searchParams;
  const requested = typeof params.kuukausi === "string" ? params.kuukausi : month;
  const viewMonth = ISO_MONTH.test(requested) ? requested : month;

  const roster = buildRoster({
    month: viewMonth,
    users,
    shifts,
    openShifts,
    absences,
  });

  const people = roster.rows.filter((row) => row.user !== null).length;
  const shiftCount = roster.rows.reduce((sum, row) => sum + row.shiftCount, 0);
  const openCount = roster.rows.find((row) => row.user === null)?.shiftCount ?? 0;

  /*
   * Kaksi tapaa lukea sama aineisto.
   *
   * Työntekijöittäin vastaa kysymykseen paljonko kukin tekee,
   * päivittäin kysymykseen kuka on töissä huomenna. Molemmat
   * tulostetaan, ja kumpikaan ei korvaa toista.
   */
  const view = params.nakyma === "paivat" ? "paivat" : "tyontekijat";

  /*
   * Tulostuspäivä paperille.
   *
   * Palvelimella muotoiltuna, jotta paperilla on ravintolan päivä
   * eikä selaimen. Sekunnit jätetään pois: listaa ei tulosteta
   * kahdesti minuutin sisällä.
   */
  const printedAt = new Date().toLocaleString("fi-FI", {
    timeZone: restaurant.timezone,
    dateStyle: "short",
    timeStyle: "short",
  });

  const draftCount = shifts.filter(
    (shift) => shift.date.startsWith(viewMonth) && publicationOf(shift) === "draft",
  ).length;

  const usedAbsences = new Set(
    roster.rows.flatMap((row) =>
      row.cells.map((cell) => cell.absence).filter((kind) => kind !== null),
    ),
  );

  return (
    <div className="rf-enter rf-print rf-roster-page space-y-4">
      <div className="rf-no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/tyovuorot"
          className="rf-press inline-flex items-center gap-1.5 text-[13px] font-bold"
          style={{ color: "var(--rf-text-2)" }}
        >
          <RfIcon name="back" size={14} />
          Työvuorot
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-0.5 p-0.5"
            style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
          >
            <Valinta
              href={`/admin/tyovuorot/lista?kuukausi=${viewMonth}`}
              label="Työntekijöittäin"
              active={view === "tyontekijat"}
            />
            <Valinta
              href={`/admin/tyovuorot/lista?kuukausi=${viewMonth}&nakyma=paivat`}
              label="Päivittäin"
              active={view === "paivat"}
            />
          </div>

          <PrintButton />
        </div>
      </div>

      {/*
        Otsikko on paperilla, ei näytöllä.

        Näytöllä ravintolan nimi ja kuukausi ovat yläpalkissa, mutta
        yläpalkki ei tulostu. Ilman tätä paperilla olisi nimetön
        ruudukko, ja seinällä oleva lista jonka kuukautta ei tiedä on
        pahempi kuin ei listaa lainkaan.
      */}
      <div className="hidden print:block">
        <h1 className="text-[15px] font-bold">
          {restaurant.name} · Työvuorolista · {formatMonth(viewMonth)}
        </h1>
      </div>

      {roster.rows.length === 0 ? (
        <EmptyState
          title="Ei vuoroja tässä kuussa"
          description={`${formatMonth(viewMonth)} on tyhjä. Luo vuoroja työvuorosivulla, niin ne ilmestyvät tähän listaan.`}
        />
      ) : (
        <>
          <p className="text-[12.5px]" style={{ color: "var(--rf-text-2)" }}>
            {people} {people === 1 ? "työntekijä" : "työntekijää"} · {shiftCount}{" "}
            {shiftCount === 1 ? "vuoro" : "vuoroa"}
            {openCount > 0 ? ` · ${openCount} avointa` : ""} ·{" "}
            {formatPlannedHours(roster.plannedMinutes)} suunniteltua työaikaa
          </p>

          {/*
            Julkaisematon lista on luonnos myös paperilla.

            Seinälle päätyvä lista on lupaus. Jos osa vuoroista on
            julkaisematta, työntekijä lukee seinältä vuoron jota ei näy
            hänen omassa näkymässään — ja luottaa väärään lähteeseen.
          */}
          {draftCount > 0 ? (
            <p
              className="flex items-start gap-2 px-3.5 py-2.5 text-[12.5px] leading-relaxed"
              style={{
                background: "var(--rf-amber-bg)",
                color: "var(--rf-amber-text)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              <span className="mt-px shrink-0">
                <RfIcon name="alert" size={15} />
              </span>
              {draftCount} {draftCount === 1 ? "vuoro on" : "vuoroa on"} yhä
              luonnoksena eikä näy työntekijöille. Julkaise ne työvuorosivulla
              ennen kuin tulostat listan.
            </p>
          ) : null}

          {view === "paivat" ? (
            <Card padded={false} className="rf-print-section">
              <div className="overflow-x-auto print:overflow-visible">
                <DayList roster={roster} />
              </div>
            </Card>
          ) : (
          <Card padded={false} className="rf-print-section">
            <div className="overflow-x-auto print:overflow-visible">
              <table className="rf-roster w-full">
                <caption className="sr-only">
                  Työvuorot {formatMonth(viewMonth)}, työntekijät riveinä ja
                  päivät sarakkeina
                </caption>

                <thead>
                  <tr>
                    <th scope="col" className="rf-roster-name">
                      Työntekijä
                    </th>

                    {roster.days.map((day) => (
                      <DayHead key={day.date} day={day} />
                    ))}

                    <th scope="col" className="rf-roster-sum">
                      Yht.
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {roster.rows.map((row) => (
                    <tr key={row.user?.id ?? "avoin"}>
                      <th scope="row" className="rf-roster-name">
                        <span className="block truncate font-semibold">
                          {row.user?.name ?? "Avoimet vuorot"}
                        </span>
                        <span
                          className="block truncate text-[10.5px] font-normal"
                          style={{ color: "var(--rf-text-3)" }}
                        >
                          {row.user
                            ? row.user.position
                              ? POSITION_LABELS[row.user.position]
                              : ""
                            : "ei tekijää"}
                        </span>
                      </th>

                      {row.cells.map((cell, index) => (
                        <Cell
                          key={cell.date}
                          cell={cell}
                          day={roster.days[index]}
                          open={row.user === null}
                        />
                      ))}

                      <td className="rf-roster-sum rf-tabular">
                        {row.user === null ? "—" : formatPlannedHours(row.plannedMinutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/*
                  Miehitysrivi kertoo mitä listasta oikeasti haetaan:
                  minä päivänä on liian vähän väkeä. Avoimia vuoroja ei
                  lasketa mukaan — ne ovat nimenomaan puuttuvaa väkeä.
                */}
                <tfoot>
                  <tr>
                    <th scope="row" className="rf-roster-name">
                      <span className="block truncate font-semibold">Vuorossa</span>
                    </th>

                    {roster.perDay.map((count, index) => (
                      <td
                        key={roster.days[index].date}
                        className="rf-roster-cell rf-tabular"
                        style={{
                          background: roster.days[index].weekend
                            ? "var(--rf-inset)"
                            : undefined,
                          color: count === 0 ? "var(--rf-text-3)" : "var(--rf-text)",
                          fontWeight: count === 0 ? 400 : 600,
                        }}
                      >
                        {count === 0 ? "–" : count}
                      </td>
                    ))}

                    <td className="rf-roster-sum rf-tabular">
                      {formatPlannedHours(roster.plannedMinutes)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
          )}

          {/*
            Alatunniste vain paperille.

            Seinällä olevasta listasta on voitava nähdä milloin se on
            tulostettu: vanha lista näyttää samalta kuin uusi, ja
            väärää listaa luetaan niin kauan kuin se roikkuu seinällä.
          */}
          <p
            className="hidden text-[10px] print:block"
            style={{ color: "var(--rf-text-3)" }}
          >
            Luotu Katella {printedAt}
          </p>

          <p className="text-[11.5px] leading-relaxed rf-no-print" style={{ color: "var(--rf-text-3)" }}>
            Suunniteltu työaika, ei toteutunut eikä palkka. Toteutunut aika
            lasketaan leimauksista.
            {usedAbsences.size > 0 ? (
              <>
                {" "}
                Poissaolot:{" "}
                {[...usedAbsences]
                  .map((kind) => `${ABSENCE_SHORT[kind!]} = ${ABSENCE_LABELS[kind!].toLowerCase()}`)
                  .join(", ")}
                .
              </>
            ) : null}
          </p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Näkymän valinta linkkeinä.
 *
 * Ei painikkeita: valinta on osa osoitetta, joten tulostettavan
 * näkymän voi lähettää eteenpäin ja paluunappi toimii.
 */
function Valinta({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className="rf-press px-3 py-1.5 text-[12.5px] font-semibold"
      aria-current={active ? "page" : undefined}
      style={{
        background: active ? "var(--rf-card)" : "transparent",
        color: active ? "var(--rf-text)" : "var(--rf-text-2)",
        borderRadius: "calc(var(--rf-r-control) - 2px)",
        boxShadow: active ? "var(--rf-shadow-sm)" : undefined,
      }}
    >
      {label}
    </Link>
  );
}

function DayHead({ day }: { day: RosterDay }) {
  return (
    <th
      scope="col"
      className="rf-roster-cell"
      style={{ background: day.weekend ? "var(--rf-inset)" : undefined }}
    >
      <span className="block text-[10.5px]" style={{ color: "var(--rf-text-3)" }}>
        {weekdayName(day.weekday)}
      </span>
      <span className="rf-tabular block font-semibold">{day.day}</span>
    </th>
  );
}

function Cell({
  cell,
  day,
  open,
}: {
  cell: RosterCell;
  day: RosterDay;
  open: boolean;
}) {
  const empty = cell.shifts.length === 0 && cell.absence === null;

  return (
    <td
      className="rf-roster-cell"
      style={{ background: day.weekend ? "var(--rf-inset)" : undefined }}
    >
      {empty ? (
        <span aria-hidden="true" style={{ color: "var(--rf-line-strong)" }}>
          ·
        </span>
      ) : null}

      {cell.shifts.map((shift, index) => (
        <span
          key={index}
          className="rf-tabular block"
          style={{
            /*
             * Kieltäytyminen yliviivataan.
             *
             * Vuoro on yhä listalla koska se on aukko joka pitää
             * täyttää, mutta se ei ole kenenkään työvuoro. Yliviivaus
             * kertoo sen myös mustavalkoisella paperilla, jolla väri
             * ei erotu.
             */
            textDecoration: shift.status === "declined" ? "line-through" : undefined,
            color: open
              ? "var(--rf-red-text)"
              : shift.status === "declined"
                ? "var(--rf-text-3)"
                : undefined,
            fontWeight: shift.status === "declined" ? 400 : 600,
          }}
        >
          {shiftLabel(shift)}
        </span>
      ))}

      {cell.absence ? (
        <span
          className="block text-[10px] font-bold"
          style={{ color: "var(--rf-amber-text)" }}
          title={ABSENCE_LABELS[cell.absence]}
        >
          {ABSENCE_SHORT[cell.absence]}
        </span>
      ) : null}
    </td>
  );
}

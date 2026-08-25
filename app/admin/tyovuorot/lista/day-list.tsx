import {
  ABSENCE_SHORT,
  shiftLabel,
  weekdayName,
  type Roster,
} from "@/lib/restoflow/roster";
import { ABSENCE_LABELS } from "@/lib/restoflow/types";

/**
 * Työvuorolista päivittäin.
 *
 * Toinen tapa lukea sama aineisto: rivi per päivä, ja rivillä kaikki
 * jotka ovat töissä. Työntekijäkohtainen ruudukko vastaa kysymykseen
 * "paljonko kukin tekee"; tämä vastaa kysymykseen "kuka on töissä
 * huomenna" — ja juuri se kysytään keittiön ovelta.
 *
 * Paperilla tämä on ruudukkoa luettavampi silloin kun väkeä on
 * paljon: ruudukon sarake kapenee jokaisesta työntekijästä, mutta
 * päivärivi vain pitenee.
 */
export function DayList({ roster }: { roster: Roster }) {
  return (
    <table className="rf-table w-full">
      <caption className="sr-only">Työvuorot päivittäin</caption>

      <thead>
        <tr>
          <th scope="col" style={{ width: "7.5rem" }}>
            Päivä
          </th>
          <th scope="col">Vuorossa</th>
          <th scope="col" className="text-right" style={{ width: "4.5rem" }}>
            Väkeä
          </th>
        </tr>
      </thead>

      <tbody>
        {roster.days.map((day, index) => {
          const rows = roster.rows
            .map((row) => ({ row, cell: row.cells[index] }))
            .filter((entry) => entry.cell.shifts.length > 0 || entry.cell.absence !== null);

          return (
            <tr
              key={day.date}
              className="rf-row"
              style={{ background: day.weekend ? "var(--rf-inset)" : undefined }}
            >
              <th scope="row" className="text-left">
                <span className="rf-tabular text-[13px] font-semibold">
                  {weekdayName(day.weekday)} {day.day}.
                </span>
              </th>

              <td>
                {rows.length === 0 ? (
                  <span className="text-[13px]" style={{ color: "var(--rf-text-3)" }}>
                    —
                  </span>
                ) : (
                  <span className="flex flex-wrap gap-x-4 gap-y-1">
                    {rows.map(({ row, cell }) => (
                      <span key={row.user?.id ?? "avoin"} className="text-[13px]">
                        <span className="font-medium">
                          {row.user?.name.split(" ")[0] ?? "Avoin"}
                        </span>{" "}
                        <span className="rf-tabular" style={{ color: "var(--rf-text-2)" }}>
                          {cell.shifts.map((shift) => shiftLabel(shift)).join(", ")}
                        </span>
                        {cell.absence ? (
                          <span
                            className="ml-1 text-[11px] font-bold"
                            style={{ color: "var(--rf-amber-text)" }}
                            title={ABSENCE_LABELS[cell.absence]}
                          >
                            {ABSENCE_SHORT[cell.absence]}
                          </span>
                        ) : null}
                      </span>
                    ))}
                  </span>
                )}
              </td>

              <td className="rf-tabular text-right">
                {roster.perDay[index] === 0 ? "–" : roster.perDay[index]}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

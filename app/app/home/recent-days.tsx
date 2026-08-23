import Link from "next/link";
import { timeIn } from "@/lib/restoflow/clock-context";
import { formatDuration, type DaySummary } from "@/lib/restoflow/timeclock";
import { RfIcon } from "@/components/restoflow/icons";

/**
 * Viimeisimmät leimaukset.
 *
 * Lista eikä korttipino: kolme päivää kolmessa laatikossa näyttäisi
 * kolmelta asialta, vaikka ne ovat yhden asian kolme riviä. Erottimet
 * riittävät.
 *
 * Päivät tulevat samasta koontifunktiosta kuin työaikanäkymässä. Kaksi
 * ryhmittelyä samasta datasta ehtii ajautua erilleen.
 */
export function RecentDays({
  days,
  timezone,
}: {
  days: DaySummary[];
  timezone: string;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4 px-1">
        <h2
          className="text-[12px] font-semibold uppercase"
          style={{ letterSpacing: "0.07em", color: "var(--rf-text-3)" }}
        >
          Viimeisimmät leimaukset
        </h2>

        {days.length > 0 ? (
          <Link
            href="/app/tyoaika"
            className="rf-press rf-hit inline-flex items-center gap-1 text-[13px] font-medium"
            style={{ color: "var(--rf-blue)" }}
          >
            Näytä kaikki
            <RfIcon name="chevron" size={13} />
          </Link>
        ) : null}
      </div>

      {days.length === 0 ? (
        <p
          className="mt-2 px-1 text-[13px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          Työaikasi näkyvät täällä, kun olet tehnyt ensimmäisen leimauksen.
        </p>
      ) : (
        <ul className="mt-1.5">
          {days.map((day) => (
            <li
              key={day.date}
              className="flex items-center justify-between gap-4 border-b py-3 last:border-0"
              style={{ borderColor: "var(--rf-line)" }}
            >
              <div className="min-w-0">
                <p className="text-[14px] font-medium">{dayLabel(day.date)}</p>
                <p className="rf-tabular mt-0.5 text-[13px]" style={{ color: "var(--rf-text-3)" }}>
                  {day.firstIn ? timeIn(timezone, day.firstIn) : "—"}
                  {" → "}
                  {day.lastOut ? timeIn(timezone, day.lastOut) : "?"}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="rf-tabular text-[14px] font-semibold" suppressHydrationWarning>
                  {formatDuration(day.workedMs)}
                </p>
                {/*
                  Auki jäänyt päivä sanotaan ääneen. Kesto kasvaa niin
                  kauan kuin leimaus on auki, eikä lukua saa esittää
                  valmiina työaikana.
                */}
                {day.open ? (
                  <p className="mt-0.5 text-[11px]" style={{ color: "var(--rf-amber-text)" }}>
                    Uloskirjaus puuttuu
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const DAYS = ["Su", "Ma", "Ti", "Ke", "To", "Pe", "La"];

/** "Ma 24.8." */
function dayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}

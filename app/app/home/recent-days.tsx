import Link from "next/link";
import { timeIn } from "@/lib/restoflow/clock-context";
import { formatDuration, type DaySummary } from "@/lib/restoflow/timeclock";
import { RfIcon } from "@/components/restoflow/icons";
import { SectionTitle, Tag, shortDay } from "../ui";

/**
 * Viimeisimmät leimaukset.
 *
 * Lista eikä korttipino: kolme päivää kolmessa laatikossa näyttäisi
 * kolmelta asialta, vaikka ne ovat yhden asian kolme riviä. Erottimet
 * riittävät.
 *
 * Päivät tulevat samasta koontifunktiosta kuin Työaika-sivun historia.
 * Kaksi ryhmittelyä samasta datasta ehtii ajautua erilleen.
 */
export function RecentDays({
  days,
  timezone,
  today,
}: {
  days: DaySummary[];
  timezone: string;
  today: string;
}) {
  return (
    <section className="space-y-1.5">
      <SectionTitle
        action={
          days.length > 0 ? (
            <Link
              href="/app/tyoaika"
              className="rf-press rf-hit inline-flex items-center gap-1 text-[13px] font-medium"
              style={{ color: "var(--rf-blue)" }}
            >
              Näytä kaikki
              <RfIcon name="chevron" size={13} />
            </Link>
          ) : undefined
        }
      >
        Viimeisimmät leimaukset
      </SectionTitle>

      {days.length === 0 ? (
        <p
          className="px-1 text-[13px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          Työaikasi näkyvät täällä, kun olet tehnyt ensimmäisen leimauksen.
        </p>
      ) : (
        <ul className="px-1">
          {days.map((day) => (
            <li
              key={day.date}
              className="flex items-center justify-between gap-4 border-b py-3 last:border-0"
              style={{ borderColor: "var(--rf-line)" }}
            >
              <div className="min-w-0">
                <p className="text-[14px] font-medium">{shortDay(day.date)}</p>
                <p className="rf-tabular mt-0.5 text-[13px]" style={{ color: "var(--rf-text-3)" }}>
                  {day.firstIn ? timeIn(timezone, day.firstIn) : "—"}
                  {" → "}
                  {day.open ? "nyt" : day.lastOut ? timeIn(timezone, day.lastOut) : "?"}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="rf-tabular text-[14px] font-semibold" suppressHydrationWarning>
                  {formatDuration(day.workedMs)}
                </p>
                {/*
                  Käynnissä oleva päivä ja unohtunut leimaus ovat eri
                  asioita. Tänään auki oleva työaika on normaali tila;
                  eilinen auki jäänyt on virhe.
                */}
                {day.open ? (
                  <span className="mt-1 inline-block">
                    {day.date === today ? (
                      <Tag tone="ok">Käynnissä</Tag>
                    ) : (
                      <Tag tone="warn">Uloskirjaus puuttuu</Tag>
                    )}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

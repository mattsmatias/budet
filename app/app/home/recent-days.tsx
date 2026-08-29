import Link from "next/link";
import { timeIn } from "@/lib/restoflow/clock-context";
import { formatDuration, type DaySummary } from "@/lib/restoflow/timeclock";
import { RfIcon } from "@/components/restoflow/icons";
import { SectionTitle, Tag, shortDay } from "../ui";
import type { AppLocale } from "@/lib/i18n/app-locales";
import type { WorkerText } from "@/lib/i18n/worker-text";

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
  t,
  locale,
}: {
  days: DaySummary[];
  timezone: string;
  today: string;
  t: WorkerText;
  locale: AppLocale;
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
              {t.yleinen.showAll}
              <RfIcon name="chevron" size={13} />
            </Link>
          ) : undefined
        }
      >
        {t.koti.recentStamps}
      </SectionTitle>

      {days.length === 0 ? (
        <p
          className="px-1 text-[13px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          {t.koti.noStampsYet}
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
                <p className="text-[14px] font-medium">
                  {shortDay(day.date, locale)}
                </p>
                <p
                  className="rf-tabular mt-0.5 text-[13px]"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  {day.firstIn ? timeIn(timezone, day.firstIn) : "—"}
                  {" → "}
                  {day.open
                    ? day.stale
                      ? "?"
                      : "nyt"
                    : day.lastOut
                      ? timeIn(timezone, day.lastOut)
                      : "?"}
                </p>
              </div>

              <div className="shrink-0 text-right">
                {/*
                  Unohtuneen päivän kestoa ei tiedetä. Kasvava luku
                  väittäisi että työ jatkuu yhä.
                */}
                <p
                  className="rf-tabular text-[14px] font-semibold"
                  suppressHydrationWarning
                >
                  {day.stale ? "—" : formatDuration(day.workedMs)}
                </p>
                {/*
                  Käynnissä oleva päivä ja unohtunut leimaus ovat eri
                  asioita. Tänään auki oleva työaika on normaali tila;
                  eilinen auki jäänyt on virhe.
                */}
                {day.open ? (
                  <span className="mt-1 inline-block">
                    {day.date === today ? (
                      <Tag tone="ok">{t.yleinen.running}</Tag>
                    ) : (
                      <Tag tone="warn">{t.yleinen.missingOut}</Tag>
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

import type { AdminText } from "@/lib/i18n/admin-text";
import type { AppLocale } from "@/lib/i18n/app-locales";
import { fill } from "@/lib/i18n/auth-text";
import {
  dayCountIn,
  guestCountIn,
  reservationCountIn,
  weekdayByNumberIn,
} from "@/lib/i18n/labels";
import { decimal, integer, percent } from "@/lib/i18n/format";
import {
  busiestHours,
  busiestWeekdays,
  occupancyForWeekday,
  perOpenDay,
  type ReservationStats,
  type StatFinding,
} from "@/lib/restoflow/reservation-stats";

/**
 * Analytiikan osiot.
 *
 * Palvelinkomponentteja: sivulla ei ole mitään mitä painetaan.
 * Kuukausi vaihdetaan yläpalkin valitsimesta, ja se on osoite eikä
 * tila.
 *
 * Palkit ovat div-elementtejä eivätkä kaaviokirjastoa. Kaksitoista
 * riviä lukuja ei tarvitse kolmeasataa kilotavua, ja teksti luvun
 * vieressä kertoo saman minkä palkin pituus — myös silloin kun sivu
 * luetaan ruudunlukijalla.
 */

// ---------------------------------------------------------------------------
// Palkkirivi
// ---------------------------------------------------------------------------

function Bar({
  label,
  value,
  share,
  meta,
  muted,
}: {
  label: string;
  /** Luku valmiiksi muotoiltuna. */
  value: string;
  /** Osuus suurimmasta, 0–1. */
  share: number;
  meta?: string;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[14px] font-medium">{label}</span>
        <span className="rf-tabular text-[14px] font-semibold">{value}</span>
      </div>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden"
        style={{ background: "var(--rf-inset)", borderRadius: 999 }}
      >
        <div
          className="h-full"
          style={{
            /* Nollakin näkyy viivana: tyhjä rivi näyttäisi puuttuvalta. */
            width: `${Math.max(1.5, share * 100)}%`,
            background: "var(--rf-text)",
            borderRadius: 999,
            opacity: muted ? 0.32 : 0.82,
          }}
        />
      </div>
      {meta ? (
        <p
          className="rf-tabular mt-1.5 text-[12px]"
          style={{ color: "var(--rf-text-3)" }}
        >
          {meta}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suosituimmat ajat
// ---------------------------------------------------------------------------

export function HourBars({
  locale,
  stats,
}: {
  locale: AppLocale;
  stats: ReservationStats;
}) {
  const rivit = busiestHours(stats, 24);
  if (rivit.length === 0) return null;

  /* Suhteutus suurimpaan eikä summaan: vertailu on tuntien välinen. */
  const suurin = Math.max(...rivit.map((row) => row.reservations));

  return (
    <div className="space-y-3.5">
      {[...rivit]
        .sort((a, b) => a.hour - b.hour)
        .map((row) => (
          <Bar
            key={row.hour}
            label={`${String(row.hour).padStart(2, "0")}:00`}
            value={integer(row.reservations, locale)}
            share={row.reservations / suurin}
            meta={guestCountIn(row.guests, locale)}
          />
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suosituimmat päivät
// ---------------------------------------------------------------------------

export function WeekdayBars({
  t,
  locale,
  stats,
}: {
  t: AdminText;
  locale: AppLocale;
  stats: ReservationStats;
}) {
  const rivit = busiestWeekdays(stats, 7);
  if (rivit.length === 0) return null;

  const suurin = Math.max(...rivit.map((row) => perOpenDay(row) ?? 0));

  return (
    <div className="space-y-3.5">
      {[...rivit]
        .sort((a, b) => a.weekday - b.weekday)
        .map((row) => {
          const keskiarvo = perOpenDay(row) ?? 0;

          return (
            <Bar
              key={row.weekday}
              label={weekdayByNumberIn(row.weekday, locale, "long")}
              value={fill(t.varausTilasto.perDay, {
                maara: decimal(keskiarvo, locale, 1),
              })}
              share={suurin > 0 ? keskiarvo / suurin : 0}
              meta={guestCountIn(row.guests, locale)}
            />
          );
        })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Täyttöaste
// ---------------------------------------------------------------------------

/**
 * Ruudukko: viikonpäivät riveinä, aukiolotunnit sarakkeina.
 *
 * Väri on yksi sävy eri vahvuuksilla eikä liukuma vihreästä punaiseen.
 * Täysi sali ei ole hälytys eikä tyhjä sali virhe — molemmat ovat
 * lukuja, ja liikennevalot väittäisivät muuta.
 *
 * Prosentti on luettavissa jokaisesta ruudusta. Pelkkä väri katoaa
 * tulostettaessa ja osalta lukijoista aina.
 */
export function OccupancyGrid({
  t,
  locale,
  stats,
}: {
  t: AdminText;
  locale: AppLocale;
  stats: ReservationStats;
}) {
  if (stats.capacity.seats <= 0) {
    return (
      <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {t.varausTilasto.occupancyNoTables}
      </p>
    );
  }

  if (stats.occupancy.length === 0) {
    return (
      <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {t.varausTilasto.occupancyNoHours}
      </p>
    );
  }

  const tunnit = [...new Set(stats.occupancy.map((row) => row.hour))].sort(
    (a, b) => a - b,
  );
  const paivat = [...new Set(stats.occupancy.map((row) => row.weekday))].sort(
    (a, b) => a - b,
  );

  return (
    <div className="-mx-[18px] overflow-x-auto px-[18px]">
      <table className="w-full border-separate border-spacing-[3px] text-[12px]">
        <thead>
          <tr>
            <th className="sr-only">{t.varausTilasto.occupancyTitle}</th>
            {tunnit.map((hour) => (
              <th
                key={hour}
                scope="col"
                className="rf-tabular px-1 pb-1 text-center font-medium"
                style={{ color: "var(--rf-text-3)" }}
              >
                {String(hour).padStart(2, "0")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paivat.map((weekday) => {
            const rivi = occupancyForWeekday(stats, weekday);

            return (
              <tr key={weekday}>
                <th
                  scope="row"
                  className="whitespace-nowrap pr-2 text-left text-[12.5px] font-medium"
                >
                  {weekdayByNumberIn(weekday, locale, "short")}
                </th>
                {tunnit.map((hour) => {
                  const solu = rivi.find((row) => row.hour === hour);

                  /* Tunti jolloin ei oltu auki: tyhjä, ei nolla. */
                  if (!solu) {
                    return (
                      <td
                        key={hour}
                        className="px-1 py-1.5 text-center"
                        style={{
                          background: "var(--rf-inset)",
                          borderRadius: 6,
                          color: "var(--rf-text-3)",
                          opacity: 0.5,
                        }}
                      >
                        –
                      </td>
                    );
                  }

                  const aste = solu.seats / stats.capacity.seats;

                  return (
                    <td
                      key={hour}
                      className="rf-tabular px-1 py-1.5 text-center font-semibold"
                      style={{
                        background: "var(--rf-accent-bg)",
                        /*
                         * Vähintään hiukan näkyvä myös nollassa, jotta
                         * aukiolotunti erottuu suljetusta.
                         */
                        opacity: 0.25 + Math.min(1, aste) * 0.75,
                        borderRadius: 6,
                        color: "var(--rf-accent-strong)",
                      }}
                      title={`${weekdayByNumberIn(weekday, locale, "long")} ${String(
                        hour,
                      ).padStart(2, "0")}:00 · ${percent(aste, locale, 0)}`}
                    >
                      {percent(aste, locale, 0)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Havainnot
// ---------------------------------------------------------------------------

/** Kellonaika havainnon tunnista. */
function kello(hour: number | undefined): string {
  return `${String(hour ?? 0).padStart(2, "0")}:00`;
}

/**
 * Havainto lauseeksi.
 *
 * Lause kootaan käännöksestä ja luvusta. Sitä ei kirjoiteta valmiiksi
 * missään, koska silloin luku ja lause voisivat erota toisistaan.
 */
function havaintoTeksti(
  havainto: StatFinding,
  t: AdminText,
  locale: AppLocale,
): string {
  const osuus = percent(havainto.value, locale, 0);
  const paiva =
    havainto.weekday === undefined
      ? ""
      : weekdayByNumberIn(havainto.weekday, locale, "long");

  switch (havainto.kind) {
    case "peak":
      return fill(t.varausTilasto.peak, {
        paiva,
        alku: kello(havainto.fromHour),
        loppu: kello(havainto.toHour),
        osuus,
      });
    case "quiet":
      return fill(t.varausTilasto.quiet, {
        paiva,
        alku: kello(havainto.fromHour),
        osuus,
      });
    case "noShow":
      return fill(t.varausTilasto.noShowFinding, { osuus });
    case "cancelled":
      return fill(t.varausTilasto.cancelledFinding, { osuus });
    case "online":
      return fill(t.varausTilasto.onlineFinding, { osuus });
    case "party":
      return fill(t.varausTilasto.partyFinding, {
        maara: decimal(havainto.value, locale, 1),
      });
  }
}

/** Mihin havainto perustuu. Ilman tätä se olisi mielipide. */
function havaintoPeruste(
  havainto: StatFinding,
  t: AdminText,
  locale: AppLocale,
): string {
  return havainto.kind === "peak" || havainto.kind === "quiet"
    ? dayCountIn(havainto.sample, locale)
    : reservationCountIn(havainto.sample, locale);
}

const SAVYT: Record<StatFinding["tone"], string> = {
  good: "var(--rf-green)",
  neutral: "var(--rf-text-3)",
  watch: "var(--rf-amber)",
};

export function Findings({
  t,
  locale,
  findings,
}: {
  t: AdminText;
  locale: AppLocale;
  findings: StatFinding[];
}) {
  if (findings.length === 0) {
    return (
      <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {t.varausTilasto.findingsEmpty}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {findings.map((havainto) => (
        <li key={havainto.id} className="flex gap-2.5">
          <span
            aria-hidden="true"
            className="mt-[7px] h-1.5 w-1.5 shrink-0"
            style={{
              background: SAVYT[havainto.tone],
              borderRadius: 999,
            }}
          />
          <div className="min-w-0">
            <p className="text-[13.5px]">
              {havaintoTeksti(havainto, t, locale)}
            </p>
            <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
              {havaintoPeruste(havainto, t, locale)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Lähteet
// ---------------------------------------------------------------------------

export function SourceBars({
  t,
  locale,
  stats,
}: {
  t: AdminText;
  locale: AppLocale;
  stats: ReservationStats;
}) {
  if (stats.bySource.length === 0) return null;

  const yhteensa = stats.bySource.reduce((sum, row) => sum + row.count, 0);
  if (yhteensa <= 0) return null;

  const nimet: Record<string, string> = {
    admin: t.varausTilasto.sourceAdmin,
    widget: t.varausTilasto.sourceWidget,
    link: t.varausTilasto.sourceLink,
    walk_in: t.varausTilasto.sourceWalkIn,
  };

  return (
    <div className="space-y-3.5">
      {stats.bySource.map((row) => (
        <Bar
          key={row.source}
          label={nimet[row.source] ?? t.varausTilasto.sourceOther}
          value={integer(row.count, locale)}
          share={row.count / yhteensa}
          meta={percent(row.count / yhteensa, locale, 0)}
        />
      ))}
    </div>
  );
}

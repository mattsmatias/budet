import Link from "next/link";
import { employeeContext } from "@/lib/restoflow/page-context";
import {
  fetchClockEvents,
  fetchPayComponents,
  fetchShifts,
  fetchTimeCorrections,
} from "@/lib/restoflow/queries";
import { buildPayslip, monthPeriod } from "@/lib/restoflow/payroll";
import { formatHours } from "@/lib/restoflow/payroll-data";
import { formatDuration } from "@/lib/restoflow/timeclock";
import { formatMonth } from "@/lib/restoflow/expenses";
import { windowStartIso } from "@/lib/restoflow/clock-context";
import { formatMoney } from "@/lib/money";
import { RfIcon } from "@/components/restoflow/icons";
import { resolveLocale } from "@/lib/i18n/resolve";
import { workerText } from "@/lib/i18n/worker-text";
import { PageHeader, Surface } from "../ui";
import type { User } from "@/lib/restoflow/types";

export const metadata = { title: "Palkkani" };

/**
 * Työntekijän oma palkkakertymä.
 *
 * Sama laskenta kuin esihenkilön näkymässä, samasta moottorista. Kaksi
 * laskentaa tarkoittaisi että työntekijälle ja työnantajalle voi näkyä
 * eri summa, ja se on juuri se riita jota kukaan ei halua.
 *
 * RLS rajaa aineiston: työntekijä näkee omat leimauksensa, omat
 * vuoronsa ja omaa työaikaansa koskevat korjaukset. Muiden palkka ei
 * tule tänne edes vahingossa.
 */
export default async function MyPayPage() {
  const { user, restaurant, month, now } = await employeeContext("/app/palkka");
  const t = workerText(await resolveLocale());

  const period = monthPeriod(month);

  /*
   * Leimaukset haetaan kuukauden alusta, ei jaetusta kontekstista.
   *
   * Konteksti antaa ne viikon alusta, mikä riittää etusivulle mutta ei
   * tähän: maanantaina kuukauden aiemmat päivät olisivat kadonneet
   * palkkakertymästä äänettömästi. Kuukauden summa on haettava
   * kuukauden ajalta.
   */
  const [events, shifts, corrections, components] = await Promise.all([
    fetchClockEvents(restaurant.id, windowStartIso(period.startsOn)),
    fetchShifts(restaurant.id),
    fetchTimeCorrections(restaurant.id, period.startsOn, period.endsOn),
    fetchPayComponents(restaurant.id),
  ]);

  const clockEvents = events.filter((e) => e.userId === user.id);

  /*
   * Käyttäjä rakennetaan istunnosta eikä jäsenlistasta.
   *
   * fetchUsers hakisi koko ravintolan henkilöstön vain yhden
   * tuntipalkan takia. Oma tuntipalkka on jo istunnossa.
   */
  const me: User = {
    id: user.id,
    restaurantId: restaurant.id,
    name: user.fullName ?? user.email ?? t.palkka.me,
    role: restaurant.role,
    position: restaurant.position,
    hourlyRateCents: restaurant.hourlyRateCents,
    initials: "",
    active: true,
  };

  const slip = buildPayslip({
    user: me,
    from: period.startsOn,
    to: period.endsOn,
    events: clockEvents,
    shifts,
    corrections,
    components,
    nowIso: now,
    timezone: restaurant.timezone,
  });

  const supplements = new Map<string, { name: string; cents: number; minutes: number }>();
  for (const line of slip.lines) {
    if (line.componentId === null) continue;
    const row = supplements.get(line.componentId) ?? {
      name: line.description,
      cents: 0,
      minutes: 0,
    };
    row.cents += line.amountCents;
    row.minutes += line.minutes;
    supplements.set(line.componentId, row);
  }

  const days = slip.lines.filter((l) => l.componentId === null);

  return (
    <div className="rf-enter space-y-6">
      <PageHeader title={t.lisatiedot.payTitle} subtitle={formatMonth(month)} />

      <Surface>
        <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {t.palkka.accrued}
        </p>
        <p className="rf-tabular mt-1 text-[34px] font-semibold tracking-tight">
          {formatMoney(slip.grossCents)}
        </p>
        <p className="mt-1 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
          {formatHours(slip.workedMinutes)}
          {restaurant.hourlyRateCents
            ? ` · ${formatMoney(restaurant.hourlyRateCents)} / h`
            : ""}
        </p>

        {supplements.size > 0 ? (
          <dl className="mt-4 space-y-1.5 border-t pt-4" style={{ borderColor: "var(--rf-line)" }}>
            <div className="flex justify-between text-[13px]">
              <dt style={{ color: "var(--rf-text-2)" }}>{t.palkka.basePay}</dt>
              <dd className="rf-tabular">{formatMoney(slip.baseCents)}</dd>
            </div>
            {[...supplements.values()].map((row) => (
              <div key={row.name} className="flex justify-between text-[13px]">
                <dt style={{ color: "var(--rf-text-2)" }}>
                  {row.name} · {formatHours(row.minutes)}
                </dt>
                <dd className="rf-tabular">{formatMoney(row.cents)}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <p className="mt-4 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
          {t.lisatiedot.payDisclaimer}
        </p>
      </Surface>

      {slip.issues.length > 0 ? (
        <Surface>
          <h2 className="text-[15px] font-semibold">{t.palkka.toCheck}</h2>
          <ul className="mt-2 space-y-2">
            {slip.issues.map((issue, index) => (
              <li key={index} className="flex items-start gap-2.5 text-[13px] leading-relaxed">
                <span style={{ color: "var(--rf-amber-text)" }}>
                  <RfIcon name="alert" size={15} />
                </span>
                {issue.message}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
            {t.lisatiedot.payIssuesNote}
          </p>
        </Surface>
      ) : null}

      <section>
        <Surface padded={false}>
          <div className="px-5 pt-5">
            <h2 className="text-[15px] font-semibold">{t.palkka.days}</h2>
            <p className="mt-1 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
              {t.palkka.fromStamps}
            </p>
          </div>

          {days.length === 0 ? (
            <p className="px-5 pt-3 pb-5 text-[13px]" style={{ color: "var(--rf-text-3)" }}>
              {t.palkka.empty}
            </p>
          ) : (
            <ul className="mt-3 divide-y" style={{ borderColor: "var(--rf-line)" }}>
              {days.map((line) => (
                <li key={line.date} className="flex items-baseline justify-between gap-3 px-5 py-3">
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium">{fi(line.date)}</span>
                    <span className="block text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                      {line.description} · {formatDuration(line.minutes * 60000)}
                    </span>
                  </span>
                  <span className="rf-tabular shrink-0 text-[14px] font-semibold">
                    {formatMoney(line.amountCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </section>

      <Link
        href="/app/lisaa"
        className="rf-press rf-hit inline-flex items-center gap-1.5 px-1 text-[13px] font-medium"
        style={{ color: "var(--rf-text-2)" }}
      >
        <RfIcon name="back" size={15} />
        Takaisin
      </Link>
    </div>
  );
}

/** "2026-08-24" → "24.8." */
function fi(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(d)}.${Number(m)}.`;
}

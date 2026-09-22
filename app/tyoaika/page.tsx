import { redirect } from "next/navigation";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { LOCALE_INFO } from "@/lib/i18n/app-locales";
import { requireContext } from "@/lib/restoflow/session";
import { can, landingFor } from "@/lib/restoflow/permissions";
import { monthRange } from "@/lib/restoflow/dates";
import { monthIn } from "@/lib/restoflow/local-time";
import {
  fetchEmployees,
  fetchMyEmployeeId,
  fetchTimeEntries,
} from "@/lib/restoflow/queries";
import {
  formatClock,
  formatHours,
  fullName,
  openEntry,
  estimatedPayCents,
  totalMinutes,
} from "@/lib/restoflow/employees";
import { fill } from "@/lib/i18n/auth-text";
import { formatMoney } from "@/lib/money";
import { formatDayIn } from "@/lib/i18n/labels";
import { Card, EmptyState, Pill } from "@/components/restoflow/ui";
import { signOut } from "@/app/(auth)/actions";
import { ClockButton } from "./clock";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.tyo.timeTitle };
}

/**
 * Työntekijän oma työaika.
 *
 * Hallinnan ulkopuolella eikä sen sisällä: työntekijä ei näe yrityksen
 * taloutta, joten hän ei myöskään näe sen valikkoa. Sivulla on yksi
 * painike ja omat luvut — ei mitään muuta.
 *
 * OMAT TIEDOT, EI KENENKÄÄN MUUN.
 *
 * Rivien rajaus tulee kannasta: työntekijä näkee vain omat leimauksensa
 * ja oman rivinsä. Tämä sivu ei suodata mitään pois — se näyttää sen
 * mitä kanta antaa, ja kanta antaa vain omat.
 */
export default async function TimeClockPage() {
  const { restaurant, role, user } = await requireContext("/tyoaika");

  const locale = await resolveLocale();
  const t = adminText(locale);
  const tag = LOCALE_INFO[locale].tag;

  if (!can(role, "timeclock.use")) redirect(landingFor(role));

  const month = monthIn(restaurant.timezone);
  const { from } = monthRange(month);

  const employeeId = await fetchMyEmployeeId(restaurant.id);

  /*
   * Ilman työntekijäriviä ei ole mitään leimattavaa.
   *
   * Tunnus voi olla olemassa ennen kuin omistaja on lisännyt henkilön
   * työntekijäksi. Tyhjä painike joka antaa virheen jokaisella
   * painalluksella olisi huonompi kuin lause joka kertoo mitä puuttuu.
   */
  if (employeeId === null) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <EmptyState
          title={t.tyo.notEmployee}
          description={t.tyo.notEmployeeHint}
        />
        <form action={signOut} className="mt-6 text-center">
          <button
            type="submit"
            className="rf-press text-[13px] font-semibold underline-offset-4 hover:underline"
            style={{ color: "var(--rf-text-2)" }}
          >
            {t.kuori.signOut}
          </button>
        </form>
      </main>
    );
  }

  const [employees, entries] = await Promise.all([
    fetchEmployees(restaurant.id),
    fetchTimeEntries(restaurant.id, from),
  ]);

  const me = employees.find((e) => e.id === employeeId) ?? null;
  const mine = entries.filter((e) => e.employeeId === employeeId);

  const open = openEntry(mine);
  const minutes = totalMinutes(mine.filter((e) => e.date.startsWith(month)));
  const payCents = estimatedPayCents(minutes, me?.hourlyCents ?? 0);

  const done = mine.filter((e) => e.clockOut !== null).slice(0, 10);

  return (
    <main className="mx-auto w-full max-w-md space-y-5 px-4 py-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] font-bold tracking-[-0.02em]">
            {t.tyo.timeTitle}
          </h1>
          <p
            className="truncate text-[13px]"
            style={{ color: "var(--rf-text-3)" }}
          >
            {me ? fullName(me) : (user.fullName ?? "")} · {restaurant.name}
          </p>
        </div>

        <Pill tone={open ? "ok" : "neutral"} dot={Boolean(open)}>
          {open ? t.tyo.onShift : t.tyo.offShift}
        </Pill>
      </header>

      {open ? (
        <p className="text-center text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {fill(t.tyo.since, {
            aika: formatClock(open.clockIn, restaurant.timezone),
          })}
        </p>
      ) : null}

      <ClockButton t={t} working={Boolean(open)} />

      <div className="grid grid-cols-2 gap-2.5">
        <Card>
          <p className="text-[12.5px]" style={{ color: "var(--rf-text-3)" }}>
            {t.tyo.hoursThisMonth}
          </p>
          <p className="rf-tabular mt-1 text-[20px] font-bold">
            {formatHours(minutes, tag)}
          </p>
        </Card>

        <Card>
          <p className="text-[12.5px]" style={{ color: "var(--rf-text-3)" }}>
            {t.tyo.estimatedPay}
          </p>
          <p className="rf-tabular mt-1 text-[20px] font-bold">
            {formatMoney(payCents)}
          </p>
        </Card>
      </div>

      <Card>
        <p className="text-[14px] font-semibold">{t.tyo.recent}</p>

        {done.length === 0 ? (
          <p
            className="mt-2 text-[13px] leading-relaxed"
            style={{ color: "var(--rf-text-3)" }}
          >
            {t.tyo.noShiftsHint}
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {done.map((entry) => (
              <li
                key={entry.id}
                className="flex items-baseline justify-between gap-3 text-[13.5px]"
              >
                <span>
                  {formatDayIn(entry.date, locale)}
                  <span
                    className="rf-tabular ms-2 text-[12px]"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    {formatClock(entry.clockIn, restaurant.timezone)}–
                    {formatClock(entry.clockOut!, restaurant.timezone)}
                  </span>
                </span>
                <span className="rf-tabular font-semibold">
                  {formatHours(entry.minutes ?? 0, tag)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p
        className="px-1 text-[12px] leading-relaxed"
        style={{ color: "var(--rf-text-3)" }}
      >
        {t.tyo.estimateNote}
      </p>

      <form action={signOut} className="pt-2 text-center">
        <button
          type="submit"
          className="rf-press text-[13px] font-semibold underline-offset-4 hover:underline"
          style={{ color: "var(--rf-text-2)" }}
        >
          {t.kuori.signOut}
        </button>
      </form>
    </main>
  );
}

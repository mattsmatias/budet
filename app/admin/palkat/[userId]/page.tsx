import Link from "next/link";
import { resolveLocale } from "@/lib/i18n/resolve";
import { LOCALE_INFO } from "@/lib/i18n/app-locales";
import { adminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { notFound } from "next/navigation";
import { ISO_DATE, monthFromParams } from "@/lib/restoflow/dates";
import { adminContext } from "@/lib/restoflow/page-context";
import { can } from "@/lib/restoflow/permissions";
import { monthPeriod } from "@/lib/restoflow/payroll";
import { formatHours, loadPayroll } from "@/lib/restoflow/payroll-data";
import {
  fetchCorrectionHistory,
  fetchPayPeriods,
  fetchPayslips,
} from "@/lib/restoflow/queries";
import { formatDuration } from "@/lib/restoflow/timeclock";
import { formatMoney } from "@/lib/money";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, Pill } from "@/components/restoflow/ui";
import {
  CostBreakdown,
  rowsFromStored,
  rowsFromTax,
} from "@/components/restoflow/cost-breakdown";
import { costsForPeriod } from "@/lib/restoflow/payroll-cost";
import { ApprovePayslip } from "./approve";
import { CorrectionRow } from "./correction";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.palkka.payslip };
}

/**
 * Yhden työntekijän palkkalaskelma.
 *
 * Rakenne on sama kuin paperisessa: ensin työaika, sitten palkka, sitten
 * bruttosumma. Viimeisenä erittely päivä kerrallaan — se vastaa
 * kysymykseen "mistä tämä summa muodostui" ilman että sitä tarvitsee
 * kysyä keneltäkään.
 */
export default async function PayslipPage({
  params,
  searchParams,
}: PageProps<"/admin/palkat/[userId]">) {
  const locale = await resolveLocale();
  const t = adminText(locale);

  /* Intl-tunniste: prosentit käyttäjän kielellä. */
  const tag = LOCALE_INFO[locale].tag;

  const { userId } = await params;
  const query = await searchParams;
  const { restaurant, role, month, now, users } =
    await adminContext("/admin/palkat");

  /*
   * Kuukausi kelpaa varaksi jaksolle.
   *
   * Yläpalkin valitsin näkyy myös tällä sivulla, koska se näkyy kaikilla
   * /admin/palkat-alkuisilla. Se asettaa ?kuukausi-parametrin, jota tämä
   * sivu ei aiemmin lukenut lainkaan: kuukauden vaihtaminen muutti
   * osoitteen muttei palkkalaskelmaa.
   *
   * Tarkka jakso voittaa yhä. Palkkakausi ei aina ole kalenterikuukausi,
   * ja ?alkaa/?paattyy on silloin se mitä käyttäjä on valinnut.
   */
  const fallback = monthPeriod(monthFromParams(query, month));
  const startsOn =
    typeof query.alkaa === "string" && ISO_DATE.test(query.alkaa)
      ? query.alkaa
      : fallback.startsOn;
  const endsOn =
    typeof query.paattyy === "string" && ISO_DATE.test(query.paattyy)
      ? query.paattyy
      : fallback.endsOn;

  const period = { startsOn, endsOn };
  const data = await loadPayroll(
    restaurant.id,
    restaurant.timezone,
    period,
    now,
  );

  const slip = data.slips.find((s) => s.userId === userId);
  const person = users.find((u) => u.id === userId);
  if (!slip || !person) notFound();

  const periods = await fetchPayPeriods(restaurant.id);
  const stored = periods.find(
    (p) => p.startsOn === startsOn && p.endsOn === endsOn,
  );
  const slipsInDb = stored ? await fetchPayslips(stored.id) : [];
  const saved = slipsInDb.find((s) => s.userId === userId);

  const corrections = await fetchCorrectionHistory(
    restaurant.id,
    startsOn,
    endsOn,
  );
  const mine = new Map(
    corrections.filter((c) => c.userId === userId).map((c) => [c.workDate, c]),
  );

  const canManage = can(role, "payroll.manage");
  const locked = stored?.status === "approved" || stored?.status === "paid";

  /*
   * Verotus ja työnantajan kustannus.
   *
   * Hyväksytyltä laskelmalta luetaan jäädytetyt luvut. Luonnokselle
   * lasketaan ennuste, koska juuri sitä varten sivu avataan: mitä
   * tämä palkka tulee maksamaan ennen kuin se hyväksytään.
   */
  const hyvaksytty = saved !== undefined && saved.status !== "draft";

  const costs = hyvaksytty
    ? null
    : await costsForPeriod({
        restaurantId: restaurant.id,
        periodFrom: period.startsOn,
        periodTo: period.endsOn,
        payDate: stored?.payDate ?? null,
        slips: [slip],
        noPayDateMessage: t.palkka.payDateMissing,
        noRulesMessage: t.palkka.rulesMissing,
      });

  const costRows = hyvaksytty
    ? rowsFromStored(saved)
    : (() => {
        const tax = costs?.byUser.get(userId);
        return tax ? rowsFromTax(tax) : null;
      })();

  /*
   * Lisät ryhmitellään lajeittain.
   *
   * Palkkalaskelmassa lukee "Iltalisät 12 h", ei kahtatoista erillistä
   * riviä. Päiväkohtainen erittely on alempana omana osionaan.
   */
  const byComponent = new Map<
    string,
    { name: string; minutes: number; cents: number }
  >();
  for (const line of slip.lines) {
    if (line.componentId === null) continue;
    const row = byComponent.get(line.componentId) ?? {
      name: line.description,
      minutes: 0,
      cents: 0,
    };
    row.minutes += line.minutes;
    row.cents += line.amountCents;
    byComponent.set(line.componentId, row);
  }

  const baseLines = slip.lines.filter((l) => l.componentId === null);

  return (
    <div className="rf-stagger space-y-5">
      <header className="rf-z-page relative">
        <Link
          href={`/admin/palkat?kausi=koko&kuukausi=${startsOn.slice(0, 7)}`}
          className="rf-press rf-hit inline-flex items-center gap-1.5 text-[13px] font-medium"
          style={{ color: "var(--rf-text-2)" }}
        >
          <RfIcon name="back" size={15} />
          {t.palkka.payTitle}
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[20px] font-bold tracking-[-0.02em]">
              {person.name}
            </h2>
            <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
              {fill(t.palkka.payPeriodRange, {
                alku: fi(startsOn),
                loppu: fi(endsOn),
              })}
            </p>
          </div>

          {saved?.status === "approved" ? (
            <Pill tone="ok">{t.palkka.approvedWord}</Pill>
          ) : slip.issues.length > 0 ? (
            <Pill tone="warn">{t.palkka.check}</Pill>
          ) : (
            <Pill tone="neutral">{t.palkka.awaitingApproval}</Pill>
          )}
        </div>
      </header>

      {/* Varoitukset ensin: ne kertovat miksi summa voi olla väärä. */}
      {slip.issues.length > 0 ? (
        <Card>
          <h2 className="text-[15px] font-semibold">{t.palkka.toCheck}</h2>
          <ul className="mt-2.5 space-y-2">
            {slip.issues.map((issue, index) => (
              <li
                key={index}
                className="flex items-start gap-2.5 text-[13px] leading-relaxed"
              >
                <span style={{ color: "var(--rf-amber-text)" }}>
                  <RfIcon name="alert" size={15} />
                </span>
                {issue.message}
              </li>
            ))}
          </ul>
          <p
            className="mt-3 text-[12px] leading-relaxed"
            style={{ color: "var(--rf-text-3)" }}
          >
            {t.palkka.notApprovedUntilFixed}
          </p>
        </Card>
      ) : null}

      {/* --- Työaika --------------------------------------------------- */}

      <Card>
        <h2 className="text-[15px] font-bold tracking-[-0.0075em]">
          {t.palkka.workTime}
        </h2>

        <dl className="mt-3 space-y-2 text-[14px]">
          <Row
            label={t.palkka.baseHours}
            value={formatHours(slip.workedMinutes)}
          />
          {[...byComponent.values()].map((row) => (
            <Row
              key={row.name}
              label={row.name}
              value={formatHours(row.minutes)}
              muted
            />
          ))}
        </dl>
      </Card>

      {/* --- Palkka ------------------------------------------------------ */}

      <Card>
        <h2 className="text-[15px] font-bold tracking-[-0.0075em]">
          {t.palkka.payWord}
        </h2>

        <dl className="mt-3 space-y-3 text-[14px]">
          <div className="flex items-baseline justify-between gap-4">
            <dt>
              {t.palkka.basePay}
              <span
                className="mt-0.5 block text-[12px]"
                style={{ color: "var(--rf-text-3)" }}
              >
                {formatHours(slip.workedMinutes)} ×{" "}
                {slip.hourlyRateCents === null
                  ? "— tuntipalkka puuttuu"
                  : fill(t.palkka.perHour, {
                      summa: formatMoney(slip.hourlyRateCents),
                    })}
              </span>
            </dt>
            <dd className="rf-tabular shrink-0 font-medium">
              {formatMoney(slip.baseCents)}
            </dd>
          </div>

          {[...byComponent.values()].map((row) => (
            <div
              key={row.name}
              className="flex items-baseline justify-between gap-4"
            >
              <dt>
                {row.name}
                <span
                  className="mt-0.5 block text-[12px]"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  {formatHours(row.minutes)}
                </span>
              </dt>
              <dd className="rf-tabular shrink-0 font-medium">
                {formatMoney(row.cents)}
              </dd>
            </div>
          ))}
        </dl>

        <div
          className="mt-4 flex items-baseline justify-between gap-4 border-t pt-4"
          style={{ borderColor: "var(--rf-line)" }}
        >
          <span className="text-[15px] font-semibold">{t.palkka.grossPay}</span>
          <span className="rf-tabular text-[22px] font-semibold">
            {formatMoney(slip.grossCents)}
          </span>
        </div>
      </Card>

      {/* --- Vähennykset ja työnantajan kustannus ------------------------- */}

      {/*
        Tämä on se osa jonka takia palkkamoduuli on olemassa.

        Bruttopalkka kertoo mitä työntekijän kanssa on sovittu.
        Työnantajan kokonaiskustannus kertoo mitä se maksaa — ja ero on
        noin viidennes. Ilman tätä korttia hinnoittelu perustuisi
        väärään lukuun.
      */}
      <Card>
        <h2 className="text-[15px] font-bold tracking-[-0.0075em]">
          {t.verotus.employerCost}
        </h2>

        <div className="mt-3">
          {costRows ? (
            <CostBreakdown
              t={t}
              tag={tag}
              rows={costRows}
              frozen={hyvaksytty}
            />
          ) : (
            <p
              className="text-[13px]"
              style={{ color: "var(--rf-amber-text)" }}
            >
              {costs?.blocked ?? t.palkka.calcFailed}
            </p>
          )}
        </div>
      </Card>

      {/* --- Mistä summa muodostui --------------------------------------- */}

      <Card>
        <h2 className="text-[15px] font-bold tracking-[-0.0075em]">
          {t.palkka.howFormed}
        </h2>
        <p
          className="mt-1 text-[13px] leading-relaxed"
          style={{ color: "var(--rf-text-2)" }}
        >
          {t.palkka.eachRowIsDay}
        </p>

        {baseLines.length === 0 ? (
          <p className="mt-4 text-[13px]" style={{ color: "var(--rf-text-3)" }}>
            {t.palkka.noWorkedTime}
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {baseLines.map((line) => {
              const extras = slip.lines.filter(
                (l) => l.date === line.date && l.componentId !== null,
              );
              const workday = slip.workdays.find((d) => d.date === line.date);

              return (
                <li key={line.date}>
                  <CorrectionRow
                    t={t}
                    date={line.date}
                    label={fi(line.date)}
                    times={line.description}
                    duration={formatDuration(line.minutes * 60000)}
                    amount={formatMoney(line.amountCents)}
                    extras={extras.map((e) => ({
                      name: e.description,
                      duration: formatDuration(e.minutes * 60000),
                      amount: formatMoney(e.amountCents),
                    }))}
                    userId={userId}
                    corrected={workday?.source === "corrected"}
                    correction={correctionOf(mine.get(line.date))}
                    canManage={canManage && !locked}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Päivät joilta puuttuu aika mutta joilla on varoitus. */}
      {slip.issues
        .filter((i) => i.kind === "missing_out")
        .map((issue) => (
          <Card key={issue.date}>
            <p className="text-[13px] leading-relaxed">
              <span style={{ color: "var(--rf-amber-text)" }}>
                <RfIcon name="alert" size={15} />
              </span>{" "}
              {fi(issue.date)} — uloskirjaus puuttuu, joten päivä ei kerrytä
              palkkaa.
            </p>

            {canManage && !locked ? (
              <div className="mt-3">
                <CorrectionRow
                  t={t}
                  date={issue.date}
                  label={fi(issue.date)}
                  times="? – ?"
                  duration="—"
                  amount={formatMoney(0)}
                  extras={[]}
                  userId={userId}
                  corrected={false}
                  correction={null}
                  canManage
                  startOpen
                />
              </div>
            ) : null}
          </Card>
        ))}

      {canManage ? (
        <ApprovePayslip
          t={t}
          userId={userId}
          startsOn={startsOn}
          endsOn={endsOn}
          blocked={slip.issues.length > 0}
          approved={saved?.status === "approved"}
          locked={locked}
          changed={
            saved !== undefined &&
            saved.status === "approved" &&
            saved.grossCents !== slip.grossCents
          }
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function correctionOf(
  record:
    | {
        id: string;
        originalIn: string | null;
        originalOut: string | null;
        reason: string;
        createdAt: string;
      }
    | undefined,
) {
  if (!record) return null;
  return {
    id: record.id,
    reason: record.reason,
    createdAt: record.createdAt,
    hadOriginal: record.originalIn !== null || record.originalOut !== null,
  };
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt style={muted ? { color: "var(--rf-text-2)" } : undefined}>{label}</dt>
      <dd className="rf-tabular shrink-0 font-medium">{value}</dd>
    </div>
  );
}

/** "2026-08-24" → "24.8.2026" */
function fi(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${Number(d)}.${Number(m)}.${y}`;
}

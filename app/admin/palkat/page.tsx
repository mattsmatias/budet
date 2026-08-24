import Link from "next/link";
import { ISO_MONTH } from "@/lib/restoflow/dates";
import { adminContext } from "@/lib/restoflow/page-context";
import { can } from "@/lib/restoflow/permissions";
import { formatMonth, previousMonth } from "@/lib/restoflow/expenses";
import { halfMonthPeriods, monthPeriod, type PeriodBounds } from "@/lib/restoflow/payroll";
import { formatHours, loadPayroll, summarise } from "@/lib/restoflow/payroll-data";
import { fetchPayPeriods, fetchPayslips } from "@/lib/restoflow/queries";
import { formatMoney } from "@/lib/money";
import { CountUp } from "@/components/restoflow/count-up";
import { RfIcon } from "@/components/restoflow/icons";
import { Avatar, Card, Pill } from "@/components/restoflow/ui";
import { Panel, PanelEmpty, StatCard } from "@/components/restoflow/dashboard-ui";
import { PeriodPicker } from "./period-picker";
import { PeriodActions } from "./period-actions";
import { PayComponents } from "./components-editor";

export const metadata = { title: "Palkat" };

/**
 * Palkat.
 *
 * Näkymän tehtävä on vastata kolmeen kysymykseen: paljonko tältä
 * kaudelta maksetaan, kenelle, ja mikä vaatii vielä huomiota.
 *
 * Kaikki luvut ovat toteutuneesta työajasta. Suunniteltu vuoro ei näy
 * tässä näkymässä lainkaan, koska se ei vaikuta palkkaan — sen
 * näyttäminen houkuttelisi vertaamaan väärää lukua oikeaan.
 */
export default async function PayrollPage({
  searchParams,
}: PageProps<"/admin/palkat">) {
  const params = await searchParams;
  const { restaurant, role, month, now, users } = await adminContext("/admin/palkat");

  const requested = typeof params.kuukausi === "string" ? params.kuukausi : month;
  const viewMonth = ISO_MONTH.test(requested) && requested <= month ? requested : month;

  const selectable: string[] = [];
  let cursor = month;
  for (let i = 0; i < 13; i++) {
    selectable.push(cursor);
    cursor = previousMonth(cursor);
  }

  /*
   * Kausivaihtoehdot: koko kuukausi tai sen puolikkaat.
   *
   * Kausi tallennetaan päivävälinä, joten mikä tahansa rajaus on
   * mahdollinen. Nämä kolme kattavat sen mitä ravintola käytännössä
   * käyttää, eikä neljäs vaihtoehto tekisi valinnasta helpompaa.
   */
  const halves = halfMonthPeriods(viewMonth);
  const options: { key: string; label: string; bounds: PeriodBounds }[] = [
    { key: "koko", label: "Koko kuukausi", bounds: monthPeriod(viewMonth) },
    { key: "1", label: "1.–15.", bounds: halves[0] },
    { key: "2", label: "16.–", bounds: halves[1] },
  ];

  const chosen =
    options.find((o) => o.key === params.kausi) ?? options[0];
  const period = chosen.bounds;

  const data = await loadPayroll(restaurant.id, restaurant.timezone, period, now);
  const summary = summarise(data);

  const periods = await fetchPayPeriods(restaurant.id);
  const stored = periods.find(
    (p) => p.startsOn === period.startsOn && p.endsOn === period.endsOn,
  );
  const slipsInDb = stored ? await fetchPayslips(stored.id) : [];
  const approvedIds = new Set(
    slipsInDb.filter((s) => s.status === "approved").map((s) => s.userId),
  );

  const canManage = can(role, "payroll.manage");
  const locked = stored?.status === "approved" || stored?.status === "paid";

  const paid = data.slips
    .filter((s) => s.workedMinutes > 0)
    .sort((a, b) => b.grossCents - a.grossCents);

  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? "Nimetön";

  return (
    <div className="rf-stagger space-y-5 md:space-y-6">
      <header className="rf-z-page relative flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            {formatMonth(viewMonth)} · {chosen.label}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker
            month={viewMonth}
            current={chosen.key}
            options={options.map((o) => ({ key: o.key, label: o.label }))}
          />
        </div>
      </header>

      <section
        aria-label="Avainluvut"
        className="grid auto-rows-fr grid-cols-2 gap-3 xl:grid-cols-4"
      >
        <StatCard
          label="Työntekijöitä"
          value={String(summary.staffCount)}
          conclusion={summary.staffCount === 0 ? "Ei työaikaa kaudella" : "Palkkaa kertynyt"}
          tone="muted"
          icon={<RfIcon name="staff" size={14} />}
        />

        <StatCard
          label="Tehdyt tunnit"
          value={formatHours(summary.workedMinutes)}
          conclusion="Leimauksista laskettu"
          tone="muted"
          icon={<RfIcon name="clock" size={14} />}
        />

        <StatCard
          label="Bruttopalkat"
          value={<CountUp to={summary.grossCents} format="money" />}
          conclusion="Peruspalkka ja lisät"
          hint="Ei sisällä vähennyksiä eikä työnantajan sivukuluja."
          tone="muted"
          icon={<RfIcon name="payroll" size={14} />}
        />

        <StatCard
          label="Tarkistettavat"
          value={String(summary.needsReview)}
          conclusion={
            summary.needsReview === 0 ? "Ei huomautettavaa" : "Vaatii korjauksen"
          }
          tone={summary.needsReview > 0 ? "warn" : "muted"}
          icon={<RfIcon name="alert" size={14} />}
        />
      </section>

      {/* Varoitukset ennen listaa: ne muuttavat sitä mitä listassa lukee. */}
      {data.issues.length > 0 ? (
        <Card>
          <h2 className="text-[15px] font-bold tracking-[-0.0075em]">Tarkistettavaa</h2>
          <ul className="mt-3 space-y-2">
            {data.issues.slice(0, 8).map((issue, index) => (
              <li
                key={`${issue.userId}-${issue.date}-${index}`}
                className="flex items-start gap-2.5 text-[13px] leading-relaxed"
              >
                <span style={{ color: "var(--rf-amber-text)" }}>
                  <RfIcon name="alert" size={15} />
                </span>
                <span>
                  <Link
                    href={`/admin/palkat/${issue.userId}?alkaa=${period.startsOn}&paattyy=${period.endsOn}`}
                    className="font-medium underline underline-offset-4"
                  >
                    {nameOf(issue.userId)}
                  </Link>{" "}
                  <span style={{ color: "var(--rf-text-2)" }}>{issue.message}</span>
                </span>
              </li>
            ))}
          </ul>

          {data.issues.length > 8 ? (
            <p className="mt-3 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
              ja {data.issues.length - 8} muuta.
            </p>
          ) : null}
        </Card>
      ) : null}

      <Panel title="Palkkakertymä" subtitle={`${period.startsOn} – ${period.endsOn}`}>
        {paid.length === 0 ? (
          <PanelEmpty text="Kaudella ei ole toteutunutta työaikaa. Palkka muodostuu leimauksista." />
        ) : (
          <>
            {/* Työpöydällä taulukko, puhelimessa kortit: kuusi saraketta
                375 pikselissä olisi lukukelvoton. */}
            <div className="hidden overflow-x-auto md:block">
              <table className="rf-table w-full min-w-[44rem] text-[14px]">
                <thead>
                  <tr>
                    <th>Työntekijä</th>
                    <th className="px-4 py-3 text-right font-medium">Tunnit</th>
                    <th className="px-4 py-3 text-right font-medium">Peruspalkka</th>
                    <th className="px-4 py-3 text-right font-medium">Lisät</th>
                    <th className="px-4 py-3 text-right font-medium">Bruttopalkka</th>
                    <th className="py-3 pl-4 font-medium">Tila</th>
                  </tr>
                </thead>
                <tbody>
                  {paid.map((slip) => (
                    <tr
                      key={slip.userId}
                      className="border-b last:border-0"
                      style={{ borderColor: "var(--rf-line)" }}
                    >
                      <td className="py-3 pr-4">
                        <Link
                          href={`/admin/palkat/${slip.userId}?alkaa=${period.startsOn}&paattyy=${period.endsOn}`}
                          className="rf-hit flex items-center gap-2.5 font-medium underline-offset-4 hover:underline"
                        >
                          <Avatar initials={initialsOf(nameOf(slip.userId))} size={26} />
                          {nameOf(slip.userId)}
                        </Link>
                      </td>
                      <td className="num">
                        {formatHours(slip.workedMinutes)}
                      </td>
                      <td className="num">
                        {formatMoney(slip.baseCents)}
                      </td>
                      <td className="rf-tabular px-4 py-3 text-right" style={{ color: "var(--rf-text-2)" }}>
                        {slip.supplementsCents === 0 ? "—" : formatMoney(slip.supplementsCents)}
                      </td>
                      <td className="num">
                        {formatMoney(slip.grossCents)}
                      </td>
                      <td className="py-3 pl-4">
                        <StatusPill
                          issues={slip.issues.length}
                          approved={approvedIds.has(slip.userId)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-2 md:hidden">
              {paid.map((slip) => (
                <li key={slip.userId}>
                  <Link
                    href={`/admin/palkat/${slip.userId}?alkaa=${period.startsOn}&paattyy=${period.endsOn}`}
                    className="rf-press flex items-center gap-3 px-3.5 py-3"
                    style={{
                      background: "var(--rf-inset)",
                      borderRadius: "var(--rf-r-control)",
                    }}
                  >
                    <Avatar initials={initialsOf(nameOf(slip.userId))} size={34} />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">
                        {nameOf(slip.userId)}
                      </span>
                      <span className="block text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                        {formatHours(slip.workedMinutes)}
                        {slip.supplementsCents > 0
                          ? ` · lisät ${formatMoney(slip.supplementsCents)}`
                          : ""}
                      </span>
                    </span>

                    <span className="rf-tabular shrink-0 text-right text-[15px] font-semibold">
                      {formatMoney(slip.grossCents)}
                      <span className="mt-1 block">
                        <StatusPill
                          issues={slip.issues.length}
                          approved={approvedIds.has(slip.userId)}
                        />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      {canManage ? (
        <PeriodActions
          startsOn={period.startsOn}
          endsOn={period.endsOn}
          approvedCount={approvedIds.size}
          totalCount={paid.length}
          issueCount={data.issues.length}
          locked={locked}
        />
      ) : null}

      {canManage ? <PayComponents components={data.components} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Nimikirjaimet, sama muoto kuin muualla listoissa. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function StatusPill({ issues, approved }: { issues: number; approved: boolean }) {
  if (issues > 0) return <Pill tone="warn">Tarkista</Pill>;
  if (approved) return <Pill tone="ok">Hyväksytty</Pill>;
  return <Pill tone="neutral">Odottaa</Pill>;
}

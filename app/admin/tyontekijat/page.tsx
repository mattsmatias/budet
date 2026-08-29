import { adminContext } from "@/lib/restoflow/page-context";
import { labels } from "@/lib/i18n/labels";
import { resolveLocale } from "@/lib/i18n/resolve";
import { adminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { fetchInvitations } from "@/lib/restoflow/queries";
import { can, seesPayRates } from "@/lib/restoflow/permissions";
import { staffCostCents } from "@/lib/restoflow/timeclock";
import { formatMoney } from "@/lib/money";
import { revokeInvitation } from "../actions";
import { Avatar, Card, MetricCard, Pill } from "@/components/restoflow/ui";
import { RfIcon } from "@/components/restoflow/icons";
import { CountUp } from "@/components/restoflow/count-up";
import { InviteForm, MemberForm } from "./forms";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.henkilosto.title };
}

export default async function StaffPage() {
  const { users, shifts, monthlyHours, role, restaurant } =
    await adminContext("/admin/tyontekijat");
  const locale = await resolveLocale();
  const t = adminText(locale);
  const nimet = labels(locale);

  const canManage = can(role, "staff.manage");
  const showsRates = seesPayRates(role);
  const invitations = canManage ? await fetchInvitations(restaurant.id) : [];

  const rows = users
    .map((user) => ({
      user,
      hours: monthlyHours[user.id] ?? 0,
      shiftCount: shifts.filter((s) => s.userId === user.id).length,
      cost: staffCostCents(
        (monthlyHours[user.id] ?? 0) * 3600000,
        user.hourlyRateCents ?? 0,
      ),
    }))
    .sort((a, b) => b.hours - a.hours);

  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const missingRates = rows.filter(
    (r) => r.user.hourlyRateCents === null && r.user.position !== null,
  ).length;

  return (
    <div className="rf-enter space-y-5">
      <div>
        <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {users.length} käyttäjää
          {invitations.length > 0
            ? ` · ${invitations.length} avointa kutsua`
            : ""}
        </p>
      </div>

      {/* Sama kokoonpano kuin yleiskuvan avainluvuissa. */}
      <section
        aria-label={t.sanat.keyFigures}
        className="grid auto-rows-fr grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3"
      >
        <MetricCard
          label={t.henkilosto.hours}
          icon={<RfIcon name="clock" size={17} />}
          tileTone="brand"
          tone="muted"
          value={<CountUp to={totalHours} format="hours" />}
          conclusion="Kuluva kuukausi"
        />

        {showsRates ? (
          <MetricCard
            label={t.henkilosto.staffCost}
            icon={<RfIcon name="payroll" size={17} />}
            tileTone="green"
            value={<CountUp to={totalCost} format="money" />}
            tone={missingRates > 0 ? "warn" : "muted"}
            conclusion={
              missingRates > 0
                ? fill(t.lauseet.missingRates, { maara: String(missingRates) })
                : "Tunnit × tuntipalkka"
            }
          />
        ) : null}

        <MetricCard
          label={t.henkilosto.average}
          icon={<RfIcon name="staff" size={17} />}
          tileTone="violet"
          tone="muted"
          value={
            users.length === 0 ? (
              "0 h"
            ) : (
              <CountUp to={totalHours / users.length} format="hours" />
            )
          }
          conclusion={t.henkilosto.perUser}
        />
      </section>

      {canManage ? <InviteForm nimet={nimet} /> : null}

      {invitations.length > 0 ? (
        <Card>
          <p className="text-[15px] font-semibold">
            {t.henkilosto2.openInvites}
          </p>
          <p
            className="mt-1 text-[13px] leading-relaxed"
            style={{ color: "var(--rf-text-2)" }}
          >
            {t.henkilosto.codeOnce}
          </p>
          <ul
            className="mt-3 divide-y"
            style={{ borderColor: "var(--rf-line)" }}
          >
            {invitations.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-medium">
                    {inv.label ?? nimet.roles[inv.role]}
                  </p>
                  <p
                    className="rf-tabular text-[12px]"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    ···{inv.codeHint} · {nimet.roles[inv.role]}
                    {inv.position
                      ? ` · ${nimet.positions[inv.position]}`
                      : ""}{" "}
                    · voimassa {formatDate(inv.expiresAt)} asti
                  </p>
                </div>
                <form action={revokeInvitation}>
                  <input type="hidden" name="invitationId" value={inv.id} />
                  <button
                    type="submit"
                    className="rf-press px-3 py-1.5 text-[13px] font-medium"
                    style={{
                      background: "var(--rf-red-bg)",
                      color: "var(--rf-red-text)",
                      borderRadius: "var(--rf-r-control)",
                    }}
                  >
                    {t.henkilosto.revoke}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Kortit puhelimessa, taulukko työpöydällä. Vaakavieritettävä taulukko
          on puhelimessa työläs yhdellä peukalolla. */}
      <ul className="space-y-3 md:hidden">
        {rows.map(({ user, hours, shiftCount, cost }) => (
          <li key={user.id}>
            <Card>
              <div className="flex items-start gap-3">
                <Avatar initials={user.initials} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">
                    {user.name}
                  </p>
                  <p
                    className="text-[13px]"
                    style={{ color: "var(--rf-text-2)" }}
                  >
                    {nimet.roles[user.role]}
                    {user.position
                      ? ` · ${nimet.positions[user.position]}`
                      : ""}
                  </p>
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat label={t.sanat.hours} value={`${hours} h`} />
                <Stat
                  label={t.henkilosto2.shiftCount}
                  value={String(shiftCount)}
                />
                <Stat
                  label={showsRates ? t.henkilosto2.cost : "Kuitit"}
                  value={
                    showsRates
                      ? formatMoney(cost)
                      : can(user.role, "receipts.view")
                        ? "kaikki"
                        : "omat"
                  }
                />
              </dl>

              {canManage ? <MemberForm nimet={nimet} user={user} /> : null}
            </Card>
          </li>
        ))}
      </ul>

      <Card padded={false} className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="rf-table w-full min-w-[44rem] text-[14px]">
            <caption className="sr-only">{t.henkilosto.usersAndHours}</caption>
            <thead>
              <tr>
                <th scope="col">{t.henkilosto.user}</th>
                <th scope="col">{t.sanat.role}</th>
                <th scope="col" className="text-right">
                  {t.sanat.hours}
                </th>
                <th scope="col" className="text-right">
                  {t.henkilosto2.shiftCount}
                </th>
                {showsRates ? (
                  <>
                    <th scope="col" className="text-right">
                      {t.henkilosto2.hourlyRate}
                    </th>
                    <th scope="col" className="text-right">
                      {t.henkilosto2.cost}
                    </th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody className="align-top">
              {rows.map(({ user, hours, shiftCount, cost }) => (
                <tr key={user.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar initials={user.initials} size={34} />
                      <div>
                        <span className="font-medium">{user.name}</span>
                        {user.position ? (
                          <p
                            className="text-[12px]"
                            style={{ color: "var(--rf-text-3)" }}
                          >
                            {nimet.positions[user.position]}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {canManage ? (
                      <MemberForm nimet={nimet} user={user} />
                    ) : null}
                  </td>
                  <td>
                    <Pill tone={user.role === "owner" ? "info" : "neutral"}>
                      {nimet.roles[user.role]}
                    </Pill>
                  </td>
                  <td className="num">{hours} h</td>
                  <td
                    className="rf-tabular px-5 py-3 text-right"
                    style={{ color: "var(--rf-text-2)" }}
                  >
                    {shiftCount}
                  </td>
                  {showsRates ? (
                    <>
                      <td
                        className="rf-tabular px-5 py-3 text-right"
                        style={{
                          color:
                            user.hourlyRateCents === null
                              ? "var(--rf-amber-text)"
                              : "var(--rf-text-2)",
                        }}
                      >
                        {user.hourlyRateCents === null
                          ? "ei asetettu"
                          : formatMoney(user.hourlyRateCents)}
                      </td>
                      <td className="num">{formatMoney(cost)}</td>
                    </>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="px-2 py-2"
      style={{ background: "var(--rf-inset)", borderRadius: "10px" }}
    >
      <dt className="text-[11px]" style={{ color: "var(--rf-text-2)" }}>
        {label}
      </dt>
      <dd className="rf-tabular mt-0.5 text-[15px] font-semibold">{value}</dd>
    </div>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${Number(d)}.${Number(m)}.${y}`;
}

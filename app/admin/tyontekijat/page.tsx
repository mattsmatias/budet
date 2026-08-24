import { adminContext } from "@/lib/restoflow/page-context";
import { fetchInvitations } from "@/lib/restoflow/queries";
import { can, seesPayRates } from "@/lib/restoflow/permissions";
import { staffCostCents } from "@/lib/restoflow/timeclock";
import { POSITION_LABELS, ROLE_LABELS } from "@/lib/restoflow/types";
import { formatMoney } from "@/lib/money";
import { revokeInvitation } from "../actions";
import { Avatar, Card, MetricCard, Pill } from "@/components/restoflow/ui";
import { RfIcon } from "@/components/restoflow/icons";
import { InviteForm, MemberForm } from "./forms";

export const metadata = { title: "Työntekijät" };

export default async function StaffPage() {
  const { users, shifts, monthlyHours, role, restaurant } =
    await adminContext("/admin/tyontekijat");

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
          {invitations.length > 0 ? ` · ${invitations.length} avointa kutsua` : ""}
        </p>
      </div>

      <section aria-label="Yhteenveto" className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Työtunnit"
          icon={<RfIcon name="clock" size={17} />}
          tileTone="brand"
          value={`${Math.round(totalHours)} h`}
          hint="Kuluva kuukausi"
        />
        {showsRates ? (
          <MetricCard
            label="Henkilöstökulut"
            icon={<RfIcon name="payroll" size={17} />}
          tileTone="green"
            value={formatMoney(totalCost)}
            hint={
              missingRates > 0
                ? `${missingRates} ilman tuntipalkkaa`
                : "Tunnit × tuntipalkka"
            }
          />
        ) : null}
        <MetricCard
          label="Keskimäärin"
          icon={<RfIcon name="staff" size={17} />}
          tileTone="violet"
          value={
            users.length === 0 ? "0 h" : `${Math.round(totalHours / users.length)} h`
          }
          hint="Käyttäjää kohti"
        />
      </section>

      {canManage ? <InviteForm /> : null}

      {invitations.length > 0 ? (
        <Card>
          <p className="text-[15px] font-semibold">Avoimet kutsut</p>
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--rf-text-2)" }}>
            Koodia ei voi näyttää uudelleen — kannassa on vain sen tiiviste.
            Jos koodi katosi, mitätöi kutsu ja luo uusi.
          </p>
          <ul className="mt-3 divide-y" style={{ borderColor: "var(--rf-line)" }}>
            {invitations.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-medium">
                    {inv.label ?? ROLE_LABELS[inv.role]}
                  </p>
                  <p
                    className="rf-tabular text-[12px]"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    ···{inv.codeHint} · {ROLE_LABELS[inv.role]}
                    {inv.position ? ` · ${POSITION_LABELS[inv.position]}` : ""} ·
                    voimassa {formatDate(inv.expiresAt)} asti
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
                    Mitätöi
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
                  <p className="truncate text-[15px] font-semibold">{user.name}</p>
                  <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
                    {ROLE_LABELS[user.role]}
                    {user.position ? ` · ${POSITION_LABELS[user.position]}` : ""}
                  </p>
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat label="Tunnit" value={`${hours} h`} />
                <Stat label="Vuoroja" value={String(shiftCount)} />
                <Stat
                  label={showsRates ? "Kulu" : "Kuitit"}
                  value={
                    showsRates
                      ? formatMoney(cost)
                      : can(user.role, "receipts.view")
                        ? "kaikki"
                        : "omat"
                  }
                />
              </dl>

              {canManage ? <MemberForm user={user} /> : null}
            </Card>
          </li>
        ))}
      </ul>

      <Card padded={false} className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="rf-table w-full min-w-[44rem] text-[14px]">
            <caption className="sr-only">Käyttäjät ja työtunnit</caption>
            <thead>
              <tr>
                <th scope="col">Käyttäjä</th>
                <th scope="col">Rooli</th>
                <th scope="col" className="text-right">Tunnit</th>
                <th scope="col" className="text-right">Vuoroja</th>
                {showsRates ? (
                  <>
                    <th scope="col" className="text-right">
                      Tuntipalkka
                    </th>
                    <th scope="col" className="text-right">Kulu</th>
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
                          <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                            {POSITION_LABELS[user.position]}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {canManage ? <MemberForm user={user} /> : null}
                  </td>
                  <td>
                    <Pill tone={user.role === "owner" ? "info" : "neutral"}>
                      {ROLE_LABELS[user.role]}
                    </Pill>
                  </td>
                  <td className="num">
                    {hours} h
                  </td>
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
                      <td className="num">
                        {formatMoney(cost)}
                      </td>
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

import { EMPLOYEES, MONTHLY_HOURS, SHIFTS } from "@/lib/restoflow/data";
import { ROLE_LABELS } from "@/lib/restoflow/types";
import { staffCostCents } from "@/lib/restoflow/timeclock";
import { formatMoney } from "@/lib/money";
import {
  Avatar,
  Card,
  DemoNotice,
  MetricCard,
  Pill,
} from "@/components/restoflow/ui";

export const metadata = { title: "Työntekijät" };

export default function StaffPage() {
  const rows = EMPLOYEES.map((employee) => {
    const hours = MONTHLY_HOURS[employee.id] ?? 0;
    const shifts = SHIFTS.filter((s) => s.employeeId === employee.id).length;
    const cost = staffCostCents(hours * 3600000, employee.hourlyRateCents);
    return { employee, hours, shifts, cost };
  }).sort((a, b) => b.hours - a.hours);

  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);

  return (
    <div className="rf-enter space-y-6">
      <div>
        <h1 className="text-[30px] font-semibold tracking-tight">Työntekijät</h1>
        <p className="mt-1 text-[15px]" style={{ color: "var(--rf-text-2)" }}>
          {EMPLOYEES.length} työntekijää · elokuu 2026
        </p>
      </div>

      <DemoNotice>
        Demo-aineisto. Tuntipalkat ja tunnit ovat esimerkkejä. Henkilöstökulu
        on laskennallinen eikä sisällä lisiä, lomakorvauksia tai sivukuluja.
      </DemoNotice>

      <section aria-label="Yhteenveto" className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Työtunnit yhteensä" value={`${totalHours} h`} />
        <MetricCard
          label="Henkilöstökulut"
          value={formatMoney(totalCost)}
          hint="Tunnit × tuntipalkka"
        />
        <MetricCard
          label="Keskimäärin"
          value={`${Math.round(totalHours / EMPLOYEES.length)} h`}
          hint="Työntekijää kohti"
        />
      </section>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-[14px]">
            <caption className="sr-only">Työntekijät ja työtunnit</caption>
            <thead>
              <tr
                className="border-b text-left text-[12px] uppercase tracking-[0.04em]"
                style={{ borderColor: "var(--rf-line)", color: "var(--rf-text-3)" }}
              >
                <th scope="col" className="px-5 py-3 font-medium">Työntekijä</th>
                <th scope="col" className="px-5 py-3 font-medium">Rooli</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Tunnit</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Vuoroja</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Tuntipalkka</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Kulu</th>
                <th scope="col" className="px-5 py-3 font-medium">Kuittioikeus</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--rf-line)" }}>
              {rows.map(({ employee, hours, shifts, cost }) => (
                <tr key={employee.id}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar initials={employee.initials} size={34} />
                      <span className="font-medium">{employee.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3" style={{ color: "var(--rf-text-2)" }}>
                    {ROLE_LABELS[employee.role]}
                  </td>
                  <td className="rf-tabular px-5 py-3 text-right font-semibold">{hours} h</td>
                  <td className="rf-tabular px-5 py-3 text-right" style={{ color: "var(--rf-text-2)" }}>
                    {shifts}
                  </td>
                  <td className="rf-tabular px-5 py-3 text-right" style={{ color: "var(--rf-text-2)" }}>
                    {formatMoney(employee.hourlyRateCents)}
                  </td>
                  <td className="rf-tabular px-5 py-3 text-right font-semibold">
                    {formatMoney(cost)}
                  </td>
                  <td className="px-5 py-3">
                    {employee.canSeeReceipts ? (
                      <Pill tone="ok" dot>
                        kyllä
                      </Pill>
                    ) : (
                      <Pill>ei</Pill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr
                className="border-t-2 font-semibold"
                style={{ borderColor: "var(--rf-line-strong)" }}
              >
                <td className="px-5 py-3">Yhteensä</td>
                <td />
                <td className="rf-tabular px-5 py-3 text-right">{totalHours} h</td>
                <td className="rf-tabular px-5 py-3 text-right">{SHIFTS.length}</td>
                <td />
                <td className="rf-tabular px-5 py-3 text-right">{formatMoney(totalCost)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

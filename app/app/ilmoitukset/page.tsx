import Link from "next/link";
import { employeeContext } from "@/lib/restoflow/page-context";
import { buildEmployeeAlerts } from "@/lib/restoflow/employee-alerts";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, EmptyState } from "@/components/restoflow/ui";

import { resolveLocale } from "@/lib/i18n/resolve";
import { workerText } from "@/lib/i18n/worker-text";
import { fill } from "@/lib/i18n/auth-text";

export async function generateMetadata() {
  const t = workerText(await resolveLocale());
  return { title: t.ilmoitukset.title };
}

/**
 * Työntekijän ilmoitukset.
 *
 * Johdetaan tilasta joka latauksella, ei tallenneta. Sen vuoksi
 * ilmoitusta ei tarvitse eikä voi merkitä luetuksi: se katoaa kun asia
 * on hoidettu. Lukukuittaus antaisi vaikutelman että jokin on tehty,
 * vaikka vuoro olisi yhä vastaamatta.
 */
export default async function EmployeeAlertsPage() {
  const { shifts, clockEvents, absences, today, now, restaurant } =
    await employeeContext("/app/ilmoitukset");

  const alerts = buildEmployeeAlerts({
    shifts,
    clockEvents,
    absences,
    today,
    now,
    timezone: restaurant.timezone,
  });
  const actionable = alerts.filter((alert) => alert.severity === "action");
  const t = workerText(await resolveLocale());

  return (
    <div className="rf-enter space-y-4">
      <header className="px-1 pt-2">
        <h1 className="text-[28px] font-semibold tracking-tight">
          {t.ilmoitukset.title}
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--rf-text-2)" }}>
          {alerts.length === 0
            ? t.ilmoitukset.emptyTitle
            : actionable.length === 0
              ? fill(t.lisatiedot.forInfo, { maara: String(alerts.length) })
              : fill(t.lisatiedot.needsAction, {
                  maara: String(actionable.length),
                })}
        </p>
      </header>

      {alerts.length === 0 ? (
        <EmptyState
          title={t.ilmoitukset.emptyTitle}
          description={t.ilmoitukset.emptyBody}
        />
      ) : (
        <ul className="space-y-3">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <Link href={alert.href} className="rf-press block">
                <Card>
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center"
                      style={{
                        background:
                          alert.severity === "action"
                            ? "var(--rf-amber-bg)"
                            : "var(--rf-blue-bg)",
                        color:
                          alert.severity === "action"
                            ? "var(--rf-amber-text)"
                            : "var(--rf-blue-text)",
                        borderRadius: "50%",
                      }}
                    >
                      <RfIcon
                        name={alert.severity === "action" ? "alert" : "info"}
                        size={18}
                      />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold">{alert.title}</p>
                      <p
                        className="mt-1 text-[13px] leading-relaxed"
                        style={{ color: "var(--rf-text-2)" }}
                      >
                        {alert.detail}
                      </p>
                    </div>

                    <span
                      className="mt-1 shrink-0"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      <RfIcon name="chevron" size={16} />
                    </span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p
        className="px-1 text-[12px] leading-relaxed"
        style={{ color: "var(--rf-text-3)" }}
      >
        {t.lisatiedot.noticesNote}
      </p>
    </div>
  );
}

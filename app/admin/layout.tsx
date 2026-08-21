import {
  BUDGETS,
  CLOCK_EVENTS,
  CURRENT_ADMIN_ID,
  DEMO_MONTH,
  DEMO_TODAY,
  RECEIPTS,
  SHIFTS,
  STAFF,
  userById,
} from "@/lib/restoflow/data";
import { buildAlerts } from "@/lib/restoflow/alerts";
import { Sidebar } from "./sidebar";

/**
 * Managerin työpöytäkuori.
 *
 * Sivupalkki kaventuu ikoneiksi kapealla näytöllä mutta ei katoa: hallinta
 * on työpöytänäkymä, ja piilotettu navigaatio tekisi siitä hitaamman.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = userById(CURRENT_ADMIN_ID)!;

  const alerts = buildAlerts({
    receipts: RECEIPTS,
    budgets: BUDGETS,
    shifts: SHIFTS,
    users: STAFF,
    clockEvents: CLOCK_EVENTS,
    month: DEMO_MONTH,
    today: DEMO_TODAY,
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} userName={user.name} alertCount={alerts.length} />
      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-6xl px-6 py-7">{children}</main>
      </div>
    </div>
  );
}

import { requireContext } from "@/lib/restoflow/session";
import { fetchRestaurantData } from "@/lib/restoflow/queries";
import { buildAlerts } from "@/lib/restoflow/alerts";
import { monthIn, todayIn } from "@/lib/restoflow/clock-context";
import { Sidebar } from "./sidebar";

/**
 * Managerin työpöytäkuori.
 *
 * Sivupalkki kaventuu ikoneiksi kapealla näytöllä mutta ei katoa: hallinta
 * on työpöytänäkymä, ja piilotettu navigaatio tekisi siitä hitaamman.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { user, restaurant, role } = await requireContext("/admin");

  const data = await fetchRestaurantData(restaurant.id);
  const alerts = buildAlerts({
    receipts: data.receipts,
    budgets: data.budgets,
    shifts: data.shifts,
    users: data.users,
    clockEvents: data.clockEvents,
    month: monthIn(restaurant.timezone),
    today: todayIn(restaurant.timezone),
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar
        role={role}
        userName={user.fullName ?? user.email ?? "Käyttäjä"}
        restaurantName={restaurant.name}
        alertCount={alerts.length}
      />
      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-6xl px-6 py-7">{children}</main>
      </div>
    </div>
  );
}

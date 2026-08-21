import Link from "next/link";
import { requireContext } from "@/lib/restoflow/session";
import { fetchRestaurantData } from "@/lib/restoflow/queries";
import { buildAlerts } from "@/lib/restoflow/alerts";
import { monthIn, todayIn } from "@/lib/restoflow/clock-context";
import { RfIcon } from "@/components/restoflow/icons";
import { AdminNav } from "./nav";

/**
 * Managerin kuori.
 *
 * Sivupalkki työpöydällä, alapalkki puhelimessa. Puhelimessa on lisäksi
 * yläpalkki, koska muuten ravintolan nimi ja uloskirjautuminen jäisivät
 * kokonaan näkymättä.
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

  const userName = user.fullName ?? user.email ?? "Käyttäjä";

  return (
    <div className="flex min-h-screen">
      <AdminNav
        role={role}
        userName={userName}
        restaurantName={restaurant.name}
        alertCount={alerts.length}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Yläpalkki vain puhelimessa: työpöydällä sama tieto on sivupalkissa. */}
        <header
          className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b px-4 py-3 md:hidden"
          style={{
            borderColor: "var(--rf-line)",
            background: "rgba(255,255,255,0.86)",
            backdropFilter: "saturate(180%) blur(20px)",
            WebkitBackdropFilter: "saturate(180%) blur(20px)",
          }}
        >
          <Link href="/admin" className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{restaurant.name}</p>
            <p className="truncate text-[12px]" style={{ color: "var(--rf-text-3)" }}>
              {userName}
            </p>
          </Link>
          <Link
            href="/admin/lisaa"
            aria-label="Lisää"
            className="rf-press p-2"
            style={{ color: "var(--rf-text-2)" }}
          >
            <RfIcon name="settings" size={20} />
          </Link>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-24 md:px-6 md:py-7 md:pb-7">
          {children}
        </main>
      </div>
    </div>
  );
}

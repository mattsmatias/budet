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
            href="/admin/ilmoitukset"
            aria-label={
              alerts.length > 0 ? `Huomiot, ${alerts.length} uutta` : "Huomiot"
            }
            className="rf-press relative p-2"
            style={{ color: "var(--rf-text-2)" }}
          >
            <RfIcon name="bell" size={20} />
            {alerts.length > 0 ? (
              <span
                aria-hidden="true"
                className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full"
                style={{ background: "var(--rf-red)" }}
              />
            ) : null}
          </Link>
        </header>

        {/* Yläpalkki työpöydällä: sama tieto oikeassa yläkulmassa kuin
            puhelimessa, jotta ilmoitukset löytyvät samasta paikasta. */}
        <div className="hidden justify-end gap-2 px-6 pt-5 md:flex">
          <Link
            href="/admin/ilmoitukset"
            aria-label={
              alerts.length > 0 ? `Huomiot, ${alerts.length} uutta` : "Huomiot"
            }
            className="rf-press relative flex h-9 w-9 items-center justify-center"
            style={{
              background: "var(--rf-card)",
              border: "1px solid var(--rf-line)",
              color: "var(--rf-text-2)",
              borderRadius: "50%",
            }}
          >
            <RfIcon name="bell" size={17} />
            {alerts.length > 0 ? (
              <span
                aria-hidden="true"
                className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full"
                style={{
                  background: "var(--rf-red)",
                  border: "2px solid var(--rf-bg)",
                }}
              />
            ) : null}
          </Link>

          <span
            aria-hidden="true"
            title={userName}
            className="flex h-9 w-9 items-center justify-center text-[13px] font-semibold"
            style={{
              background: "var(--rf-inset)",
              color: "var(--rf-text-2)",
              borderRadius: "50%",
            }}
          >
            {userName.trim().charAt(0).toUpperCase() || "?"}
          </span>
        </div>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-24 md:px-6 md:pb-7 md:pt-4">
          {children}
        </main>
      </div>
    </div>
  );
}

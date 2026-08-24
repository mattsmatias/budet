import Link from "next/link";
import { requireContext } from "@/lib/restoflow/session";
import { fetchRestaurantData } from "@/lib/restoflow/queries";
import { buildAlerts } from "@/lib/restoflow/alerts";
import { monthIn, nowIso, todayIn } from "@/lib/restoflow/clock-context";
import { can } from "@/lib/restoflow/permissions";
import { AdminNav } from "./nav";
import { HeaderMenus } from "./header-menus";

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
    absences: data.absences,
    month: monthIn(restaurant.timezone),
    today: todayIn(restaurant.timezone),
    now: nowIso(),
    timezone: restaurant.timezone,
    openShifts: data.openShifts,
    sales: data.sales,
  });

  const userName = user.fullName ?? user.email ?? "Käyttäjä";

  return (
    <div className="flex min-h-screen">
      <AdminNav role={role} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Yläpalkki vain puhelimessa: työpöydällä sama tieto on sivupalkissa. */}
        <header
          className="rf-z-chrome sticky top-0 flex items-center justify-between gap-3 border-b px-4 py-3 md:hidden"
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
          <HeaderMenus
            alerts={alerts}
            userName={userName}
            restaurantName={restaurant.name}
            role={role}
            canOpenSettings={can(role, "settings.view")}
          />
        </header>

        {/* Yläpalkki työpöydällä: sama tieto oikeassa yläkulmassa kuin
            puhelimessa, jotta ilmoitukset löytyvät samasta paikasta. */}
        {/*
          Sama leveysrajaus kuin sisällöllä.

          Ilman tätä palkki venyi koko ikkunan leveyteen ja kello sekä
          tunnus liimautuivat ruudun oikeaan reunaan, kun kortit
          loppuivat satoja pikseleitä aiemmin. Nyt ne ovat samassa
          pystylinjassa korttien oikean reunan kanssa.
        */}
        <div className="rf-z-chrome relative mx-auto hidden w-full max-w-6xl justify-end gap-2 px-4 pt-5 md:flex md:px-6">
          <HeaderMenus
            alerts={alerts}
            userName={userName}
            restaurantName={restaurant.name}
            role={role}
            canOpenSettings={can(role, "settings.view")}
          />
        </div>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-24 md:px-6 md:pb-7 md:pt-4">
          {children}
        </main>
      </div>
    </div>
  );
}

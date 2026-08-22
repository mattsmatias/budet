"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavFor, primaryNavFor } from "@/lib/restoflow/permissions";
import type { Role } from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";

/**
 * Hallintanavigaatio.
 *
 * Kaksi muotoa samasta listasta: sivupalkki työpöydällä, alapalkki
 * puhelimessa. Puhelimessa kapea ikonisarake söisi neljänneksen leveydestä
 * antamatta mitään, ja alapalkki on peukalon ulottuvilla.
 *
 * Kohdat tulevat roolin oikeuksista, eivät kovakoodatusta listasta — sama
 * funktio ohjaa sivujen pääsytarkistusta.
 */
export function AdminNav({
  role,
  restaurantName,
}: {
  role: Role;
  restaurantName: string;
}) {
  const items = adminNavFor(role);
  const primary = primaryNavFor(role);

  return (
    <>
      <DesktopSidebar items={items} restaurantName={restaurantName} />
      <MobileBar items={primary} />
    </>
  );
}

type NavItems = ReturnType<typeof adminNavFor>;

function useActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === "/admin" ? pathname === href : pathname.startsWith(href);
}

// ---------------------------------------------------------------------------

function DesktopSidebar({
  items,
  restaurantName,
}: {
  items: NavItems;
  restaurantName: string;
}) {
  const isActive = useActive();

  return (
    <aside
      className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r md:flex"
      style={{ borderColor: "var(--rf-line)", background: "var(--rf-card)" }}
    >
      <div className="px-5 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[17px] font-semibold tracking-tight">Budet</span>
        </Link>
        <p className="mt-2 truncate text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {restaurantName}
        </p>
      </div>

      <nav
        aria-label="Hallintanavigaatio"
        className="flex-1 overflow-y-auto px-2.5 pb-4"
      >
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active = isActive(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="rf-press flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] font-medium"
                  style={{
                    background: active ? "var(--rf-accent-bg)" : "transparent",
                    color: active ? "var(--rf-accent-strong)" : "var(--rf-text-2)",
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  <RfIcon name={item.icon} size={19} />
                  <span className="flex-1">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

    </aside>
  );
}

// ---------------------------------------------------------------------------

/**
 * Alapalkki puhelimeen.
 *
 * Viisi tärkeintä kohtaa; loput löytyvät "Lisää"-välilehdeltä. Kuusi
 * kohtaa alapalkissa tekee kosketuskohteista liian kapeita.
 */
function MobileBar({ items }: { items: NavItems }) {
  const isActive = useActive();
  const primary = items;
  // Lisää on aina mukana: sen takana ovat asetukset ja uloskirjautuminen.
  const hasMore = true;

  return (
    <nav
      aria-label="Hallintanavigaatio"
      className="fixed bottom-0 left-0 right-0 z-30 border-t md:hidden"
      style={{
        borderColor: "var(--rf-line)",
        background: "rgba(255,255,255,0.86)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <ul className="mx-auto flex max-w-md">
        {primary.map((item) => {
          const active = isActive(item.href);

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="rf-press relative flex flex-col items-center gap-1 py-2"
                style={{ color: active ? "var(--rf-blue)" : "var(--rf-text-3)" }}
              >
                <RfIcon name={item.icon} size={22} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}

        {hasMore ? (
          <li className="flex-1">
            <Link
              href="/admin/lisaa"
              aria-current={isActive("/admin/lisaa") ? "page" : undefined}
              className="rf-press flex flex-col items-center gap-1 py-2"
              style={{
                color: isActive("/admin/lisaa") ? "var(--rf-blue)" : "var(--rf-text-3)",
              }}
            >
              <RfIcon name="more" size={22} />
              <span className="text-[10px] font-medium">Lisää</span>
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}



function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="7.5" fill="#1d1d1f" />
      <path
        d="M9 19V9.6c0-.3.3-.6.6-.6h4.6a3 3 0 0 1 0 6H11"
        stroke="#fff"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m14.4 15 4.6 4" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

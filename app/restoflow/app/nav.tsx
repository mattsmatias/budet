"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, ICONS } from "@/components/restoflow/ui";

const TABS = [
  { href: "/restoflow/app", label: "Koti", icon: ICONS.home },
  { href: "/restoflow/app/kuitit", label: "Kuitit", icon: ICONS.receipt },
  { href: "/restoflow/app/vuorot", label: "Vuorot", icon: ICONS.calendar },
  { href: "/restoflow/app/tyoaika", label: "Työaika", icon: ICONS.clock },
  { href: "/restoflow/app/lisaa", label: "Lisää", icon: ICONS.more },
] as const;

/**
 * Alanavigaatio.
 *
 * Viisi kohtaa, ei enempää. Kuudes kohta tarkoittaisi että jokin niistä ei
 * ansaitse paikkaansa.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Päänavigaatio"
      className="sticky bottom-0 z-20 border-t"
      style={{
        borderColor: "var(--rf-line)",
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const active =
            tab.href === "/restoflow/app"
              ? pathname === tab.href
              : pathname.startsWith(tab.href);

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="rf-press flex flex-col items-center gap-1 py-2"
                style={{ color: active ? "var(--rf-blue)" : "var(--rf-text-3)" }}
              >
                <Icon path={tab.icon} size={22} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

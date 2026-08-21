"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, Icon, ICONS } from "@/components/restoflow/ui";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: ICONS.home },
  { href: "/admin/kuitit", label: "Kuitit", icon: ICONS.receipt },
  { href: "/admin/kulut", label: "Kulut", icon: ICONS.chart },
  { href: "/admin/tyovuorot", label: "Työvuorot", icon: ICONS.calendar },
  { href: "/admin/tyontekijat", label: "Työntekijät", icon: ICONS.users },
  { href: "/admin/raportit", label: "Raportit", icon: ICONS.file },
  { href: "/admin/ilmoitukset", label: "Ilmoitukset", icon: ICONS.bell },
  { href: "/admin/asetukset", label: "Asetukset", icon: ICONS.settings },
] as const;

export function Sidebar({ badgeCount }: { badgeCount: number }) {
  const pathname = usePathname();

  return (
    <aside
      className="flex shrink-0 flex-col border-r lg:w-60"
      style={{ borderColor: "var(--rf-line)", background: "var(--rf-card)" }}
    >
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Logo />
        <span className="hidden text-[17px] font-semibold tracking-tight lg:inline">
          RestoFlow
        </span>
      </div>

      <nav aria-label="Hallintanavigaatio" className="flex-1 px-2.5">
        <ul className="space-y-0.5">
          {ITEMS.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === item.href
                : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="rf-press flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] font-medium"
                  style={{
                    background: active ? "var(--rf-inset)" : "transparent",
                    color: active ? "var(--rf-text)" : "var(--rf-text-2)",
                  }}
                >
                  <Icon path={item.icon} size={19} />
                  <span className="hidden flex-1 lg:inline">{item.label}</span>
                  {item.href === "/admin/ilmoitukset" && badgeCount > 0 ? (
                    <span
                      className="rf-tabular ml-auto hidden min-w-[20px] px-1.5 py-0.5 text-center text-[11px] font-semibold lg:inline"
                      style={{
                        background: "var(--rf-red)",
                        color: "#fff",
                        borderRadius: 999,
                      }}
                    >
                      {badgeCount}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        className="m-2.5 flex items-center gap-3 rounded-[12px] px-3 py-3"
        style={{ background: "var(--rf-inset)" }}
      >
        <Avatar initials="MV" size={34} />
        <div className="hidden min-w-0 lg:block">
          <p className="truncate text-[13px] font-semibold">Mika Virtanen</p>
          <p className="text-[12px]" style={{ color: "var(--rf-text-2)" }}>
            Manager
          </p>
        </div>
      </div>
    </aside>
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

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { adminNavFor } from "@/lib/restoflow/permissions";
import { ROLE_LABELS, type Role } from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";
import { Avatar } from "@/components/restoflow/ui";

/**
 * Hallintanavigaatio.
 *
 * Kohdat tulevat roolin oikeuksista, eivät kovakoodatusta listasta. Sama
 * funktio ohjaa sivujen pääsytarkistusta, joten valikko ei voi ajautua eri
 * linjalle kuin todellinen oikeus.
 */
export function Sidebar({
  role,
  userName,
  restaurantName,
  alertCount,
}: {
  role: Role;
  userName: string;
  restaurantName: string;
  alertCount: number;
}) {
  const pathname = usePathname();
  const items = adminNavFor(role);

  return (
    <aside
      className="flex shrink-0 flex-col border-r lg:w-[232px]"
      style={{ borderColor: "var(--rf-line)", background: "var(--rf-card)" }}
    >
      <div className="px-5 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="hidden text-[17px] font-semibold tracking-tight lg:inline">
            RestoFlow
          </span>
        </Link>
        <p
          className="mt-2 hidden truncate text-[12px] lg:block"
          style={{ color: "var(--rf-text-3)" }}
        >
          {restaurantName}
        </p>
      </div>

      <nav aria-label="Hallintanavigaatio" className="flex-1 px-2.5">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === item.href
                : pathname.startsWith(item.href);

            const badge = item.href === "/admin/ilmoitukset" ? alertCount : 0;

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
                  <span
                    aria-hidden="true"
                    className="grid h-6 w-6 shrink-0 place-items-center"
                  >
                    <RfIcon name={item.icon} size={19} />
                  </span>
                  <span className="hidden flex-1 lg:inline">{item.label}</span>
                  {badge > 0 ? (
                    <span
                      className="rf-tabular ml-auto hidden min-w-[20px] px-1.5 py-0.5 text-center text-[11px] font-semibold lg:inline"
                      style={{ background: "var(--rf-red)", color: "#fff", borderRadius: 999 }}
                    >
                      {badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-2.5 pb-2">
        <Link
          href="/app"
          className="rf-press flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] font-medium"
          style={{ color: "var(--rf-text-3)" }}
        >
          <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center">
            <RfIcon name="clock" size={17} />
          </span>
          <span className="hidden lg:inline">Työntekijänäkymä</span>
        </Link>
      </div>

      <div
        className="m-2.5 rounded-[12px] p-3"
        style={{ background: "var(--rf-inset)" }}
      >
        <div className="flex items-center gap-3">
          <Avatar initials={initialsOf(userName)} size={34} />
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-[13px] font-semibold">{userName}</p>
            <p className="text-[12px]" style={{ color: "var(--rf-text-2)" }}>
              {ROLE_LABELS[role]}
            </p>
          </div>
        </div>

        <form action={signOut} className="mt-2.5">
          <button
            type="submit"
            className="rf-press flex w-full items-center justify-center gap-2 py-2 text-[13px] font-medium"
            style={{
              background: "var(--rf-card)",
              color: "var(--rf-text-2)",
              borderRadius: "10px",
            }}
          >
            <RfIcon name="logout" size={15} />
            <span className="hidden lg:inline">Kirjaudu ulos</span>
          </button>
        </form>
      </div>
    </aside>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
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

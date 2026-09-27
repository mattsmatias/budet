"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Työntekijän kaksi näkymää.
 *
 * Aktiivinen kohta merkitään taustalla eikä pelkällä värillä: väri
 * yksin katoaa kirkkaassa valossa, ja esittely pidetään usein
 * ikkunan ääressä.
 */
const KOHDAT = [
  { href: "/esittely" as const, label: "Esittely" },
  { href: "/ilmoita" as const, label: "Ilmoita yritys" },
];

export function TiimiNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Tiimi" className="flex items-center gap-1">
      {KOHDAT.map((k) => {
        const active = pathname === k.href;

        return (
          <Link
            key={k.href}
            href={k.href}
            aria-current={active ? "page" : undefined}
            className="rf-press px-2.5 py-1.5 text-[13px]"
            style={{
              background: active ? "var(--rf-inset)" : "transparent",
              color: active ? "var(--rf-text)" : "var(--rf-text-2)",
              fontWeight: active ? 700 : 500,
              borderRadius: 980,
            }}
          >
            {k.label}
          </Link>
        );
      })}
    </nav>
  );
}

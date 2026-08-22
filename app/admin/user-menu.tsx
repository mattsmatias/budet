"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/(auth)/actions";
import { ROLE_LABELS, type Role } from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";

/**
 * Tunnusvalikko oikeassa yläkulmassa.
 *
 * Asetukset ja uloskirjautuminen olivat aiemmin kahdessa eri paikassa:
 * asetukset navigaatiossa muiden näkymien seassa, uloskirjautuminen
 * sivupalkin alalaidassa. Kumpikaan ei ole päivittäinen tehtävä eikä
 * kuulu samaan listaan kuin Kuitit ja Työvuorot — ne ovat tilin
 * hallintaa, ja tilin hallinta löytyy tunnuksen takaa.
 *
 * Valikko sulkeutuu ulkopuolisesta napautuksesta ja Esc-näppäimestä.
 * Kumpikin on tapa jolla valikot suljetaan, ja jos vain toinen toimii,
 * käyttäjä ehtii kokeilla väärää.
 */
export function UserMenu({
  userName,
  restaurantName,
  role,
  canOpenSettings,
}: {
  userName: string;
  restaurantName: string;
  role: Role;
  canOpenSettings: boolean;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Tunnus: ${userName}`}
        className="rf-press flex h-9 w-9 items-center justify-center text-[13px] font-semibold"
        style={{
          background: open ? "var(--rf-accent-bg)" : "var(--rf-inset)",
          color: open ? "var(--rf-accent-strong)" : "var(--rf-text-2)",
          borderRadius: "50%",
        }}
      >
        {initialOf(userName)}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Tunnus"
          className="rf-enter absolute right-0 z-40 mt-2 w-60 overflow-hidden"
          style={{
            background: "var(--rf-card)",
            border: "1px solid var(--rf-line)",
            borderRadius: "var(--rf-r-control)",
            boxShadow: "var(--rf-shadow-lg)",
          }}
        >
          <div
            className="border-b px-4 py-3"
            style={{ borderColor: "var(--rf-line)" }}
          >
            <p className="truncate text-[14px] font-semibold">{userName}</p>
            <p className="truncate text-[12px]" style={{ color: "var(--rf-text-2)" }}>
              {ROLE_LABELS[role]} · {restaurantName}
            </p>
          </div>

          <div className="p-1.5">
            {canOpenSettings ? (
              <Link
                href="/admin/asetukset"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="rf-press flex items-center gap-2.5 rounded-[9px] px-2.5 py-2.5 text-[14px]"
                style={{ color: "var(--rf-text)" }}
              >
                <span style={{ color: "var(--rf-text-3)" }}>
                  <RfIcon name="settings" size={17} />
                </span>
                Asetukset
              </Link>
            ) : null}

            <Link
              href="/app"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="rf-press flex items-center gap-2.5 rounded-[9px] px-2.5 py-2.5 text-[14px]"
              style={{ color: "var(--rf-text)" }}
            >
              <span style={{ color: "var(--rf-text-3)" }}>
                <RfIcon name="clock" size={17} />
              </span>
              Työntekijänäkymä
            </Link>

            <form action={signOut}>
              <button
                type="submit"
                role="menuitem"
                className="rf-press flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2.5 text-left text-[14px]"
                style={{ color: "var(--rf-red-text)" }}
              >
                <RfIcon name="logout" size={17} />
                Kirjaudu ulos
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

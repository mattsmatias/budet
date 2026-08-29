"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RfIcon } from "@/components/restoflow/icons";
import { DEV_NAV, isDevPath } from "./nav-items";

/**
 * Konsolin navigaatio.
 *
 * SAMA MUOTOKIELI KUIN RAVINTOLAN PUOLELLA.
 *
 * Leveys, välit, kulmasäteet ja värit tulevat samoista muuttujista.
 * Kaksi eri näköistä käyttöliittymää samassa sovelluksessa tarkoittaisi
 * kahta ylläpidettävää tyyliä, ja niistä toinen jäisi aina jälkeen.
 *
 * Ero on otsikossa, ei tyylissä: kisko sanoo "Developer", jotta
 * järjestelmätason näkymää ei sekoita oman ravintolan näkymään.
 */
export function DevNav() {
  const pathname = usePathname();

  return (
    <aside
      className="rf-no-print sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r md:flex"
      style={{ borderColor: "var(--rf-line)", background: "var(--rf-sidebar)" }}
    >
      <div className="px-[18px] pb-3 pt-[14px]">
        <Link href="/kehittaja" className="block">
          <span className="block text-[16px] font-extrabold tracking-[-0.02em]">
            Kate
          </span>
          <span
            className="mt-0.5 block text-[10.5px] font-bold uppercase"
            style={{ color: "var(--rf-text-3)", letterSpacing: "0.07em" }}
          >
            Developer Console
          </span>
        </Link>
      </div>

      <nav
        aria-label="Konsolin navigaatio"
        className="flex-1 overflow-y-auto px-3 pb-2"
      >
        {DEV_NAV.map((section) => (
          <div key={section.id}>
            {section.id === "main" ? null : (
              <p
                id={`dev-nav-${section.id}`}
                className="rf-rail-head px-[11px] pb-1 pt-3 text-[10.5px] font-bold uppercase"
                style={{ color: "var(--rf-text-3)", letterSpacing: "0.07em" }}
              >
                {section.label}
              </p>
            )}

            <ul
              aria-label={section.id === "main" ? section.label : undefined}
              aria-labelledby={
                section.id === "main" ? undefined : `dev-nav-${section.id}`
              }
            >
              {section.items.map((item) => {
                const active = isDevPath(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className="rf-rail-link rf-press flex items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-[13.5px] leading-[1.5] tracking-[-0.0083em]"
                      style={{
                        background: active ? "var(--rf-inset)" : "transparent",
                        color: active ? "var(--rf-text)" : "var(--rf-text-2)",
                        fontWeight: active ? 700 : 500,
                      }}
                    >
                      <RfIcon name={item.icon} size={17} strokeWidth={1.8} />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/*
        Paluu omaan ravintolaan.

        Ylläpitäjä on myös tavallinen käyttäjä. Ilman tätä riviä
        konsolista pääsee pois vain kirjoittamalla osoitteen käsin.
      */}
      <div
        className="border-t px-3 py-2"
        style={{ borderColor: "var(--rf-line)" }}
      >
        <Link
          href="/admin"
          className="rf-rail-link rf-press flex items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-[13px] font-medium"
          style={{ color: "var(--rf-text-2)" }}
        >
          <RfIcon name="back" size={16} strokeWidth={1.8} />
          Takaisin Kateen
        </Link>
      </div>
    </aside>
  );
}

/**
 * Kapean ruudun valikko.
 *
 * Konsoli on työpöytätyökalu, mutta tabletilla pitää päästä
 * katsomaan. Vaakarivi vierittyy eikä yritä mahtua kerralla.
 */
export function DevNavMobile() {
  const pathname = usePathname();
  const items = DEV_NAV.flatMap((s) => s.items);

  return (
    <nav
      aria-label="Konsolin navigaatio"
      className="rf-no-print sticky top-0 z-20 flex gap-1 overflow-x-auto border-b px-3 py-2 md:hidden"
      style={{ borderColor: "var(--rf-line)", background: "var(--rf-sidebar)" }}
    >
      {items.map((item) => {
        const active = isDevPath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="rf-press flex shrink-0 items-center gap-2 rounded-[10px] px-3 py-2 text-[13px]"
            style={{
              background: active ? "var(--rf-inset)" : "transparent",
              color: active ? "var(--rf-text)" : "var(--rf-text-2)",
              fontWeight: active ? 700 : 500,
            }}
          >
            <RfIcon name={item.icon} size={16} strokeWidth={1.8} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

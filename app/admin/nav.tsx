"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  can,
  adminNavFor,
  adminNavSectionsFor,
  primaryNavFor,
  type NavEntry,
} from "@/lib/restoflow/permissions";
import type { Role } from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";
import { signOut } from "@/app/(auth)/actions";
import { ThemeToggle } from "./theme-toggle";

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
  user,
  counts,
  alerts,
}: {
  role: Role;
  user: { name: string; roleLabel: string; initials: string };
  /** Avoimien huomioiden määrä ilmoitusriville. */
  alerts: number;
  /**
   * Lukumäärät valikon kohtiin, avaimena polku.
   *
   * Vain se mikä odottaa ihmistä: tarkistettavat kuitit, tekijättömät
   * vuorot, palkkalaskelmien huomiot. Luku joka ei vaadi mitään on
   * koriste, ja koristeluku opettaa ohittamaan kaikki luvut.
   */
  counts: Record<string, number>;
}) {
  const sections = adminNavSectionsFor(role);
  const primary = primaryNavFor(role);

  return (
    <>
      <DesktopSidebar
        sections={sections}
        user={user}
        counts={counts}
        alerts={alerts}
        canOpenSettings={can(role, "settings.view")}
      />
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
  sections,
  user,
  counts,
  alerts,
  canOpenSettings,
}: {
  sections: ReturnType<typeof adminNavSectionsFor>;
  user: { name: string; roleLabel: string; initials: string };
  counts: Record<string, number>;
  alerts: number;
  canOpenSettings: boolean;
}) {
  return (
    <aside
      className="sticky top-0 hidden h-screen rf-no-print w-[232px] shrink-0 flex-col border-r md:flex"
      style={{ borderColor: "var(--rf-line)", background: "var(--rf-sidebar)" }}
    >
      <div className="px-5 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[16px] font-extrabold tracking-[-0.02em]">Budet</span>
        </Link>
      </div>

      <nav
        aria-label="Hallintanavigaatio"
        className="flex-1 overflow-y-auto px-4 pb-4"
      >
        {sections.map((section) => (
          <div key={section.id} className="mb-1 last:mb-0">
            {/*
             * Otsikko on ryhmän nimi eikä koriste, joten se merkitään
             * myös rakenteeseen: ruudunlukija kuulee listan nimen eikä
             * vain seitsemää irrallista linkkiä.
             */}
            <ul aria-label={section.label} className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink key={item.href} item={item} count={counts[item.href] ?? 0} />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/*
       * Matti erotettuna pohjalle. Se ei kuulu mihinkään osastoon: se ei
       * ole sivu vaan tapa käyttää kaikkia muita.
       *
       * Asetukset oli tässä alla. Se oli myös tunnusvalikossa, eli
       * kahdessa paikassa — ja kaksi paikkaa samalle asialle on kaksi
       * paikkaa joita pitää etsiä. Se löytyy nyt vain oikean yläkulman
       * tunnusvalikosta, uloskirjautumisen vierestä: molemmat koskevat
       * käyttäjää eivätkä ravintolan työtä.
       */}
      <div className="border-t px-3 pb-4 pt-3" style={{ borderColor: "var(--rf-line)" }}>
        <Link
          href="/admin/ilmoitukset"
          className="rf-press mb-1 flex items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-[13.5px] font-medium"
          style={{ color: "var(--rf-text-2)" }}
        >
          <RfIcon name="bell" size={17} />
          <span className="flex-1">Ilmoitukset</span>
          {alerts > 0 ? (
            <span
              className="rf-tabular shrink-0 px-1.5 py-0.5 text-[11px] font-bold"
              style={{
                background: "var(--rf-accent)",
                color: "var(--rf-on-accent)",
                borderRadius: 980,
              }}
            >
              {alerts > 99 ? "99+" : alerts}
            </span>
          ) : null}
        </Link>

        {/*
         * Asetukset ja uloskirjautuminen omana ryhmänään pohjalla.
         *
         * Ne eivät ole ravintolan työtä vaan tilin hallintaa, ja siksi
         * ne ovat erillään päivittäisistä kohdista — mutta näkyvissä
         * eivätkä valikon takana. Tunnusvalikko työpöydän oikeasta
         * yläkulmasta poistui samalla: kaksi paikkaa samalle asialle on
         * kaksi paikkaa joita pitää etsiä.
         */}
        <ul aria-label="Tili" className="space-y-0.5">
          {canOpenSettings ? (
            <NavLink
              item={{
                href: "/admin/asetukset",
                label: "Asetukset",
                icon: "settings",
                requires: "settings.view",
                section: "main",
              }}
              count={0}
            />
          ) : null}
          <li>
            <form action={signOut}>
              <button
                type="submit"
                className="rf-press flex w-full items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-left text-[13.5px] font-medium"
                style={{ color: "var(--rf-text-2)" }}
              >
                <RfIcon name="logout" size={17} />
                <span>Kirjaudu ulos</span>
              </button>
            </form>
          </li>
        </ul>

        <div
          className="mt-1 flex items-center gap-2.5 rounded-[10px] px-2.5 py-2"
          style={{ background: "var(--rf-inset)" }}
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center text-[11px] font-bold"
            style={{
              background: "var(--rf-accent-bg)",
              // Merkkiväri jää 4,25:een omalla vaalealla pohjallaan.
              // Nimikirjaimet ovat tekstiä, joten ne saavat tummemman.
              color: "var(--rf-accent-strong)",
              borderRadius: "50%",
            }}
          >
            {user.initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-bold">{user.name}</span>
            <span className="block truncate text-[11.5px]" style={{ color: "var(--rf-text-3)" }}>
              {user.roleLabel}
            </span>
          </span>
        </div>

        <ThemeToggle />
      </div>

    </aside>
  );
}

function NavLink({ item, count }: { item: NavEntry; count: number }) {
  const isActive = useActive();
  const active = isActive(item.href);

  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        /*
         * Ikoni ja sana yhdessä.
         *
         * Ikoni yksin ei kerro mitä sivulla on, mutta sanan rinnalla se
         * antaa riville tarttumapinnan: silmä löytää tutun muodon
         * ennen kuin ehtii lukea. Valinta on täytetty pinta eikä
         * pelkkä lihavointi, jotta se erottuu myös vilkaisulla.
         */
        className="rf-press flex items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-[13.5px]"
        style={{
          background: active ? "var(--rf-inset)" : "transparent",
          color: active ? "var(--rf-text)" : "var(--rf-text-2)",
          fontWeight: active ? 700 : 500,
        }}
      >
        <RfIcon name={item.icon} size={17} />
        <span className="flex-1">{item.label}</span>

        {count > 0 ? (
          <span
            className="rf-tabular shrink-0 px-1.5 py-0.5 text-[11px] font-semibold"
            style={{
              background: "var(--rf-amber-bg)",
              color: "var(--rf-amber-text)",
              borderRadius: 980,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </Link>
    </li>
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
                /* Valittu välilehti on korostusvärillä kuten kiskossakin:
                   sininen oli tässä ainoa paikka jossa "valittu" oli
                   sininen, ja puhelin näytti eri sovellukselta. */
                style={{ color: active ? "var(--rf-accent)" : "var(--rf-text-3)" }}
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
                color: isActive("/admin/lisaa") ? "var(--rf-accent)" : "var(--rf-text-3)",
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

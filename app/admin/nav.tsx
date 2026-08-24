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
import { MattiPanel } from "./matti/panel";

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
  counts,
}: {
  role: Role;
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
      <DesktopSidebar sections={sections} counts={counts} matti={can(role, "matti.use")} />
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
  counts,
  matti,
}: {
  sections: ReturnType<typeof adminNavSectionsFor>;
  counts: Record<string, number>;
  /** Onko roolilla oikeus Mattiin. */
  matti: boolean;
}) {
  return (
    <aside
      className="sticky top-0 hidden h-screen rf-no-print w-[232px] shrink-0 flex-col border-r md:flex"
      style={{ borderColor: "var(--rf-line)", background: "var(--rf-sidebar)" }}
    >
      <div className="px-[18px] pb-4 pt-[18px]">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[16px] font-extrabold tracking-[-0.02em]">Budet</span>
        </Link>
      </div>

      <nav
        aria-label="Hallintanavigaatio"
        className="flex-1 overflow-y-auto px-3 pb-3 pt-1"
      >
        {/*
          Ryhmät erottuvat väljyydellä, eivät viivalla eivätkä
          otsikolla.

          Kymmenen samannäköistä riviä luetaan yhtenä pötkönä, ja
          silmä joutuu lukemaan joka kerta koko listan. Otsikot
          nimeäisivät ryhmät mutta veisivät sata pikseliä pystyssä —
          matalalla ruudulla kisko alkaisi vieriä, ja vierivä valikko
          on huonompi kuin nimeämätön.
        */}
        {sections.map((section) => (
          <div key={section.id} className="mb-2.5 last:mb-0">
            {/*
             * Otsikko on ryhmän nimi eikä koriste, joten se merkitään
             * myös rakenteeseen: ruudunlukija kuulee listan nimen eikä
             * vain seitsemää irrallista linkkiä.
             */}
            <ul aria-label={section.label}>
              {section.items.map((item) => (
                <NavLink key={item.href} item={item} count={counts[item.href] ?? 0} />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/*
        Kiskon pohjalla vain Matti.

        Tässä oli Ilmoitukset, Asetukset, Kirjaudu ulos, tunnusrivi ja
        teemakytkin — kaikki tilin hallintaa, ja kaikki myös yläpalkin
        tunnusvalikossa. Kaksi paikkaa samalle asialle on kaksi paikkaa
        joita pitää etsiä, ja kisko on ravintolan työtä varten.

        Matti ei ole sivu vaan tapa käyttää kaikkia muita, joten se ei
        kuulu mihinkään osastoon vaan omalle rivilleen viivan alle.
      */}
      {matti ? (
        <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "var(--rf-line)" }}>
          <MattiPanel enabled />
        </div>
      ) : null}

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
        className="rf-press mb-0.5 flex items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-[13.5px] leading-[1.5] tracking-[-0.0083em]"
        style={{
          background: active ? "var(--rf-inset)" : "transparent",
          color: active ? "var(--rf-text)" : "var(--rf-text-2)",
          fontWeight: active ? 700 : 500,
        }}
      >
        <RfIcon name={item.icon} size={17} strokeWidth={1.8} />
        <span className="flex-1">{item.label}</span>

        {count > 0 ? (
          <span
            className="rf-tabular shrink-0 px-1.5 py-px text-[10.5px] font-semibold"
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

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
import type { Briefing } from "@/lib/matti/briefing";
import type { AdminText } from "@/lib/i18n/admin-text";

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
  briefing,
  greeting,
  restaurantName,
  t,
}: {
  role: Role;
  /** Kuoren tekstit; navigaation otsikot tulevat näistä. */
  t: AdminText;
  /** Näkyy kiskon tunnuslohkon alarivillä, kuten konsolissa. */
  restaurantName: string;
  /** Matin tilannekatsaus — johdettu samasta aineistosta kuin hälytykset. */
  briefing: Briefing;
  greeting: string;
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
        counts={counts}
        restaurantName={restaurantName}
        t={t}
        matti={can(role, "matti.use")}
        briefing={briefing}
        greeting={greeting}
      />
      <MobileBar items={primary} t={t} />
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
  briefing,
  greeting,
  restaurantName,
  t,
}: {
  briefing: Briefing;
  greeting: string;
  restaurantName: string;
  t: AdminText;
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
      {/*
        Tunnuslohko.

        SAMA LOCKUP KUIN KONSOLISSA.

        Kiskon linkit olivat jo pikselintarkasti samat molemmissa
        näkymissä — mitattuna 13,5 px, paino 500, rivin korkeus 38,3 px
        ja väli 2 px. Ainoa ero oli tässä: konsolissa on kaksirivinen
        tekstilockup ja hallinnassa oli logomerkki ja yksi sana.

        Alarivi kertoo missä ollaan, kuten konsolin "Developer Console".
        Hallinnassa se on ravintolan nimi: se on sama tieto ja hyödyllinen
        heti kun ravintoloita on enemmän kuin yksi.
      */}
      <div className="px-[18px] pb-3 pt-[14px]">
        <Link href="/" className="block">
          <span className="block text-[16px] font-extrabold tracking-[-0.02em]">
            Kate
          </span>
          <span
            className="mt-0.5 block truncate text-[10.5px] font-bold uppercase"
            style={{ color: "var(--rf-text-3)", letterSpacing: "0.07em" }}
          >
            {restaurantName}
          </span>
        </Link>
      </div>

      <nav
        aria-label={t.kuori2.adminNav}
        className="flex-1 overflow-y-auto px-3 pb-2"
      >
        {/*
          Ryhmän nimi rivien yläpuolella.

          Kymmenen samannäköistä riviä luetaan yhtenä pötkönä, ja
          silmä joutuu lukemaan joka kerta koko listan. Pelkkä väljyys
          erotti ryhmät muttei kertonut mitä ne ovat.

          Ensimmäinen ryhmä jää nimeämättä: "PÄÄVALIKKO" yhden
          Yleiskatsaus-rivin yllä toistaisi sanan joka ei kerro mitään,
          ja veisi rivin verran tilaa pystyssä.

          Otsikko on ryhmän nimi eikä koriste, joten se merkitään myös
          rakenteeseen: ruudunlukija kuulee listan nimen eikä vain
          neljää irrallista linkkiä.
        */}
        {sections.map((section) => (
          <div key={section.id}>
            {section.id === "main" ? null : (
              <p
                id={`rf-nav-${section.id}`}
                className="rf-rail-head px-[11px] pb-1 pt-3 text-[10.5px] font-bold uppercase"
                style={{ color: "var(--rf-text-3)", letterSpacing: "0.07em" }}
              >
                {t.nav[section.key]}
              </p>
            )}

            <ul
              aria-label={section.id === "main" ? t.nav[section.key] : undefined}
              aria-labelledby={section.id === "main" ? undefined : `rf-nav-${section.id}`}
            >
              {section.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  count={counts[item.href] ?? 0}
                  t={t}
                />
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
        <div className="border-t px-3 pb-2 pt-2" style={{ borderColor: "var(--rf-line)" }}>
          <MattiPanel enabled briefing={briefing} greeting={greeting} />
        </div>
      ) : null}

    </aside>
  );
}

function NavLink({
  item,
  count,
  t,
}: {
  item: NavEntry;
  count: number;
  t: AdminText;
}) {
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
        className="rf-rail-link rf-press flex items-center gap-[11px] rounded-[10px] px-[11px] py-[9px] text-[13.5px] leading-[1.5] tracking-[-0.0083em]"
        style={{
          background: active ? "var(--rf-inset)" : "transparent",
          color: active ? "var(--rf-text)" : "var(--rf-text-2)",
          fontWeight: active ? 700 : 500,
        }}
      >
        <RfIcon name={item.icon} size={17} strokeWidth={1.8} />
        <span className="flex-1">{t.nav[item.key]}</span>

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
function MobileBar({ items, t }: { items: NavItems; t: AdminText }) {
  const isActive = useActive();
  const primary = items;
  // Lisää on aina mukana: sen takana ovat asetukset ja uloskirjautuminen.
  const hasMore = true;

  return (
    <nav
      aria-label={t.kuori2.adminNav}
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
                <span className="text-[10px] font-medium">{t.nav[item.key]}</span>
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
              <span className="text-[10px] font-medium">{t.nav.more}</span>
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}



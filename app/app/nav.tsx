"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RfIcon, type IconName } from "@/components/restoflow/icons";

const TABS = [
  { href: "/app", label: "Koti", icon: "overview" },
  { href: "/app/kuitit", label: "Kuitit", icon: "receipt" },
  { href: "/app/vuorot", label: "Vuorot", icon: "calendar" },
  { href: "/app/tyoaika", label: "Työaika", icon: "clock" },
  { href: "/app/lisaa", label: "Lisää", icon: "more" },
] as const satisfies readonly { href: string; label: string; icon: IconName }[];

type Tab = (typeof TABS)[number];

/**
 * Työntekijän navigaatio.
 *
 * Kaksi muotoa samasta listasta, kuten hallintapuolella: sivupalkki
 * työpöydällä, alapalkki puhelimessa. Sama viisi kohtaa molemmissa —
 * työpöytäversio ei ole eri sovellus vaan sama sovellus isolla ruudulla,
 * eikä mikään saa olla tavoitettavissa vain toisessa.
 *
 * Kuitit-välilehti näkyy vain niille joilla on oikeus kuitteihin.
 * Työntekijä ei lisää eikä lue kuitteja, joten hänelle välilehti johtaisi
 * ikuisesti tyhjään listaan.
 */
function visibleTabs(showReceipts: boolean): Tab[] {
  return TABS.filter((tab) => tab.href !== "/app/kuitit" || showReceipts);
}

/**
 * Sivupalkki työpöydälle.
 *
 * Erillinen alapalkista, koska ne eivät ole samassa kohdassa puussa:
 * sivupalkki on sisällön rinnalla, alapalkki sen alla samassa
 * pystypalstassa. Sticky-alapalkki flex-rivin jäsenenä ei tarttuisi
 * mihinkään.
 */
export function AppSidebar({
  showReceipts,
  userName,
  restaurantName,
}: {
  showReceipts: boolean;
  userName: string;
  restaurantName: string;
}) {
  return (
    <DesktopSidebar
      tabs={visibleTabs(showReceipts)}
      userName={userName}
      restaurantName={restaurantName}
    />
  );
}

/** Alapalkki puhelimeen. Sijoitetaan sisältöpalstan pohjalle. */
export function AppBottomNav({ showReceipts }: { showReceipts: boolean }) {
  return <MobileBar tabs={visibleTabs(showReceipts)} />;
}

function useActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === "/app" ? pathname === href : pathname.startsWith(href);
}

// ---------------------------------------------------------------------------

function DesktopSidebar({
  tabs,
  userName,
  restaurantName,
}: {
  tabs: Tab[];
  userName: string;
  restaurantName: string;
}) {
  const isActive = useActive();

  return (
    <aside
      className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r lg:flex"
      style={{ borderColor: "var(--rf-line)", background: "var(--rf-card)" }}
    >
      <div className="px-5 py-5">
        <Link href="/app" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[17px] font-semibold tracking-tight">Budet</span>
        </Link>
        <p className="mt-2 truncate text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {restaurantName}
        </p>
      </div>

      <nav aria-label="Päänavigaatio" className="flex-1 overflow-y-auto px-2.5 pb-4">
        <ul className="space-y-0.5">
          {tabs.map((tab) => {
            const active = isActive(tab.href);

            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className="rf-press flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px]"
                  style={{
                    background: active ? "var(--rf-accent-bg)" : "transparent",
                    color: active ? "var(--rf-accent-strong)" : "var(--rf-text-2)",
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  <RfIcon name={tab.icon} size={19} />
                  <span className="flex-1">{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t px-5 py-4" style={{ borderColor: "var(--rf-line)" }}>
        <p className="truncate text-[13px] font-medium">{userName}</p>
        <p className="mt-0.5 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          Työntekijänäkymä
        </p>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------

/**
 * Alapalkki puhelimeen.
 *
 * Viisi kohtaa, ei enempää. Kuudes kohta tarkoittaisi että jokin niistä ei
 * ansaitse paikkaansa, ja kosketuskohteista tulisi liian kapeita.
 */
function MobileBar({ tabs }: { tabs: Tab[] }) {
  const isActive = useActive();

  return (
    <nav
      aria-label="Päänavigaatio"
      className="sticky bottom-0 z-20 border-t lg:hidden"
      style={{
        borderColor: "var(--rf-line)",
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <ul className="mx-auto flex max-w-md">
        {tabs.map((tab) => {
          const active = isActive(tab.href);

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="rf-press flex flex-col items-center gap-1 py-2"
                style={{ color: active ? "var(--rf-blue)" : "var(--rf-text-3)" }}
              >
                <RfIcon name={tab.icon} size={22} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Logo() {
  return (
    <span
      className="flex h-7 w-7 items-center justify-center text-[13px] font-bold"
      style={{
        background: "var(--rf-accent)",
        color: "var(--rf-on-accent)",
        borderRadius: 8,
      }}
    >
      B
    </span>
  );
}

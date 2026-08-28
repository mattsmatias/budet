"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RfIcon, type IconName } from "@/components/restoflow/icons";

const TABS = [
  { href: "/app", label: "Koti", icon: "overview" },
  { href: "/app/vuorot", label: "Vuorot", icon: "calendar" },
  { href: "/app/tyoaika", label: "Työaika", icon: "clock" },
  { href: "/app/lisaa", label: "Lisää", icon: "more" },
] as const satisfies readonly { href: string; label: string; icon: IconName }[];

type Tab = (typeof TABS)[number];

/**
 * Työntekijän navigaatio.
 *
 * Kaksi muotoa samasta listasta, kuten hallintapuolella: sivupalkki
 * työpöydällä, alapalkki puhelimessa. Samat kohdat molemmissa —
 * työpöytäversio ei ole eri sovellus vaan sama sovellus isolla ruudulla,
 * eikä mikään saa olla tavoitettavissa vain toisessa.
 *
 * Kuitteja ei ole tässä näkymässä. Työntekijä ei lisää eikä lue niitä,
 * ja esihenkilölle sama lista on hallintanäkymässä — kahdessa paikassa
 * ylläpidetty sama sivu ajautuu ennen pitkää erilleen.
 */

/**
 * Sivupalkki työpöydälle.
 *
 * Erillinen alapalkista, koska ne eivät ole samassa kohdassa puussa:
 * sivupalkki on sisällön rinnalla, alapalkki sen alla samassa
 * pystypalstassa. Sticky-alapalkki flex-rivin jäsenenä ei tarttuisi
 * mihinkään.
 */
export function AppSidebar({ userName }: { userName: string }) {
  return <DesktopSidebar tabs={TABS} userName={userName} />;
}

/** Alapalkki puhelimeen. Sijoitetaan sisältöpalstan pohjalle. */
export function AppBottomNav() {
  return <MobileBar tabs={TABS} />;
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
}: {
  tabs: readonly Tab[];
  userName: string;
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
 * Neljä kohtaa, ei enempää. Viides kohta tarkoittaisi että jokin niistä ei
 * ansaitse paikkaansa, ja kosketuskohteista tulisi liian kapeita.
 *
 * KELLUVA PALKKI, EI POHJAAN LIIMATTU REUNA.
 *
 * Etusivun kieli on pyöristetty ja kohoava, ja tämä on ainoa asia joka on
 * ruudulla koko ajan — jos jokin kantaa sen kielen, niin tämä. Sisältö
 * vierii palkin alta läpi, mikä on myös syy sumennukseen: umpinainen
 * palkki katkaisisi listan kesken rivin.
 *
 * Palkki pysyy sticky-elementtinä, joten se varaa oman tilansa
 * pystysuunnassa eikä peitä viimeistä riviä.
 */
function MobileBar({ tabs }: { tabs: readonly Tab[] }) {
  const isActive = useActive();

  return (
    <div
      className="sticky bottom-0 z-20 px-3 pt-2 pb-3 lg:hidden"
      style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
    >
      <nav aria-label="Päänavigaatio" className="bd-app-bar mx-auto max-w-md">
        <ul className="flex">
          {tabs.map((tab) => {
            const active = isActive(tab.href);

            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className="rf-press flex flex-col items-center gap-1 pt-2 pb-2"
                  style={{
                    color: active ? "var(--rf-accent-strong)" : "var(--rf-text-3)",
                  }}
                >
                  {/*
                    Aktiivinen kohta saa taustan ikonin taakse.
                    Pelkkä värivaihdos on puhelimessa liian hiljainen: sitä
                    ei erota vilkaisulla eikä kirkkaassa ulkovalossa.

                    Ikonin ja tekstin väri on sama kuin taustan: ennen ikoni
                    oli sininen punertavalla pohjalla, mikä oli kahden eri
                    merkityksen sekoitus samassa napissa.
                  */}
                  <span
                    className="flex items-center justify-center px-4 py-1"
                    style={{
                      background: active ? "var(--rf-accent-bg)" : "transparent",
                      borderRadius: 10,
                    }}
                  >
                    <RfIcon name={tab.icon} size={21} />
                  </span>
                  <span
                    className="text-[10px]"
                    style={{ fontWeight: active ? 600 : 500 }}
                  >
                    {tab.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function Logo() {
  return (
    /*
      Sama merkkivärin tekstisävy kuin leimauspainikkeessa.

      --rf-on-accent on valkoinen molemmissa teemoissa, mutta tumman
      teeman punainen on vaalea — valkoinen kirjain jäi siinä lähes
      näkymättömäksi.
    */
    <span
      className="bd-app-accent flex h-7 w-7 items-center justify-center text-[13px] font-bold"
      style={{ borderRadius: 8 }}
    >
      B
    </span>
  );
}

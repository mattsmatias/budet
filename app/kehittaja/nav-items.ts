/**
 * Developer Consolen valikko.
 *
 * VAIN SIVUT JOILLA ON SISÄLTÖ.
 *
 * Tyhjä valikkorivi on lupaus jota ei ole lunastettu: se näyttää
 * ominaisuudelta kunnes sitä painaa. Siksi tässä on vain ne kohdat
 * joiden takana on oikeaa dataa oikeasta kannasta.
 */

import type { IconName } from "@/components/restoflow/icons";

export interface DevNavItem {
  href: string;
  label: string;
  icon: IconName;
}

export interface DevNavSection {
  id: string;
  label: string;
  items: DevNavItem[];
}

export const DEV_NAV: DevNavSection[] = [
  {
    id: "main",
    label: "Hallinta",
    items: [
      { href: "/kehittaja", label: "Yleiskatsaus", icon: "overview" },
      { href: "/kehittaja/ravintolat", label: "Ravintolat", icon: "suppliers" },
      { href: "/kehittaja/kayttajat", label: "Käyttäjät", icon: "staff" },
      { href: "/kehittaja/tilaukset", label: "Tilaukset", icon: "budget" },
    ],
  },
  {
    id: "jarjestelma",
    label: "Järjestelmä",
    items: [
      { href: "/kehittaja/tila", label: "Järjestelmän tila", icon: "trend" },
      { href: "/kehittaja/liput", label: "Feature flagit", icon: "settings" },
      { href: "/kehittaja/loki", label: "Toimintaloki", icon: "report" },
    ],
  },
];

/** Onko polku konsolin sivu? Käytetään aktiivisen rivin päättelyyn. */
export function isDevPath(pathname: string, href: string): boolean {
  if (href === "/kehittaja") return pathname === "/kehittaja";
  return pathname === href || pathname.startsWith(`${href}/`);
}

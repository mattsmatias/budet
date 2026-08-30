"use client";

import { usePathname } from "next/navigation";
import { ADMIN_NAV } from "@/lib/restoflow/permissions";
import type { AdminText } from "@/lib/i18n/admin-text";

/**
 * Sivun nimi yläpalkkiin.
 *
 * Nimi luetaan reitistä eikä anneta jokaiselta sivulta erikseen.
 * Kaksi totuutta samasta nimestä ajautuu erilleen: valikossa lukisi
 * "Työvuorot" ja otsikossa "Vuorolista", eikä kumpikaan olisi väärin
 * omalla tavallaan.
 *
 * Pisin osuma voittaa, jotta /admin/kuitit/uusi saa nimensä
 * Kuiteilta eikä Yleiskatsaukselta.
 */
const lisasivut = (t: AdminText): { href: string; label: string }[] => [
  { href: "/admin/havainnot", label: t.loput.insights },
  { href: "/admin/ilmoitukset", label: t.loput.notifications },
  { href: "/admin/asetukset", label: t.loput.settings },
  { href: "/admin/myynti", label: t.loput.sales },
  { href: "/admin/toimittajat", label: t.loput.suppliersTitle },
  { href: "/admin/lisaa", label: t.loput.more },
  /*
   * Kuitin lisäys on oma nimensä.
   *
   * Pisin osuma antaisi sille t.loput.receiptsWord, ja lomake näyttäisi
   * kuittilistalta. Sivun nimi on ainoa asia joka erottaa ne, kun
   * sivu ei enää kirjoita omaa otsikkoaan.
   */
  { href: "/admin/kuitit/uusi", label: t.loput.newReceipt },
  /* Toimintaloki ei ole valikossa: se löytyy asetuksista. */
  { href: "/admin/loki", label: t.loput.activityLog },
];

export function PageTitle({ fallback, t }: { fallback: string; t: AdminText }) {
  const pathname = usePathname();

  const routes = [
    ...ADMIN_NAV.map((e) => ({ href: e.href, label: t.nav[e.key] })),
    ...lisasivut(t),
  ];

  const match = routes
    .filter((r) => pathname === r.href || pathname.startsWith(`${r.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return <>{match?.label ?? fallback}</>;
}

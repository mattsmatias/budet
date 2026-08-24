"use client";

import { usePathname } from "next/navigation";
import { ADMIN_NAV } from "@/lib/restoflow/permissions";

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
const EXTRA: { href: string; label: string }[] = [
  { href: "/admin/havainnot", label: "Havainnot" },
  { href: "/admin/ilmoitukset", label: "Ilmoitukset" },
  { href: "/admin/asetukset", label: "Asetukset" },
  { href: "/admin/myynti", label: "Myynti" },
  { href: "/admin/toimittajat", label: "Toimittajat" },
  { href: "/admin/lisaa", label: "Lisää" },
];

export function PageTitle({ fallback }: { fallback: string }) {
  const pathname = usePathname();

  const routes = [...ADMIN_NAV.map((e) => ({ href: e.href, label: e.label })), ...EXTRA];

  const match = routes
    .filter((r) => pathname === r.href || pathname.startsWith(`${r.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return <>{match?.label ?? fallback}</>;
}

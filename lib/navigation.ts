/**
 * Roolipohjainen navigaatio (§5).
 *
 * Yksi lähde totuudelle siitä mitä kukin rooli näkee. Sama funktio ohjaa
 * sekä valikkoa että palvelinpuolen pääsytarkistusta, jotta valikko ei voi
 * ajautua eri linjalle kuin todellinen oikeus.
 */

export type Role =
  | "business_owner"
  | "accountant"
  | "firm_admin"
  | "firm_staff"
  | "company_admin"
  | "employee"
  | "super_admin";

export interface NavItem {
  href: string;
  label: string;
  roles: Role[];
  /** Näkyy valikossa mutta ei ole vielä toteutettu (§74). */
  comingSoon?: boolean;
}

const ALL: Role[] = [
  "business_owner",
  "accountant",
  "firm_admin",
  "firm_staff",
  "company_admin",
  "employee",
  "super_admin",
];

const FIRM: Role[] = ["accountant", "firm_admin", "firm_staff", "super_admin"];

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Yleiskuva", roles: ALL },
  { href: "/inbox", label: "Saapuneet", roles: ALL },
  { href: "/documents", label: "Dokumentit", roles: ALL },
  { href: "/transactions", label: "Tapahtumat", roles: ALL },
  { href: "/vat", label: "ALV", roles: ALL },
  { href: "/review", label: "Tarkistus", roles: ALL },
  { href: "/trips", label: "Matkat", roles: ALL },
  { href: "/exports", label: "Viennit", roles: ALL },
  { href: "/clients", label: "Asiakkaat", roles: FIRM },
  { href: "/reports", label: "Raportit", roles: ALL },
  { href: "/rules", label: "Säännöt", roles: ["super_admin", "firm_admin", "accountant"] },
  { href: "/audit", label: "Audit trail", roles: ALL },
  { href: "/settings", label: "Asetukset", roles: ALL },
];

export function navigationFor(role: Role): NavItem[] {
  // Työntekijä näkee vain oman kuittivirtansa ja matkansa.
  if (role === "employee") {
    return NAV.filter((i) => ["/dashboard", "/inbox", "/trips"].includes(i.href));
  }
  return NAV.filter((i) => i.roles.includes(role));
}

export function canAccess(role: Role, href: string): boolean {
  return navigationFor(role).some((i) => href.startsWith(i.href));
}

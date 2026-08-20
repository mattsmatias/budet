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
  badge?: number;
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
  { href: "/documents", label: "Dokumentit", roles: ALL, comingSoon: true },
  { href: "/transactions", label: "Tapahtumat", roles: ALL, comingSoon: true },
  { href: "/vat", label: "ALV", roles: ALL, comingSoon: true },
  { href: "/review", label: "Tarkistus", roles: ALL, badge: 3 },
  { href: "/trips", label: "Matkat", roles: ALL, comingSoon: true },
  { href: "/exports", label: "Viennit", roles: ALL, comingSoon: true },
  { href: "/clients", label: "Asiakkaat", roles: FIRM, comingSoon: true },
  { href: "/reports", label: "Raportit", roles: ALL, comingSoon: true },
  { href: "/rules", label: "Säännöt", roles: ["super_admin", "firm_admin", "accountant"], comingSoon: true },
  { href: "/audit", label: "Audit trail", roles: ALL, comingSoon: true },
  { href: "/settings", label: "Asetukset", roles: ALL, comingSoon: true },
];

export function navigationFor(role: Role): NavItem[] {
  // Työntekijä näkee vain oman kuittivirtansa.
  if (role === "employee") {
    return NAV.filter((i) => ["/dashboard", "/inbox", "/trips"].includes(i.href));
  }
  return NAV.filter((i) => i.roles.includes(role));
}

export function canAccess(role: Role, href: string): boolean {
  return navigationFor(role).some((i) => href.startsWith(i.href));
}

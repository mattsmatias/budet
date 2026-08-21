/**
 * Roolit ja oikeudet.
 *
 * Yksi taulukko joka määrää mitä kukin rooli näkee ja saa tehdä. Sama
 * funktio ohjaa sekä navigaatiota että sivujen pääsytarkistusta — jos
 * valikko ja tarkistus olisivat erillään, ne ajautuisivat eri linjalle ja
 * piilotettu linkki näyttäisi turvatoimelta olematta sellainen.
 *
 * Kirjanpitäjä on tässä tärkein tapaus: hän tarvitsee kulut, ALV:t ja
 * raportit, mutta ei työntekijöiden henkilökohtaisia tietoja.
 */

import type { Role } from "./types";

export type Capability =
  | "receipts.view"
  | "receipts.add"
  | "receipts.edit"
  | "expenses.view"
  | "suppliers.view"
  | "budgets.view"
  | "budgets.edit"
  | "shifts.view.own"
  | "shifts.view.all"
  | "shifts.manage"
  | "time.track.own"
  | "time.view.all"
  | "staff.view"
  | "staff.rates.view"
  | "staff.manage"
  | "reports.view"
  | "reports.export"
  | "alerts.view"
  | "settings.view"
  | "settings.edit";

const OWNER: Capability[] = [
  "receipts.view", "receipts.add", "receipts.edit",
  "expenses.view", "suppliers.view",
  "budgets.view", "budgets.edit",
  "shifts.view.own", "shifts.view.all", "shifts.manage",
  "time.track.own", "time.view.all",
  "staff.view", "staff.rates.view", "staff.manage",
  "reports.view", "reports.export",
  "alerts.view", "settings.view", "settings.edit",
];

const MANAGER: Capability[] = [
  "receipts.view", "receipts.add", "receipts.edit",
  "expenses.view", "suppliers.view",
  "budgets.view",
  "shifts.view.own", "shifts.view.all", "shifts.manage",
  "time.track.own", "time.view.all",
  "staff.view", "staff.rates.view",
  "reports.view", "reports.export",
  "alerts.view", "settings.view",
];

const EMPLOYEE: Capability[] = [
  "receipts.add",
  "shifts.view.own",
  "time.track.own",
];

/**
 * Kirjanpitäjä: talous kyllä, henkilöstön yksityiskohdat ei.
 *
 * Ei `staff.rates.view` — tuntipalkat ovat henkilötietoa jota kirjanpitäjä
 * ei tarvitse kuluraportin lukemiseen. Työaika näkyy kokonaistunteina
 * raporteissa.
 */
const ACCOUNTANT: Capability[] = [
  "receipts.view",
  "expenses.view", "suppliers.view",
  "budgets.view",
  "reports.view", "reports.export",
  "time.view.all",
  "alerts.view",
];

const BY_ROLE: Record<Role, Capability[]> = {
  owner: OWNER,
  manager: MANAGER,
  employee: EMPLOYEE,
  accountant: ACCOUNTANT,
};

export function can(role: Role, capability: Capability): boolean {
  return BY_ROLE[role].includes(capability);
}

export function capabilitiesOf(role: Role): Capability[] {
  return [...BY_ROLE[role]];
}

/** Näkeekö rooli toisen työntekijän kuitit, vai vain omansa? */
export function seesAllReceipts(role: Role): boolean {
  return can(role, "receipts.view");
}

/** Näytetäänkö tuntipalkat ja niistä lasketut summat? */
export function seesPayRates(role: Role): boolean {
  return can(role, "staff.rates.view");
}

// ---------------------------------------------------------------------------
// Navigaatio
// ---------------------------------------------------------------------------

export interface NavEntry {
  href: string;
  label: string;
  emoji: string;
  /** Ikoni-avain components/restoflow/ui.tsx:n ICONS-taulusta. */
  icon: string;
  requires: Capability;
}

export const ADMIN_NAV: NavEntry[] = [
  { href: "/admin", label: "Yleiskuva", emoji: "📊", icon: "home", requires: "expenses.view" },
  { href: "/admin/kuitit", label: "Kuitit", emoji: "🧾", icon: "receipt", requires: "receipts.view" },
  { href: "/admin/kulut", label: "Kulut", emoji: "💶", icon: "chart", requires: "expenses.view" },
  { href: "/admin/toimittajat", label: "Toimittajat", emoji: "🚚", icon: "truck", requires: "suppliers.view" },
  { href: "/admin/budjetit", label: "Budjetit", emoji: "🎯", icon: "target", requires: "budgets.view" },
  { href: "/admin/tyovuorot", label: "Työvuorot", emoji: "📅", icon: "calendar", requires: "shifts.view.all" },
  { href: "/admin/tyontekijat", label: "Työntekijät", emoji: "👥", icon: "users", requires: "staff.view" },
  { href: "/admin/raportit", label: "Raportit", emoji: "📄", icon: "file", requires: "reports.view" },
  { href: "/admin/ilmoitukset", label: "Huomiot", emoji: "🔔", icon: "bell", requires: "alerts.view" },
  { href: "/admin/asetukset", label: "Asetukset", emoji: "⚙️", icon: "settings", requires: "settings.view" },
];

export function adminNavFor(role: Role): NavEntry[] {
  return ADMIN_NAV.filter((entry) => can(role, entry.requires));
}

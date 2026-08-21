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

import type { IconName } from "@/components/restoflow/icons";
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

/**
 * Työntekijä: oma työaika ja omat vuorot, ei kuluja.
 *
 * Ei `receipts.add`. Kuitti on ravintolan kirjanpitoaineistoa, ei
 * työntekijän ilmoitus: kuka tahansa vuorossa oleva ei saa synnyttää
 * kulukirjausta jota kukaan ei ole hyväksynyt. Ravintola lisää kuitit
 * itse hallintanäkymässä.
 */
const EMPLOYEE: Capability[] = [
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

/** Saako rooli lisätä kuitteja? Ravintolan esihenkilö saa, työntekijä ei. */
export function canAddReceipts(role: Role): boolean {
  return can(role, "receipts.add");
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
  /** Ikoni-avain components/restoflow/icons.tsx:n sarjasta. */
  icon: IconName;
  requires: Capability;
}

export const ADMIN_NAV: NavEntry[] = [
  { href: "/admin", label: "Yleiskuva", icon: "overview", requires: "expenses.view" },
  { href: "/admin/kuitit", label: "Kuitit", icon: "receipt", requires: "receipts.view" },
  { href: "/admin/kulut", label: "Kulut", icon: "expenses", requires: "expenses.view" },
  { href: "/admin/toimittajat", label: "Toimittajat", icon: "suppliers", requires: "suppliers.view" },
  { href: "/admin/budjetit", label: "Budjetit", icon: "budget", requires: "budgets.view" },
  { href: "/admin/tyovuorot", label: "Työvuorot", icon: "calendar", requires: "shifts.view.all" },
  { href: "/admin/tyontekijat", label: "Työntekijät", icon: "staff", requires: "staff.view" },
  { href: "/admin/raportit", label: "Raportit", icon: "report", requires: "reports.view" },
  { href: "/admin/ilmoitukset", label: "Huomiot", icon: "bell", requires: "alerts.view" },
  { href: "/admin/asetukset", label: "Asetukset", icon: "settings", requires: "settings.view" },
];

export function adminNavFor(role: Role): NavEntry[] {
  return ADMIN_NAV.filter((entry) => can(role, entry.requires));
}

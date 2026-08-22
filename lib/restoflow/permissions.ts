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
// Reitit ja navigaatio
// ---------------------------------------------------------------------------
//
// Kaksi eri asiaa, jotka on pidettävä erillään:
//
//   ROUTE_ACCESS  — mitä oikeutta polku vaatii. Kattaa KAIKKI reitit,
//                   myös ne joita ei näytetä valikossa.
//   ADMIN_NAV     — mitä valikossa näkyy. Osajoukko edellisestä.
//
// Aiemmin nämä olivat sama lista, mikä tuntui siistiltä mutta oli ansa:
// reitin poistaminen valikosta olisi poistanut siltä myös
// pääsytarkistuksen. Valikon sisältö on tuotepäätös, pääsy ei.

export interface RouteAccess {
  href: string;
  requires: Capability;
}

/**
 * Jokainen hallintareitti ja sen vaatimus.
 *
 * Uusi sivu on lisättävä tänne. Jos se puuttuu, se perii lähimmän
 * ylemmän polun vaatimuksen — /admin-juuren — eli sulkeutuu eikä jää
 * auki. Fail closed on tässä oikea oletus.
 */
export const ROUTE_ACCESS: RouteAccess[] = [
  { href: "/admin", requires: "expenses.view" },
  { href: "/admin/kuitit", requires: "receipts.view" },
  { href: "/admin/kulut", requires: "expenses.view" },
  { href: "/admin/toimittajat", requires: "suppliers.view" },
  { href: "/admin/budjetit", requires: "budgets.view" },
  { href: "/admin/tyovuorot", requires: "shifts.view.all" },
  { href: "/admin/tyontekijat", requires: "staff.view" },
  { href: "/admin/havainnot", requires: "expenses.view" },
  { href: "/admin/raportit", requires: "reports.view" },
  { href: "/admin/ilmoitukset", requires: "alerts.view" },
  { href: "/admin/asetukset", requires: "settings.view" },
];

export interface NavEntry {
  href: string;
  label: string;
  /** Ikoni-avain components/restoflow/icons.tsx:n sarjasta. */
  icon: IconName;
  requires: Capability;
}

/**
 * Päänavigaatio: kuusi kohtaa, ei enempää.
 *
 * Toimittajat, Budjetit, Havainnot ja Ilmoitukset ovat pudonneet pois.
 * Ne eivät ole vähemmän tärkeitä vaan väärässä paikassa: ne ovat
 * kulujen ja poikkeamien *analyysiä*, eivät erillisiä tehtäviä.
 * Käyttäjä ei avaa sovellusta katsoakseen "havaintoja" — hän avaa sen
 * nähdäkseen mitä pitää tehdä. Yhdentoista kohdan valikossa se hukkuu.
 *
 * Asetukset on tilin hallintaa eikä päivittäinen tehtävä, joten se
 * löytyy tunnuksen takaa oikeasta yläkulmasta.
 *
 * Reitit ovat yhä olemassa ja niihin päästään sieltä missä ne ovat
 * merkityksellisiä: yleiskuvan osioista, hälytysten linkeistä,
 * kellokuvakkeesta ja tunnusvalikosta.
 */
export const ADMIN_NAV: NavEntry[] = [
  { href: "/admin", label: "Yleiskuva", icon: "overview", requires: "expenses.view" },
  { href: "/admin/kuitit", label: "Kuitit", icon: "receipt", requires: "receipts.view" },
  { href: "/admin/kulut", label: "Kulut", icon: "expenses", requires: "expenses.view" },
  { href: "/admin/tyovuorot", label: "Työvuorot", icon: "calendar", requires: "shifts.view.all" },
  { href: "/admin/tyontekijat", label: "Työntekijät", icon: "staff", requires: "staff.view" },
  { href: "/admin/raportit", label: "Raportit", icon: "report", requires: "reports.view" },
];

/**
 * Puhelimen ylivuotovalikko.
 *
 * Alapalkkiin mahtuu neljä kohtaa; nämä ovat harvemmin tarvittavat.
 */
export const MORE_NAV: NavEntry[] = [
  { href: "/admin/tyontekijat", label: "Työntekijät", icon: "staff", requires: "staff.view" },
  { href: "/admin/budjetit", label: "Budjetit", icon: "budget", requires: "budgets.view" },
  { href: "/admin/raportit", label: "Raportit", icon: "report", requires: "reports.view" },
];

export function adminNavFor(role: Role): NavEntry[] {
  return ADMIN_NAV.filter((entry) => can(role, entry.requires));
}

/** Puhelimen alapalkin neljä ensimmäistä kohtaa. */
export function primaryNavFor(role: Role): NavEntry[] {
  return adminNavFor(role).slice(0, 4);
}

/** Ylivuotovalikon kohdat: mitä ei mahtunut alapalkkiin. */
export function moreNavFor(role: Role): NavEntry[] {
  const primary = new Set(primaryNavFor(role).map((entry) => entry.href));

  return [
    ...adminNavFor(role).filter((entry) => !primary.has(entry.href)),
    ...MORE_NAV.filter((entry) => can(role, entry.requires)),
  ].filter(
    (entry, index, all) => all.findIndex((e) => e.href === entry.href) === index,
  );
}

/**
 * Mitä oikeutta polku vaatii.
 *
 * Luetaan ROUTE_ACCESS:sta eikä valikosta, jotta valikosta piilotettu
 * reitti ei menetä pääsytarkistustaan. Pisin osuma voittaa, jotta
 * /admin/toimittajat/xyz perii /admin/toimittajat-vaatimuksen eikä osu
 * /admin-juureen.
 */
export function capabilityForPath(path: string): Capability | null {
  const matches = ROUTE_ACCESS.filter(
    (entry) => path === entry.href || path.startsWith(`${entry.href}/`),
  ).sort((a, b) => b.href.length - a.href.length);

  return matches[0]?.requires ?? null;
}

/**
 * Mihin rooli ohjataan kun sillä ei ole pääsyä pyydettyyn näkymään.
 *
 * Ensimmäinen näkymä johon oikeus riittää. Työntekijällä ei ole yhtään,
 * joten hän päätyy omaan näkymäänsä.
 */
export function landingFor(role: Role): string {
  return adminNavFor(role)[0]?.href ?? "/app";
}

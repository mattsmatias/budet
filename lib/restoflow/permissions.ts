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
  | "payroll.view"
  | "payroll.view.own"
  | "payroll.manage"
  | "sales.view"
  | "sales.manage"
  | "reports.view"
  | "reports.export"
  | "alerts.view"
  | "lunch.view"
  | "lunch.manage"
  | "matti.use"
  /*
   * Tehtävät kahtena oikeutena.
   *
   * Työntekijä näkee omat tehtävänsä ja kuittaa ne tehdyiksi, muttei
   * luo eikä siirrä määräaikoja. Kanta rajaa saman: merkintä tehdyksi
   * kulkee funktion kautta, muokkaus vaatii esihenkilön.
   */
  | "tasks.view"
  | "tasks.manage"
  | "audit.view"
  | "settings.view"
  | "settings.edit";

const OWNER: Capability[] = [
  "receipts.view", "receipts.add", "receipts.edit",
  "expenses.view", "suppliers.view",
  "budgets.view", "budgets.edit",
  "shifts.view.own", "shifts.view.all", "shifts.manage",
  "time.track.own", "time.view.all",
  "staff.view", "staff.rates.view", "staff.manage",
  "payroll.view", "payroll.view.own", "payroll.manage",
  "sales.view", "sales.manage",
  "reports.view", "reports.export",
  "lunch.view", "lunch.manage",
  "matti.use",
  "tasks.view", "tasks.manage",
  /*
   * Toimintaloki on omistajan näkymä.
   *
   * Se sisältää palkkamuutokset, käyttöoikeudet ja verokannat.
   * Vuoropäällikkö näkee oman työnsä jäljet kohteiden omista
   * näkymistä; koko yrityksen loki on omistajan.
   */
  "audit.view",
  "alerts.view", "settings.view", "settings.edit",
];

const MANAGER: Capability[] = [
  "receipts.view", "receipts.add", "receipts.edit",
  "expenses.view", "suppliers.view",
  "budgets.view",
  "shifts.view.own", "shifts.view.all", "shifts.manage",
  "time.track.own", "time.view.all",
  "staff.view", "staff.rates.view",
  "payroll.view", "payroll.view.own", "payroll.manage",
  "sales.view", "sales.manage",
  "reports.view", "reports.export",
  "lunch.view", "lunch.manage",
  "matti.use",
  "tasks.view", "tasks.manage",
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
  // Omat tehtävät ja niiden kuittaus. Rivikäytäntö rajaa mitkä
  // tehtävät hän näkee — oikeus ei avaa talous- eikä hallintotehtäviä.
  "tasks.view",
  // Oma palkkakertymä, ei muiden. Työntekijän on nähtävä mitä hänelle
  // kertyy; muiden palkka ei kuulu hänelle.
  "payroll.view.own",
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
  // Kirjanpitäjä lukee myynnin raportteja varten muttei kirjaa sitä.
  "sales.view",
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
  { href: "/admin/tehtavat", requires: "tasks.manage" },
  { href: "/admin/loki", requires: "audit.view" },
  { href: "/admin/tyontekijat", requires: "staff.view" },
  { href: "/admin/palkat", requires: "payroll.view" },
  { href: "/admin/myynti", requires: "sales.view" },
  { href: "/admin/havainnot", requires: "expenses.view" },
  { href: "/admin/lounas", requires: "lunch.view" },
  { href: "/admin/raportit", requires: "reports.view" },
  { href: "/admin/ilmoitukset", requires: "alerts.view" },
  { href: "/admin/asetukset", requires: "settings.view" },
];

/**
 * Valikon osastot.
 *
 * Ryhmittely tekee seitsemästä kohdasta luettavan: silmä etsii ensin
 * osaston ja vasta sitten rivin. Järjestys on tässä eikä
 * käyttöliittymässä, jotta uuden kohdan lisääjä joutuu päättämään
 * mihin se kuuluu.
 */
export const NAV_SECTIONS = [
  { id: "main", label: "Päävalikko" },
  { id: "finance", label: "Talous" },
  { id: "staff", label: "Henkilöstö" },
  /*
   * Ravintola ja Raportointi olivat kaksi omaa osastoaan, joissa
   * kummassakin oli yksi rivi. Yhden rivin osasto ei ryhmittele
   * mitään — se vain jakaa listan pienempiin paloihin. Nyt ne ovat
   * yhtä: kaikki mikä ei ole rahaa eikä väkeä.
   */
  { id: "restaurant", label: "Muut" },
] as const;

export type NavSection = (typeof NAV_SECTIONS)[number]["id"];

export interface NavEntry {
  href: string;
  label: string;
  /** Ikoni-avain components/restoflow/icons.tsx:n sarjasta. */
  icon: IconName;
  requires: Capability;
  section: NavSection;
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
  { href: "/admin", label: "Yleiskatsaus", icon: "overview", requires: "expenses.view", section: "main" },

  /*
   * Myynti on valikossa, ja se on TALOUDEN ensimmäinen kohta.
   *
   * Reitti oli olemassa mutta sinne pääsi vain yleiskuvan kortista.
   * Myynti on kuitenkin illan viimeinen työvaihe: kassan päiväraportti
   * kirjataan joka päivä, ja päivittäinen tehtävä kuuluu valikkoon.
   *
   * Kulut ovat vastaus kysymykseen paljonko meni; myynti kysymykseen
   * paljonko tuli. Jälkimmäinen tulee ensin, koska ilman sitä
   * ensimmäisellä ei ole mittakaavaa.
   */
  { href: "/admin/myynti", label: "Myynti", icon: "sales", requires: "sales.view", section: "finance" },

  { href: "/admin/kuitit", label: "Kuitit", icon: "receipt", requires: "receipts.view", section: "finance" },
  { href: "/admin/kulut", label: "Kulut", icon: "expenses", requires: "expenses.view", section: "finance" },
  { href: "/admin/budjetit", label: "Budjetit", icon: "budget", requires: "budgets.view", section: "finance" },

  /*
   * Toimittajat on valikossa.
   *
   * Reitti on ollut olemassa koko ajan, mutta sinne pääsi vain
   * kuitin toimittajanimen kautta — eli vasta kun tiesi jo minkä
   * toimittajan haluaa. Sivu vastaa kysymykseen "kenelle raha
   * menee", ja se on kysymys jota ei osaa esittää linkin kautta.
   */
  { href: "/admin/toimittajat", label: "Toimittajat", icon: "suppliers", requires: "suppliers.view", section: "finance" },

  /*
   * Tehtävät ovat päivittäinen kohta, ei arkisto.
   *
   * Ravintoloitsija avaa Budetin kysyäkseen mitä pitää tehdä. Tehtävä
   * jonka määräaika lähestyy on juuri se vastaus, joten se kuuluu
   * valikkoon eikä asetusten taakse.
   *
   * Vaatii tasks.manage eikä tasks.view: työntekijällä on tasks.view
   * omia tehtäviään varten, mutta hänen näkymänsä on /app eikä
   * hallinta. Ilman tätä eroa työntekijä ohjautuisi kirjautuessaan
   * hallinnan tehtäväsivulle.
   */
  { href: "/admin/tehtavat", label: "Tehtävät", icon: "check", requires: "tasks.manage", section: "main" },

  { href: "/admin/tyovuorot", label: "Työvuorot", icon: "calendar", requires: "shifts.view.all", section: "staff" },
  { href: "/admin/tyontekijat", label: "Työntekijät", icon: "staff", requires: "staff.view", section: "staff" },
  { href: "/admin/palkat", label: "Palkat", icon: "payroll", requires: "payroll.view", section: "staff" },

  { href: "/admin/lounas", label: "Lounas", icon: "lunch", requires: "lunch.view", section: "restaurant" },

  { href: "/admin/raportit", label: "Raportointi", icon: "report", requires: "reports.view", section: "restaurant" },
];

/*
 * Asetukset ei ole valikkokohta.
 *
 * Se löytyy tunnusvalikosta uloskirjautumisen vierestä: molemmat
 * koskevat käyttäjää eivätkä ravintolan työtä. Reitin suoja tulee
 * ROUTE_ACCESS-taulusta, ei valikosta — niin kuin kaikilla muillakin
 * valikon ulkopuolisilla reiteillä.
 */

/**
 * Puhelimen ylivuotovalikko.
 *
 * Alapalkkiin mahtuu neljä kohtaa; nämä ovat harvemmin tarvittavat.
 */
export const MORE_NAV: NavEntry[] = [
  { href: "/admin/tyontekijat", label: "Työntekijät", icon: "staff", requires: "staff.view", section: "staff" },
  { href: "/admin/budjetit", label: "Budjetit", icon: "budget", requires: "budgets.view", section: "finance" },
  { href: "/admin/raportit", label: "Raportointi", icon: "report", requires: "reports.view", section: "restaurant" },
];

export function adminNavFor(role: Role): NavEntry[] {
  return ADMIN_NAV.filter((entry) => can(role, entry.requires));
}

/**
 * Valikko osastoittain, tyhjät osastot pois.
 *
 * Kirjanpitäjä ei näe henkilöstöä lainkaan, joten HENKILÖSTÖ-otsikko
 * olisi hänelle tyhjä väliotsikko — otsikko ilman sisältöä lupaa
 * kohtia joita ei ole.
 */
export function adminNavSectionsFor(
  role: Role,
): { id: NavSection; label: string; items: NavEntry[] }[] {
  const items = adminNavFor(role);

  return NAV_SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    items: items.filter((item) => item.section === section.id),
  })).filter((section) => section.items.length > 0);
}

/**
 * Puhelimen alapalkin kohdat.
 *
 * Lueteltu nimeltä eikä otettu sivupalkin neljää ensimmäistä. Muuten
 * sivupalkkiin lisätty kohta työntäisi viimeisen ylivuotovalikkoon
 * hiljaa — niin kävi kun Budjetit lisättiin Kulut-kohdan perään ja
 * Työvuorot olisi tipahtanut pois. Puhelimessa vuorot ovat tärkeämmät
 * kuin budjetit, eikä sitä valintaa saa tehdä järjestysluku.
 *
 * Neljä kohtaa, ei enempää: viides tekee kosketuskohteista liian
 * kapeita. Loput ovat Lisää-välilehdellä.
 */
const PRIMARY_HREFS = [
  "/admin",
  "/admin/kuitit",
  "/admin/kulut",
  "/admin/tyovuorot",
];

export function primaryNavFor(role: Role): NavEntry[] {
  return adminNavFor(role)
    .filter((entry) => PRIMARY_HREFS.includes(entry.href))
    .slice(0, 4);
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

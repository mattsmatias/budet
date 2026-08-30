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
import type { NavKey } from "@/lib/i18n/admin-text";
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
  /*
   * Pöytävaraukset kahtena oikeutena.
   *
   * Tarjoilija tarvitsee illan varauslistan tehdäkseen työnsä, muttei
   * saa siirtää eikä perua varauksia. Sama raja on kannassa:
   * reservation_day palvelee kaikkia jäseniä ja jättää yhteystiedot
   * pois, kun taas muokkausfunktiot vaativat is_manager.
   */
  | "reservations.view"
  | "reservations.manage"
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
  /*
   * Kirjanpito kahtena oikeutena.
   *
   * Kirjanpitaja lukee mutta ei kirjaa. Se ei ole tuotepaatos vaan
   * kannan linja: is_manager kattaa omistajan ja vuoropaallikon, ja
   * samaa funktiota kayttaa kolmisenkymmenta muuta kaytantoa. Jos
   * kirjanpitajan halutaan kirjaavan, se on oma tarkoituksellinen
   * muutoksensa eika sivuvaikutus.
   */
  | "accounting.view"
  | "accounting.manage"
  | "audit.view"
  | "settings.view"
  | "settings.edit";

const OWNER: Capability[] = [
  "receipts.view",
  "receipts.add",
  "receipts.edit",
  "expenses.view",
  "suppliers.view",
  "budgets.view",
  "budgets.edit",
  "shifts.view.own",
  "shifts.view.all",
  "shifts.manage",
  "time.track.own",
  "time.view.all",
  "staff.view",
  "staff.rates.view",
  "staff.manage",
  "payroll.view",
  "payroll.view.own",
  "payroll.manage",
  "sales.view",
  "sales.manage",
  "reports.view",
  "reports.export",
  "lunch.view",
  "lunch.manage",
  "reservations.view",
  "reservations.manage",
  "matti.use",
  "tasks.view",
  "tasks.manage",
  "accounting.view",
  "accounting.manage",
  /*
   * Toimintaloki on omistajan näkymä.
   *
   * Se sisältää palkkamuutokset, käyttöoikeudet ja verokannat.
   * Vuoropäällikkö näkee oman työnsä jäljet kohteiden omista
   * näkymistä; koko yrityksen loki on omistajan.
   */
  "audit.view",
  "alerts.view",
  "settings.view",
  "settings.edit",
];

const MANAGER: Capability[] = [
  "receipts.view",
  "receipts.add",
  "receipts.edit",
  "expenses.view",
  "suppliers.view",
  "budgets.view",
  "shifts.view.own",
  "shifts.view.all",
  "shifts.manage",
  "time.track.own",
  "time.view.all",
  "staff.view",
  "staff.rates.view",
  "payroll.view",
  "payroll.view.own",
  "payroll.manage",
  "sales.view",
  "sales.manage",
  "reports.view",
  "reports.export",
  "lunch.view",
  "lunch.manage",
  "reservations.view",
  "reservations.manage",
  "matti.use",
  "tasks.view",
  "tasks.manage",
  "accounting.view",
  "accounting.manage",
  "alerts.view",
  "settings.view",
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
  /*
   * Illan varauslista, ilman asiakkaiden yhteystietoja.
   *
   * Salivuorossa on tiedettävä montako seuruetta on tulossa ja mihin
   * pöytiin. Puhelinnumero ei kuulu siihen: sillä soittaa esihenkilö
   * jos ilta muuttuu. Kanta karsii kentät, ei käyttöliittymä.
   */
  "reservations.view",
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
  "expenses.view",
  "suppliers.view",
  "budgets.view",
  "reports.view",
  "reports.export",
  "time.view.all",
  // Kirjanpitäjä lukee myynnin raportteja varten muttei kirjaa sitä.
  "sales.view",
  /*
   * Kirjanpito näkyy muttei aukea muokattavaksi.
   *
   * Kirjanpitäjä on juuri se joka kirjanpidon tekisi, mutta kannan
   * is_manager ei kata häntä eikä sitä muuteta ohimennen: samaa
   * funktiota käyttää kolmisenkymmentä muuta käytäntöä. Näkymä ja
   * kanta ovat siis samaa mieltä siitä mitä hän saa tehdä.
   */
  "accounting.view",
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
  { href: "/admin/kirjanpito", requires: "accounting.view" },
  { href: "/admin/havainnot", requires: "expenses.view" },
  { href: "/admin/lounas", requires: "lunch.view" },
  { href: "/admin/varaukset", requires: "reservations.view" },
  { href: "/admin/raportit", requires: "reports.view" },
  { href: "/admin/ilmoitukset", requires: "alerts.view" },
  { href: "/admin/asetukset", requires: "settings.view" },
  /*
   * Varausasetukset ovat asetusten alla mutta oma vaatimuksensa.
   *
   * settings.edit on vain omistajalla, mutta pöytäkartta ja aukioloajat
   * ovat vuoropäällikön työtä — ja kanta on samaa mieltä: siellä raja
   * on is_manager.
   */
  { href: "/admin/varaukset/asetukset", requires: "reservations.manage" },
  /*
   * Sosiaalisen median tili on omistajan asia.
   *
   * Yhdistäminen antaa Katelle oikeuden julkaista ravintolan nimissä,
   * ja se on eri päätös kuin lounaslistan kirjoittaminen. Julkaisu
   * itse vaatii lunch.manage, joka on myös vuoropäälliköllä.
   */
  { href: "/admin/asetukset/some", requires: "settings.edit" },
];

/**
 * Valikon osastot.
 *
 * Ryhmittely tekee seitsemästä kohdasta luettavan: silmä etsii ensin
 * osaston ja vasta sitten rivin. Järjestys on tässä eikä
 * käyttöliittymässä, jotta uuden kohdan lisääjä joutuu päättämään
 * mihin se kuuluu.
 */
/*
 * Osaston nimi tulee sanakirjasta, ei tästä.
 *
 * Lista kertoo mitä osastoja on ja missä järjestyksessä — se on
 * käyttöoikeus- ja rakenneasia. Otsikko on käännettävää tekstiä.
 */
export const NAV_SECTIONS = [
  { id: "main", key: "sectionMain" },
  { id: "finance", key: "sectionFinance" },
  { id: "staff", key: "sectionStaff" },
  /*
   * Ravintola ja Raportointi olivat kaksi omaa osastoaan, joissa
   * kummassakin oli yksi rivi. Yhden rivin osasto ei ryhmittele
   * mitään — se vain jakaa listan pienempiin paloihin. Nyt ne ovat
   * yhtä: kaikki mikä ei ole rahaa eikä väkeä.
   */
  { id: "restaurant", key: "sectionOther" },
] as const;

export type NavSection = (typeof NAV_SECTIONS)[number]["id"];

export interface NavEntry {
  href: string;
  /** Otsikon avain sanakirjassa (lib/i18n/admin-text.ts). */
  key: NavKey;
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
  {
    href: "/admin",
    key: "overview",
    icon: "overview",
    requires: "expenses.view",
    section: "main",
  },

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
  {
    href: "/admin/myynti",
    key: "sales",
    icon: "sales",
    requires: "sales.view",
    section: "finance",
  },

  {
    href: "/admin/kuitit",
    key: "receipts",
    icon: "receipt",
    requires: "receipts.view",
    section: "finance",
  },
  {
    href: "/admin/kulut",
    key: "expenses",
    icon: "expenses",
    requires: "expenses.view",
    section: "finance",
  },
  {
    href: "/admin/budjetit",
    key: "budgets",
    icon: "budget",
    requires: "budgets.view",
    section: "finance",
  },

  /*
   * Toimittajat on valikossa.
   *
   * Reitti on ollut olemassa koko ajan, mutta sinne pääsi vain
   * kuitin toimittajanimen kautta — eli vasta kun tiesi jo minkä
   * toimittajan haluaa. Sivu vastaa kysymykseen "kenelle raha
   * menee", ja se on kysymys jota ei osaa esittää linkin kautta.
   */
  {
    href: "/admin/toimittajat",
    key: "suppliers",
    icon: "suppliers",
    requires: "suppliers.view",
    section: "finance",
  },

  /*
   * Kirjanpito on talouden viimeinen kohta.
   *
   * Järjestys kertoo kulun: myynti tuli, kuitit ja kulut menivät,
   * budjetti kertoo paljonko sai mennä, toimittajat kenelle meni —
   * ja kirjanpito on se mihin kaikki edellinen päätyy.
   *
   * Se on omalla sivullaan muttei oma tietosiilonsa: sivu ei kysy
   * käyttäjältä mitään mitä Kate jo tietää.
   */
  {
    href: "/admin/kirjanpito",
    key: "accounting",
    icon: "report",
    requires: "accounting.view",
    section: "finance",
  },

  /*
   * Tehtävät ovat päivittäinen kohta, ei arkisto.
   *
   * Ravintoloitsija avaa Katen kysyäkseen mitä pitää tehdä. Tehtävä
   * jonka määräaika lähestyy on juuri se vastaus, joten se kuuluu
   * valikkoon eikä asetusten taakse.
   *
   * Vaatii tasks.manage eikä tasks.view: työntekijällä on tasks.view
   * omia tehtäviään varten, mutta hänen näkymänsä on /app eikä
   * hallinta. Ilman tätä eroa työntekijä ohjautuisi kirjautuessaan
   * hallinnan tehtäväsivulle.
   */
  {
    href: "/admin/tehtavat",
    key: "tasks",
    icon: "check",
    requires: "tasks.manage",
    section: "main",
  },

  {
    href: "/admin/tyovuorot",
    key: "shifts",
    icon: "calendar",
    requires: "shifts.view.all",
    section: "staff",
  },
  {
    href: "/admin/tyontekijat",
    key: "staff",
    icon: "staff",
    requires: "staff.view",
    section: "staff",
  },
  {
    href: "/admin/palkat",
    key: "payroll",
    icon: "payroll",
    requires: "payroll.view",
    section: "staff",
  },

  /*
   * Pöytävaraukset vaatii reservations.manage eikä .view.
   *
   * Sama syy kuin Tehtävissä: työntekijällä on reservations.view
   * salivuoroa varten, mutta hänen näkymänsä on /app. Jos valikkokohta
   * vaatisi vain lukuoikeutta, landingFor ohjaisi hänet kirjautuessaan
   * hallinnan varaussivulle.
   */
  {
    href: "/admin/varaukset",
    key: "reservations",
    icon: "tables",
    requires: "reservations.manage",
    section: "restaurant",
  },

  {
    href: "/admin/lounas",
    key: "lunch",
    icon: "lunch",
    requires: "lunch.view",
    section: "restaurant",
  },

  {
    href: "/admin/raportit",
    key: "reports",
    icon: "report",
    requires: "reports.view",
    section: "restaurant",
  },
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
  {
    href: "/admin/tyontekijat",
    key: "staff",
    icon: "staff",
    requires: "staff.view",
    section: "staff",
  },
  {
    href: "/admin/budjetit",
    key: "budgets",
    icon: "budget",
    requires: "budgets.view",
    section: "finance",
  },
  {
    href: "/admin/raportit",
    key: "reports",
    icon: "report",
    requires: "reports.view",
    section: "restaurant",
  },
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
): { id: NavSection; key: NavKey; items: NavEntry[] }[] {
  const items = adminNavFor(role);

  return NAV_SECTIONS.map((section) => ({
    id: section.id,
    key: section.key,
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
    (entry, index, all) =>
      all.findIndex((e) => e.href === entry.href) === index,
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

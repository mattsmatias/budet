/**
 * Lounaslistan viikkologiikka.
 *
 * Viikko alkaa maanantaista. Se ei ole tyyliseikka vaan sopimus jonka
 * kanta pakottaa: lunch_menus.week_start hyväksyy vain maanantain, ja
 * loppupäivä on johdettu sarake. Tässä tiedostossa pyöristetään mikä
 * tahansa päivä oikeaan viikkoon, jotta kanta ei koskaan saa muuta.
 *
 * Päivämäärät ovat merkkijonoja muodossa "2026-08-24". Date-oliot
 * kantaisivat mukanaan kellonajan ja aikavyöhykkeen, ja lounaslistalla
 * kumpikaan ei tarkoita mitään — se on päivä eikä hetki.
 */

export type LunchStatus = "draft" | "published" | "archived";

export interface LunchPrice {
  id: string;
  name: string;
  cents: number;
  sortOrder: number;
}

export interface LunchItem {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  /** Ruokavaliotunnukset, esim. "vegan". */
  diets: string[];
  /** Allergeenitunnukset, esim. "gluten". */
  allergens: string[];
}

export interface LunchDay {
  id: string;
  date: string;
  items: LunchItem[];
}

export interface LunchWeek {
  id: string;
  weekStart: string;
  /**
   * Viikon hinnat.
   *
   * Hinta oli aiemmin päivässä. Se oli liikaa: lounas maksaa saman
   * verran maanantaina ja perjantaina, ja viisi kenttää samalle
   * luvulle on viisi paikkaa jossa se voi jäädä päivittämättä.
   */
  prices: LunchPrice[];
  /** Sisältyykö jälkiruoka hintaan? */
  includesDessert: boolean;
  /** Sisältyykö kahvi hintaan? */
  includesCoffee: boolean;
  weekEnd: string;
  status: LunchStatus;
  publishedAt: string | null;
  contentUpdatedAt: string;
  days: LunchDay[];
}

export interface DietType {
  id: string;
  label: string;
  shortLabel: string;
}

export interface AllergenType {
  id: string;
  label: string;
}

const DAY_MS = 86_400_000;

/** Päivä UTC-keskipäivänä. Keskipäivä, jottei kesäaika siirrä päivää. */
function toDate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Päivän viikon maanantai.
 *
 * getUTCDay antaa sunnuntaille nollan. Suomessa sunnuntai on viikon
 * viimeinen päivä, joten se kuuluu edelliseen maanantaihin — ilman tätä
 * korjausta sunnuntain lounas hyppäisi seuraavalle viikolle.
 */
export function weekStartOf(isoDate: string): string {
  const date = toDate(isoDate);
  const day = date.getUTCDay();
  const back = day === 0 ? 6 : day - 1;
  return toIso(new Date(date.getTime() - back * DAY_MS));
}

export function addDays(isoDate: string, days: number): string {
  return toIso(new Date(toDate(isoDate).getTime() + days * DAY_MS));
}

export function nextWeek(weekStart: string): string {
  return addDays(weekStart, 7);
}

export function previousWeek(weekStart: string): string {
  return addDays(weekStart, -7);
}

/** Viikon seitsemän päivää maanantaista sunnuntaihin. */
export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/**
 * ISO-viikkonumero.
 *
 * Vuoden ensimmäinen viikko on se johon torstai osuu. Siksi laskenta
 * menee torstain kautta eikä tammikuun ensimmäisestä päivästä:
 * 1.1. voi kuulua edellisen vuoden viikkoon 52 tai 53.
 */
export function isoWeekNumber(isoDate: string): number {
  const date = toDate(weekStartOf(isoDate));
  const thursday = new Date(date.getTime() + 3 * DAY_MS);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1, 12));

  return (
    Math.round((thursday.getTime() - yearStart.getTime()) / DAY_MS / 7) + 1
  );
}

const WEEKDAYS = [
  "Maanantai",
  "Tiistai",
  "Keskiviikko",
  "Torstai",
  "Perjantai",
  "Lauantai",
  "Sunnuntai",
];

const WEEKDAYS_SHORT = ["MA", "TI", "KE", "TO", "PE", "LA", "SU"];

function weekdayIndex(isoDate: string): number {
  const day = toDate(isoDate).getUTCDay();
  return day === 0 ? 6 : day - 1;
}

export function weekdayName(isoDate: string): string {
  return WEEKDAYS[weekdayIndex(isoDate)];
}

export function weekdayShort(isoDate: string): string {
  return WEEKDAYS_SHORT[weekdayIndex(isoDate)];
}

/** Onko lauantai tai sunnuntai? */
export function isWeekend(isoDate: string): boolean {
  return weekdayIndex(isoDate) >= 5;
}

/** "24.8.2026" */
export function formatDay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${Number(d)}.${Number(m)}.${y}`;
}

/** "24.8." — vuosi jätetään pois kun se on rivin muusta sisällöstä selvä. */
export function formatDayShort(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(d)}.${Number(m)}.`;
}

/**
 * "24.8.–30.8.2026"
 *
 * Vuosi kirjoitetaan kerran kun viikko ei ylitä vuodenvaihdetta.
 * Vuodenvaihteen yli menevä viikko tarvitsee molemmat vuodet, muuten
 * se väittää joulukuun kuuluvan tammikuulle.
 */
export function formatWeekRange(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const startYear = weekStart.slice(0, 4);
  const endYear = end.slice(0, 4);

  if (startYear === endYear) {
    return `${formatDayShort(weekStart)}–${formatDay(end)}`;
  }
  return `${formatDay(weekStart)}–${formatDay(end)}`;
}

/**
 * Onko julkaistussa listassa julkaisemattomia muutoksia?
 *
 * Kanta kirjaa sisällön muutosajan liipaisimella. Vertailu tehdään
 * tässä eikä kannassa, koska sama tieto tarvitaan monessa näkymässä
 * eikä siitä kannata tehdä saraketta joka voi olla vanhentunut.
 */
export function hasUnpublishedChanges(week: LunchWeek): boolean {
  if (week.status !== "published" || week.publishedAt === null) return false;
  return new Date(week.contentUpdatedAt) > new Date(week.publishedAt);
}

/** Onko viikossa yhtään ruokaa? Tyhjää viikkoa ei julkaista. */
export function hasContent(week: LunchWeek): boolean {
  return week.days.some((day) => day.items.length > 0);
}

/** Päivät joilla on sisältöä. Julkinen sivu ei näytä tyhjiä päiviä. */
export function daysWithContent(week: LunchWeek): LunchDay[] {
  return week.days.filter((day) => day.items.length > 0);
}

export const LUNCH_STATUS_LABELS: Record<LunchStatus, string> = {
  draft: "Luonnos",
  published: "Julkaistu",
  archived: "Arkistoitu",
};

/** Oletushinnan nimi. Yhden hinnan tapauksessa tätä ei näytetä erikseen. */
export const DEFAULT_PRICE_NAME = "Lounas";

/**
 * Alennushinnat ja niiden järjestys.
 *
 * NIMET OVAT SOPIMUS, EIVÄT VAPAATA TEKSTIÄ.
 *
 * Hinta tunnistetaan nimellä sekä kannassa että näytöllä, joten
 * "Opiskelija" ja "opiskelijahinta" olisivat kaksi eri hintaa. Lista on
 * siksi tässä yhdessä paikassa ja järjestysnumero luetaan siitä.
 *
 * Järjestys on sama kuin ravintolan hinnastossa: täysi hinta ensin,
 * alennukset sen jälkeen suuruusjärjestyksessä. Aakkosjärjestys olisi
 * nostanut eläkeläishinnan ensimmäiseksi.
 */
export const EXTRA_PRICE_NAMES = [
  "Opiskelija",
  "Lapsi",
  "Eläkeläinen",
] as const;

export type ExtraPriceName = (typeof EXTRA_PRICE_NAMES)[number];

/** Kaikki hinnat siinä järjestyksessä kuin ne näytetään. */
export const PRICE_ORDER: string[] = [DEFAULT_PRICE_NAME, ...EXTRA_PRICE_NAMES];

/**
 * Hinnan järjestysnumero kannalle.
 *
 * Tuntematon nimi menee loppuun. Ravintola voi lisätä oman hintansa
 * suoraan kantaan, eikä sen kuulu sekoittua vakiohintojen väliin.
 */
export function priceSortOrder(name: string): number {
  const index = PRICE_ORDER.indexOf(name);
  return index === -1 ? 9 : index;
}

/**
 * Onko viikossa jotain julkaistavaa?
 *
 * PAINIKE VAIN KUN SILLÄ ON TEKEMISTÄ.
 *
 * "Julkaise" näkyi aina kun viikossa oli ruokaa — myös silloin kun
 * viikko oli jo julkaistu eikä siihen ollut koskettu. Painike lupasi
 * siis muutosta jota ei ollut, ja sen näkeminen sai luulemaan että
 * jotain on tallentamatta.
 *
 * Julkaistavaa on kolmessa tapauksessa: luonnoksessa on ruokaa,
 * julkaistuun on tehty muutoksia, tai kumpaakaan ei ole eikä painiketta
 * tarvita. Arkistoitua ei julkaista uudelleen.
 */
export function needsPublish(week: LunchWeek | null): boolean {
  if (week === null) return false;
  if (week.status === "archived") return false;
  if (!hasContent(week)) return false;
  if (week.status === "draft") return true;
  return hasUnpublishedChanges(week);
}

/**
 * Mitä hintaan sisältyy, luettavana listana.
 *
 * Asiakas kysyy tämän tiskillä joka päivä, eikä sitä voi päätellä
 * ruokalistasta. Tyhjä lista tarkoittaa ettei kumpaakaan ole merkitty
 * sisältyväksi — ei sitä että tietoa ei ole.
 */
export function includedExtras(week: {
  includesDessert: boolean;
  includesCoffee: boolean;
}): string[] {
  const extras: string[] = [];
  if (week.includesDessert) extras.push("jälkiruoka");
  if (week.includesCoffee) extras.push("kahvi");
  return extras;
}

export interface LunchIncludes {
  includesDessert: boolean;
  includesCoffee: boolean;
}

/**
 * Mitä uusi viikko perii edelliseltä.
 *
 * Jälkiruoka ja kahvi eivät muutu viikoittain. Uusi viikko perii ne
 * edelliseltä, jottei samaa asetusta tarvitse kertoa joka kerta.
 *
 * Tämä on koodissa eikä mallin harkinnassa. Periminen on datan
 * kopioimista, ja malli joka joskus muistaa ja joskus ei on huonompi
 * kuin sääntö joka pätee aina. Nimenomainen valinta voittaa perinnön:
 * kun käyttäjä sanoo "ei kahvia", sitä ei kumota edellisellä viikolla.
 */
export function inheritedIncludes(
  explicit: Partial<LunchIncludes>,
  previous: LunchIncludes | null,
): LunchIncludes {
  return {
    includesDessert:
      explicit.includesDessert ?? previous?.includesDessert ?? false,
    includesCoffee:
      explicit.includesCoffee ?? previous?.includesCoffee ?? false,
  };
}

/** "Hintaan sisältyy jälkiruoka ja kahvi." tai null. */
export function includedSentence(week: {
  includesDessert: boolean;
  includesCoffee: boolean;
}): string | null {
  const extras = includedExtras(week);
  if (extras.length === 0) return null;

  return `Hintaan sisältyy ${extras.join(" ja ")}.`;
}

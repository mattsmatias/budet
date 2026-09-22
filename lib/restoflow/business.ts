/**
 * Toimialat.
 *
 * Kate palvelee ravintoloita, kahviloita ja parturi-kampaamoja. Toimiala
 * ratkaisee mitä käyttöliittymä tarjoaa: mitkä kulukategoriat ovat
 * valittavissa, millä sanoilla tekoäly luokittelee kuitit ja miten Matti
 * puhuu yrityksestä. Myyntiryhmät ja tilikartta luodaan kannassa
 * toimialan mukaan (migraatio 0099).
 *
 * TOIMIALA RAJAA VALINTOJA, EI DATAA.
 *
 * Jos yrityksen toimiala vaihdetaan, vanhat kuitit pysyvät omissa
 * kategorioissaan ja näkyvät raporteissa. Rajaus koskee sitä mitä
 * uudelle kuitille tarjotaan — muuten toimialan vaihto hävittäisi
 * näkyvistä kuluja jotka on jo kirjattu.
 */

import type { ExpenseCategory } from "./types";

export type BusinessType = "restaurant" | "cafe" | "barber";

export const BUSINESS_TYPES: BusinessType[] = ["restaurant", "cafe", "barber"];

/** Nimet Developer Consoleen, joka on suomeksi. */
export const BUSINESS_TYPE_NAMES_FI: Record<BusinessType, string> = {
  restaurant: "Ravintola",
  cafe: "Kahvila",
  barber: "Parturi-kampaamo",
};

export function isBusinessType(value: unknown): value is BusinessType {
  return (
    typeof value === "string" &&
    (BUSINESS_TYPES as readonly string[]).includes(value)
  );
}

/** Kulukategoriat esitysjärjestyksessä toimialan mukaan. */
const CATEGORIES: Record<BusinessType, ExpenseCategory[]> = {
  restaurant: [
    "food",
    "alcohol",
    "soft_drinks",
    "kitchen_supplies",
    "packaging",
    "cleaning",
    "equipment",
    "rent",
    "transport",
    "staff",
    "other",
  ],
  cafe: [
    "food",
    "soft_drinks",
    "packaging",
    "kitchen_supplies",
    "cleaning",
    "equipment",
    "rent",
    "transport",
    "staff",
    "other",
  ],
  barber: [
    "products",
    "equipment",
    "rent",
    "cleaning",
    "transport",
    "staff",
    "other",
  ],
};

export function categoriesFor(type: BusinessType): ExpenseCategory[] {
  return CATEGORIES[type] ?? CATEGORIES.restaurant;
}

/**
 * Valittavat kategoriat, kun jokin kategoria on jo käytössä.
 *
 * Toimialan vaihdon jälkeen vanhalla kuitilla voi olla kategoria jota
 * uusi toimiala ei tarjoa. Muokkauslomake näyttää sen silti, jottei
 * kuitin avaaminen muuttaisi sen kategoriaa huomaamatta.
 */
export function categoriesWith(
  type: BusinessType,
  current: ExpenseCategory | null | undefined,
): ExpenseCategory[] {
  const list = categoriesFor(type);
  return current && !list.includes(current) ? [...list, current] : list;
}

/**
 * Toimiala tekoälyn ohjeisiin ja Matin kehotteeseen.
 *
 * Suomeksi, koska ohjeet ovat suomeksi. Kuvaus kertoo mallille millaisia
 * kuitteja yritys saa, jotta luokittelu osuu oikein: parturin
 * hiustuotekuitti ei ole ruokaa.
 */
export function businessDescription(type: BusinessType): string {
  switch (type) {
    case "cafe":
      return "kahvila (kahvi, leivonnaiset, kevyet ruoat, take away)";
    case "barber":
      return "parturi-kampaamo (hius- ja partapalvelut, hoitotuotteiden myynti)";
    default:
      return "ravintola";
  }
}

/**
 * Nimikkeet, joihin on liitetty toimialan kategoriavalinnat.
 *
 * Sivu kutsuu tätä kerran, ja kaikki valikot sen alla näyttävät vain
 * yrityksen kategoriat — komponentteja ei tarvitse johdottaa erikseen.
 */
export function withBusiness<T extends { categoryChoices?: ExpenseCategory[] }>(
  labels: T,
  type: BusinessType,
): T {
  return { ...labels, categoryChoices: categoriesFor(type) };
}

/** Valikon rivit: toimialan kategoriat ja tarvittaessa nykyinen arvo. */
export function categoryOptions(
  labels: {
    categories: Record<ExpenseCategory, string>;
    categoryChoices?: ExpenseCategory[];
  },
  current?: ExpenseCategory | null,
): [ExpenseCategory, string][] {
  const base =
    labels.categoryChoices ??
    (Object.keys(labels.categories) as ExpenseCategory[]);
  const keys = current && !base.includes(current) ? [...base, current] : base;
  return keys.map((key) => [key, labels.categories[key]]);
}

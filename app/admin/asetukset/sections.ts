import type { IconName } from "@/components/restoflow/icons";
import type { AdminText } from "@/lib/i18n/admin-text";

/**
 * Asetusten osastot.
 *
 * Kaikki asetukset yhdellä sivulla oli kuuden kortin ruudukko, jossa
 * ravintolan nimi oli yhtä näkyvästi esillä kuin lause siitä mitä Kate
 * ei tee. Osasto kerrallaan tarkoittaa että näkyvissä on se mitä
 * ollaan muuttamassa, ja loput ovat yhden klikkauksen päässä.
 *
 * Valinta on osoitteessa eikä komponentin tilassa: asetusosion voi
 * linkittää, ja paluu selaimen napista vie edelliseen osioon eikä
 * ulos sivulta.
 *
 * EI OSASTOA ILMAN ASETUSTA.
 *
 * Jokainen kohta tässä listassa muuttaa jotain. Poikkeus on
 * Toimintaloki, joka ei muuta mitään vaan kertoo mitä on muutettu —
 * sitä etsitään samasta paikasta kuin muutakin hallintaa.
 */
export interface SettingsSection {
  id: string;
  label: string;
  /** Yhden rivin kuvaus valikkoon ja osion otsikon alle. */
  summary: string;
  icon: IconName;
  /** Vaatiiko osio omistajan oikeudet. */
  ownerOnly: boolean;
  /*
   * Oma sivunsa asetusten sisällä.
   *
   * Useimmat osastot ovat saman sivun näkymiä ja valinta on
   * ?osio-parametrissa. Pöytävaraukset on niin laaja — sali,
   * aukiolot, kestot, yhdistelmät ja upotuskoodi — että osastona se
   * olisi asetussivun sisällä oleva toinen asetussivu. Se on siis
   * oma reittinsä, mutta löytyy samasta valikosta kuin muutkin.
   */
  href?: string;
}

/*
 * Osastot tehtaana.
 *
 * Tunniste on osoitteessa eika saa muuttua kielen mukana; otsikko ja
 * kuvaus kaannetaan.
 */
export const settingsSections = (t: AdminText): SettingsSection[] => [
  {
    id: "ravintola",
    label: t.asetus.secRestaurant,
    summary: t.asetus.secRestaurantHint,
    icon: "settings",
    ownerOnly: true,
  },
  {
    id: "profiili",
    label: t.asetus.secAccount,
    summary: t.asetus.secAccountHint,
    icon: "staff",
    ownerOnly: false,
  },
  {
    id: "vuorot",
    label: t.asetus.secTime,
    summary: t.asetus.secTimeHint,
    icon: "clock",
    ownerOnly: true,
  },
  {
    id: "verotus",
    label: t.asetus.secTax,
    summary: t.asetus.secTaxHint,
    icon: "report",
    ownerOnly: true,
  },
  {
    id: "kirjanpito",
    label: t.asetus.secAccounting,
    summary: t.asetus.secAccountingHint,
    icon: "report",
    ownerOnly: true,
  },
  {
    id: "kategoriat",
    label: t.asetus.secCategories,
    summary: t.asetus.secCategoriesHint,
    icon: "expenses",
    ownerOnly: true,
  },
  {
    id: "some",
    label: t.some.title,
    summary: t.some.secSomeHint,
    icon: "share",
    ownerOnly: true,
    href: "/admin/asetukset/some",
  },
  {
    id: "varaukset",
    label: t.nav.reservations,
    summary: t.asetus.secReservationsHint,
    icon: "tables",
    ownerOnly: false,
    href: "/admin/asetukset/varaukset",
  },
  /*
   * Toimintaloki on asetuksissa muttei asetus.
   *
   * Se ei muuta mitään: se kertoo mitä on muutettu. Paikka on silti
   * oikea — sitä etsitään sieltä mistä muutkin hallinnan asiat, ja
   * omistaja on ainoa joka sen näkee.
   */
  {
    id: "loki",
    label: t.asetus.secLog,
    summary: t.asetus.secLogHint,
    icon: "clock",
    ownerOnly: true,
  },
];

/** Tuntematon osio putoaa ensimmäiseen: osoiterivin voi kirjoittaa itse. */
export function sectionFor(id: unknown, t: AdminText): SettingsSection {
  /*
   * Omalle sivulleen vievät kohdat eivät kelpaa osioksi.
   *
   * ?osio=varaukset osuisi muuten kohtaan jolla ei ole sisältöä tällä
   * sivulla, ja käyttäjä näkisi tyhjän osaston.
   */
  const osastot = settingsSections(t).filter((s) => !s.href);
  return osastot.find((s) => s.id === id) ?? osastot[0];
}

import type { IconName } from "@/components/restoflow/icons";

/**
 * Asetusten osastot.
 *
 * Kaikki asetukset yhdellä sivulla oli kuuden kortin ruudukko, jossa
 * ravintolan nimi oli yhtä näkyvästi esillä kuin lause siitä mitä Budet
 * ei tee. Osasto kerrallaan tarkoittaa että näkyvissä on se mitä
 * ollaan muuttamassa, ja loput ovat yhden klikkauksen päässä.
 *
 * Valinta on osoitteessa eikä komponentin tilassa: asetusosion voi
 * linkittää, ja paluu selaimen napista vie edelliseen osioon eikä
 * ulos sivulta.
 *
 * EI OSASTOA ILMAN ASETUSTA.
 *
 * Jokainen kohta tässä listassa muuttaa jotain — paitsi viimeinen,
 * joka on nimetty rehellisesti tiedoksi eikä asetuksiksi.
 */
export interface SettingsSection {
  id: string;
  label: string;
  /** Yhden rivin kuvaus valikkoon ja osion otsikon alle. */
  summary: string;
  icon: IconName;
  /** Vaatiiko osio omistajan oikeudet. */
  ownerOnly: boolean;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "ravintola",
    label: "Ravintola",
    summary: "Nimi, aikavyöhyke ja julkinen osoite",
    icon: "settings",
    ownerOnly: true,
  },
  {
    id: "profiili",
    label: "Oma tunnus",
    summary: "Nimesi ja salasanasi",
    icon: "staff",
    ownerOnly: false,
  },
  {
    id: "vuorot",
    label: "Työaika ja vuorot",
    summary: "Leimausikkuna ja avoimet vuorot",
    icon: "clock",
    ownerOnly: true,
  },
  {
    id: "verotus",
    label: "Verotus",
    summary: "Myyntiryhmät, ALV-kannat ja kassan ryhmät",
    icon: "report",
    ownerOnly: true,
  },
  {
    id: "kirjanpito",
    label: "Kirjanpito",
    summary: "Kuukausien sulkeminen",
    icon: "report",
    ownerOnly: true,
  },
  {
    id: "kategoriat",
    label: "Kulukategoriat",
    summary: "Vakiokategoriat ja omat lisäykset",
    icon: "expenses",
    ownerOnly: true,
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
    label: "Toimintaloki",
    summary: "Kuka teki mitä ja milloin",
    icon: "clock",
    ownerOnly: true,
  },
  {
    id: "tietoja",
    label: "Tietoja",
    summary: "Kuittien poiminta ja rajaukset",
    icon: "info",
    ownerOnly: false,
  },
];

/** Tuntematon osio putoaa ensimmäiseen: osoiterivin voi kirjoittaa itse. */
export function sectionFor(id: unknown): SettingsSection {
  return (
    SETTINGS_SECTIONS.find((s) => s.id === id) ?? SETTINGS_SECTIONS[0]
  );
}

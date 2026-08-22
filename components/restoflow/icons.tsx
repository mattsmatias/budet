/**
 * Budet'n ikonisarja.
 *
 * Yksi geometria koko sovelluksessa: 24×24 ruudukko, 1,6 px viiva, pyöreät
 * päät ja liitokset, ei täyttöjä. Ikonit ovat piirretty samalle optiselle
 * painolle kuin teksti — liian ohut katoaa vaalealta kortilta, liian paksu
 * kilpailee otsikon kanssa.
 *
 * Emojia ei käytetä: se renderöityy eri tavalla jokaisella alustalla, tuo
 * mukanaan värin jota muu käyttöliittymä välttää, eikä skaalaudu tekstin
 * mukana. Ammattimainen taloustyökalu näyttää samalta joka koneella.
 */

import type { ExpenseCategory } from "@/lib/restoflow/types";

export type IconName =
  | "overview"
  | "receipt"
  | "expenses"
  | "suppliers"
  | "budget"
  | "calendar"
  | "staff"
  | "report"
  | "bell"
  | "settings"
  | "clock"
  | "camera"
  | "image"
  | "file"
  | "plus"
  | "search"
  | "chevron"
  | "back"
  | "download"
  | "check"
  | "alert"
  | "info"
  | "more"
  | "logout"
  | "trend";

/**
 * Ikonipolut.
 *
 * Kaikki on piirretty samaan optiseen laatikkoon (noin 3–21), jotta ne
 * näyttävät samankokoisilta vierekkäin. Geometrisesti tarkka 24×24 ei
 * riitä: ympyrä näyttää pienemmältä kuin samankokoinen neliö.
 */
const PATHS: Record<IconName, string> = {
  // Epäsymmetrinen ruudukko — yleiskuva, ei "koti".
  overview: "M3.5 3.5h7v7h-7zM13.5 3.5h7v4.5h-7zM13.5 12h7v8.5h-7zM3.5 14h7v6.5h-7z",

  // Kuitti: repäisty alareuna tekee siitä tunnistettavan pienenäkin.
  receipt:
    "M5.5 3h13v18l-2.2-1.5-2.2 1.5-2.1-1.5-2.2 1.5-2.1-1.5L5.5 21zM9 8h6M9 12h4",

  // Pylväät, nouseva järjestys — kulut ajassa.
  expenses: "M4 20.5V13M9.3 20.5V7.5M14.7 20.5v-4.5M20 20.5V10",

  // Myymälä/varasto — toimittaja on paikka, ei kuljetusväline.
  suppliers: "M3.5 20.5V10L12 4.5l8.5 5.5v10.5zM9.5 20.5v-6h5v6M3.5 20.5h17",

  // Kohdistin — budjetti on tavoite.
  budget:
    "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM12 16.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4ZM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",

  calendar: "M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4",

  staff:
    "M14.5 20.5v-1.6a3.9 3.9 0 0 0-3.9-3.9H7.4a3.9 3.9 0 0 0-3.9 3.9v1.6M9 12.4a3.9 3.9 0 1 0 0-7.8 3.9 3.9 0 0 0 0 7.8ZM20.5 20.5v-1.6a3.9 3.9 0 0 0-2.9-3.8M15.6 4.8a3.9 3.9 0 0 1 0 7.6",

  report: "M6 3h8l4 4v14H6zM14 3v4h4M9.5 12.5h5M9.5 16.5h3",

  bell: "M17.5 9.5a5.5 5.5 0 1 0-11 0c0 5.5-2 6.8-2 6.8h15s-2-1.3-2-6.8M13.7 19.5a2 2 0 0 1-3.4 0",

  // Liu'ut, ei ratas — sopii paremmin tähän geometriaan.
  settings: "M4 7.5h8M16 7.5h4M4 16.5h4M12 16.5h8M14 5v5M10 14v5",

  clock: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM12 7.5V12l3 2",

  camera: "M4 7.5h3.2l1.6-2.2h6.4l1.6 2.2H20v12H4zM12 17a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2Z",

  image: "M4 5h16v14H4zM4 15.5l4.2-4.2 3.5 3.5 3-3 5.3 5.3M9 10a1.2 1.2 0 1 0 0-2.4A1.2 1.2 0 0 0 9 10Z",

  file: "M6 3h8l4 4v14H6zM14 3v4h4",

  plus: "M12 5.5v13M5.5 12h13",

  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM16.2 16.2 20.5 20.5",

  chevron: "m9.5 5.5 6.5 6.5-6.5 6.5",

  back: "m14.5 5.5-6.5 6.5 6.5 6.5",

  download: "M12 3.5v11.5M7.8 11l4.2 4.2 4.2-4.2M4.5 20.5h15",

  check: "m5 12.5 4.5 4.5L19 7",

  alert: "M12 9v4.5M12 17h.01M10.4 4.2 2.6 17.9A1.8 1.8 0 0 0 4.2 20.6h15.6a1.8 1.8 0 0 0 1.6-2.7L13.6 4.2a1.8 1.8 0 0 0-3.2 0Z",

  info: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM12 11v5.5M12 7.6h.01",

  more: "M5.2 12h.01M12 12h.01M18.8 12h.01",

  logout: "M9.5 20.5H5.5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h4M16 16.5l4.5-4.5L16 7.5M20.5 12H9.5",

  trend: "M3.5 17 9.5 11l3.8 3.8L20.5 7.5M15.5 7.5h5v5",
};

export function RfIcon({
  name,
  size = 20,
  strokeWidth = 1.6,
  label,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  label?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Kulukategoriat
// ---------------------------------------------------------------------------

/**
 * Kategoriakohtaiset ikonit.
 *
 * Jokainen kategoria tarvitsee oman siluettinsa joka erottuu muista myös
 * 16 pikselissä. Siksi esimerkiksi alkoholi on viinilasi ja alkoholiton on
 * pahvimuki pillillä — muoto eroaa, ei vain yksityiskohta.
 */
const CATEGORY_PATHS: Record<ExpenseCategory, string> = {
  // Tarjoilukupu — ruoka lautasella, ei yksittäinen raaka-aine.
  food: "M3 18.5h18M5 18.5a7 7 0 0 1 14 0M12 7.2V5M10.4 5h3.2",

  // Viinilasi.
  alcohol: "M7.8 3.5h8.4l-.8 6.4a3.7 3.7 0 0 1-6.8 0zM12 14.3v6.2M8.6 20.5h6.8",

  // Pahvimuki ja pilli.
  soft_drinks: "M6.5 7.5h11l-1.2 12.1a1.4 1.4 0 0 1-1.4 1.2H9.1a1.4 1.4 0 0 1-1.4-1.2zM7.1 12h9.8M14.6 7.5 16.8 3",

  // Suihkepullo.
  cleaning: "M9.3 9h5.4v11.5H9.3zM10.8 9V5.4h2.6V9M13.4 5.4h3.4M16.8 5.4v2.3M9.3 12.7h5.4",

  // Paistinpannu.
  kitchen_supplies: "M3.5 11.5h11v3.2a5 5 0 0 1-5 5H8.5a5 5 0 0 1-5-5zM14.5 13h6M7.5 8.8V6.5M11 8.8V6.5",

  // Pakkauslaatikko.
  packaging: "M12 3.5 3.8 7.8v8.4L12 20.5l8.2-4.3V7.8zM3.8 7.8 12 12.1M12 12.1v8.4M20.2 7.8 12 12.1M7.9 5.6l8.2 4.3",

  // Henkilöstö.
  staff: "M15.5 20.5v-1.5a3.8 3.8 0 0 0-3.8-3.8H7.3a3.8 3.8 0 0 0-3.8 3.8v1.5M9.5 12.2a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6ZM20.5 20.5v-1.5a3.8 3.8 0 0 0-2.8-3.7",

  // Kuorma-auto — kuljetus on liike, toimittaja on paikka.
  transport:
    "M2.5 7.5h11v9h-11zM13.5 10.5h3.4l3.1 3.1v2.9h-6.5zM6.8 19.4a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8ZM16.9 19.4a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8Z",

  // Hintalappu — luokittelematon erä.
  other: "M11.4 3.5H20.5v9.1l-8.4 8.4a1.5 1.5 0 0 1-2.1 0l-7-7a1.5 1.5 0 0 1 0-2.1zM16.6 8.4h.01",
};

export function CategoryIcon({
  category,
  size = 20,
  strokeWidth = 1.6,
  label,
}: {
  category: ExpenseCategory;
  size?: number;
  strokeWidth?: number;
  label?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      <path d={CATEGORY_PATHS[category]} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Työvuoron tila
// ---------------------------------------------------------------------------

/**
 * Tilamerkit vuoroille.
 *
 * Muoto kantaa merkityksen, väri vahvistaa sen. Pelkkä väri ei riitä:
 * noin joka kahdeskymmenes mies erottaa punaisen ja vihreän huonosti.
 */
export function ShiftStatusIcon({
  status,
  size = 16,
}: {
  status: "draft" | "pending" | "accepted" | "declined" | "changed";
  size?: number;
}) {
  const paths: Record<typeof status, string> = {
    draft: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17Z",
    pending: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM12 7.8V12l2.8 1.8",
    accepted: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17Zm-3.6-8.8 2.6 2.6 4.6-5",
    declined: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6",
    changed: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM8.5 13.5h7M8.5 13.5l2.4-2.4M15.5 10.5h-7M15.5 10.5l-2.4 2.4",
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[status]} />
    </svg>
  );
}

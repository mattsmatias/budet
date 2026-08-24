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

import type { ReactNode } from "react";
import type { ExpenseCategory } from "@/lib/restoflow/types";
import {
  productGlyph,
  supplierGlyph,
  type GlyphName,
} from "@/lib/restoflow/glyphs";

export type IconName =
  | "overview"
  | "receipt"
  | "expenses"
  | "suppliers"
  | "lunch"
  | "sparkle"
  | "trash"
  | "budget"
  | "calendar"
  | "staff"
  | "report"
  | "bell"
  | "settings"
  | "payroll"
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

  // Roskakori. Poistolle oli aiemmin varoituskolmio, joka tarkoittaa
  // huomiota eikä poistoa — sama merkki kahdelle eri asialle opettaa
  // ohittamaan molemmat.
  trash: "M4 7h16M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7M10 11v5M14 11v5",

  // Nelisakarainen tähti — vakiintunut merkki tekoälylle. Hienovarainen
  // ja piirretty samalla viivalla kuin muut: Matti on työkalu muiden
  // joukossa, ei sovelluksen sisällä oleva erillinen tuote.
  sparkle:
    "M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.7 10.4 12.2 5 10.6 10.4 9zM18.5 16.5l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6z",

  // Tarjoilukupu — lounas on tarjoiltava annos, ei ostos.
  lunch: "M3 18.5h18M4.8 18.5a7.2 7.2 0 0 1 14.4 0M12 8.3V6.2M10.6 6.2h2.8",

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

  // Seteli — palkka on maksu, ei kalenteri eikä sydän.
  payroll:
    "M3 6.5h18v11H3zM12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM6.2 10.2h.01M17.8 13.8h.01",

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

/**
 * Ikonit joita ei saa yhdellä polulla.
 *
 * Suurin osa sarjasta on yksi viiva, mutta valikon ikonit ovat
 * suunnitelmassa neliöitä ja ympyröitä — ne pysyvät tarkkoina
 * pienessäkin koossa, kun muoto on primitiivi eikä käsin piirretty
 * approksimaatio. Nämä voittavat PATHS-taulukon samalla nimellä.
 */
const SHAPES: Partial<Record<IconName, ReactNode>> = {
  // Neljä yhtä suurta ruutua: yleiskuva on koko näkymä, ei yksi osa.
  overview: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
    </>
  ),

  // Repäisty alareuna tekee kuitista tunnistettavan pienenäkin.
  receipt: (
    <>
      <path d="M5 3.5h14v17l-3-2-2 2-2-2-2 2-2-2-3 2z" />
      <path d="M9 9h6M9 13h4" />
    </>
  ),

  // Pylväät pohjaviivan päällä: ilman viivaa ne leijuvat.
  expenses: <path d="M4 19V9M10 19V5M16 19v-6M22 19H2" />,

  // Kello: budjetti on kuukauden mitta, ei tähtäin.
  budget: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v8.5l6 3" />
    </>
  ),

  // Pinotut tasot — toimittajat ovat kerroksia saman kuukauden päällä.
  suppliers: (
    <>
      <path d="M3 8.5 12 4l9 4.5-9 4.5z" />
      <path d="M3 12.5 12 17l9-4.5M3 16.5 12 21l9-4.5" />
    </>
  ),

  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),

  // Yksi ihminen edessä, toinen puoliksi takana: ryhmä, ei pari.
  staff: (
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.4a3.4 3.4 0 0 1 0 5.2M18 14.4a6.5 6.5 0 0 1 3.5 5.6" />
    </>
  ),

  // Valuuttamerkki — palkka on rahaa, ei seteli esineenä.
  payroll: <path d="M12 2.5v19M16.5 6.5H9.8a2.8 2.8 0 0 0 0 5.6h4.4a2.8 2.8 0 0 1 0 5.6H7" />,

  // Rakennus pylväineen — lounas on paikka johon tullaan.
  lunch: (
    <>
      <path d="M4 20h16M6 20V9.5M18 20V9.5" />
      <path d="M3.5 9.5 12 4l8.5 5.5z" />
    </>
  ),

  // Taitettu nurkka erottaa raportin kuitista.
  report: (
    <>
      <path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z" />
      <path d="M14 3v5h5" />
    </>
  ),
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
      {SHAPES[name] ?? <path d={PATHS[name]} />}
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

// ---------------------------------------------------------------------------
// Tuote- ja toimittajaikonit
// ---------------------------------------------------------------------------

/**
 * Sama geometria kuin muualla: 24×24, 1,6 px viiva, ei täyttöjä.
 *
 * Nämä ovat tarkempia kuin kategoriaikonit — maito eikä "ruoka" — ja
 * niitä käytetään vain silloin kun tuotteen nimestä tunnistetaan mikä
 * se on. Tunnistamaton rivi saa kategoriansa ikonin, joten sarake ei
 * jää koskaan tyhjäksi.
 */
const GLYPH_PATHS: Record<GlyphName, string> = {
  // Maitopurkki harjakatolla.
  milk: "M7.8 8.6 12 3.5l4.2 5.1v11.9H7.8zM7.8 8.6h8.4M10.2 12.4h3.6",

  // Kananmuna: soikio joka on alaosastaan leveämpi.
  egg: "M12 3.6c2.9 0 5 4.4 5 8a5 5 0 0 1-10 0c0-3.6 2.1-8 5-8Z",

  // Lehti ja varsi — tuoretuote, ei yksittäinen kasvis.
  vegetable:
    "M20.4 4.6c0 8.1-5.1 12-9.6 12a5.6 5.6 0 1 1 0-11.2c4 0 6.6-.8 9.6-.8ZM4.4 20.4C7 15.9 10 13.4 14.1 11.4",

  // Omena varsineen.
  fruit:
    "M12 20.5a6.6 6.6 0 1 0 0-13.2 6.6 6.6 0 0 0 0 13.2ZM12 7.3V4.2M12 5c2.4 0 3.8-1.1 3.8-1.1",

  // Pihvi.
  meat: "M4.6 12.9c0-4.4 3.6-7.2 8-7.2s6.9 2.7 6.9 6.2-2.7 7.6-7.1 7.6-7.8-2.2-7.8-6.6ZM8.4 12.9a3.1 3.1 0 0 1 3.1-3.1",

  // Kala: runko ja pyrstö.
  fish: "M14.6 12c0 3.6-3.3 6.4-6.9 6.4-2.2 0-3.9-1.1-3.9-1.1s1.2-2 1.2-5.3-1.2-5.3-1.2-5.3S5.5 5.6 7.7 5.6c3.6 0 6.9 2.8 6.9 6.4ZM14.6 12l5.9-4.3v8.6zM7.4 10.4h.01",

  // Limppu.
  bread: "M4.6 11.6c0-3.2 3.3-4.9 7.4-4.9s7.4 1.7 7.4 4.9c0 1.4-1.1 2.5-2.5 2.5v6.2H7.1v-6.2c-1.4 0-2.5-1.1-2.5-2.5Z",

  // Viljan tähkä.
  grain:
    "M12 20.8v-11M12 9.8c-2.4 0-3.9-1.9-3.9-4.3 2.4 0 3.9 1.9 3.9 4.3ZM12 9.8c2.4 0 3.9-1.9 3.9-4.3-2.4 0-3.9 1.9-3.9 4.3ZM12 15.3c-2.4 0-3.9-1.9-3.9-4.3 2.4 0 3.9 1.9 3.9 4.3ZM12 15.3c2.4 0 3.9-1.9 3.9-4.3-2.4 0-3.9 1.9-3.9 4.3Z",

  // Purkki kannella.
  jar: "M8.4 3.5h7.2v2.6H8.4zM7.2 6.1h9.6v12.9a1.5 1.5 0 0 1-1.5 1.5H8.7a1.5 1.5 0 0 1-1.5-1.5zM7.2 10.2h9.6",

  // Pullo kaulalla ja etiketillä.
  bottle:
    "M10.2 3.5h3.6v3.2l1.8 3a3 3 0 0 1 .44 1.57v7.23a2 2 0 0 1-2 2H9.96a2 2 0 0 1-2-2v-7.23a3 3 0 0 1 .44-1.57l1.8-3zM8 13.8h8",

  // Tölkki: soikea kansi tekee sen tunnistettavaksi pienenäkin.
  can: "M12 3.6c2.5 0 4.4.9 4.4 2v12.8c0 1.1-1.9 2-4.4 2s-4.4-.9-4.4-2V5.6c0-1.1 1.9-2 4.4-2ZM7.6 5.6c0 1.1 1.9 2 4.4 2s4.4-.9 4.4-2",

  // Kuppi ja korva.
  coffee:
    "M4.6 8.4h11.8v6.2a5 5 0 0 1-5 5H9.6a5 5 0 0 1-5-5zM16.4 9.9h1.5a2.5 2.5 0 0 1 0 5h-1.5M8.2 5.4V3.6M12 5.4V3.6",

  // Kassi kahvoilla.
  bag: "M6.4 8.2h11.2l1 12.3H5.4zM9.2 8.2V6a2.8 2.8 0 0 1 5.6 0v2.2",

  // Palautuva kierros — pantti.
  deposit: "M20 12a8 8 0 1 1-2.6-5.9M20 4.2v4.4h-4.4",

  // Viinilasi. Sama muoto kuin alkoholikategorialla, koska kyse on
  // samasta asiasta — toimittajasta joka myy alkoholia.
  wine: "M7.8 3.5h8.4l-.8 6.4a3.7 3.7 0 0 1-6.8 0zM12 14.3v6.2M8.6 20.5h6.8",

  // Myymälä markiisilla.
  shop: "M3.6 9.6h16.8v10.9H3.6zM3.6 9.6 5.6 4h12.8l2 5.6M9.6 20.5v-5.9h4.8v5.9M3.6 9.6a2.8 2.8 0 0 0 5.6 0 2.8 2.8 0 0 0 5.6 0 2.8 2.8 0 0 0 5.6 0",

  // Varasto — tukku on rakennus, ei myymälä.
  wholesale: "M3.6 10.4 12 5l8.4 5.4v10.1H3.6zM8.6 20.5v-6.1h6.8v6.1",
};

export function Glyph({
  name,
  size = 16,
  strokeWidth = 1.6,
}: {
  name: GlyphName;
  size?: number;
  strokeWidth?: number;
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
      aria-hidden="true"
    >
      <path d={GLYPH_PATHS[name]} />
    </svg>
  );
}

/**
 * Kuittirivin ikoni.
 *
 * Tuotteen oma ikoni jos nimestä tunnistetaan mikä se on, muuten rivin
 * kategoria. Näin sarake on aina täynnä eikä tunnistamaton tuote näytä
 * virheeltä.
 */
export function ProductIcon({
  description,
  category,
  size = 15,
}: {
  description: string;
  category: ExpenseCategory;
  size?: number;
}) {
  const glyph = productGlyph(description);

  return glyph ? (
    <Glyph name={glyph} size={size} />
  ) : (
    <CategoryIcon category={category} size={size} />
  );
}

/**
 * Toimittajan ikoni.
 *
 * Kauppa, tukku ja Alko erottuvat toisistaan. Tunnistamaton toimittaja
 * saa kuitin kategorian ikonin.
 */
export function SupplierIcon({
  name,
  category,
  size = 20,
}: {
  name: string;
  category: ExpenseCategory;
  size?: number;
}) {
  const glyph = supplierGlyph(name);

  return glyph ? (
    <Glyph name={glyph} size={size} />
  ) : (
    <CategoryIcon category={category} size={size} />
  );
}

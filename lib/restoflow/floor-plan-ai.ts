/**
 * Pöytien tunnistaminen pohjapiirroksesta.
 *
 * Ravintola lisää salin pohjapiirroksen kuvana. Kahdenkymmenen pöydän
 * raahaaminen käsin oikeille paikoille on puolen tunnin työ, ja kuvassa
 * ne ovat jo oikeilla paikoillaan — usein numeroituinakin.
 *
 * ---------------------------------------------------------------------
 * TUNNISTUS EI OLE HYVÄKSYNTÄ
 * ---------------------------------------------------------------------
 *
 * Malli palauttaa ehdotuksen. Se näytetään listana, ja käyttäjä
 * hyväksyy sen tai jättää hyväksymättä. Automaattinen sijoittelu olisi
 * kartta jota kukaan ei ole katsonut — ja kartta on se mistä vuoron
 * aikana luetaan mikä pöytä on vapaa.
 *
 * Sama linja kuin verokortin ja kuitin lukemisessa.
 *
 * ---------------------------------------------------------------------
 * SIJAINTI ON PROSENTTI, EI PIKSELI
 * ---------------------------------------------------------------------
 *
 * Mallille kerrotaan että kuvan vasen reuna on 0 ja oikea 100. Pikselit
 * riippuisivat siitä minkä kokoisena kuva sattui malliin menemään, ja
 * kartta tallentaa prosentteja.
 */

import { z } from "zod";
import type { PlanTable, TableShape } from "./floor-plan";

// ---------------------------------------------------------------------------
// Mitä mallilta pyydetään
// ---------------------------------------------------------------------------

const sijainti = z.number().min(0).max(100);

export const detectionSchema = z.object({
  /**
   * Onko kuva lainkaan pohjapiirros.
   *
   * Käyttäjä voi ladata ruokalistan tai valokuvan salista. Silloin
   * oikea vastaus on "en tunnista tätä pohjapiirrokseksi" eikä
   * kaksikymmentä keksittyä pöytää.
   */
  isFloorPlan: z.boolean(),

  tables: z
    .array(
      z.object({
        /** Pöydän keskipiste prosentteina kuvan leveydestä. */
        x: sijainti,
        /** Prosentteina kuvan korkeudesta. */
        y: sijainti,
        shape: z.enum(["round", "square", "rect"]),
        /** Kuvaan merkitty numero tai nimi, jos sellainen on. */
        label: z.string().max(40).nullable(),
        /** Tuolien määrä jos ne on piirretty. */
        seats: z.number().int().min(1).max(30).nullable(),
      }),
    )
    .max(200),

  fixtures: z
    .array(
      z.object({
        kind: z.enum([
          "wall",
          "bar",
          "kitchen",
          "wc",
          "door",
          "entrance",
          "other",
        ]),
        x: sijainti,
        y: sijainti,
        /** Leveys prosentteina kuvan leveydestä. */
        width: z.number().min(0.5).max(100),
        /** Korkeus prosentteina kuvan korkeudesta. */
        height: z.number().min(0.5).max(100),
        label: z.string().max(40).nullable(),
      }),
    )
    .max(100),
});

export type Detection = z.infer<typeof detectionSchema>;
export type DetectedTable = Detection["tables"][number];
export type DetectedFixture = Detection["fixtures"][number];

export const FLOOR_PLAN_PROMPT = `Luet ravintolan pohjapiirrosta ja
merkitset siitä pöydät ja kiinteät rakenteet.

KOORDINAATIT
Kuvan vasen reuna on x = 0 ja oikea reuna x = 100. Yläreuna on y = 0 ja
alareuna y = 100. Anna aina pöydän keskipiste, ei kulmaa.

PÖYDÄT
Merkitse jokainen asiakaspöytä. Pyöreä pöytä on "round", neliön
muotoinen "square" ja selvästi pitkänomainen "rect".

Jos pöydässä on numero tai nimi, kirjoita se label-kenttään täsmälleen
sellaisena kuin se lukee. Älä keksi numeroita jos niitä ei ole: silloin
label on null.

Jos tuolit on piirretty, laske ne ja kirjoita määrä seats-kenttään.
Muussa tapauksessa seats on null. Älä arvaa paikkalukua pöydän koosta.

ÄLÄ merkitse pöydiksi: baaritiskiä, tarjoilupöytää, keittiön
työtasoja, penkkejä ilman pöytää.

RAKENTEET
Merkitse fixtures-listaan seinät (wall), baaritiski (bar), keittiö
(kitchen), wc, ovet (door), sisäänkäynti (entrance) ja muut kiinteät
kalusteet (other). Anna keskipiste sekä leveys ja korkeus
prosentteina.

Ulkoseinät voit jättää merkitsemättä: kartan reuna on jo salin reuna.
Merkitse väliseinät.

EPÄVARMUUS
Jos kuva ei ole pohjapiirros vaan esimerkiksi valokuva, ruokalista tai
lasku, aseta isFloorPlan epätodeksi ja jätä listat tyhjiksi.

Jos et ole varma onko jokin pöytä, jätä se pois. Puuttuva pöytä
lisätään käsin minuutissa; väärässä paikassa oleva pöytä löydetään
vasta kun seurue seisoo salissa.`;

// ---------------------------------------------------------------------------
// Ehdotuksen sovittaminen olemassa oleviin pöytiin
// ---------------------------------------------------------------------------

export interface TableMatch {
  /** Olemassa olevan pöydän tunniste. */
  id: string;
  name: string;
  x: number;
  y: number;
  shape: TableShape;
  /** Mihin tunnistus perustui. */
  by: "label" | "order";
  /** Kuvasta luettu paikkaluku, jos se poikkeaa pöydän omasta. */
  seats: number | null;
}

export interface MatchResult {
  matched: TableMatch[];
  /** Kuvassa näkyvät pöydät joille ei löytynyt vastinetta. */
  extra: DetectedTable[];
  /** Pöydät joita kuvasta ei löytynyt. Nämä jäävät paikoilleen. */
  missing: { id: string; name: string }[];
}

/** Nimien vertailu: "Pöytä 12", "12" ja " 12 " ovat sama pöytä. */
function avain(name: string): string {
  return name
    .toLowerCase()
    .replace(/pöytä|poyta|table|bord|masa|laud/g, "")
    .replace(/[^a-z0-9äöå]/g, "")
    .trim();
}

/**
 * Tunnistetut pöydät ravintolan omiin pöytiin.
 *
 * Nimi ensin, järjestys vasta sitten.
 *
 * Nimi on ainoa varma side: jos pohjapiirroksessa lukee 12, se on
 * pöytä 12. Järjestys on arvaus — mutta hyödyllinen arvaus silloin kun
 * kuvassa ei ole numeroita ja pöytiä on yhtä monta kuin listalla.
 *
 * Järjestys luetaan kuten salia katsotaan: ylhäältä alas, vasemmalta
 * oikealle. Rivitoleranssi on viisi prosenttia korkeudesta, jottei
 * hieman ylempänä oleva pöytä hyppää edelle omalta riviltään.
 */
export function matchDetections(
  detected: DetectedTable[],
  tables: PlanTable[],
): MatchResult {
  const jaljella = [...tables];
  const matched: TableMatch[] = [];
  const extra: DetectedTable[] = [];

  /* Nimellä täsmäävät ensin, jotta järjestys ei vie niiden paikkaa. */
  const nimetty = new Map<string, PlanTable>();
  for (const table of jaljella) {
    const k = avain(table.name);
    if (k.length > 0 && !nimetty.has(k)) nimetty.set(k, table);
  }

  const jarjestykseen: DetectedTable[] = [];

  for (const row of detected) {
    const k = row.label === null ? "" : avain(row.label);
    const osuma = k.length > 0 ? nimetty.get(k) : undefined;

    if (osuma) {
      nimetty.delete(k);
      const kohta = jaljella.findIndex((x) => x.id === osuma.id);
      if (kohta >= 0) jaljella.splice(kohta, 1);

      matched.push({
        id: osuma.id,
        name: osuma.name,
        x: row.x,
        y: row.y,
        shape: row.shape,
        by: "label",
        seats: row.seats,
      });
    } else if (k.length > 0) {
      /*
       * Kuvassa on numero, mutta sen nimistä pöytää ei ole listalla.
       *
       * Tämä ei mene järjestykseen. Kuva sanoo "12", ja jos se
       * sijoitettaisiin järjestyksen perusteella pöydälle 13, kartta
       * väittäisi eri asiaa kuin pohjapiirros jonka päällä se on.
       * Ylimääräisenä se on käyttäjän nähtävissä ja korjattavissa.
       */
      extra.push(row);
    } else {
      jarjestykseen.push(row);
    }
  }

  /*
   * Loput järjestyksessä, mutta vain jos niitä on yhtä monta.
   *
   * Eri määrä tarkoittaa että jokin on jäänyt tunnistamatta tai
   * ylimääräistä on tunnistettu — ja silloin järjestykseen sitominen
   * siirtäisi pöydät toistensa paikoille. Se on huonompi kuin olla
   * siirtämättä mitään.
   */
  if (jarjestykseen.length > 0 && jarjestykseen.length === jaljella.length) {
    const lue = [...jarjestykseen].sort((a, b) =>
      Math.abs(a.y - b.y) > 5 ? a.y - b.y : a.x - b.x,
    );

    const kohteet = [...jaljella].sort((a, b) =>
      a.name.localeCompare(b.name, "fi", { numeric: true }),
    );

    lue.forEach((row, i) => {
      const table = kohteet[i];
      matched.push({
        id: table.id,
        name: table.name,
        x: row.x,
        y: row.y,
        shape: row.shape,
        by: "order",
        seats: row.seats,
      });
    });

    jaljella.length = 0;
  } else {
    extra.push(...jarjestykseen);
  }

  return {
    matched,
    extra,
    missing: jaljella.map((table) => ({ id: table.id, name: table.name })),
  };
}

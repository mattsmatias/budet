/**
 * Pöytien ja varausten tuonti tiedostosta.
 *
 * Ravintola joka vaihtaa varausjärjestelmää saa vanhasta ulos CSV:n.
 * Mitä siinä on, riippuu järjestelmästä: Quandoolla sarake on "Guests",
 * OpenTablella "Party Size", suomalaisella toimistolla "Henkilöä". Yksi
 * kiinteä sarakejärjestys tarkoittaisi, että tuonti toimii yhdellä
 * viejällä ja hylkää loput.
 *
 * Siksi tämä moduuli tekee kaksi asiaa erikseen:
 *
 *   1. Lukee tiedoston riveiksi ja soluiksi (erotin päätellään).
 *   2. Arvaa mikä sarake on mikä, ja antaa arvauksen käyttäjän
 *      korjattavaksi.
 *
 * Arvaus on ehdotus eikä päätös. Ihminen näkee esikatselusta mitä
 * tuodaan ennen kuin mitään tallennetaan, koska väärin tulkittu
 * päivämääräsarake ei näy virheenä vaan sadan varauksen siirtymisenä
 * väärälle kuukaudelle.
 *
 * ---------------------------------------------------------------------
 * TÄSSÄ EI OLE YHTÄÄN KYSELYÄ
 * ---------------------------------------------------------------------
 *
 * Kaikki alla on puhdasta laskentaa: merkkijono sisään, rivit ulos.
 * Tuonnin tekee kannan funktio, joka kirjaa varaukset varausmoottorin
 * läpi. Jako on siksi, että juuri tämä osa menee rikki oudolla
 * tiedostolla — ja rikkoutumisen on oltava testattavissa ilman kantaa.
 */

// ---------------------------------------------------------------------------
// Tiedosto soluiksi
// ---------------------------------------------------------------------------

/**
 * Erottimen päättely.
 *
 * Otsikkorivi ratkaisee: se on rivi jossa erottimia on eniten. Pisteellä
 * ja pilkulla kirjoitettu desimaali sotkisi laskennan riviaineistosta,
 * mutta otsikot ovat sanoja.
 *
 * Puolipiste on ensin, koska suomalainen Excel kirjoittaa sen.
 */
const EROTTIMET = [";", ",", "\t", "|"] as const;

export function detectDelimiter(text: string): string {
  const rivi = text.split(/\r?\n/).find((row) => row.trim().length > 0) ?? "";

  let paras = ",";
  let eniten = 0;

  for (const erotin of EROTTIMET) {
    /* Lainausmerkkien sisällä olevat erottimet eivät kelpaa laskuriin. */
    const maara = countOutsideQuotes(rivi, erotin);
    if (maara > eniten) {
      eniten = maara;
      paras = erotin;
    }
  }

  return paras;
}

function countOutsideQuotes(row: string, delimiter: string): number {
  let count = 0;
  let quoted = false;

  for (let i = 0; i < row.length; i++) {
    const merkki = row[i];
    if (merkki === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && merkki === delimiter) count++;
  }

  return count;
}

/**
 * CSV soluiksi.
 *
 * Lainausmerkit, niiden sisällä olevat rivinvaihdot ja kahdennettu
 * lainausmerkki ("") ovat kaikki oikeasti tiedostoissa, joten ne
 * käsitellään. Rivi joka on kokonaan tyhjä jätetään pois: tiedoston
 * lopussa on melkein aina yksi.
 */
export function parseDelimited(text: string, delimiter?: string): string[][] {
  const erotin = delimiter ?? detectDelimiter(text);
  const puhdas = text.replace(/^﻿/, "");

  const rivit: string[][] = [];
  let rivi: string[] = [];
  let solu = "";
  let quoted = false;

  for (let i = 0; i < puhdas.length; i++) {
    const merkki = puhdas[i];

    if (quoted) {
      if (merkki === '"') {
        if (puhdas[i + 1] === '"') {
          solu += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        solu += merkki;
      }
      continue;
    }

    if (merkki === '"') {
      quoted = true;
      continue;
    }

    if (merkki === erotin) {
      rivi.push(solu.trim());
      solu = "";
      continue;
    }

    if (merkki === "\n" || merkki === "\r") {
      /* \r\n on yksi rivinvaihto eikä kaksi. */
      if (merkki === "\r" && puhdas[i + 1] === "\n") i++;

      rivi.push(solu.trim());
      solu = "";

      if (rivi.some((kentta) => kentta.length > 0)) rivit.push(rivi);
      rivi = [];
      continue;
    }

    solu += merkki;
  }

  rivi.push(solu.trim());
  if (rivi.some((kentta) => kentta.length > 0)) rivit.push(rivi);

  return rivit;
}

// ---------------------------------------------------------------------------
// Sarakkeiden tunnistus
// ---------------------------------------------------------------------------

export type ReservationField =
  | "date"
  | "time"
  | "partySize"
  | "name"
  | "phone"
  | "email"
  | "note"
  | "allergies"
  | "status"
  | "tables";

export type TableField = "name" | "seatsMin" | "seatsMax" | "area" | "shape";

export type Mapping<T extends string> = Partial<Record<T, number>>;

/**
 * Otsikoiden nimet joista sarake tunnistetaan.
 *
 * Lista on tarkoituksella pitkä ja kielillä joilla ravintola-alan
 * järjestelmiä myydään Suomessa. Osuma etsitään järjestyksessä, ja
 * tarkin nimi on ensin: "party size" ennen "party", jotta jälkimmäinen
 * ei nappaa edellistä.
 */
const VARAUS_NIMET: Record<ReservationField, string[]> = {
  date: ["päivä", "paiva", "pvm", "päivämäärä", "date", "datum", "day"],
  time: ["klo", "aika", "kello", "time", "hour", "start time", "starttime"],
  partySize: [
    "party size",
    "partysize",
    "henkilöä",
    "henkiloa",
    "hlö",
    "hlo",
    "seurue",
    "guests",
    "covers",
    "pax",
    "people",
    "persons",
    "party",
  ],
  name: ["nimi", "asiakas", "varaaja", "name", "guest name", "guest", "customer"],
  phone: ["puhelin", "puh", "numero", "phone", "mobile", "tel", "telephone"],
  email: ["sähköposti", "sahkoposti", "email", "e-mail", "mail"],
  note: [
    "lisätiedot",
    "lisatiedot",
    "toiveet",
    "viesti",
    "note",
    "notes",
    "comment",
    "comments",
    "remarks",
    "message",
  ],
  allergies: [
    "allergiat",
    "allergia",
    "ruokavalio",
    "allergies",
    "allergy",
    "dietary",
    "diet",
  ],
  status: ["tila", "status", "state"],
  tables: ["pöytä", "poyta", "pöydät", "poydat", "table", "tables"],
};

const POYTA_NIMET: Record<TableField, string[]> = {
  name: ["nimi", "pöytä", "poyta", "name", "table", "table name", "number"],
  seatsMin: ["väh", "vah", "min", "seats min", "minimum", "vähintään"],
  seatsMax: [
    "paikat",
    "enint",
    "max",
    "seats",
    "seats max",
    "capacity",
    "kapasiteetti",
  ],
  area: ["alue", "sali", "area", "zone", "section", "room"],
  shape: ["muoto", "shape"],
};

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function guess<T extends string>(
  headers: string[],
  nimet: Record<T, string[]>,
): Mapping<T> {
  const puhtaat = headers.map(normalise);
  const mapping: Mapping<T> = {};
  const varatut = new Set<number>();

  for (const kentta of Object.keys(nimet) as T[]) {
    /* Täsmällinen osuma ensin, sitten alkuosa. Sisältyvyys on viimeinen. */
    const ehdokkaat = nimet[kentta];

    let osuma = -1;

    for (const nimi of ehdokkaat) {
      osuma = puhtaat.findIndex((h, i) => !varatut.has(i) && h === nimi);
      if (osuma >= 0) break;
    }

    if (osuma < 0) {
      for (const nimi of ehdokkaat) {
        osuma = puhtaat.findIndex(
          (h, i) => !varatut.has(i) && h.includes(nimi),
        );
        if (osuma >= 0) break;
      }
    }

    if (osuma >= 0) {
      mapping[kentta] = osuma;
      varatut.add(osuma);
    }
  }

  return mapping;
}

export function guessReservationColumns(
  headers: string[],
): Mapping<ReservationField> {
  return guess(headers, VARAUS_NIMET);
}

export function guessTableColumns(headers: string[]): Mapping<TableField> {
  return guess(headers, POYTA_NIMET);
}

// ---------------------------------------------------------------------------
// Arvojen tulkinta
// ---------------------------------------------------------------------------

/**
 * Päivämäärä ISO-muotoon.
 *
 * Kolme muotoa: 2026-08-31, 31.8.2026 ja 31/08/2026. Amerikkalainen
 * kuukausi ensin -muoto tunnistetaan vain silloin kun se on ainoa
 * mahdollinen (ensimmäinen luku yli 12), koska 03/04/2026 on
 * kahdessa maassa kaksi eri päivää eikä arvaus voi olla oikea.
 *
 * Null tarkoittaa "en osaa lukea tätä". Se on rivin virhe eikä
 * hiljainen nolla: väärälle päivälle tuotu varaus löytyy vasta silloin
 * kun seurue ei tule.
 */
export function parseImportDate(value: string): string | null {
  const teksti = (value ?? "").trim();
  if (!teksti) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(teksti);
  if (iso) return kokoa(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const piste = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/.exec(teksti);
  if (piste) {
    const eka = Number(piste[1]);
    const toka = Number(piste[2]);

    /* Yli 12 ei voi olla kuukausi: 13/04 on huhtikuun 13. päivä. */
    if (eka > 12 && toka <= 12) {
      return kokoa(Number(piste[3]), toka, eka);
    }
    if (toka > 12 && eka <= 12) {
      return kokoa(Number(piste[3]), eka, toka);
    }

    /* Muuten päivä ensin: eurooppalainen muoto on tässä oletus. */
    return kokoa(Number(piste[3]), toka, eka);
  }

  const vuosiEnsin = /^(\d{4})\/(\d{1,2})\/(\d{1,2})/.exec(teksti);
  if (vuosiEnsin) {
    return kokoa(
      Number(vuosiEnsin[1]),
      Number(vuosiEnsin[2]),
      Number(vuosiEnsin[3]),
    );
  }

  return null;
}

function kokoa(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  /* Kalenterin oma tarkistus: 31.2. ei ole päivä. */
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Kellonaika muotoon HH:MM.
 *
 * Myös aikaleimasta (2026-08-31 19:00) ja pisteellä kirjoitetusta
 * (19.30), koska molempia tulee viejistä ulos. Sekunnit pudotetaan:
 * varausaika on minuutin tarkkuudella.
 */
export function parseImportTime(value: string): string | null {
  const teksti = (value ?? "").trim();
  if (!teksti) return null;

  /*
   * Luku, erotin, kaksi lukua — eikä numeroa kummallakaan puolella.
   *
   * Ilman reunaehtoja "31.8.2026 19:00" tulkittaisiin kello 08:20:ksi:
   * kuvio osuu keskelle päivämäärää. Sama solu sisältää usein sekä
   * päivän että kellon, joten se on tavallinen tapaus eikä nurkka.
   */
  const osuma = /(?<!\d)(\d{1,2})[:.](\d{2})(?!\d)/.exec(teksti);
  if (!osuma) return null;

  const tunnit = Number(osuma[1]);
  const minuutit = Number(osuma[2]);

  if (tunnit > 23 || minuutit > 59) return null;

  return `${String(tunnit).padStart(2, "0")}:${String(minuutit).padStart(2, "0")}`;
}

/**
 * Seurueen koko luvusta joka voi olla "4", "4 hlö" tai "4 people".
 *
 * Ensimmäinen kokonaisluku kelpaa. Null on virhe eikä ykkönen: yhden
 * hengen varaus siellä missä oli kymmenen on hiljaa väärä.
 */
export function parseImportNumber(value: string): number | null {
  const osuma = /(\d+)/.exec((value ?? "").trim());
  if (!osuma) return null;

  const luku = Number(osuma[1]);
  return Number.isFinite(luku) ? luku : null;
}

/** Pöytien nimet solusta: "12 + 13", "12,13" ja "12/13" ovat kaikki kaksi. */
export function parseImportTables(value: string): string[] {
  return (value ?? "")
    .split(/[,+/;]/)
    .map((osa) => osa.trim())
    .filter((osa) => osa.length > 0);
}

const TILAT: Record<string, string> = {
  peruttu: "cancelled",
  peruutettu: "cancelled",
  cancelled: "cancelled",
  canceled: "cancelled",
  "no show": "no_show",
  no_show: "no_show",
  noshow: "no_show",
  "ei saapunut": "no_show",
  saapui: "completed",
  arrived: "completed",
  seated: "completed",
  completed: "completed",
  valmis: "completed",
  vahvistettu: "confirmed",
  confirmed: "confirmed",
  booked: "confirmed",
};

/**
 * Tila vanhasta järjestelmästä.
 *
 * Tuntematon tila on vahvistettu eikä virhe: varaus on olemassa, ja
 * vahvistettu on ainoa tulkinta joka ei väitä siitä mitään ylimääräistä.
 *
 * Saapunut tuodaan valmiina eikä saapuneena: menneen illan seurue ei
 * istu enää pöydässä, ja "saapunut" pitäisi pöydän varattuna
 * salinäkymässä ikuisesti.
 */
export function parseImportStatus(value: string): string {
  const teksti = normalise(value ?? "");
  return TILAT[teksti] ?? "confirmed";
}

// ---------------------------------------------------------------------------
// Rivit tuotavaksi
// ---------------------------------------------------------------------------

export interface ImportReservation {
  date: string;
  time: string;
  partySize: number;
  name: string;
  phone?: string;
  email?: string;
  note?: string;
  allergies?: string;
  status?: string;
  tables?: string[];
}

export interface ImportTable {
  name: string;
  seatsMin: number;
  seatsMax: number;
  area?: string;
  shape?: string;
}

export interface RowProblem {
  /** Rivinumero tiedostossa, otsikkorivi mukaan lukien. */
  line: number;
  field: string;
  value: string;
}

export interface Prepared<T> {
  rows: T[];
  problems: RowProblem[];
}

function cell<T extends string>(
  row: string[],
  mapping: Mapping<T>,
  field: T,
): string {
  const index = mapping[field];
  if (index === undefined || index < 0) return "";
  return (row[index] ?? "").trim();
}

/**
 * Varausrivit tuotavaksi.
 *
 * Kelpaamaton rivi ei pysäytä muita vaan päätyy ongelmalistaan
 * rivinumeroineen. Tuhannen rivin tiedostossa on aina muutama
 * puolikas, ja niiden takia ei kannata hylätä yhdeksääsataa
 * yhdeksääkymmentä.
 */
export function prepareReservations(
  rows: string[][],
  mapping: Mapping<ReservationField>,
  options: { skipHeader?: boolean } = {},
): Prepared<ImportReservation> {
  const data = options.skipHeader === false ? rows : rows.slice(1);
  const out: ImportReservation[] = [];
  const problems: RowProblem[] = [];

  data.forEach((row, index) => {
    /* +2: otsikkorivi ja ykkösestä alkava numerointi. */
    const line = index + 2;

    const date = parseImportDate(cell(row, mapping, "date"));
    const time = parseImportTime(cell(row, mapping, "time"));
    const party = parseImportNumber(cell(row, mapping, "partySize"));
    const name = cell(row, mapping, "name");

    if (!name) {
      problems.push({ line, field: "name", value: "" });
      return;
    }
    if (!date) {
      problems.push({ line, field: "date", value: cell(row, mapping, "date") });
      return;
    }
    if (!time) {
      problems.push({ line, field: "time", value: cell(row, mapping, "time") });
      return;
    }
    if (party === null || party < 1) {
      problems.push({
        line,
        field: "partySize",
        value: cell(row, mapping, "partySize"),
      });
      return;
    }

    const tables = parseImportTables(cell(row, mapping, "tables"));

    out.push({
      date,
      time,
      partySize: party,
      name: name.slice(0, 120),
      phone: cell(row, mapping, "phone").slice(0, 40) || undefined,
      email: cell(row, mapping, "email").slice(0, 160) || undefined,
      note: cell(row, mapping, "note").slice(0, 500) || undefined,
      allergies: cell(row, mapping, "allergies").slice(0, 200) || undefined,
      status: parseImportStatus(cell(row, mapping, "status")),
      tables: tables.length > 0 ? tables : undefined,
    });
  });

  return { rows: out, problems };
}

/**
 * Pöytärivit tuotavaksi.
 *
 * Paikkaluku on ainoa pakollinen numero. Jos vähimmäismäärää ei ole
 * annettu, se on yksi: pöytä johon mahtuu kuusi kelpaa yhdelle, ja
 * ravintola voi kiristää sen jälkeenpäin. Toisin päin arvattuna tuonti
 * sulkisi pöytiä pois käytöstä hiljaa.
 */
export function prepareTables(
  rows: string[][],
  mapping: Mapping<TableField>,
  options: { skipHeader?: boolean } = {},
): Prepared<ImportTable> {
  const data = options.skipHeader === false ? rows : rows.slice(1);
  const out: ImportTable[] = [];
  const problems: RowProblem[] = [];

  data.forEach((row, index) => {
    const line = index + 2;

    const name = cell(row, mapping, "name");
    const max = parseImportNumber(cell(row, mapping, "seatsMax"));
    const min = parseImportNumber(cell(row, mapping, "seatsMin"));

    if (!name) {
      problems.push({ line, field: "name", value: "" });
      return;
    }

    if (max === null || max < 1) {
      problems.push({
        line,
        field: "seatsMax",
        value: cell(row, mapping, "seatsMax"),
      });
      return;
    }

    const vahimmais = min !== null && min >= 1 && min <= max ? min : 1;
    const muoto = normalise(cell(row, mapping, "shape"));

    out.push({
      name: name.slice(0, 60),
      seatsMin: vahimmais,
      seatsMax: max,
      area: cell(row, mapping, "area").slice(0, 60) || undefined,
      shape:
        muoto.startsWith("pyö") || muoto.startsWith("round") || muoto === "circle"
          ? "round"
          : muoto.startsWith("neli") || muoto.startsWith("square")
            ? "square"
            : muoto.startsWith("suora") || muoto.startsWith("rect")
              ? "rect"
              : undefined,
    });
  });

  return { rows: out, problems };
}

/**
 * Rivit paloiksi, jotta yksi kutsu ei vie koko tiedostoa.
 *
 * Kanta ottaa vastaan rajallisen määrän kerralla, koska jokainen
 * varausrivi kulkee varausmoottorin läpi ja ottaa ravintolakohtaisen
 * lukon. Pala kerrallaan tarkoittaa myös, että keskeytynyt tuonti on
 * puoliksi tehty eikä kokonaan hukassa — ja saman tiedoston voi ajaa
 * uudelleen, koska kanta ohittaa jo tuodut rivit.
 */
export function chunk<T>(rows: T[], size: number): T[][] {
  const koko = Math.max(1, size);
  const out: T[][] = [];

  for (let i = 0; i < rows.length; i += koko) {
    out.push(rows.slice(i, i + koko));
  }

  return out;
}

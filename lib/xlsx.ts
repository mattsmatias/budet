/**
 * Vähimmäinen .xlsx-kirjoitin.
 *
 * Miksi itse eikä kirjastolla: xlsx on ZIP-paketti muutamaa XML-tiedostoa,
 * ja tarvitsemme siitä vain taulukon. Valmis kirjasto toisi megatavun
 * koodia, oman päivitysvelkansa ja ominaisuuksia joita ei käytetä.
 * Tämä on noin kaksisataa riviä joka tekee yhden asian.
 *
 * Paketti kirjoitetaan pakkaamattomana (STORED). Deflate säästäisi tilaa
 * mutta vaatisi zlibin ja virheenkäsittelyn; raporttitiedostot ovat
 * kymmeniä kilotavuja, joten säästö ei maksa monimutkaisuutta.
 *
 * Luvut kirjoitetaan lukuina eikä tekstinä, jotta Excelissä voi laskea.
 * Juuri se on syy tehdä xlsx CSV:n rinnalle.
 */

export type CellValue = string | number | null;

export interface Sheet {
  /** Välilehden nimi. Excel rajaa 31 merkkiin eikä salli : \ / ? * [ ] */
  name: string;
  /** Ensimmäinen rivi on otsikko ja lukitaan paikalleen. */
  rows: CellValue[][];
}

// ---------------------------------------------------------------------------
// XML
// ---------------------------------------------------------------------------

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 0 → A, 25 → Z, 26 → AA. */
function columnName(index: number): string {
  let name = "";
  let n = index;

  do {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);

  return name;
}

function safeSheetName(name: string, fallback: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, " ").trim();
  return (cleaned || fallback).slice(0, 31);
}

function sheetXml(sheet: Sheet): string {
  const rows = sheet.rows
    .map((cells, rowIndex) => {
      const r = rowIndex + 1;

      const body = cells
        .map((value, columnIndex) => {
          const ref = `${columnName(columnIndex)}${r}`;
          if (value === null || value === "") return "";

          if (typeof value === "number" && Number.isFinite(value)) {
            return `<c r="${ref}"><v>${value}</v></c>`;
          }

          // Otsikkorivi lihavoidaan tyylillä 1.
          const style = rowIndex === 0 ? ' s="1"' : "";
          return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(
            String(value),
          )}</t></is></c>`;
        })
        .join("");

      return `<row r="${r}">${body}</row>`;
    })
    .join("");

  // Otsikkorivi jäädytetään: pitkää taulukkoa ei voi lukea ilman sitä.
  const freeze =
    '<sheetViews><sheetView workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    "</sheetView></sheetViews>";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${freeze}<sheetData>${rows}</sheetData></worksheet>`;
}

function workbookXml(sheets: Sheet[]): string {
  const entries = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(safeSheetName(sheet.name, `Taulukko${index + 1}`))}" sheetId="${
          index + 1
        }" r:id="rId${index + 1}"/>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${entries}</sheets></workbook>`;
}

function workbookRelsXml(count: number): string {
  const entries = Array.from({ length: count }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${
      i + 1
    }.xml"/>`,
  ).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${entries}<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function contentTypesXml(count: number): string {
  const sheets = Array.from({ length: count }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${
      i + 1
    }.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
}

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

/** Kaksi tyyliä: tavallinen ja lihavoitu otsikko. */
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`;

// ---------------------------------------------------------------------------
// ZIP
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }

  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface Entry {
  name: string;
  data: Uint8Array;
}

/**
 * Kirjoittaa pakkaamattoman ZIP-paketin.
 *
 * Kentät ovat little-endian, kuten ZIP-määrittely vaatii. Aikaleimaksi
 * kiinteä arvo: vaihtuva aikaleima tekisi samasta aineistosta eri
 * tavuja joka ajolla, eikä tiedostoja voisi verrata.
 */
function zip(entries: Entry[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];

  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(local.buffer);

    view.setUint32(0, 0x04034b50, true); // paikallinen tunniste
    view.setUint16(4, 20, true); // tarvittava versio
    view.setUint16(6, 0x0800, true); // UTF-8-nimet
    view.setUint16(8, 0, true); // menetelmä: STORED
    view.setUint16(10, 0, true); // aika
    view.setUint16(12, 0x2821, true); // päivä (1.1.2000)
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    chunks.push(local, entry.data);

    const dir = new Uint8Array(46 + nameBytes.length);
    const dirView = new DataView(dir.buffer);

    dirView.setUint32(0, 0x02014b50, true); // keskushakemiston tunniste
    dirView.setUint16(4, 20, true);
    dirView.setUint16(6, 20, true);
    dirView.setUint16(8, 0x0800, true);
    dirView.setUint16(10, 0, true);
    dirView.setUint16(12, 0, true);
    dirView.setUint16(14, 0x2821, true);
    dirView.setUint32(16, crc, true);
    dirView.setUint32(20, size, true);
    dirView.setUint32(24, size, true);
    dirView.setUint16(28, nameBytes.length, true);
    dirView.setUint32(42, offset, true);
    dir.set(nameBytes, 46);

    central.push(dir);
    offset += local.length + size;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  const all = [...chunks, ...central, end];
  const total = all.reduce((sum, part) => sum + part.length, 0);

  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of all) {
    out.set(part, cursor);
    cursor += part.length;
  }

  return out;
}

// ---------------------------------------------------------------------------

/** Rakentaa .xlsx-tiedoston annetuista välilehdistä. */
export function buildXlsx(sheets: Sheet[]): Uint8Array {
  if (sheets.length === 0) {
    throw new Error("Työkirjassa on oltava vähintään yksi välilehti");
  }

  const encoder = new TextEncoder();

  const entries: Entry[] = [
    { name: "[Content_Types].xml", data: encoder.encode(contentTypesXml(sheets.length)) },
    { name: "_rels/.rels", data: encoder.encode(ROOT_RELS) },
    { name: "xl/workbook.xml", data: encoder.encode(workbookXml(sheets)) },
    { name: "xl/_rels/workbook.xml.rels", data: encoder.encode(workbookRelsXml(sheets.length)) },
    { name: "xl/styles.xml", data: encoder.encode(STYLES) },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: encoder.encode(sheetXml(sheet)),
    })),
  ];

  return zip(entries);
}

/**
 * Tunnuksen rasterointi PNG- ja ICO-muotoon.
 *
 * MIKSI TÄMÄ ON SKRIPTI EIKÄ KÄSIN TEHTY TIEDOSTO.
 *
 * Ensimmäisellä yrityksellä kuva tehtiin selaimessa ja tavut
 * kopioitiin käsin. Yksi merkki meni väärin, PNG:n CRC ei täsmännyt,
 * ja Next kaatoi koko sivuston 500-virheeseen. Binääriä ei voi
 * tarkistaa silmällä.
 *
 * Nyt kuva lasketaan samasta geometriasta kuin components/brand/logo.tsx
 * ja app/icon.svg. Skripti on ajettavissa uudelleen milloin tahansa:
 *
 *   node scripts/build-icons.mjs
 *
 * Muodot arvotaan analyyttisesti eikä piirretä poluista, joten
 * reunanpehmennys tehdään ylinäytteistämällä: jokainen pikseli
 * jaetaan 4x4 osaan ja peitto lasketaan niiden osumista.
 */

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const JUURI = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- Geometria. Samat luvut kuin logo.tsx ja icon.svg. --------------------

const RUUTU = 28;
const TAUSTA = [0x0f, 0x17, 0x29];
const MERKKI = [0xff, 0xff, 0xff];

const VARSI = { x: 7.3, y: 6.5, w: 4.84, h: 15, r: 0.6 };
const HAARA = { cx: 12.14, sisa: 3.95, ulko: 8.59 };
const LOVI = { y: 14, x1: 10.65, x2: 16.25, paksuus: 0.45 };
const TILE_R = 7.5;

const nelio = (v) => v * v;

/** Pyöristetyn suorakaiteen sisäpuoli. */
function suorakaiteessa(x, y, { x: rx, y: ry, w, h, r }) {
  if (x < rx || x > rx + w || y < ry || y > ry + h) return false;
  const kx = Math.min(Math.max(x, rx + r), rx + w - r);
  const ky = Math.min(Math.max(y, ry + r), ry + h - r);
  return nelio(x - kx) + nelio(y - ky) <= nelio(r);
}

/** Neljännesrenkaan sisäpuoli. ylos=true on ylähaara. */
function haarassa(x, y, ylos) {
  const cy = ylos ? VARSI.y : VARSI.y + VARSI.h;
  const dx = x - HAARA.cx;
  const dy = ylos ? y - cy : cy - y;
  if (dx < 0 || dy < 0) return false;
  const d2 = nelio(dx) + nelio(dy);
  return d2 >= nelio(HAARA.sisa) && d2 <= nelio(HAARA.ulko);
}

/** Pyöreäpäisen viivan sisäpuoli. */
function lovessa(x, y) {
  const s = LOVI.paksuus / 2;
  const kx = Math.min(Math.max(x, LOVI.x1), LOVI.x2);
  return nelio(x - kx) + nelio(y - LOVI.y) <= nelio(s);
}

/** Väri pisteessä, tai null jos laatikon ulkopuolella. */
function variPisteessa(x, y) {
  if (!suorakaiteessa(x, y, { x: 0, y: 0, w: RUUTU, h: RUUTU, r: TILE_R })) return null;
  if (lovessa(x, y)) return TAUSTA;
  if (suorakaiteessa(x, y, VARSI)) return MERKKI;
  if (haarassa(x, y, true) || haarassa(x, y, false)) return MERKKI;
  return TAUSTA;
}

// --- Rasterointi ----------------------------------------------------------

const OTOKSIA = 4; // 4x4 alinäytettä per pikseli

function rasteroi(koko) {
  const rivit = [];
  const skaala = RUUTU / koko;

  for (let py = 0; py < koko; py += 1) {
    // PNG-suodatintavu jokaisen rivin alkuun.
    const rivi = Buffer.alloc(1 + koko * 4);
    for (let px = 0; px < koko; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < OTOKSIA; sy += 1) {
        for (let sx = 0; sx < OTOKSIA; sx += 1) {
          const x = (px + (sx + 0.5) / OTOKSIA) * skaala;
          const y = (py + (sy + 0.5) / OTOKSIA) * skaala;
          const vari = variPisteessa(x, y);
          if (!vari) continue;
          r += vari[0];
          g += vari[1];
          b += vari[2];
          a += 1;
        }
      }

      const n = OTOKSIA * OTOKSIA;
      const i = 1 + px * 4;
      // Esikerrotut summat jaetaan osumilla, ei kaikilla otoksilla:
      // muuten reunapikselit tummenisivat kohti mustaa.
      rivi[i] = a ? Math.round(r / a) : 0;
      rivi[i + 1] = a ? Math.round(g / a) : 0;
      rivi[i + 2] = a ? Math.round(b / a) : 0;
      rivi[i + 3] = Math.round((a / n) * 255);
    }
    rivit.push(rivi);
  }

  return Buffer.concat(rivit);
}

// --- PNG ------------------------------------------------------------------

const CRC_TAULU = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const tavu of buf) c = CRC_TAULU[(c ^ tavu) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pala(tyyppi, data) {
  const pituus = Buffer.alloc(4);
  pituus.writeUInt32BE(data.length);
  const runko = Buffer.concat([Buffer.from(tyyppi, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(runko));
  return Buffer.concat([pituus, runko, crc]);
}

function png(koko) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(koko, 0);
  ihdr.writeUInt32BE(koko, 4);
  ihdr[8] = 8; // bittisyvyys
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // pakkaus
  ihdr[11] = 0; // suodatus
  ihdr[12] = 0; // ei lomitusta

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pala("IHDR", ihdr),
    pala("IDAT", deflateSync(rasteroi(koko), { level: 9 })),
    pala("IEND", Buffer.alloc(0)),
  ]);
}

// --- ICO ------------------------------------------------------------------

function ico(koot) {
  const kuvat = koot.map(png);
  const otsikko = Buffer.alloc(6);
  otsikko.writeUInt16LE(1, 2);
  otsikko.writeUInt16LE(koot.length, 4);

  let siirtyma = 6 + koot.length * 16;
  const merkinnat = koot.map((koko, i) => {
    const m = Buffer.alloc(16);
    m[0] = koko >= 256 ? 0 : koko;
    m[1] = koko >= 256 ? 0 : koko;
    m.writeUInt16LE(1, 4);
    m.writeUInt16LE(32, 6);
    m.writeUInt32LE(kuvat[i].length, 8);
    m.writeUInt32LE(siirtyma, 12);
    siirtyma += kuvat[i].length;
    return m;
  });

  return Buffer.concat([otsikko, ...merkinnat, ...kuvat]);
}

// --- Kirjoitus ------------------------------------------------------------

const kohteet = [
  ["app/favicon.ico", ico([16, 32, 48])],
  ["app/apple-icon.png", png(180)],
];

for (const [polku, data] of kohteet) {
  writeFileSync(join(JUURI, polku), data);
  console.log(`${polku}  ${data.length} tavua`);
}

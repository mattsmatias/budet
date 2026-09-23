/**
 * Kirkolliset juhlapäivät, vappu ja itsenäisyyspäivä.
 *
 * MIKSI TÄMÄ ON OMA TIEDOSTONSA.
 *
 * Työehtosopimuksen sunnuntaikorotus koskee sunnuntain lisäksi näitä
 * päiviä. Päivät ovat kalenterin asia eivätkä palkanlaskennan, ja
 * yksittäinen päivämäärä siellä täällä koodissa olisi mahdoton
 * tarkistaa. Ne ovat siis yhdessä paikassa ja omilla testeillään.
 *
 * TÄMÄ EI OLE KALENTERIJÄRJESTELMÄ.
 *
 * Täällä ei ole lomapäiviä, aukioloja eikä työvuorosuunnittelua —
 * vain kysymys siitä, onko tämä päivä sellainen jolta sopimus maksaa
 * sunnuntaikorotuksen.
 *
 * AATOT EIVÄT OLE KIRKOLLISIA JUHLAPÄIVIÄ.
 *
 * Joulu- ja juhannusaatto ovat monessa sopimuksessa omia erikoisuuksiaan,
 * mutta työaikalain ja MaRa-sopimuksen sanamuoto puhuu kirkollisista
 * juhlapäivistä, vapusta ja itsenäisyyspäivästä. Aattoja ei siksi ole
 * täällä: niiden lisääminen on sopimuskohtainen päätös eikä oletus.
 */

/** Kiinteät päivät kuukausi-päivä-muodossa. */
const KIINTEAT = new Set([
  "01-01", // uudenvuodenpäivä
  "01-06", // loppiainen
  "05-01", // vappu
  "12-06", // itsenäisyyspäivä
  "12-25", // joulupäivä
  "12-26", // tapaninpäivä
]);

/** "2026-09-06" → Date keskipäivällä UTC:ssä, jotta vyöhyke ei siirrä päivää. */
function paivaks(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00Z`);
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function siirra(isoDate: string, days: number): string {
  const d = paivaks(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}

/**
 * Pääsiäispäivä, anonyymi gregoriaaninen algoritmi.
 *
 * Pitkäperjantai, toinen pääsiäispäivä, helatorstai ja helluntai
 * lasketaan kaikki tästä, joten yksi oikein laskettu päivä riittää.
 */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Lauantai annetulla välillä.
 *
 * Juhannuspäivä on lauantai 20.–26.6. ja pyhäinpäivä lauantai
 * 31.10.–6.11. Ne eivät ole kiinteitä päiviä vaan sääntöjä, ja sääntö
 * on ainoa muoto joka pysyy oikeana ensi vuonnakin.
 */
function lauantaiValilla(year: number, alku: string): string {
  let paiva = `${year}-${alku}`;

  for (let i = 0; i < 7; i += 1) {
    if (paivaks(paiva).getUTCDay() === 6) return paiva;
    paiva = siirra(paiva, 1);
  }

  return paiva;
}

/** Vuoden kaikki juhlapäivät. */
function vuodenPyhat(year: number): Set<string> {
  const paasiainen = easterSunday(year);

  return new Set([
    ...[...KIINTEAT].map((md) => `${year}-${md}`),
    siirra(paasiainen, -2), // pitkäperjantai
    paasiainen, // pääsiäispäivä
    siirra(paasiainen, 1), // 2. pääsiäispäivä
    siirra(paasiainen, 39), // helatorstai
    siirra(paasiainen, 49), // helluntaipäivä
    lauantaiValilla(year, "06-20"), // juhannuspäivä
    lauantaiValilla(year, "10-31"), // pyhäinpäivä
  ]);
}

/* Vuosi kerrallaan muistiin: laskenta kysyy tätä joka minuutilta. */
const muisti = new Map<number, Set<string>>();

/** Onko päivä kirkollinen juhlapäivä, vappu tai itsenäisyyspäivä? */
export function isPublicHoliday(isoDate: string): boolean {
  const year = Number(isoDate.slice(0, 4));
  if (!Number.isFinite(year)) return false;

  let pyhat = muisti.get(year);
  if (!pyhat) {
    pyhat = vuodenPyhat(year);
    muisti.set(year, pyhat);
  }

  return pyhat.has(isoDate);
}

/**
 * Kuuluuko päivälle sunnuntaikorotus?
 *
 * Viikonpäivä tulee laskennasta, joka on jo ratkaissut sen yrityksen
 * aikavyöhykkeellä — sitä ei päätellä tässä uudestaan.
 */
export function isSundayOrHoliday(isoDate: string, weekday: number): boolean {
  return weekday === 0 || isPublicHoliday(isoDate);
}

/** Aatot joilta sopimus maksaa korotuksen iltapäivästä alkaen. */
const AATOT = new Set([
  "12-31", // uudenvuodenaatto
  "04-30", // vapunaatto
  "12-24", // jouluaatto
]);

/** Vuoden aatot: kiinteät sekä pääsiäislauantai ja juhannusaatto. */
function vuodenAatot(year: number): Set<string> {
  return new Set([
    ...[...AATOT].map((md) => `${year}-${md}`),
    siirra(easterSunday(year), -1), // pääsiäislauantai
    siirra(lauantaiValilla(year, "06-20"), -1), // juhannusaatto
  ]);
}

const aattoMuisti = new Map<number, Set<string>>();

/** Onko päivä sopimuksen tuntema aatto? */
export function isEve(isoDate: string): boolean {
  const year = Number(isoDate.slice(0, 4));
  if (!Number.isFinite(year)) return false;

  let aatot = aattoMuisti.get(year);
  if (!aatot) {
    aatot = vuodenAatot(year);
    aattoMuisti.set(year, aatot);
  }

  return aatot.has(isoDate);
}

/**
 * Kuuluuko päivälle aattokorotus?
 *
 * PYHÄPÄIVÄLLE SIJOITTUVA AATTO EI SAA AATTOLISÄÄ.
 *
 * Sopimus sanoo tämän suoraan. Käytännössä kyse on aatosta joka osuu
 * sunnuntaille: silloin päivä saa sunnuntaikorotuksen eikä aaton
 * korotusta, eivätkä ne kerry päällekkäin.
 */
export function isEveWithSupplement(
  isoDate: string,
  weekday: number,
): boolean {
  return isEve(isoDate) && !isSundayOrHoliday(isoDate, weekday);
}

/**
 * Milloin vuoroon saa leimata.
 *
 * Sääntö on kahdessa paikassa, ja se on tarkoituksellista: kanta
 * ratkaisee, käyttöliittymä kertoo etukäteen. Piilotettu painike ei ole
 * este, mutta este ilman selitystä ei ole käyttöliittymä.
 *
 * Tämän tiedoston vastine on record_clock_event-funktiossa
 * (migraatio 0029). Jos toista muutetaan, toinen on muutettava samalla.
 *
 * Kaikki laskenta tehdään ravintolan ajassa. Vuoron kellonajat ovat
 * paikallisia ("14:00"), joten niitä ei voi verrata UTC-hetkeen.
 */

import { dayIn, minutesOfDayIn } from "./clock-context";
import type { Shift } from "./types";

/**
 * Vuoron kellonajat.
 *
 * Vain nämä kaksi kenttää tarvitaan keston laskentaan. Avoin vuoro ei
 * ole Shift — siltä puuttuu tekijä — mutta se alkaa ja päättyy samalla
 * tavalla.
 */
export interface TimeSpan {
  startTime: string;
  endTime: string;
}

/** Vuoron kesto minuutteina, yön yli menevä mukaan lukien. */
export function shiftLengthMinutes(shift: TimeSpan): number {
  const start = toMinutes(shift.startTime);
  const end = toMinutes(shift.endTime);
  return end > start ? end - start : end + 24 * 60 - start;
}

/**
 * Vuoron alku ja loppu minuutteina vuoron aloituspäivän keskiyöstä.
 *
 * Loppu voi olla yli 1440, mikä tarkoittaa seuraavaa päivää. Se on
 * yksinkertaisempaa kuin kahden päivämäärän käsittely, ja vertailu
 * tehdään samassa yksikössä.
 */
export function shiftBounds(shift: TimeSpan): { startMin: number; endMin: number } {
  const startMin = toMinutes(shift.startTime);
  return { startMin, endMin: startMin + shiftLengthMinutes(shift) };
}

export type ClockInState =
  /** Ei vuoroa jonka ikkunaan nykyhetki osuisi. */
  | { kind: "no-shift"; next: Shift | null }
  /** Vuoro on olemassa mutta ikkuna ei ole vielä auki. */
  | { kind: "too-early"; shift: Shift; opensAtMinutes: number }
  /** Sisäänleimaus sallittu. */
  | { kind: "open"; shift: Shift };

/**
 * Saako työntekijä leimata sisään juuri nyt?
 *
 * Ikkuna alkaa `earlyMinutes` ennen vuoron alkua ja päättyy vuoron
 * loppuun. Loppuraja on siellä koska päättyneeseen vuoroon leimaaminen
 * tuottaisi työaikaa jota kukaan ei ole suunnitellut — ja kello käy
 * siitä eteenpäin itsestään.
 *
 * Hylätty vuoro ei kelpaa. Muut tilat kelpaavat: esihenkilön tekemä
 * vuoro on voimassa heti, ja muuttunut vuoro on yhä vuoro.
 */
export function clockInState(input: {
  shifts: Shift[];
  userId: string;
  nowIso: string;
  timezone: string;
  earlyMinutes: number;
}): ClockInState {
  const { shifts, userId, nowIso, timezone, earlyMinutes } = input;

  const today = dayIn(timezone, nowIso);
  const nowMin = minutesOfDayIn(timezone, nowIso);
  const yesterday = addDays(today, -1);

  const mine = shifts.filter(
    (s) => s.userId === userId && s.status !== "declined",
  );

  for (const shift of mine) {
    // Eilinen vuoro voi jatkua yli keskiyön; silloin nykyhetki on
    // eilisen vuoron aikajanalla 1440 minuutin päässä.
    const offset =
      shift.date === today ? 0 : shift.date === yesterday ? 24 * 60 : null;
    if (offset === null) continue;

    const { startMin, endMin } = shiftBounds(shift);
    const position = nowMin + offset;

    if (position >= startMin - earlyMinutes && position < endMin) {
      return { kind: "open", shift };
    }
  }

  /*
   * Ei auki. Kerrotaan seuraavasta vuorosta, jotta näkymä voi näyttää
   * milloin leimaus avautuu sen sijaan että sanoisi vain "ei".
   */
  const upcoming = nextShiftFrom(mine, nowIso, timezone);

  if (upcoming && upcoming.date === today) {
    const { startMin } = shiftBounds(upcoming);
    if (nowMin < startMin - earlyMinutes) {
      return { kind: "too-early", shift: upcoming, opensAtMinutes: startMin - earlyMinutes };
    }
  }

  return { kind: "no-shift", next: upcoming ?? null };
}

/**
 * Seuraava vuoro joka ei ole vielä päättynyt.
 *
 * PÄÄTTYNYT VUORO EI OLE SEURAAVA VUORO.
 *
 * Pelkkä `date >= today` valitsee tämän päivän vuoron vielä illallakin.
 * Kello 20 työntekijä näki "Seuraava vuoro: tänään 08:00–16:00" — vuoro
 * jonka hän oli jo tehnyt. Loppuaikaa on siis verrattava nykyhetkeen,
 * ei pelkkää päivää.
 *
 * Vertailu tehdään ravintolan ajassa: vuoron kellonajat ovat
 * paikallisia, joten UTC-hetkeen niitä ei voi verrata.
 *
 * Hylätty vuoro ei ole vuoro. Muut tilat kelpaavat.
 */
export function nextShiftFrom(
  shifts: Shift[],
  nowIso: string,
  timezone: string,
): Shift | null {
  const today = dayIn(timezone, nowIso);
  const nowMin = minutesOfDayIn(timezone, nowIso);

  const candidates = shifts
    .filter((s) => s.status !== "declined" && s.date >= today)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
    );

  for (const shift of candidates) {
    if (shift.date > today) return shift;
    if (shiftBounds(shift).endMin > nowMin) return shift;
  }

  return null;
}

/**
 * Kuinka monen millisekunnin päästä leimausikkuna aukeaa.
 *
 * Kortti tarvitsee tämän voidakseen avautua itsestään sen sijaan että
 * jättäisi harmaan painikkeen ruudulle siihen asti kunnes joku tietää
 * ladata sivun uudelleen.
 *
 * Erotus lasketaan minuuteista päivän alusta, ei kahdesta hetkestä.
 * Vuoron kellonaika on paikallinen, ja sen muuntaminen absoluuttiseksi
 * hetkeksi vaatisi vyöhykesiirtymän jota tässä ei tarvita: molemmat
 * luvut ovat samalla mitta-asteikolla.
 *
 * Kesäajan vaihtuminen odotuksen aikana siirtäisi rajaa tunnilla. Se
 * ei ole tässä ongelma, koska uusi piirros laskee saman odotuksen
 * uudelleen — virhe korjaa itsensä.
 */
export function opensInMs(
  opensAtMinutes: number,
  nowIso: string,
  timezone: string,
): number {
  return Math.max(0, opensAtMinutes - minutesOfDayIn(timezone, nowIso)) * 60_000;
}

/** "09:30" minuuteista keskiyöstä. Yli vuorokauden menevä kiertää ympäri. */
export function formatMinuteOfDay(minutes: number): string {
  const wrapped = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

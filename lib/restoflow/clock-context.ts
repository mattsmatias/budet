/**
 * Nykyhetki ravintolan aikavyöhykkeellä.
 *
 * Työaika ja kuukausirajat lasketaan ravintolan ajassa, ei palvelimen.
 * Vercelin palvelin on UTC:ssä; ilman muunnosta klo 01:30 Helsingissä
 * kirjautuisi edelliselle päivälle ja kuukauden viimeisen päivän kuitit
 * putoaisivat väärään kuukauteen.
 */

/** ISO-päivä ("2026-08-20") annetulla vyöhykkeellä. */
export function todayIn(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Kuukausi ("2026-08") annetulla vyöhykkeellä. */
export function monthIn(timezone: string, now: Date = new Date()): string {
  return todayIn(timezone, now).slice(0, 7);
}

/**
 * Nykyhetki ISO-aikaleimana.
 *
 * Aikaleima on aina UTC:ssä — vyöhyke vaikuttaa vain siihen mille päivälle
 * hetki kuuluu, ei itse hetkeen.
 */
export function nowIso(now: Date = new Date()): string {
  return now.toISOString();
}

/** Viikon maanantai annetulle päivälle. */
export function weekStart(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export function weekEnd(isoDate: string): string {
  const d = new Date(`${weekStart(isoDate)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

/** Kuukauden ensimmäinen päivä ISO-muodossa — kantakyselyihin. */
export function monthStartDate(month: string): string {
  return `${month}-01`;
}

/**
 * Hakuikkunan alku paikalliselle päivälle.
 *
 * Kantakysely rajaa aikaleimoja, jotka ovat UTC:tä. Paikallinen
 * vuorokausi alkaa Helsingissä kaksi tai kolme tuntia aiemmin, joten
 * suoraan `${paiva}T00:00:00Z` jättäisi yön ensimmäiset tunnit
 * ulkopuolelle:
 *
 *   leimaus 24.8. klo 01:50 Helsingissä = 23.8. klo 22:50 UTC
 *
 * Yövuorolainen ei siis näkisi omaa sisäänleimaustaan. Vuorokauden
 * puskuri kattaa kaikki vyöhykkeet, ja ylimääräiset rivit rajautuvat
 * pois päiväkohtaisessa laskennassa.
 */
export function windowStartIso(localDate: string): string {
  const d = new Date(`${localDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Aikaleiman tulkinta ravintolan ajassa
// ---------------------------------------------------------------------------
//
// Leimaus tallennetaan UTC:nä, mutta se KUULUU sille päivälle ja sille
// kellonajalle joka ravintolassa oli. Aiemmin päivä ja kellonaika
// poimittiin ISO-merkkijonosta viipaloimalla, mikä on UTC-aikaa:
//
//   occurred_at  2026-08-21 23:15Z
//   viipaloituna "2026-08-21" ja "23:15"
//   Helsingissä  2026-08-22    ja  02:15
//
// Kolme tuntia ja yksi päivä väärin. Työaika oli oikein, koska kesto
// lasketaan absoluuttisista hetkistä, mutta työ kirjautui väärälle
// päivälle ja kello näytti väärää aikaa. Palkoissa se ei kelpaa:
// ilta-, yö- ja viikonloppulisät määräytyvät nimenomaan paikallisesta
// kellonajasta ja viikonpäivästä.

/*
 * Muotoilijat ovat kalliita rakentaa ja niitä tarvitaan riviä kohti.
 * Yksi kappale per vyöhyke riittää.
 */
const dayFormatters = new Map<string, Intl.DateTimeFormat>();
const timeFormatters = new Map<string, Intl.DateTimeFormat>();

function dayFormatter(timezone: string): Intl.DateTimeFormat {
  let formatter = dayFormatters.get(timezone);
  if (!formatter) {
    // en-CA antaa muodon "2026-08-22" ilman omaa merkkijonorakentelua.
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayFormatters.set(timezone, formatter);
  }
  return formatter;
}

function timeFormatter(timezone: string): Intl.DateTimeFormat {
  let formatter = timeFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    timeFormatters.set(timezone, formatter);
  }
  return formatter;
}

/** ISO-päivä ("2026-08-22") jolle aikaleima kuuluu ravintolan ajassa. */
export function dayIn(timezone: string, iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso.slice(0, 10);
  return dayFormatter(timezone).format(at);
}

/** Kellonaika ("02:15") ravintolan ajassa. */
export function timeIn(timezone: string, iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso.slice(11, 16);
  return timeFormatter(timezone).format(at);
}

/** Viikonpäivä ravintolan ajassa: 1 = maanantai, 7 = sunnuntai. */
export function weekdayIn(timezone: string, iso: string): number {
  const day = dayIn(timezone, iso);
  // Päivä on jo paikallinen, joten UTC-keskiyö antaa oikean viikonpäivän.
  const d = new Date(`${day}T00:00:00Z`);
  return ((d.getUTCDay() + 6) % 7) + 1;
}

/** Minuutteja keskiyöstä ravintolan ajassa. Ilta- ja yölisiä varten. */
export function minutesOfDayIn(timezone: string, iso: string): number {
  const [hours, minutes] = timeIn(timezone, iso).split(":").map(Number);
  return hours * 60 + minutes;
}

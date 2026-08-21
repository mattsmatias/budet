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

/**
 * Matkan vapaan tekstin jäsennys (§25).
 *
 * Tämä on deterministinen jäsennin, EI kielimalli. Se poimii vain sen minkä
 * se pystyy tunnistamaan varmasti ja merkitsee loput epävarmoiksi. Käyttäjä
 * vahvistaa tuloksen ennen tallennusta — mitään ei kirjata pelkän arvauksen
 * perusteella.
 *
 * Esimerkki:
 *   "Ajoin Helsingistä Tampereelle Acme-palaveriin, 174 km edestakaisin,
 *    ja söin lounaan"
 * →  origin: Helsinki, destination: Tampere, km: 174, meals: 1
 */

export interface ParsedTrip {
  origin?: string;
  destination?: string;
  purpose?: string;
  kilometers?: number;
  durationHours?: number;
  mealsProvided?: number;
  roundTrip: boolean;
  /** Kentät joita ei saatu tekstistä. Käyttäjä täyttää ne itse. */
  missing: string[];
}

/** Suomen sijamuotoja: "Helsingistä" → "Helsinki". Karkea mutta läpinäkyvä. */
const CITY_SUFFIXES = [
  "sta", "stä", "lta", "ltä", "sta", "een", "lle", "seen", "ssa", "ssä", "lla", "llä",
];

const KNOWN_CITIES = [
  "Helsinki", "Espoo", "Vantaa", "Tampere", "Turku", "Oulu", "Jyväskylä",
  "Lahti", "Kuopio", "Pori", "Joensuu", "Vaasa", "Rovaniemi", "Seinäjoki",
  "Kouvola", "Hämeenlinna", "Mikkeli", "Kotka", "Salo", "Porvoo",
];

export function parseTripText(text: string): ParsedTrip {
  const missing: string[] = [];
  const lower = text.toLowerCase();

  const kilometers = parseKilometers(text);
  const roundTrip = /edestakai|molempiin suuntiin|meno[- ]?paluu|round.?trip/i.test(text);
  const durationHours = parseDuration(text);
  const mealsProvided = countMeals(lower);
  const { origin, destination } = parseRoute(text);
  const purpose = parsePurpose(text);

  if (kilometers === undefined) missing.push("kilometers");
  if (durationHours === undefined) missing.push("durationHours");
  if (!origin) missing.push("origin");
  if (!destination) missing.push("destination");
  if (!purpose) missing.push("purpose");

  return {
    origin,
    destination,
    purpose,
    kilometers,
    durationHours,
    mealsProvided,
    roundTrip,
    missing,
  };
}

function parseKilometers(text: string): number | undefined {
  // "174 km", "174km", "174,5 km"
  const match = /(\d+(?:[.,]\d+)?)\s*km\b/i.exec(text);
  if (!match) return undefined;
  const value = Number.parseFloat(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : undefined;
}

function parseDuration(text: string): number | undefined {
  // "8 h", "8 tuntia", "8,5 tuntia"
  const match = /(\d+(?:[.,]\d+)?)\s*(?:h\b|tunti|tuntia)/i.exec(text);
  if (!match) return undefined;
  const value = Number.parseFloat(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : undefined;
}

function countMeals(lower: string): number {
  let meals = 0;
  if (/lounas|lounaan|lounasta/.test(lower)) meals += 1;
  if (/päivällis|illallis/.test(lower)) meals += 1;
  return Math.min(meals, 2);
}

function parseRoute(text: string): { origin?: string; destination?: string } {
  // Poimitaan kaupungit siinä järjestyksessä kuin ne esiintyvät.
  const found: { city: string; index: number }[] = [];

  for (const city of KNOWN_CITIES) {
    const stem = city.slice(0, Math.max(4, city.length - 2));
    const pattern = new RegExp(`\\b${escapeRegex(stem)}\\p{L}*`, "giu");
    const match = pattern.exec(text);
    if (match) found.push({ city, index: match.index });
  }

  found.sort((a, b) => a.index - b.index);

  return {
    origin: found[0]?.city,
    destination: found[1]?.city,
  };
}

function parsePurpose(text: string): string | undefined {
  // "X-palaveriin", "X-tapaamiseen", "asiakaskäynti X"
  const match =
    /([\p{Lu}][\p{L}&.-]*)[- ]?(?:palaveri|tapaamis|kokous|asiakaskäynti|neuvottelu)\p{L}*/u.exec(
      text,
    );
  if (match) return `${match[1]} – ${match[0].replace(match[1], "").replace(/^[- ]/, "")}`.trim();

  const generic = /(?:varten|takia|vuoksi)\s+([^.,]{3,60})/i.exec(text);
  if (generic) return generic[1].trim();

  return undefined;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Normalisoi suomalaisen sijamuodon perusmuotoon, jos tunnistetaan. */
export function normaliseCity(word: string): string {
  for (const suffix of CITY_SUFFIXES) {
    if (word.toLowerCase().endsWith(suffix)) {
      const stem = word.slice(0, -suffix.length);
      const known = KNOWN_CITIES.find(
        (c) => c.toLowerCase().startsWith(stem.toLowerCase().slice(0, 4)),
      );
      if (known) return known;
    }
  }
  return word;
}

/**
 * Kaupan tunnistus kuitin nimestä.
 *
 * Kuitissa lukee "K-MARKET MALMI", "S-Market Kajaani" tai "Gigantti Oy".
 * Ne ovat eri merkkijonoja mutta osa tunnettua ketjua. Tunnistus liittää
 * ne samaan brändiin, jotta listasta näkee yhdellä silmäyksellä missä on
 * käyty.
 *
 * Kaksi sääntöä ohjaa koko tiedostoa:
 *
 *   Y-tunnus voittaa nimen. Nimi on ihmisen kirjoittama ja kuitissa
 *   painettu; Y-tunnus on yksikäsitteinen. Kun se on luettavissa, sitä
 *   käytetään eikä arvailla.
 *
 *   Epävarma tunnistus ei ole tunnistus. Väärä kauppa kirjanpidossa on
 *   pahempi kuin tuntematon kauppa, koska väärää ei kukaan tarkista.
 *   Raja-arvot ovat alla ja niitä voi säätää yhdestä paikasta.
 */

/**
 * Varmuusrajat.
 *
 * Yhdessä paikassa, koska nämä ovat tuotepäätöksiä eivätkä algoritmin
 * yksityiskohtia — niitä säädetään sen mukaan kuinka usein tunnistus
 * osuu väärin, ja silloin ei haluta etsiä lukuja koodista.
 */
export const MERCHANT_CONFIDENCE = {
  /** Tästä ylöspäin liitetään ilman kysymistä. */
  auto: 0.9,
  /** Tästä ylöspäin ehdotetaan käyttäjälle, mutta ei liitetä. */
  suggest: 0.6,
} as const;

export interface Merchant {
  id: string;
  name: string;
  legalName: string | null;
  businessId: string | null;
  category: string;
  subcategory: string | null;
  brandColor: string;
  brandBackground: string;
  logoUrl: string | null;
  /** Normalisoidut kirjoitusasut. */
  aliases: string[];
}

export interface MerchantMatch {
  merchantId: string;
  /** 0–1. Vertaa MERCHANT_CONFIDENCE-rajoihin. */
  confidence: number;
  /** Mihin tunnistus perustui. Näytetään käyttäjälle kun se ehdotetaan. */
  basis: "business_id" | "alias" | "prefix" | "token";
}

/**
 * Yhtiömuodot ja muut sanat jotka eivät erottele kauppaa mistään.
 *
 * "Gigantti Oy" ja "Gigantti" ovat sama yritys. Jos näitä ei poisteta,
 * jokainen kirjoitusasu tarvitsisi oman aliaksensa.
 */
const NOISE_WORDS = new Set([
  "oy",
  "oyj",
  "ab",
  "ky",
  "tmi",
  "ltd",
  "as",
  "abp",
  "osk",
  "finland",
  "suomi",
  "yritysmyynti",
  "kuitti",
  "myymala",
  "myymälä",
]);

/**
 * Normalisoi nimen vertailukelpoiseksi.
 *
 * Sama funktio ajetaan sekä siemenaineiston aliaksille että kuitista
 * luetulle nimelle. Kaksi eri normalisointia olisi kahden eri totuuden
 * alku: alias tallennettaisiin muodossa jota tunnistus ei koskaan
 * tuota.
 *
 * Skandit säilytetään. "Päivittäistavara" ja "paivittaistavara" ovat eri
 * sanoja, ja ä:n muuntaminen a:ksi yhdistäisi nimiä jotka eivät liity
 * toisiinsa.
 */
export function normalizeMerchantName(raw: string): string {
  return (
    raw
      .toLowerCase()
      // Piste kuuluu nimeen: verkkokauppa.com ei ole verkkokauppa com.
      .replace(/[^\p{L}\p{N}.]+/gu, " ")
      .split(" ")
      .map((word) => word.replace(/^\.+|\.+$/g, ""))
      .filter((word) => word !== "" && !NOISE_WORDS.has(word))
      .join(" ")
      .trim()
  );
}

/**
 * Y-tunnus kuitin tekstistä, tai null.
 *
 * Muoto on seitsemän numeroa, viiva ja tarkiste. Tarkiste lasketaan
 * painokertoimilla, joten väärin luettu numero jää tähän kiinni eikä
 * päädy tunnisteeksi.
 */
export function parseBusinessId(raw: string | null): string | null {
  if (!raw) return null;

  const match = raw.match(/(\d{7})\s*-\s*(\d)/);
  if (!match) return null;

  const body = match[1];
  const checkDigit = Number(match[2]);

  // Viralliset painot. Summan jakojäännös 11:llä ratkaisee tarkisteen.
  const weights = [7, 9, 10, 5, 8, 4, 2];
  const sum = weights.reduce((s, w, i) => s + w * Number(body[i]), 0);
  const remainder = sum % 11;

  // Jäännös 1 ei tuota kelvollista tarkistetta, joten tunnusta ei ole.
  if (remainder === 1) return null;

  const expected = remainder === 0 ? 0 : 11 - remainder;
  if (expected !== checkDigit) return null;

  return `${body}-${checkDigit}`;
}

/**
 * Tunnistaa kaupan nimestä ja mahdollisesta Y-tunnuksesta.
 *
 * Palauttaa null kun mikään ei osu tarpeeksi hyvin. Kutsupaikka
 * päättää raja-arvojen perusteella liitetäänkö vai ehdotetaanko.
 */
export function matchMerchant(
  rawName: string,
  businessId: string | null,
  catalogue: Merchant[],
): MerchantMatch | null {
  // 1. Y-tunnus. Yksikäsitteinen, joten muuta ei tarvitse katsoa.
  if (businessId) {
    const exact = catalogue.find((m) => m.businessId === businessId);
    if (exact) {
      return { merchantId: exact.id, confidence: 1, basis: "business_id" };
    }
  }

  const name = normalizeMerchantName(rawName);
  if (name === "") return null;

  // 2. Tarkka kirjoitusasu.
  for (const merchant of catalogue) {
    if (merchant.aliases.includes(name)) {
      return { merchantId: merchant.id, confidence: 0.97, basis: "alias" };
    }
  }

  // 3. Alkuosa. "k market malmi" alkaa aliaksella "k market", ja
  //    toimipisteen nimi on kuitissa lähes aina brändin perässä.
  //
  //    Pisin osuma voittaa: "k supermarket malmi" alkaa sekä aliaksella
  //    "k supermarket" että — jos sellainen olisi — lyhyemmällä. Ilman
  //    tätä K-Supermarket voisi liittyä K-Marketiin.
  let best: MerchantMatch | null = null;
  let bestLength = 0;

  for (const merchant of catalogue) {
    for (const alias of merchant.aliases) {
      if (!name.startsWith(`${alias} `)) continue;
      if (alias.length <= bestLength) continue;

      bestLength = alias.length;
      best = { merchantId: merchant.id, confidence: 0.92, basis: "prefix" };
    }
  }

  if (best) return best;

  // 4. Sanaosuma. Heikoin peruste, joten se jää ehdotukseksi eikä
  //    liitetä itsestään. Yhden kirjaimen sanat ohitetaan: pelkkä "k"
  //    yhdistäisi kaikki K-ketjut toisiinsa.
  const words = new Set(name.split(" ").filter((w) => w.length > 1));

  for (const merchant of catalogue) {
    for (const alias of merchant.aliases) {
      const aliasWords = alias.split(" ").filter((w) => w.length > 1);
      if (aliasWords.length === 0) continue;

      const hits = aliasWords.filter((w) => words.has(w)).length;
      if (hits !== aliasWords.length) continue;

      return { merchantId: merchant.id, confidence: 0.72, basis: "token" };
    }
  }

  return null;
}

/** Liitetäänkö tunnistus itsestään? */
export function isAutoMatch(match: MerchantMatch | null): boolean {
  return match !== null && match.confidence >= MERCHANT_CONFIDENCE.auto;
}

/** Ehdotetaanko tunnistusta käyttäjälle? */
export function isSuggestion(match: MerchantMatch | null): boolean {
  return (
    match !== null &&
    match.confidence >= MERCHANT_CONFIDENCE.suggest &&
    match.confidence < MERCHANT_CONFIDENCE.auto
  );
}

/**
 * Tunnistamattoman kaupan ulkoasu.
 *
 * Neutraali harmaa, ei satunnaista väriä. Väri on tunniste; jos se
 * arvottaisiin, se väittäisi tunnistuksesta jota ei ole tehty.
 */
export const UNKNOWN_MERCHANT = {
  name: null,
  brandColor: "#6b7280",
  brandBackground: "#f3f4f6",
} as const;

/** Logon kirjain kun kuvaa ei ole. */
export function merchantInitial(name: string): string {
  const first = name.trim().charAt(0);
  return first === "" ? "?" : first.toUpperCase();
}

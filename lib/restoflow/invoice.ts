/**
 * Laskun luetut tiedot.
 *
 * Poiminta antaa merkkijonoja; tämä päättää mitkä niistä ovat oikeita.
 * Ero on tässä tavallista suurempi: väärin luettu viitenumero ei näytä
 * väärältä, mutta maksu ei kohdistu ja lasku jää auki. Sama koskee
 * IBANia — yksi väärä merkki ja raha lähtee jonnekin muualle tai ei
 * lähde lainkaan.
 *
 * Molemmissa on tarkiste, joten arvausta ei tarvitse hyväksyä. Sama
 * ratkaisu kuin Y-tunnuksella (merchants.ts): laskettu tarkiste
 * ratkaisee, ei se miltä numero näyttää.
 */

import { formatMoney } from "@/lib/money";

// ---------------------------------------------------------------------------
// Viitenumero
// ---------------------------------------------------------------------------

/**
 * Kotimainen viitenumero.
 *
 * Tarkiste on viimeinen numero. Muut numerot painotetaan oikealta
 * vasemmalle sarjalla 7, 3, 1 ja summa täydennetään seuraavaan
 * kymmeneen.
 *
 * Pituus on 4–20 numeroa. Lyhyempi ei ole viite vaan sattuma, ja
 * pidempi ei mahdu pankkiin.
 */
export function parseReference(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  if (digits.length < 4 || digits.length > 20) return null;

  /* Pelkät nollat läpäisisivät tarkisteen muttei ole viite. */
  if (/^0+$/.test(digits)) return null;

  const body = digits.slice(0, -1);
  const check = Number(digits.slice(-1));

  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    /* Painotus alkaa oikeasta reunasta, joten indeksi luetaan lopusta. */
    sum += Number(body[body.length - 1 - i]) * weights[i % 3];
  }

  const expected = (10 - (sum % 10)) % 10;
  return expected === check ? digits : null;
}

/**
 * Kansainvälinen RF-viite.
 *
 * RF, kaksi tarkistenumeroa ja korkeintaan 21 merkkiä. Tarkiste on
 * sama mod 97 kuin IBANissa: siirretään neljä ensimmäistä merkkiä
 * loppuun, korvataan kirjaimet numeroilla ja jakojäännöksen on oltava
 * yksi.
 */
export function parseRfReference(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const clean = raw.replace(/\s/g, "").toUpperCase();
  if (!/^RF\d{2}[0-9A-Z]{1,21}$/.test(clean)) return null;

  return mod97(clean) === 1 ? clean : null;
}

/** Kumpi tahansa viitemuoto, tai null jos kumpikaan ei kelpaa. */
export function parseAnyReference(raw: string | null | undefined): string | null {
  return parseRfReference(raw) ?? parseReference(raw);
}

/**
 * Viitenumero luettavaksi: viiden numeron ryhmiin oikealta.
 *
 * Pankkien ja laskujen vakiintunut ryhmittely. Ihminen vertaa numeroa
 * paperiin, ja kahdenkymmenen numeron rimpsu luetaan väärin.
 */
export function formatReference(reference: string): string {
  if (reference.startsWith("RF")) {
    return reference.replace(/(.{4})/g, "$1 ").trim();
  }

  const ryhmat: string[] = [];
  for (let i = reference.length; i > 0; i -= 5) {
    ryhmat.unshift(reference.slice(Math.max(0, i - 5), i));
  }
  return ryhmat.join(" ");
}

// ---------------------------------------------------------------------------
// IBAN
// ---------------------------------------------------------------------------

/**
 * IBAN tarkisteineen.
 *
 * Pituus vaihtelee maittain (Suomessa 18), joten pituutta ei lukita —
 * mod 97 riittää ja kattaa kaikki maat. Väli- ja tavuviivat sallitaan,
 * koska laskussa numero on ryhmitelty.
 */
export function parseIban(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const clean = raw.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[0-9A-Z]{10,30}$/.test(clean)) return null;

  return mod97(clean) === 1 ? clean : null;
}

/** IBAN neljän merkin ryhmiin, kuten se laskussa lukee. */
export function formatIban(iban: string): string {
  return iban.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Mod 97 -tarkiste.
 *
 * Neljä ensimmäistä merkkiä loppuun, kirjaimet numeroiksi (A = 10),
 * ja jakojäännös 97:llä. Luku on liian suuri Numberille, joten se
 * lasketaan pala kerrallaan.
 */
function mod97(value: string): number {
  const siirretty = value.slice(4) + value.slice(0, 4);

  let jaannos = 0;
  for (const merkki of siirretty) {
    const numero = /\d/.test(merkki)
      ? merkki
      : String(merkki.charCodeAt(0) - 55);

    for (const d of numero) {
      jaannos = (jaannos * 10 + Number(d)) % 97;
    }
  }

  return jaannos;
}

// ---------------------------------------------------------------------------
// Laskusta tehtäväksi
// ---------------------------------------------------------------------------

export type Luottamus = "high" | "medium" | "low";

export interface InvoiceField<T> {
  value: T | null;
  confidence: Luottamus;
}

export interface InvoiceExtraction {
  /** Onko kuvassa lasku lainkaan. */
  isInvoice: boolean;
  supplier: InvoiceField<string>;
  dueDate: InvoiceField<string>;
  invoiceDate: InvoiceField<string>;
  totalCents: InvoiceField<number>;
  reference: InvoiceField<string>;
  iban: InvoiceField<string>;
  invoiceNumber: InvoiceField<string>;
  imageQuality: "good" | "poor";
}

export interface TaskDraft {
  title: string;
  dueOn: string | null;
  description: string;
  /** Kentät joiden lukemiseen ei voi luottaa. Käyttäjä tarkistaa ne. */
  uncertain: string[];
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Kelvollinen ja järkevä päivämäärä.
 *
 * Muoto ei riitä: 1925-03-04 on kelvollinen ISO-päivä muttei
 * eräpäivä. Malli lukee joskus laskun numerosta tai viivakoodista
 * jotain päivämäärän näköistä, ja väärä eräpäivä tehtävässä on
 * pahempi kuin puuttuva.
 */
function jarkevaPaiva(raw: string | null, tanaan: string): string | null {
  if (!raw || !ISO.test(raw)) return null;

  const paiva = Date.parse(`${raw}T00:00:00Z`);
  if (Number.isNaN(paiva)) return null;

  const nyt = Date.parse(`${tanaan}T00:00:00Z`);
  const vuosi = 365 * 24 * 60 * 60 * 1000;

  /* Vuosi taaksepäin kattaa myöhässä olevan laskun, kaksi eteenpäin loput. */
  if (paiva < nyt - vuosi || paiva > nyt + 2 * vuosi) return null;

  return raw;
}

/**
 * Poiminnasta tehtävän kentät.
 *
 * Otsikkoon tulee se mikä listasta pitää tunnistaa yhdellä
 * silmäyksellä: kenelle ja kuinka paljon. Loput menevät kuvaukseen,
 * koska ne tarvitaan vasta maksuhetkellä.
 *
 * Epävarmat kentät kerätään erikseen sen sijaan että ne jätettäisiin
 * pois. Käyttäjä näkee arvon ja korjaa sen; tyhjä kenttä ei kerro
 * että jotain luettiin väärin.
 */
export function invoiceToTask(
  extraction: InvoiceExtraction,
  today: string,
  locale = "fi-FI",
): TaskDraft {
  const uncertain: string[] = [];
  const heikko = (kentta: InvoiceField<unknown>) =>
    kentta.value !== null && kentta.confidence === "low";

  const supplier = extraction.supplier.value?.trim() || null;
  if (heikko(extraction.supplier)) uncertain.push("supplier");

  const total = extraction.totalCents.value;
  if (heikko(extraction.totalCents)) uncertain.push("totalCents");

  const dueOn = jarkevaPaiva(extraction.dueDate.value, today);
  if (extraction.dueDate.value !== null && dueOn === null) {
    /* Luettu mutta hylätty: se on nimenomaan tarkistettava. */
    uncertain.push("dueDate");
  } else if (heikko(extraction.dueDate)) {
    uncertain.push("dueDate");
  }

  /*
   * Viite ja IBAN tarkisteen läpi tai ei lainkaan.
   *
   * Näissä ei ole epävarmaa välitilaa: joko tarkiste täsmää ja numero
   * on oikein luettu, tai se on väärin eikä sitä saa näyttää
   * maksettavaksi.
   */
  const reference = parseAnyReference(extraction.reference.value);
  if (extraction.reference.value && !reference) uncertain.push("reference");

  const iban = parseIban(extraction.iban.value);
  if (extraction.iban.value && !iban) uncertain.push("iban");

  const otsikko = [supplier, total !== null ? formatMoney(total, "EUR", locale) : null]
    .filter(Boolean)
    .join(" ");

  const rivit: string[] = [];
  if (reference) rivit.push(`Viite ${formatReference(reference)}`);
  if (iban) rivit.push(`IBAN ${formatIban(iban)}`);
  if (extraction.invoiceNumber.value) {
    rivit.push(`Laskun numero ${extraction.invoiceNumber.value.trim()}`);
  }

  return {
    title: otsikko,
    dueOn,
    description: rivit.join("\n"),
    uncertain,
  };
}

/**
 * Kuittien poimintamoottori.
 *
 * Rajapinta on erotettu toteutuksesta, jotta OpenAI, Anthropic, Google tai
 * erikoistunut OCR-palvelu voidaan kytkeä vaihtamatta käyttöliittymää.
 *
 * KESKEINEN SÄÄNTÖ: poiminta ei koskaan palauta pelkkää arvoa, vaan arvon
 * ja luottamuksen. Epävarma tieto merkitään epävarmaksi ja käyttäjä näkee
 * sen ennen tallennusta. Tyhjä arvo on parempi kuin keksitty.
 */

import { prepareForExtraction } from "./image-prep";
import { checkVat } from "./vat";
import type {
  ExpenseCategory,
  Extracted,
  PaymentMethod,
  ReviewReason,
} from "./types";

/** Poimittu rivi. Ei vielä ReceiptItem — id syntyy vasta tallennuksessa. */
export interface ExtractedItem {
  description: string;
  quantity: number | null;
  unit: string | null;
  totalCents: number;
  category: ExpenseCategory;
  vatRate: number | null;
  productGroup: string | null;
}

export interface ExtractionResult {
  supplier: Extracted<string>;
  date: Extracted<string>;
  totalCents: Extracted<number>;
  vatCents: Extracted<number>;
  category: Extracted<ExpenseCategory>;
  paymentMethod: Extracted<PaymentMethod>;
  receiptNumber: Extracted<string>;
  items: ExtractedItem[];
  /** Kuvan laatuarvio. Huono kuva nostaa tarkistustarpeen. */
  imageQuality: "good" | "poor";
  elapsedMs: number;
}

export interface ExtractionInput {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Tiedoston tiiviste duplikaattien tunnistukseen. */
  hash?: string;
  /** Itse tiedosto. Vain palvelinpoimija tarvitsee sen. */
  file?: File;
}

export interface ReceiptExtractor {
  readonly name: string;
  extract(input: ExtractionInput): Promise<ExtractionResult>;
}

/**
 * Mock-poimija.
 *
 * Deterministinen tiedostonimen perusteella: sama nimi antaa aina saman
 * tuloksen. Demoa voi esitellä ilman että luvut hyppivät, ja testit ovat
 * toistettavia.
 *
 * Tämä EI ole oikea tekoäly, ja se sanotaan käyttöliittymässä ääneen.
 */
export class MockReceiptExtractor implements ReceiptExtractor {
  readonly name = "mock";

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const started = Date.now();
    return { ...profileFor(input.fileName), elapsedMs: Date.now() - started };
  }
}

type Profile = Omit<ExtractionResult, "elapsedMs">;

function profileFor(fileName: string): Profile {
  const name = fileName.toLowerCase();

  if (name.includes("metro")) {
    return {
      supplier: { value: "Metro Tukku", confidence: "high" },
      date: { value: "2026-08-20", confidence: "high" },
      totalCents: { value: 18690, confidence: "high" },
      vatCents: { value: 2367, confidence: "high" },
      category: { value: "food", confidence: "high" },
      paymentMethod: { value: "card", confidence: "high" },
      receiptNumber: { value: "MT-4471", confidence: "medium" },
      imageQuality: "good",
      items: [
        { description: "Naudan sisäfilee", quantity: 4, unit: "kg", totalCents: 8960, category: "food", vatRate: 0.14, productGroup: "Liha" },
        { description: "Perunat", quantity: 25, unit: "kg", totalCents: 2450, category: "food", vatRate: 0.14, productGroup: "Vihannekset" },
        { description: "Salaattisekoitus", quantity: 6, unit: "pkt", totalCents: 3480, category: "food", vatRate: 0.14, productGroup: "Vihannekset" },
        { description: "Oliiviöljy", quantity: 1, unit: "kanisteri", totalCents: 3800, category: "food", vatRate: 0.14, productGroup: "Öljyt" },
      ],
    };
  }

  if (name.includes("kespro")) {
    // Sekakuitti: kolme kategoriaa samalla tositteella, kaksi verokantaa.
    return {
      supplier: { value: "Kespro", confidence: "high" },
      date: { value: "2026-08-19", confidence: "high" },
      totalCents: { value: 31250, confidence: "high" },
      vatCents: { value: 4601, confidence: "high" },
      category: { value: "food", confidence: "high" },
      paymentMethod: { value: "invoice", confidence: "medium" },
      receiptNumber: { value: "KP-88214", confidence: "high" },
      imageQuality: "good",
      items: [
        { description: "Kanafilee", quantity: 10, unit: "kg", totalCents: 14200, category: "food", vatRate: 0.14, productGroup: "Liha" },
        { description: "Coca-Cola 0,33 l", quantity: 24, unit: "kpl", totalCents: 8650, category: "soft_drinks", vatRate: 0.14, productGroup: "Virvoitusjuomat" },
        { description: "Astianpesuaine", quantity: 2, unit: "kanisteri", totalCents: 5900, category: "cleaning", vatRate: 0.255, productGroup: "Puhdistusaineet" },
        { description: "Talouspaperi", quantity: 6, unit: "rll", totalCents: 2500, category: "cleaning", vatRate: 0.255, productGroup: "Puhdistusaineet" },
      ],
    };
  }

  if (name.includes("wolt")) {
    return {
      supplier: { value: "Wolt Market", confidence: "high" },
      date: { value: "2026-08-18", confidence: "high" },
      totalCents: {
        value: 4520,
        confidence: "low",
        hint: "Loppusumma oli osittain rypistynyt — tarkista",
      },
      vatCents: { value: null, confidence: "low", hint: "ALV ei erottunut kuitista" },
      category: { value: "food", confidence: "medium" },
      paymentMethod: { value: "unknown", confidence: "low", hint: "Maksutapaa ei tunnistettu" },
      receiptNumber: { value: null, confidence: "low" },
      imageQuality: "poor",
      items: [],
    };
  }

  if (name.includes("alko") || name.includes("viini")) {
    // ALV vastaa 14,5 %:a vaikka kategoria on alkoholi — ristiriita joka
    // pitää huomata, ei korjata hiljaa.
    return {
      supplier: { value: "Alko Yritysmyynti", confidence: "high" },
      date: { value: "2026-08-17", confidence: "high" },
      totalCents: { value: 128400, confidence: "high" },
      vatCents: { value: 16260, confidence: "medium", hint: "Tarkista verokanta" },
      category: { value: "alcohol", confidence: "high" },
      paymentMethod: { value: "invoice", confidence: "high" },
      receiptNumber: { value: "ALK-7781", confidence: "high" },
      imageQuality: "good",
      items: [
        { description: "Punaviini 0,75 l", quantity: 36, unit: "plo", totalCents: 79200, category: "alcohol", vatRate: 0.255, productGroup: "Viinit" },
        { description: "Valkoviini 0,75 l", quantity: 24, unit: "plo", totalCents: 49200, category: "alcohol", vatRate: 0.255, productGroup: "Viinit" },
      ],
    };
  }

  if (name.includes("juoma") || name.includes("olut") || name.includes("hartwall")) {
    return {
      supplier: { value: "Hartwall", confidence: "high" },
      date: { value: "2026-08-16", confidence: "high" },
      totalCents: { value: 68400, confidence: "high" },
      vatCents: { value: 8664, confidence: "high" },
      category: { value: "soft_drinks", confidence: "high" },
      paymentMethod: { value: "invoice", confidence: "high" },
      receiptNumber: { value: "HW-2261", confidence: "high" },
      imageQuality: "good",
      items: [
        { description: "Virvoitusjuomat 0,33 l", quantity: 240, unit: "kpl", totalCents: 43200, category: "soft_drinks", vatRate: 0.14, productGroup: "Virvoitusjuomat" },
        { description: "Kivennäisvesi", quantity: 120, unit: "kpl", totalCents: 25200, category: "soft_drinks", vatRate: 0.14, productGroup: "Vedet" },
      ],
    };
  }

  // Tuntematon tiedostonimi: jäljitelmällä ei ole mitään sanottavaa.
  //
  // imageQuality on "good" eikä "poor": jäljitelmä ei ole nähnyt kuvaa,
  // joten se ei voi arvioida sen laatua. "Kuittikuva epäselvä" olisi
  // keksitty väite kuvasta jota ei katsottu — sama virhe kuin keksitty
  // summa, ja se saisi käyttäjän kuvaamaan kuitin turhaan uudelleen.
  return {
    supplier: { value: null, confidence: "low" },
    date: { value: new Date().toISOString().slice(0, 10), confidence: "low", hint: "Oletus: tänään" },
    totalCents: { value: null, confidence: "low" },
    vatCents: { value: null, confidence: "low" },
    category: { value: null, confidence: "low" },
    paymentMethod: { value: "unknown", confidence: "low" },
    receiptNumber: { value: null, confidence: "low" },
    imageQuality: "good",
    items: [],
  };
}

// ---------------------------------------------------------------------------

/**
 * Päättelee mitkä kentät vaativat tarkistuksen.
 *
 * Sääntö on tarkoituksella tiukka: mikä tahansa muu kuin korkea luottamus
 * rahaan, puuttuva pakollinen kenttä tai kategorian verokantaan sopimaton
 * ALV nostaa kuitin jonoon. Väärä kulukirjaus on kalliimpi kuin
 * ylimääräinen klikkaus.
 */
export function reviewReasonsFor(result: ExtractionResult): ReviewReason[] {
  const reasons: ReviewReason[] = [];

  if (result.totalCents.value === null || result.totalCents.confidence === "low") {
    reasons.push("total_uncertain");
  }

  if (result.vatCents.value === null) {
    reasons.push("vat_missing");
  } else if (result.vatCents.confidence !== "high") {
    reasons.push("vat_uncertain");
  }

  if (result.category.value === null) {
    reasons.push("category_missing");
  }

  // ALV vs. kategorian odotettu verokanta — vain kun molemmat tiedetään.
  if (
    result.category.value !== null &&
    result.vatCents.value !== null &&
    result.totalCents.value !== null
  ) {
    const check = checkVat(
      result.totalCents.value,
      result.vatCents.value,
      result.category.value,
    );
    if (!check.matches) reasons.push("vat_mismatch");
  }

  if (result.supplier.value === null || result.supplier.confidence === "low") {
    reasons.push("supplier_uncertain");
  }

  if (result.date.confidence === "low") reasons.push("date_uncertain");

  if (result.paymentMethod.value === null || result.paymentMethod.value === "unknown") {
    reasons.push("payment_missing");
  }

  if (result.imageQuality === "poor") reasons.push("poor_image");

  return reasons;
}

/** Kentät joissa on tarkistettavaa — käytetään korostukseen. */
export function uncertainFields(result: ExtractionResult): string[] {
  const fields: string[] = [];
  const check = (key: string, field: Extracted<unknown>) => {
    if (field.value === null || field.confidence !== "high") fields.push(key);
  };

  check("supplier", result.supplier);
  check("date", result.date);
  check("totalCents", result.totalCents);
  check("vatCents", result.vatCents);
  check("category", result.category);
  check("paymentMethod", result.paymentMethod);

  return fields;
}

/**
 * Palvelinpoimija.
 *
 * Kuva lähetetään omalle reitille, joka kutsuu mallia. Avain ei voi olla
 * selaimessa: NEXT_PUBLIC-muuttuja päätyy sivun lähdekoodiin ja on siten
 * julkinen. Reitti tarkistaa myös oikeuden, joten poimintaa ei voi ajaa
 * ravintolan laskuun ilman jäsenyyttä.
 *
 * Jos reitti kertoo ettei palvelua ole kytketty, palataan jäljitelmään
 * eikä kuitin lisäys katkea.
 */
export class RemoteReceiptExtractor implements ReceiptExtractor {
  readonly name = "remote";

  constructor(private readonly fallback: ReceiptExtractor) {}

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    if (!input.file) return this.fallback.extract(input);

    const started = Date.now();

    // Kuva valmistellaan ennen lähetystä: HEIC muuntuu JPEG:ksi ja
    // kahdeksan megapikselin kuva pienenee luettavaan kokoon.
    const { file } = await prepareForExtraction(input.file);

    const body = new FormData();
    body.set("file", file);

    let response: Response;
    try {
      response = await fetch("/api/kuitit/poiminta", { method: "POST", body });
    } catch {
      throw new ExtractionError(
        "Yhteys poimintapalveluun katkesi. Täytä tiedot käsin tai yritä uudelleen.",
      );
    }

    // 501 on ainoa tilanne jossa palataan hiljaa jäljitelmään: palvelua
    // ei ole kytketty, eikä siitä kannata varoittaa joka kerta.
    if (response.status === 501) return this.fallback.extract(input);

    if (!response.ok) {
      // Muu virhe kerrotaan. Hiljainen paluu tyhjään lomakkeeseen
      // näyttäisi siltä ettei kuitissa ollut mitään luettavaa, ja
      // käyttäjä kuvaisi sen turhaan uudelleen.
      const detail = await response
        .json()
        .then((body: { error?: string }) => body.error)
        .catch(() => undefined);

      throw new ExtractionError(detail ?? "Kuvan luku epäonnistui.");
    }

    const parsed = (await response.json()) as Partial<ExtractionResult>;
    return { ...emptyResult(), ...parsed, elapsedMs: Date.now() - started };
  }
}

/** Poiminnan virhe joka on tarkoitettu käyttäjälle näytettäväksi. */
export class ExtractionError extends Error {
  readonly name = "ExtractionError";
}

/** Tyhjä tulos. Tyhjä arvo on parempi kuin keksitty. */
export function emptyResult(): ExtractionResult {
  const unknown = <T>() => ({ value: null as T | null, confidence: "low" as const });

  return {
    supplier: unknown<string>(),
    date: unknown<string>(),
    totalCents: unknown<number>(),
    vatCents: unknown<number>(),
    category: unknown<ExpenseCategory>(),
    paymentMethod: unknown<PaymentMethod>(),
    receiptNumber: unknown<string>(),
    items: [],
    imageQuality: "good",
    elapsedMs: 0,
  };
}

/**
 * Rivin ALV-kanta murtolukuna.
 *
 * Malli lukee kuitista "ALV 14 %" ja palauttaa herkästi luvun 14, koska
 * niin kuitissa lukee. Kanta tallennetaan murtolukuna sarakkeeseen
 * numeric(5,4), johon mahtuu enintään 9,9999 — luku 14 kaatoi
 * tallennuksen virheeseen "numeric field overflow", eikä käyttäjälle
 * kerrottu mistä oli kyse.
 *
 * Yli yhden oleva arvo tulkitaan prosenttiluvuksi. Se ei ole arvaus:
 * yli 100 %:n arvonlisäveroa ei ole olemassa, joten 14 voi tarkoittaa
 * vain yhtä asiaa. Kaikki muu mahdoton pudotetaan tyhjäksi — tyhjä
 * kenttä on parempi kuin keksitty.
 */
export function vatRateOf(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;

  const fraction = value > 1 && value <= 100 ? value / 100 : value;

  // Sarakkeen tarkkuus on neljä desimaalia; pyöristys tehdään täällä
  // eikä jätetä kannan tehtäväksi.
  const rounded = Math.round(fraction * 10000) / 10000;

  if (rounded < 0 || rounded >= 1) return null;
  return rounded;
}

/**
 * Rivin määrä.
 *
 * Sarake on numeric(12,3). Ilman rajaa mallin lukuvirhe päätyisi
 * kantaan asti ja kaataisi tallennuksen samalla tavalla kuin kanta.
 */
export function quantityOf(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (value < 0 || value > 1_000_000) return null;
  return Math.round(value * 1000) / 1000;
}

/** Onko oikea poimintapalvelu kytketty? Palvelinpuolen tarkistus. */
export function isRealExtractor(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Poimijan nimi asetusnäkymään. */
export function extractorName(): string {
  return isRealExtractor()
    ? `Claude (${process.env.RECEIPT_MODEL ?? DEFAULT_MODEL})`
    : "Paikallinen jäljitelmä (mock)";
}

/** Malli jota poimintareitti käyttää ellei toisin määrätä. */
export const DEFAULT_MODEL = "claude-opus-5";

/**
 * Oletuspoimija.
 *
 * Yrittää palvelinreittiä ja palaa jäljitelmään jos sitä ei ole kytketty.
 */
export const receiptExtractor: ReceiptExtractor = new RemoteReceiptExtractor(
  new MockReceiptExtractor(),
);

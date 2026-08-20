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

import type {
  ExpenseCategory,
  Extracted,
  PaymentMethod,
  ReceiptLine,
  ReviewReason,
} from "./types";

export interface ExtractionResult {
  supplier: Extracted<string>;
  date: Extracted<string>;
  totalCents: Extracted<number>;
  vatCents: Extracted<number>;
  category: Extracted<ExpenseCategory>;
  paymentMethod: Extracted<PaymentMethod>;
  receiptNumber: Extracted<string>;
  lines: ReceiptLine[];
  /** Poiminnan kesto millisekunteina — näytetään kehittäjälle, ei käyttäjälle. */
  elapsedMs: number;
}

export interface ReceiptExtractor {
  readonly name: string;
  extract(input: ExtractionInput): Promise<ExtractionResult>;
}

export interface ExtractionInput {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Tiedoston tiiviste duplikaattien tunnistukseen. */
  hash?: string;
}

/**
 * Mock-poimija.
 *
 * Tuottaa uskottavan tuloksen tiedostonimen perusteella ja on
 * deterministinen: sama tiedostonimi antaa aina saman tuloksen. Näin demoa
 * voi esitellä ilman että luvut hyppivät, ja testit ovat toistettavia.
 *
 * Tämä EI ole oikea tekoäly, ja se sanotaan käyttöliittymässä ääneen.
 */
export class MockReceiptExtractor implements ReceiptExtractor {
  readonly name = "mock";

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const started = Date.now();
    const profile = profileFor(input.fileName);

    return {
      ...profile,
      elapsedMs: Date.now() - started,
    };
  }
}

type Profile = Omit<ExtractionResult, "elapsedMs">;

/**
 * Tiedostonimi ratkaisee profiilin. Tunnistamaton nimi tuottaa
 * tarkoituksella epävarman tuloksen — se on realistisin tapaus ja näyttää
 * miten käyttöliittymä käsittelee epävarmuutta.
 */
function profileFor(fileName: string): Profile {
  const name = fileName.toLowerCase();

  if (name.includes("metro")) {
    return {
      supplier: { value: "Metro Tukku", confidence: "high" },
      date: { value: "2026-08-20", confidence: "high" },
      totalCents: { value: 18690, confidence: "high" },
      vatCents: { value: 3252, confidence: "high" },
      category: { value: "food", confidence: "high" },
      paymentMethod: { value: "card", confidence: "high" },
      receiptNumber: { value: "MT-4471", confidence: "medium" },
      lines: [
        { description: "Naudan sisäfilee 4 kg", quantity: 4, totalCents: 8960 },
        { description: "Perunat 25 kg", quantity: 1, totalCents: 2450 },
        { description: "Salaattisekoitus", quantity: 6, totalCents: 3480 },
        { description: "Oliiviöljy 5 l", quantity: 1, totalCents: 3800 },
      ],
    };
  }

  if (name.includes("kespro")) {
    return {
      supplier: { value: "Kespro", confidence: "high" },
      date: { value: "2026-08-19", confidence: "high" },
      totalCents: { value: 31250, confidence: "high" },
      vatCents: { value: 5438, confidence: "high" },
      category: { value: "food", confidence: "high" },
      paymentMethod: { value: "invoice", confidence: "medium" },
      receiptNumber: { value: "KP-88214", confidence: "high" },
      lines: [
        { description: "Tuoretuotteet", quantity: null, totalCents: 18400 },
        { description: "Pakasteet", quantity: null, totalCents: 12850 },
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
      category: { value: "supplies", confidence: "medium" },
      paymentMethod: { value: "card", confidence: "high" },
      receiptNumber: { value: null, confidence: "low" },
      lines: [],
    };
  }

  if (name.includes("juoma") || name.includes("alko") || name.includes("olut")) {
    return {
      supplier: { value: "Hartwall", confidence: "high" },
      date: { value: "2026-08-17", confidence: "high" },
      totalCents: { value: 68400, confidence: "high" },
      vatCents: { value: 13205, confidence: "medium", hint: "ALV 25,5 % — tarkista" },
      category: { value: "drinks", confidence: "high" },
      paymentMethod: { value: "invoice", confidence: "high" },
      receiptNumber: { value: "HW-2261", confidence: "high" },
      lines: [
        { description: "Olut 0,33 l × 240", quantity: 240, totalCents: 43200 },
        { description: "Virvoitusjuomat", quantity: null, totalCents: 25200 },
      ],
    };
  }

  // Tuntematon kuitti: tunnistetaan se mikä irtoaa, loput jää käyttäjälle.
  return {
    supplier: { value: null, confidence: "low", hint: "Toimittajan nimeä ei tunnistettu" },
    date: { value: new Date().toISOString().slice(0, 10), confidence: "low", hint: "Oletus: tänään" },
    totalCents: { value: null, confidence: "low", hint: "Loppusummaa ei tunnistettu" },
    vatCents: { value: null, confidence: "low" },
    category: { value: null, confidence: "low", hint: "Valitse kategoria" },
    paymentMethod: { value: "unknown", confidence: "low" },
    receiptNumber: { value: null, confidence: "low" },
    lines: [],
  };
}

// ---------------------------------------------------------------------------

/**
 * Päättelee mitkä kentät vaativat käyttäjän tarkistuksen.
 *
 * Sääntö on yksinkertainen ja tarkoituksella tiukka: mikä tahansa muu kuin
 * korkea luottamus rahaan tai puuttuva pakollinen kenttä nostaa kuitin
 * tarkistusjonoon. Väärä kulukirjaus on kalliimpi kuin ylimääräinen klikkaus.
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

  if (result.supplier.value === null || result.supplier.confidence === "low") {
    reasons.push("supplier_uncertain");
  }

  if (result.date.confidence === "low") {
    reasons.push("date_uncertain");
  }

  return reasons;
}

/** Kenttiä joissa on jotain tarkistettavaa — käytetään korostukseen. */
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

  return fields;
}

/** Oletuspoimija. Vaihdetaan tästä kun oikea palvelu kytketään. */
export const receiptExtractor: ReceiptExtractor = new MockReceiptExtractor();

/**
 * Dokumenttipoiminnan rajapinta.
 *
 * Sovellus ei saa tietää mitä palveluntarjoajaa käytetään (§9). Kaikki
 * tarjoajat — OpenAI, Anthropic, Google, Azure, AWS tai erikoistunut
 * OCR-palvelu — toteuttavat saman rajapinnan ja palauttavat saman
 * normalisoidun muodon.
 */

export type ExtractionMethod = "ocr" | "llm" | "manual" | "derived";

/**
 * Yksittäinen poimittu kenttä. Arvo ja luottamus kulkevat aina yhdessä —
 * pelkkä arvo ilman luottamusta ei kerro voiko siihen nojata.
 */
export interface ExtractedField<T = string> {
  value: T | null;
  confidence: number;
  method: ExtractionMethod;
  /** Sijainti dokumentissa tulevia korostuksia varten. */
  page?: number;
  bbox?: { x: number; y: number; width: number; height: number };
}

export interface ExtractedLineItem {
  lineNumber: number;
  description: ExtractedField;
  quantity: ExtractedField<number>;
  unitPriceCents: ExtractedField<number>;
  netAmountCents: ExtractedField<number>;
  vatRate: ExtractedField<number>;
  vatAmountCents: ExtractedField<number>;
  grossAmountCents: ExtractedField<number>;
  /** Poimijan ehdottama luokka. Sääntömoottori päättää käsittelyn. */
  suggestedCategory: ExtractedField;
}

export interface ExtractionResult {
  documentKind: ExtractedField;
  supplierName: ExtractedField;
  supplierAddress: ExtractedField;
  supplierCountry: ExtractedField;
  supplierVatId: ExtractedField;
  documentNumber: ExtractedField;
  documentDate: ExtractedField;
  dueDate: ExtractedField;
  currency: ExtractedField;
  netAmountCents: ExtractedField<number>;
  vatAmountCents: ExtractedField<number>;
  grossAmountCents: ExtractedField<number>;
  paymentMethod: ExtractedField;
  lineItems: ExtractedLineItem[];
  /** Koko poiminnan yhteenlaskettu luottamus 0–1. */
  overallConfidence: number;
  provider: string;
  modelVersion?: string;
  processingMs: number;
}

export interface ExtractionInput {
  fileName: string;
  mimeType: string;
  /** Tiedoston sisältö. Palveluntarjoaja päättää miten sen lähettää. */
  bytes: Uint8Array;
  /** Vihje odotetusta jurisdiktiosta. Ei sido poimintaa. */
  hintCountry?: string;
}

export interface OcrProvider {
  readonly name: string;
  /** Onko tarjoaja käytettävissä (esim. API-avain asetettu). */
  isConfigured(): boolean;
  extract(input: ExtractionInput): Promise<ExtractionResult>;
}

/** Apuri kentän luomiseen. */
export function field<T>(
  value: T | null,
  confidence: number,
  method: ExtractionMethod = "ocr",
): ExtractedField<T> {
  return { value, confidence, method };
}

/** Tyhjä kenttä, kun poimija ei löytänyt arvoa. */
export function missing<T>(): ExtractedField<T> {
  return { value: null, confidence: 0, method: "ocr" };
}

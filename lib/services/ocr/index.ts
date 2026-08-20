/**
 * Poimintapalvelun valinta.
 *
 * Rekisteri, ei if-ketju: uusi tarjoaja lisätään listaan ja valitaan
 * ympäristömuuttujalla. Sovelluskoodi kutsuu vain getOcrProvider().
 */

import { MockOcrProvider } from "./mock";
import type { OcrProvider } from "./types";

export * from "./types";
export { MockOcrProvider } from "./mock";

const registry = new Map<string, () => OcrProvider>([
  ["mock", () => new MockOcrProvider()],
  // Lisää tähän: ["anthropic", () => new AnthropicOcrProvider()],
  //              ["google",    () => new GoogleDocumentAiProvider()],
]);

let cached: OcrProvider | null = null;

export function getOcrProvider(): OcrProvider {
  if (cached) return cached;

  const requested = process.env.OCR_PROVIDER ?? "mock";
  const factory = registry.get(requested);

  if (!factory) {
    throw new Error(
      `Tuntematon OCR_PROVIDER: "${requested}". Tunnetut: ${[...registry.keys()].join(", ")}`,
    );
  }

  const provider = factory();
  if (!provider.isConfigured()) {
    throw new Error(
      `OCR-tarjoaja "${requested}" ei ole konfiguroitu. Tarkista ympäristömuuttujat.`,
    );
  }

  cached = provider;
  return provider;
}

/** Testejä varten. */
export function resetOcrProvider(): void {
  cached = null;
}

/** Onko käytössä oikea tarjoaja vai demo-poimija? Näytetään käyttöliittymässä. */
export function isUsingMockOcr(): boolean {
  return (process.env.OCR_PROVIDER ?? "mock") === "mock";
}

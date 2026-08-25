/**
 * Kassan päiväraportin poiminta.
 *
 * Sama rakenne kuin kuiteilla, ja samasta syystä: rajapinta erillään
 * toteutuksesta, ja poiminta palauttaa arvon ja luottamuksen — ei
 * pelkkää arvoa. Tyhjä kenttä on parempi kuin keksitty, koska
 * käyttäjä täyttää sen itse ja tietää tehneensä niin.
 *
 * MIKSI OMA MODUULI EIKÄ KUITTIPOIMINNAN LAAJENNUS
 *
 * Kuitti on osto ja päiväraportti on myynti. Ne näyttävät samalta
 * paperilta mutta sisältävät eri kentät, ja yhteinen skeema olisi
 * kymmenen kenttää joista puolet on aina tyhjiä. Tyhjä kenttä joka on
 * aina tyhjä opettaa ohittamaan kaikki tyhjät kentät.
 */

import { prepareForExtraction } from "./image-prep";
import type { ReportGroup } from "./sales-vat";
import type { Extracted } from "./types";

export interface SalesExtraction {
  /** Raportin päivä. */
  date: Extracted<string>;
  /** Verollinen myynti sentteinä. */
  grossCents: Extracted<number>;
  /** ALV yhteensä sentteinä. */
  vatCents: Extracted<number>;
  /** Veroton myynti sentteinä. */
  netCents: Extracted<number>;
  /** Kuittien eli tapahtumien määrä. */
  transactions: Extracted<number>;
  /**
   * Myyntiryhmät sellaisina kuin ne raportissa lukivat.
   *
   * Tyhjä lista tarkoittaa ettei raportti erittele ryhmiä — silloin
   * päivä kirjataan yhtenä summana kuten ennenkin. Erittely on se mikä
   * tekee kannoittaisen täsmäytyksen mahdolliseksi.
   */
  groups: ReportGroup[];
  /** Kuvan laatuarvio. Huono kuva nostaa tarkistustarpeen. */
  imageQuality: "good" | "poor";
  elapsedMs: number;
}

export interface SalesExtractionInput {
  fileName: string;
  file?: File;
}

export interface SalesExtractor {
  readonly name: string;
  extract(input: SalesExtractionInput): Promise<SalesExtraction>;
}

export class SalesExtractionError extends Error {
  constructor(
    message: string,
    readonly retryable = true,
  ) {
    super(message);
    this.name = "SalesExtractionError";
  }
}

export function emptySalesExtraction(): SalesExtraction {
  const unknown = <T>(): Extracted<T> => ({ value: null, confidence: "low" });

  return {
    date: unknown<string>(),
    grossCents: unknown<number>(),
    vatCents: unknown<number>(),
    netCents: unknown<number>(),
    transactions: unknown<number>(),
    groups: [],
    imageQuality: "poor",
    elapsedMs: 0,
  };
}

/**
 * Jäljitelmä ilman API-avainta.
 *
 * Deterministinen tiedostonimestä: sama nimi antaa aina saman
 * tuloksen, joten demo ei hypi ja kehitys ei vaadi avainta. Tämä EI
 * ole oikea poiminta, ja käyttöliittymä sanoo sen ääneen.
 */
export class MockSalesExtractor implements SalesExtractor {
  readonly name = "mock";

  async extract(input: SalesExtractionInput): Promise<SalesExtraction> {
    const started = Date.now();

    // Tiedostonimen tiiviste antaa vaihtelua ilman satunnaisuutta.
    let hash = 0;
    for (const ch of input.fileName) hash = (hash * 31 + ch.charCodeAt(0)) % 100000;

    const grossCents = 180000 + (hash % 220) * 1000;
    const vatCents = Math.round(grossCents * 0.14);

    return {
      date: { value: null, confidence: "low" },
      grossCents: { value: grossCents, confidence: "high" },
      vatCents: { value: vatCents, confidence: "medium" },
      netCents: { value: grossCents - vatCents, confidence: "high" },
      transactions: { value: 40 + (hash % 90), confidence: "medium" },
      groups: [
        { posName: "Ruoka", grossCents: Math.round(grossCents * 0.7), vatCents: null },
        { posName: "Juomat", grossCents: grossCents - Math.round(grossCents * 0.7), vatCents: null },
      ],
      imageQuality: "good",
      elapsedMs: Date.now() - started,
    };
  }
}

/**
 * Palvelinpoiminta.
 *
 * Avain ei voi olla selaimessa, joten kuva lähetetään omalle
 * reitilleen. 501 tarkoittaa ettei palvelua ole kytketty — silloin
 * palataan hiljaa jäljitelmään, koska myynnin kirjaamisen on
 * toimittava ilman poimintaa.
 */
export class RemoteSalesExtractor implements SalesExtractor {
  readonly name = "remote";

  constructor(private readonly fallback: SalesExtractor) {}

  async extract(input: SalesExtractionInput): Promise<SalesExtraction> {
    if (!input.file) return this.fallback.extract(input);

    const started = Date.now();

    // Sama valmistelu kuin kuiteilla: HEIC muuntuu JPEG:ksi ja iso
    // kuva pienenee luettavaan kokoon.
    const { file } = await prepareForExtraction(input.file);

    const body = new FormData();
    body.set("file", file);

    let response: Response;
    try {
      response = await fetch("/api/myynti/poiminta", { method: "POST", body });
    } catch {
      throw new SalesExtractionError(
        "Yhteys poimintapalveluun katkesi. Täytä luvut käsin tai yritä uudelleen.",
      );
    }

    if (response.status === 501) return this.fallback.extract(input);

    if (!response.ok) {
      const detail = await response
        .json()
        .then((body: { error?: string; retryable?: boolean }) => body)
        .catch(() => undefined);

      throw new SalesExtractionError(
        detail?.error ?? "Raportin luku epäonnistui.",
        detail?.retryable ?? true,
      );
    }

    const parsed = (await response.json()) as SalesExtraction;
    return { ...parsed, elapsedMs: Date.now() - started };
  }
}

export const salesExtractor: SalesExtractor = new RemoteSalesExtractor(
  new MockSalesExtractor(),
);

/**
 * EU VIES -tarkistus (§17).
 *
 * TÄRKEÄ PERIAATE: kelvollinen ALV-tunniste EI yksin tarkoita käännettyä
 * verovelvollisuutta. Tämä palvelu palauttaa vain vahvistuksen tunnisteesta.
 * Verokohtelun ratkaisee sääntömoottori koko tapahtuman faktojen perusteella.
 */

export type ViesStatus =
  | "valid"
  | "invalid"
  | "unavailable"
  | "format_error"
  | "not_checked";

export interface ViesResult {
  status: ViesStatus;
  vatId: string;
  country: string;
  companyName?: string;
  companyAddress?: string;
  /** VIESin virallinen kuittausnumero, säilytetään näyttönä. */
  consultationNumber?: string;
  checkedAt: string;
  provider: string;
  errorMessage?: string;
  requestPayload?: unknown;
  responsePayload?: unknown;
}

export interface ViesProvider {
  readonly name: string;
  isConfigured(): boolean;
  check(vatId: string): Promise<ViesResult>;
}

/**
 * ALV-tunnisteen muototarkistus.
 *
 * Muoto-oikeellisuus on välttämätön mutta ei riittävä ehto. Tämä funktio ei
 * koskaan kerro onko tunniste voimassa — vain onko sitä järkevää kysyä VIESiltä.
 */
export function validateVatIdFormat(vatId: string): {
  valid: boolean;
  country?: string;
  normalized?: string;
} {
  const normalized = vatId.replace(/[\s-]/g, "").toUpperCase();
  const match = /^([A-Z]{2})([0-9A-Z]{2,12})$/.exec(normalized);
  if (!match) return { valid: false };

  const [, country, body] = match;
  const pattern = VAT_ID_PATTERNS[country];
  if (!pattern) return { valid: false, country };
  if (!pattern.test(body)) return { valid: false, country, normalized };

  return { valid: true, country, normalized };
}

/** Maakohtaiset runko-osan muodot. Ei tarkistussummia — ne kuuluvat VIESille. */
const VAT_ID_PATTERNS: Record<string, RegExp> = {
  AT: /^U\d{8}$/,
  BE: /^\d{10}$/,
  BG: /^\d{9,10}$/,
  CY: /^\d{8}[A-Z]$/,
  CZ: /^\d{8,10}$/,
  DE: /^\d{9}$/,
  DK: /^\d{8}$/,
  EE: /^\d{9}$/,
  ES: /^[A-Z0-9]\d{7}[A-Z0-9]$/,
  FI: /^\d{8}$/,
  FR: /^[A-Z0-9]{2}\d{9}$/,
  GR: /^\d{9}$/,
  HR: /^\d{11}$/,
  HU: /^\d{8}$/,
  IE: /^[A-Z0-9]{8,9}$/,
  IT: /^\d{11}$/,
  LT: /^(\d{9}|\d{12})$/,
  LU: /^\d{8}$/,
  LV: /^\d{11}$/,
  MT: /^\d{8}$/,
  NL: /^\d{9}B\d{2}$/,
  PL: /^\d{10}$/,
  PT: /^\d{9}$/,
  RO: /^\d{2,10}$/,
  SE: /^\d{12}$/,
  SI: /^\d{8}$/,
  SK: /^\d{10}$/,
};

/**
 * Mock-toteutus. Deterministinen: sama tunniste antaa aina saman vastauksen.
 *
 * OIKEAN LIITTÄMINEN: toteuta ViesProvider komission SOAP- tai REST-rajapintaa
 * vasten ja vaihda getViesProvider()-funktion palautus. Tallennettava vastaus
 * ja kuittausnumero ovat jo tietokannassa (vies_checks).
 */
export class MockViesProvider implements ViesProvider {
  readonly name = "mock";

  isConfigured(): boolean {
    return true;
  }

  async check(vatId: string): Promise<ViesResult> {
    const checkedAt = new Date().toISOString();
    const format = validateVatIdFormat(vatId);

    if (!format.valid) {
      return {
        status: "format_error",
        vatId,
        country: format.country ?? "??",
        checkedAt,
        provider: this.name,
        errorMessage: "ALV-tunnisteen muoto ei kelpaa.",
      };
    }

    const normalized = format.normalized!;

    // Demo-aineiston tunnetut tunnisteet. Kaikki muut palautuvat
    // 'unavailable' — koska emme oikeasti tiedä, emmekä saa väittää tietävämme.
    const known = KNOWN_DEMO_VAT_IDS[normalized];
    if (known) {
      return {
        status: "valid",
        vatId: normalized,
        country: format.country!,
        companyName: known.name,
        companyAddress: known.address,
        consultationNumber: `DEMO-${normalized}`,
        checkedAt,
        provider: this.name,
        responsePayload: { demo: true, ...known },
      };
    }

    return {
      status: "unavailable",
      vatId: normalized,
      country: format.country!,
      checkedAt,
      provider: this.name,
      errorMessage:
        "VIES-tarkistus ei ole käytettävissä demo-tilassa tälle tunnisteelle. Tapahtumaa ei ole hyväksytty automaattisesti.",
    };
  }
}

const KNOWN_DEMO_VAT_IDS: Record<string, { name: string; address: string }> = {
  DE811205325: {
    name: "Bauhaus AG",
    address: "Gutenbergstraße 4, 68167 Mannheim, Deutschland",
  },
  FI28765432: {
    name: "Ravintola Linnea Oy",
    address: "Hämeenkatu 12, 33100 Tampere, Suomi",
  },
};

let provider: ViesProvider = new MockViesProvider();

export function getViesProvider(): ViesProvider {
  return provider;
}

/** Testejä ja tulevaa oikeaa toteutusta varten. */
export function setViesProvider(next: ViesProvider): void {
  provider = next;
}

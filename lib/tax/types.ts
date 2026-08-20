/**
 * Verosääntömoottorin tyypit.
 *
 * Moottori on tarkoituksella riippumaton tietokannasta, Reactista ja
 * tekoälystä: sisään normalisoidut faktat, ulos päätös. Tämä tekee siitä
 * itsenäisesti testattavan (§50).
 */

export type Jurisdiction = string; // ISO 3166-1 alpha-2

export type SupplyType = "goods" | "service" | "mixed" | "unknown";

export type BuyerType = "business" | "consumer" | "unknown";

export type ConfidenceBand = "high" | "medium" | "low";

export type RuleStatus =
  | "demo"
  | "draft"
  | "review"
  | "validated"
  | "active"
  | "deprecated";

export type DecisionOutcome = "determined" | "needs_review" | "not_applicable";

/**
 * Normalisoidut faktat. Kaikki mitä päätös saa käyttää on tässä — moottori ei
 * lue mitään ulkoista tilaa. Sama faktajoukko + sama sääntöversio tuottaa
 * aina saman päätöksen.
 */
export interface TaxFacts {
  /** Myyjän/raportoivan yrityksen jurisdiktio. */
  jurisdiction: Jurisdiction;
  /** Tapahtuman päivä. Ratkaisee minkä sääntöversion piiriin se kuuluu. */
  transactionDate: string; // ISO-päivä, 'YYYY-MM-DD'

  supplierCountry?: Jurisdiction;
  buyerCountry?: Jurisdiction;
  buyerType?: BuyerType;
  buyerVatId?: string;
  /** Tosi vasta kun VIES on vahvistanut tunnisteen (§17). */
  buyerVatIdValid?: boolean;
  buyerInEu?: boolean;

  supplyType?: SupplyType;
  /** Rivin luokka, esim. 'food' | 'alcohol' | 'tip'. */
  category?: string;
  crossBorder?: boolean;

  netAmountCents?: number;
  grossAmountCents?: number;
  currency?: string;

  /** Poiminnan laatu 0–1. Vaikuttaa luottamukseen, ei sääntövalintaan. */
  extractionConfidence?: number;
}

/** Sääntöehdot. Kaikkien annettujen avainten on toteuduttava (AND). */
export interface RuleConditions {
  jurisdiction?: Jurisdiction;
  category?: string[];
  supplyType?: SupplyType;
  crossBorder?: boolean;
  buyerInEu?: boolean;
  buyerType?: BuyerType;
  buyerVatIdValid?: boolean;
}

export interface RuleActions {
  vatCode?: string;
  vatRate?: number;
  reverseCharge?: boolean;
  deductible?: boolean;
  deductibleShare?: number;
  /** Pakottaa ihmistarkistuksen vaikka sääntö osuisi. */
  requiresReview?: boolean;
}

export interface RuleVersion {
  ruleId: string;
  version: string;
  status: RuleStatus;
  /** Pienempi arvioidaan ensin. */
  priority: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  jurisdiction: Jurisdiction;
  name: string;
  description?: string;
  conditions: RuleConditions;
  actions: RuleActions;
  /** Vain validoiduilla säännöillä. Demo-säännöillä undefined. */
  legalReference?: string;
  sourceUrl?: string;
  notes?: string;
}

export interface TaxDecision {
  outcome: DecisionOutcome;

  ruleId?: string;
  ruleVersion?: string;
  ruleStatus?: RuleStatus;
  jurisdiction?: Jurisdiction;
  effectiveFrom?: string;
  effectiveTo?: string | null;

  vatCode?: string;
  vatRate?: number;
  vatAmountCents?: number;
  reverseCharge: boolean;
  deductible?: boolean;
  deductibleShare?: number;

  /** Faktat sellaisenaan, jotta päätös voidaan ajaa uudelleen (§14). */
  inputFacts: TaxFacts;
  reason: string;
  sourceReference?: string;
  confidence: ConfidenceBand;
  confidenceScore: number;
  engineVersion: string;

  /** Koneluettavat syyt tarkistukseen. Tyhjä = ei estettä. */
  reviewReasons: string[];
}

export interface EngineOptions {
  /**
   * Sallitut sääntöstatukset. Tuotannossa demo-sääntöjä ei pitäisi käyttää
   * ilman että se näkyy käyttäjälle.
   */
  allowedStatuses?: RuleStatus[];
  engineVersion?: string;
}

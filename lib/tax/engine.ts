/**
 * Verra TaxRuleEngine.
 *
 * Deterministinen sääntömoottori. Ei kutsu kielimallia, ei verkkoa, ei kelloa
 * muuten kuin annettujen faktojen kautta. Sama syöte + sama sääntöjoukko
 * tuottaa aina saman päätöksen (§2).
 *
 * Moottori ei koskaan arvaa. Jos yksikään sääntö ei osu tai osuvia sääntöjä
 * on useita samalla prioriteetilla, tulos on 'needs_review' (§1, §24).
 */

import { vatFromNet, vatFromGross } from "../money";
import type {
  ConfidenceBand,
  EngineOptions,
  RuleConditions,
  RuleVersion,
  TaxDecision,
  TaxFacts,
} from "./types";

export const ENGINE_VERSION = "1.0.0";

const DEFAULT_ALLOWED_STATUSES: RuleVersion["status"][] = [
  "demo",
  "validated",
  "active",
];

/**
 * Arvioi faktat sääntöjoukkoa vasten ja palauttaa yhden päätöksen.
 *
 * Sääntöjoukko annetaan parametrina, ei haeta globaalisti — näin sama
 * moottori palvelee tuotantosääntöjä, historiallista uudelleenajoa ja
 * testejä ilman haaraumia.
 */
export function evaluate(
  facts: TaxFacts,
  rules: RuleVersion[],
  options: EngineOptions = {},
): TaxDecision {
  const engineVersion = options.engineVersion ?? ENGINE_VERSION;
  const allowed = options.allowedStatuses ?? DEFAULT_ALLOWED_STATUSES;

  const normalized = normalizeFacts(facts);

  const candidates = rules
    .filter((rule) => allowed.includes(rule.status))
    .filter((rule) => rule.jurisdiction === normalized.jurisdiction)
    .filter((rule) => isEffectiveOn(rule, normalized.transactionDate))
    .filter((rule) => matches(rule.conditions, normalized))
    // Vakaa järjestys: prioriteetti, sitten sääntötunnus, sitten versio.
    // Ilman tätä kahden samanarvoisen säännön järjestys riippuisi
    // syötejärjestyksestä eikä tulos olisi toistettava.
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        a.ruleId.localeCompare(b.ruleId) ||
        a.version.localeCompare(b.version),
    );

  if (candidates.length === 0) {
    // Faktatason syyt kerätään myös silloin kun sääntö ei osu. Muuten
    // review-jono näyttäisi pelkän "ei sääntöä" vaikka todellinen syy olisi
    // vahvistamaton ALV-tunniste tai puuttuva summa.
    return undetermined(
      normalized,
      engineVersion,
      "Yksikään sääntö ei vastaa tapahtuman faktoja.",
      ["no_matching_rule", ...factLevelReviewReasons(normalized)],
    );
  }

  const winner = candidates[0];

  // Sääntöristiriita: kaksi eri sääntöä samalla prioriteetilla. Moottori ei
  // valitse arpomalla, vaan siirtää päätöksen ihmiselle.
  const tied = candidates.filter(
    (r) => r.priority === winner.priority && r.ruleId !== winner.ruleId,
  );
  if (tied.length > 0) {
    return undetermined(
      normalized,
      engineVersion,
      `Sääntöristiriita: ${[winner, ...tied]
        .map((r) => r.ruleId)
        .join(", ")} osuvat samalla prioriteetilla.`,
      ["rule_conflict"],
      winner,
    );
  }

  const reviewReasons = collectReviewReasons(normalized, winner);
  const { score, band } = scoreConfidence(normalized, winner, reviewReasons);

  const vatRate = winner.actions.vatRate;
  const vatAmountCents = computeVat(normalized, vatRate);

  const determined = reviewReasons.length === 0;

  return {
    outcome: determined ? "determined" : "needs_review",
    ruleId: winner.ruleId,
    ruleVersion: winner.version,
    ruleStatus: winner.status,
    jurisdiction: winner.jurisdiction,
    effectiveFrom: winner.effectiveFrom,
    effectiveTo: winner.effectiveTo ?? null,
    vatCode: winner.actions.vatCode,
    vatRate,
    vatAmountCents,
    reverseCharge: winner.actions.reverseCharge ?? false,
    deductible: winner.actions.deductible,
    deductibleShare: winner.actions.deductibleShare,
    inputFacts: normalized,
    reason: explain(winner, normalized, reviewReasons),
    sourceReference: winner.legalReference,
    confidence: band,
    confidenceScore: score,
    engineVersion,
    reviewReasons,
  };
}

/**
 * Täydentää johdettavissa olevat faktat. Johtaminen tehdään kerran tässä,
 * jotta säännöt eivät jokainen erikseen päättele samaa asiaa eri tavalla.
 */
export function normalizeFacts(facts: TaxFacts): TaxFacts {
  const supplierCountry = facts.supplierCountry ?? facts.jurisdiction;
  const crossBorder =
    facts.crossBorder ??
    (facts.buyerCountry ? facts.buyerCountry !== supplierCountry : false);

  const buyerInEu =
    facts.buyerInEu ??
    (facts.buyerCountry ? EU_COUNTRIES.has(facts.buyerCountry) : undefined);

  // VAT-tunnisteen kelpoisuutta ei koskaan johdeta pelkästä muodosta.
  // Undefined tarkoittaa "ei tarkistettu", ei "kelvollinen".
  const buyerVatIdValid = facts.buyerVatIdValid;

  return {
    ...facts,
    supplierCountry,
    crossBorder,
    buyerInEu,
    buyerVatIdValid,
    supplyType: facts.supplyType ?? "unknown",
    buyerType: facts.buyerType ?? "unknown",
  };
}

function isEffectiveOn(rule: RuleVersion, date: string): boolean {
  if (date < rule.effectiveFrom) return false;
  if (rule.effectiveTo && date > rule.effectiveTo) return false;
  return true;
}

function matches(conditions: RuleConditions, facts: TaxFacts): boolean {
  if (conditions.jurisdiction && conditions.jurisdiction !== facts.jurisdiction) {
    return false;
  }
  if (conditions.category) {
    if (!facts.category || !conditions.category.includes(facts.category)) {
      return false;
    }
  }
  if (conditions.supplyType && conditions.supplyType !== facts.supplyType) {
    return false;
  }
  if (
    conditions.crossBorder !== undefined &&
    conditions.crossBorder !== facts.crossBorder
  ) {
    return false;
  }
  if (conditions.buyerInEu !== undefined && conditions.buyerInEu !== facts.buyerInEu) {
    return false;
  }
  if (conditions.buyerType !== undefined && conditions.buyerType !== facts.buyerType) {
    return false;
  }
  if (
    conditions.buyerVatIdValid !== undefined &&
    conditions.buyerVatIdValid !== (facts.buyerVatIdValid ?? false)
  ) {
    return false;
  }
  return true;
}

function computeVat(facts: TaxFacts, rate?: number): number | undefined {
  if (rate === undefined) return undefined;
  if (facts.netAmountCents !== undefined) return vatFromNet(facts.netAmountCents, rate);
  if (facts.grossAmountCents !== undefined) {
    return vatFromGross(facts.grossAmountCents, rate);
  }
  return undefined;
}

/**
 * Syyt jotka johtuvat pelkistä faktoista, riippumatta siitä osuuko sääntö.
 * Erotettu sääntötason syistä, jotta ne voidaan kerätä myös silloin kun
 * yksikään sääntö ei osu.
 */
function factLevelReviewReasons(facts: TaxFacts): string[] {
  const reasons: string[] = [];

  if (
    facts.extractionConfidence !== undefined &&
    facts.extractionConfidence < 0.7
  ) {
    reasons.push("low_extraction_confidence");
  }
  // Rajat ylittävä B2B ilman vahvistettua tunnistetta ei mene läpi
  // automaattisesti, vaikka sääntö muuten osuisi (§17). Undefined on eri
  // asia kuin false, mutta kumpikaan ei ole vahvistus.
  if (
    facts.crossBorder &&
    facts.buyerType === "business" &&
    facts.buyerVatIdValid !== true
  ) {
    reasons.push("unverified_vat_id");
  }
  if (facts.crossBorder && facts.buyerCountry === undefined) {
    reasons.push("unknown_buyer_country");
  }
  if (facts.netAmountCents === undefined && facts.grossAmountCents === undefined) {
    reasons.push("missing_amount");
  }

  return reasons;
}

/**
 * Kerää syyt joiden takia päätöstä ei voi hyväksyä automaattisesti.
 * Tyhjä lista tarkoittaa että sääntö ratkaisi asian yksiselitteisesti.
 */
function collectReviewReasons(facts: TaxFacts, rule: RuleVersion): string[] {
  const reasons: string[] = [];

  if (rule.actions.requiresReview) {
    reasons.push("rule_requires_review");
  }
  if (rule.status === "demo") {
    reasons.push("demo_rule");
  }
  if (rule.status === "deprecated") {
    reasons.push("deprecated_rule");
  }

  reasons.push(...factLevelReviewReasons(facts));

  return reasons;
}

function scoreConfidence(
  facts: TaxFacts,
  rule: RuleVersion,
  reviewReasons: string[],
): { score: number; band: ConfidenceBand } {
  // Lähdetään täydestä ja vähennetään todellisista signaaleista. Ei
  // keksittyjä prosentteja (§24).
  let score = 1;

  if (rule.status === "demo") score -= 0.3;
  if (rule.status === "deprecated") score -= 0.4;
  if (rule.actions.requiresReview) score -= 0.25;

  if (facts.extractionConfidence !== undefined) {
    score -= (1 - facts.extractionConfidence) * 0.5;
  }
  if (facts.category === undefined) score -= 0.15;
  if (facts.crossBorder && facts.buyerVatIdValid !== true) score -= 0.25;
  if (facts.netAmountCents === undefined && facts.grossAmountCents === undefined) {
    score -= 0.2;
  }

  score = Math.max(0, Math.min(1, Number(score.toFixed(4))));

  const band: ConfidenceBand =
    reviewReasons.length > 0 || score < 0.6
      ? score < 0.4
        ? "low"
        : "medium"
      : score >= 0.85
        ? "high"
        : "medium";

  return { score, band };
}

function explain(
  rule: RuleVersion,
  facts: TaxFacts,
  reviewReasons: string[],
): string {
  const parts: string[] = [];
  parts.push(`${rule.name} (${rule.ruleId} v${rule.version}).`);

  const used: string[] = [];
  if (facts.category) used.push(`luokka ${facts.category}`);
  if (facts.supplyType && facts.supplyType !== "unknown") {
    used.push(`suoritetyyppi ${facts.supplyType}`);
  }
  if (facts.crossBorder) {
    used.push(
      `rajat ylittävä myynti ${facts.supplierCountry ?? "?"} → ${facts.buyerCountry ?? "?"}`,
    );
  } else {
    used.push(`kotimaan myynti (${facts.jurisdiction})`);
  }
  if (facts.buyerType && facts.buyerType !== "unknown") {
    used.push(`ostaja ${facts.buyerType === "business" ? "yritys" : "kuluttaja"}`);
  }
  parts.push(`Käytetyt faktat: ${used.join(", ")}.`);

  if (rule.status === "demo") {
    parts.push(
      "Sääntö on demo-tasoinen eikä sitä ole validoitu virallista lähdettä vasten.",
    );
  }
  if (reviewReasons.length > 0) {
    parts.push(
      `Vaatii ihmisen tarkistuksen: ${reviewReasons
        .map(reviewReasonLabel)
        .join(", ")}.`,
    );
  }

  return parts.join(" ");
}

function undetermined(
  facts: TaxFacts,
  engineVersion: string,
  reason: string,
  reviewReasons: string[],
  rule?: RuleVersion,
): TaxDecision {
  return {
    outcome: "needs_review",
    ruleId: rule?.ruleId,
    ruleVersion: rule?.version,
    ruleStatus: rule?.status,
    jurisdiction: facts.jurisdiction,
    reverseCharge: false,
    inputFacts: facts,
    reason,
    confidence: "low",
    confidenceScore: 0,
    engineVersion,
    reviewReasons,
  };
}

/** Ihmisluettavat selitteet tarkistussyille. Käytetään myös review-jonossa. */
export function reviewReasonLabel(code: string): string {
  return REVIEW_REASON_LABELS[code] ?? code;
}

export const REVIEW_REASON_LABELS: Record<string, string> = {
  no_matching_rule: "yksikään sääntö ei osunut",
  rule_conflict: "sääntöristiriita",
  rule_requires_review: "sääntö edellyttää tarkistusta",
  demo_rule: "demo-sääntö, ei validoitu",
  deprecated_rule: "sääntö on poistettu käytöstä",
  low_extraction_confidence: "poiminnan laatu heikko",
  unverified_vat_id: "ALV-tunnistetta ei ole vahvistettu",
  unknown_buyer_country: "ostajan maa tuntematon",
  missing_amount: "summa puuttuu",
};

/** EU-jäsenmaat ALV-tarkoituksessa. */
export const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI",
  "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT",
  "NL", "PL", "PT", "RO", "SE", "SI", "SK",
]);

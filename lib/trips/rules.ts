/**
 * Kilometrikorvaus- ja päivärahasäännöt (§25).
 *
 * Nämä EIVÄT ole kovakoodattuja verokantoja vaan versioituja sääntöjä
 * samalla periaatteella kuin ALV. Kun Verohallinnon päätös muuttuu, luodaan
 * uusi versio omalla voimassaoloajallaan — vanhaa ei muokata, jotta aiempi
 * matkalasku pysyy toistettavana.
 *
 * VAROITUS: statukseltaan 'demo'. Arvot on vahvistettava virallisesta
 * lähteestä ennen tuotantokäyttöä.
 */

export interface MileageRuleVersion {
  ruleId: string;
  version: string;
  status: "demo" | "validated" | "active" | "deprecated";
  effectiveFrom: string;
  effectiveTo: string | null;
  jurisdiction: string;
  /** Sentteinä kilometriltä. */
  rateCents: number;
  notes?: string;
}

export interface PerDiemRuleVersion {
  ruleId: string;
  version: string;
  status: "demo" | "validated" | "active" | "deprecated";
  effectiveFrom: string;
  effectiveTo: string | null;
  jurisdiction: string;
  /** Yli 6 h mutta enintään 10 h. */
  partialCents: number;
  /** Yli 10 h. */
  fullCents: number;
  /** Ateriaetu vähentää päivärahaa tällä osuudella. */
  mealDeductionShare: number;
  notes?: string;
}

export const MILEAGE_RULES: MileageRuleVersion[] = [
  {
    ruleId: "mileage-fi",
    version: "2026.1",
    status: "demo",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    jurisdiction: "FI",
    rateCents: 55,
    notes: "Demo-arvo. Vahvistettava Verohallinnon voimassa olevasta päätöksestä.",
  },
];

export const PER_DIEM_RULES: PerDiemRuleVersion[] = [
  {
    ruleId: "perdiem-fi",
    version: "2026.1",
    status: "demo",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    jurisdiction: "FI",
    partialCents: 2500,
    fullCents: 5400,
    mealDeductionShare: 0.5,
    notes: "Demo-arvot. Vahvistettava Verohallinnon voimassa olevasta päätöksestä.",
  },
];

function effectiveOn<T extends { effectiveFrom: string; effectiveTo: string | null }>(
  versions: T[],
  date: string,
  jurisdiction: string,
): T | undefined {
  return versions
    .filter((v) => (v as unknown as { jurisdiction: string }).jurisdiction === jurisdiction)
    .filter((v) => date >= v.effectiveFrom && (!v.effectiveTo || date <= v.effectiveTo))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}

export function mileageRuleFor(date: string, jurisdiction = "FI") {
  return effectiveOn(MILEAGE_RULES, date, jurisdiction);
}

export function perDiemRuleFor(date: string, jurisdiction = "FI") {
  return effectiveOn(PER_DIEM_RULES, date, jurisdiction);
}

export interface TripCalculation {
  kilometers: number;
  mileageRateCents: number;
  mileageCents: number;
  perDiemCents: number;
  mealDeductionCents: number;
  totalCents: number;
  mileageRuleId?: string;
  mileageRuleVersion?: string;
  perDiemRuleId?: string;
  perDiemRuleVersion?: string;
  /** Syyt joiden takia laskelma vaatii tarkistusta. */
  reviewReasons: string[];
}

export interface TripInput {
  date: string;
  kilometers?: number;
  durationHours?: number;
  mealsProvided?: number;
  jurisdiction?: string;
}

/**
 * Laskee matkakorvauksen voimassa olevista sääntöversioista.
 *
 * Ei koskaan arvaa: jos sääntöversiota ei löydy annetulle päivälle, korvaus
 * on nolla ja syy kirjataan tarkistettavaksi.
 */
export function calculateTrip(input: TripInput): TripCalculation {
  const jurisdiction = input.jurisdiction ?? "FI";
  const reviewReasons: string[] = [];

  const mileageRule = mileageRuleFor(input.date, jurisdiction);
  const perDiemRule = perDiemRuleFor(input.date, jurisdiction);

  const kilometers = input.kilometers ?? 0;
  let mileageCents = 0;

  if (kilometers > 0) {
    if (!mileageRule) {
      reviewReasons.push("no_mileage_rule");
    } else {
      mileageCents = Math.round(kilometers * mileageRule.rateCents);
      if (mileageRule.status === "demo") reviewReasons.push("demo_rule");
    }
  }

  let perDiemCents = 0;
  let mealDeductionCents = 0;

  if (input.durationHours !== undefined && input.durationHours > 6) {
    if (!perDiemRule) {
      reviewReasons.push("no_per_diem_rule");
    } else {
      perDiemCents =
        input.durationHours > 10 ? perDiemRule.fullCents : perDiemRule.partialCents;

      // Tarjottu ateria pienentää päivärahaa. Kaksi ateriaa nollaa sen.
      const meals = Math.min(input.mealsProvided ?? 0, 2);
      if (meals > 0) {
        mealDeductionCents = Math.round(
          perDiemCents * perDiemRule.mealDeductionShare * (meals === 2 ? 2 : 1),
        );
        mealDeductionCents = Math.min(mealDeductionCents, perDiemCents);
      }
      if (perDiemRule.status === "demo" && !reviewReasons.includes("demo_rule")) {
        reviewReasons.push("demo_rule");
      }
    }
  } else if (input.durationHours === undefined) {
    reviewReasons.push("unknown_duration");
  }

  return {
    kilometers,
    mileageRateCents: mileageRule?.rateCents ?? 0,
    mileageCents,
    perDiemCents,
    mealDeductionCents,
    totalCents: mileageCents + perDiemCents - mealDeductionCents,
    mileageRuleId: mileageRule?.ruleId,
    mileageRuleVersion: mileageRule?.version,
    perDiemRuleId: perDiemRule?.ruleId,
    perDiemRuleVersion: perDiemRule?.version,
    reviewReasons,
  };
}

export const TRIP_REVIEW_LABELS: Record<string, string> = {
  no_mileage_rule: "kilometrikorvaussääntöä ei löytynyt tälle päivälle",
  no_per_diem_rule: "päivärahasääntöä ei löytynyt tälle päivälle",
  demo_rule: "demo-sääntö, arvoja ei ole validoitu",
  unknown_duration: "matkan kesto tuntematon",
};

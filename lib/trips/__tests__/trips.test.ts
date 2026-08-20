import { describe, expect, it } from "vitest";
import { parseTripText } from "../parse";
import { calculateTrip, mileageRuleFor, perDiemRuleFor } from "../rules";

describe("parseTripText", () => {
  it("poimii reitin, kilometrit ja aterian esimerkkilauseesta", () => {
    const p = parseTripText(
      "Ajoin Helsingistä Tampereelle Acme-palaveriin, 174 km edestakaisin, ja söin lounaan",
    );
    expect(p.origin).toBe("Helsinki");
    expect(p.destination).toBe("Tampere");
    expect(p.kilometers).toBe(174);
    expect(p.roundTrip).toBe(true);
    expect(p.mealsProvided).toBe(1);
  });

  it("tunnistaa desimaalikilometrit pilkulla", () => {
    expect(parseTripText("Ajoin 12,5 km").kilometers).toBe(12.5);
  });

  it("tunnistaa keston", () => {
    expect(parseTripText("Matka kesti 8 tuntia").durationHours).toBe(8);
    expect(parseTripText("Reissu 9,5 h").durationHours).toBe(9.5);
  });

  it("laskee kaksi ateriaa", () => {
    expect(parseTripText("söin lounaan ja päivällisen").mealsProvided).toBe(2);
  });

  it("ei arvaa puuttuvia kenttiä vaan listaa ne", () => {
    const p = parseTripText("Kävin jossain");
    expect(p.kilometers).toBeUndefined();
    expect(p.missing).toContain("kilometers");
    expect(p.missing).toContain("origin");
    expect(p.missing).toContain("durationHours");
  });

  it("on deterministinen", () => {
    const text = "Ajoin Turusta Ouluun 610 km, 11 tuntia";
    expect(parseTripText(text)).toEqual(parseTripText(text));
  });
});

describe("calculateTrip", () => {
  const DATE = "2026-06-01";

  it("laskee kilometrikorvauksen voimassa olevasta säännöstä", () => {
    const rule = mileageRuleFor(DATE)!;
    const c = calculateTrip({ date: DATE, kilometers: 174, durationHours: 5 });
    expect(c.mileageCents).toBe(Math.round(174 * rule.rateCents));
    expect(c.mileageRuleId).toBe("mileage-fi");
    expect(c.mileageRuleVersion).toBe(rule.version);
  });

  it("ei maksa päivärahaa alle kuuden tunnin matkasta", () => {
    expect(calculateTrip({ date: DATE, kilometers: 50, durationHours: 4 }).perDiemCents).toBe(0);
  });

  it("maksaa osapäivärahan 6–10 tunnin matkasta", () => {
    const rule = perDiemRuleFor(DATE)!;
    expect(calculateTrip({ date: DATE, durationHours: 8 }).perDiemCents).toBe(
      rule.partialCents,
    );
  });

  it("maksaa kokopäivärahan yli kymmenen tunnin matkasta", () => {
    const rule = perDiemRuleFor(DATE)!;
    expect(calculateTrip({ date: DATE, durationHours: 12 }).perDiemCents).toBe(
      rule.fullCents,
    );
  });

  it("vähentää tarjotun aterian päivärahasta", () => {
    const withMeal = calculateTrip({ date: DATE, durationHours: 12, mealsProvided: 1 });
    const without = calculateTrip({ date: DATE, durationHours: 12 });
    expect(withMeal.mealDeductionCents).toBeGreaterThan(0);
    expect(withMeal.totalCents).toBeLessThan(without.totalCents);
  });

  it("ateriavähennys ei koskaan ylitä päivärahaa", () => {
    const c = calculateTrip({ date: DATE, durationHours: 12, mealsProvided: 2 });
    expect(c.mealDeductionCents).toBeLessThanOrEqual(c.perDiemCents);
    expect(c.totalCents).toBeGreaterThanOrEqual(0);
  });

  it("merkitsee demo-säännön tarkistettavaksi", () => {
    expect(calculateTrip({ date: DATE, kilometers: 10, durationHours: 2 }).reviewReasons)
      .toContain("demo_rule");
  });

  it("ei arvaa korvausta jos sääntöä ei ole voimassa", () => {
    const c = calculateTrip({ date: "2020-01-01", kilometers: 100, durationHours: 12 });
    expect(c.mileageCents).toBe(0);
    expect(c.perDiemCents).toBe(0);
    expect(c.reviewReasons).toContain("no_mileage_rule");
    expect(c.reviewReasons).toContain("no_per_diem_rule");
  });

  it("merkitsee tuntemattoman keston", () => {
    expect(calculateTrip({ date: DATE, kilometers: 50 }).reviewReasons).toContain(
      "unknown_duration",
    );
  });
});

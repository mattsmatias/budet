/**
 * Palkanlaskennan verotus.
 *
 * Testit on nimetty sillä kysymyksellä johon ne vastaavat, koska
 * rikkoutuessaan ne luetaan ilman että kukaan muistaa miksi ne
 * kirjoitettiin.
 *
 * Luvut on laskettu käsin testissä näkyviin. "Odotettu 1 460" ilman
 * perustelua olisi testi joka todistaa vain sen että koodi tekee sitä
 * mitä se teki kirjoitushetkellä.
 */

import { describe, expect, it } from "vitest";
import {
  ageOn,
  benefitsForPeriod,
  calculatePayslipTax,
  employerUnemploymentFor,
  pickTaxCard,
  prorateMonthly,
  roundCents,
  withholdingFor,
  type EmployeeBenefit,
  type EmployerSettings,
  type TaxCard,
  type TaxRules,
} from "../payroll-tax";

/**
 * Vuoden 2026 vahvistetut arvot.
 *
 * Samat kuin migraatiossa 0079. Jos ne eroavat, toinen on väärin —
 * ja testin tehtävä on huutaa siitä.
 */
const RULES_2026: TaxRules = {
  taxYear: 2026,
  employeePensionRate: 7.3,
  employeeUnemploymentRate: 0.89,
  employerPensionRate: 17.1,
  employerHealthRate: 1.91,
  employerUnemploymentLowRate: 0.31,
  employerUnemploymentHighRate: 1.23,
  employerUnemploymentThresholdCents: 250_950_000,
  noTaxCardRate: 60,
  maxWithholdingRate: 60,
  pensionMinAge: 17,
  pensionMaxAge: 68,
  unemploymentMinAge: 18,
  unemploymentMaxAge: 65,
};

const EI_ASETUKSIA: EmployerSettings = {
  pensionRate: null,
  accidentRate: null,
  groupLifeRate: null,
};

function kortti(muutos: Partial<TaxCard> = {}): TaxCard {
  return {
    id: "kortti-1",
    basePercent: 20,
    additionalPercent: 42,
    incomeLimitCents: 2_500_000,
    priorIncomeCents: 0,
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    ...muutos,
  };
}

function etu(muutos: Partial<EmployeeBenefit> = {}): EmployeeBenefit {
  return {
    id: "etu-1",
    kind: "phone",
    label: "",
    monthlyValueCents: 2000,
    validFrom: "2026-01-01",
    validTo: null,
    ...muutos,
  };
}

function laske(muutos: Partial<Parameters<typeof calculatePayslipTax>[0]> = {}) {
  return calculatePayslipTax({
    grossCents: 200_000,
    periodFrom: "2026-03-01",
    periodTo: "2026-03-31",
    payDate: "2026-04-15",
    cards: [kortti()],
    benefits: [],
    usedLimitCents: 0,
    payrollBeforeCents: 0,
    rules: RULES_2026,
    employer: EI_ASETUKSIA,
    birthDate: "1990-05-20",
    ...muutos,
  });
}

// ===========================================================================
// Pyöristys
// ===========================================================================

describe("roundCents", () => {
  it("pyöristää puolet ylöspäin", () => {
    expect(roundCents(10.5)).toBe(11);
    expect(roundCents(10.4)).toBe(10);
  });

  it("ei tuota miinusnollaa korjauserästä", () => {
    expect(Object.is(roundCents(-0.5), -1)).toBe(true);
    expect(roundCents(-10.5)).toBe(-11);
  });
});

// ===========================================================================
// 1. Normaali veroprosentti
// ===========================================================================

describe("ennakonpidätys perusprosentilla", () => {
  it("pidättää perusprosentin kun tulorajaa on jäljellä", () => {
    /* 2 000,00 € × 20 % = 400,00 € */
    const tulos = withholdingFor({
      taxableCents: 200_000,
      card: kortti(),
      usedLimitCents: 0,
      rules: RULES_2026,
    });

    expect(tulos.cents).toBe(40_000);
    expect(tulos.atBaseCents).toBe(200_000);
    expect(tulos.atAdditionalCents).toBe(0);
    expect(tulos.noTaxCard).toBe(false);
  });

  it("laskee tulorajan käytön ja jäljellä olevan", () => {
    const tulos = withholdingFor({
      taxableCents: 200_000,
      card: kortti({ incomeLimitCents: 2_500_000 }),
      usedLimitCents: 845_000,
      rules: RULES_2026,
    });

    expect(tulos.limitBeforeCents).toBe(845_000);
    expect(tulos.limitUsedCents).toBe(200_000);
    /* 25 000 − 8 450 − 2 000 = 14 550 € */
    expect(tulos.limitRemainingCents).toBe(1_455_000);
  });
});

// ===========================================================================
// 2. ja 3. Lisäprosentti ja tulorajan ylitys
// ===========================================================================

describe("ennakonpidätys tulorajan ylittyessä", () => {
  it("jakaa palkan perus- ja lisäprosentin kesken", () => {
    /*
     * Tehtävänannon esimerkki:
     *   tulorajaa jäljellä 500 €, uusi veronalainen palkka 1 000 €
     *
     * 500 € × 20 %  = 100,00 €
     * 500 € × 42 %  = 210,00 €
     *                 310,00 €
     */
    const tulos = withholdingFor({
      taxableCents: 100_000,
      card: kortti({ incomeLimitCents: 2_500_000 }),
      usedLimitCents: 2_450_000,
      rules: RULES_2026,
    });

    expect(tulos.atBaseCents).toBe(50_000);
    expect(tulos.atAdditionalCents).toBe(50_000);
    expect(tulos.cents).toBe(31_000);
    expect(tulos.limitRemainingCents).toBe(0);
  });

  it("pidättää kaiken lisäprosentilla kun raja on jo täynnä", () => {
    const tulos = withholdingFor({
      taxableCents: 100_000,
      card: kortti(),
      usedLimitCents: 2_500_000,
      rules: RULES_2026,
    });

    expect(tulos.atBaseCents).toBe(0);
    expect(tulos.atAdditionalCents).toBe(100_000);
    expect(tulos.cents).toBe(42_000);
  });

  it("ottaa huomioon ennen Katea kertyneen tulon", () => {
    /*
     * Kate otetaan käyttöön kesken vuoden. Kortin rajasta on jo
     * käytetty 24 000 €, joten 2 000 € palkasta vain 1 000 € menee
     * perusprosentilla.
     */
    const tulos = calculatePayslipTax({
      grossCents: 200_000,
      periodFrom: "2026-06-01",
      periodTo: "2026-06-30",
      payDate: "2026-07-15",
      cards: [kortti({ priorIncomeCents: 2_400_000 })],
      benefits: [],
      usedLimitCents: 2_400_000,
      payrollBeforeCents: 0,
      rules: RULES_2026,
      employer: EI_ASETUKSIA,
      birthDate: "1990-05-20",
    });

    expect(tulos.withholding.atBaseCents).toBe(100_000);
    expect(tulos.withholding.atAdditionalCents).toBe(100_000);
  });
});

// ===========================================================================
// 4. Tulorajan täyttyminen
// ===========================================================================

describe("tulorajan täyttyminen", () => {
  it("kuluttaa rajan tasan eikä mene miinukselle", () => {
    const tulos = withholdingFor({
      taxableCents: 50_000,
      card: kortti({ incomeLimitCents: 2_500_000 }),
      usedLimitCents: 2_450_000,
      rules: RULES_2026,
    });

    expect(tulos.atBaseCents).toBe(50_000);
    expect(tulos.atAdditionalCents).toBe(0);
    expect(tulos.limitRemainingCents).toBe(0);
  });

  it("ei anna negatiivista jäljellä olevaa vaikka raja olisi ylitetty", () => {
    const tulos = withholdingFor({
      taxableCents: 10_000,
      card: kortti(),
      usedLimitCents: 9_000_000,
      rules: RULES_2026,
    });

    expect(tulos.limitRemainingCents).toBe(0);
    expect(tulos.atBaseCents).toBe(0);
  });
});

// ===========================================================================
// 5.–7. Verokortin valinta maksupäivän mukaan
// ===========================================================================

describe("verokortin valinta", () => {
  const vanha = kortti({
    id: "vanha",
    basePercent: 18,
    validFrom: "2026-01-01",
    validTo: "2026-06-30",
  });

  const uusi = kortti({
    id: "uusi",
    basePercent: 24,
    validFrom: "2026-07-01",
    validTo: "2026-12-31",
  });

  it("valitsee maksupäivänä voimassa olevan", () => {
    expect(pickTaxCard([vanha, uusi], "2026-03-15")?.id).toBe("vanha");
    expect(pickTaxCard([vanha, uusi], "2026-08-15")?.id).toBe("uusi");
  });

  it("valitsee maksupäivän eikä työpäivän mukaan", () => {
    /*
     * Kesäkuussa tehty työ maksetaan heinäkuussa. Verohallinnon ohje
     * sanoo että kortti valitaan maksupäivästä, joten uusi kortti
     * voittaa vaikka työ tehtiin vanhan aikana.
     */
    const tulos = calculatePayslipTax({
      grossCents: 200_000,
      periodFrom: "2026-06-01",
      periodTo: "2026-06-30",
      payDate: "2026-07-15",
      cards: [vanha, uusi],
      benefits: [],
      usedLimitCents: 0,
      payrollBeforeCents: 0,
      rules: RULES_2026,
      employer: EI_ASETUKSIA,
      birthDate: "1990-05-20",
    });

    expect(tulos.used.taxCardId).toBe("uusi");
    expect(tulos.used.basePercent).toBe(24);
  });

  it("ei valitse vanhentunutta korttia", () => {
    expect(pickTaxCard([vanha], "2026-08-15")).toBeNull();
  });

  it("valitsee myöhäisimmän kun kortit menevät päällekkäin", () => {
    const muutos = kortti({ id: "muutos", validFrom: "2026-05-01" });
    expect(pickTaxCard([vanha, muutos], "2026-05-15")?.id).toBe("muutos");
  });
});

// ===========================================================================
// 8. Puuttuva verokortti
// ===========================================================================

describe("puuttuva verokortti", () => {
  it("pidättää lain mukaisen prosentin eikä arvaa", () => {
    const tulos = laske({ cards: [] });

    /* 2 000,00 € × 60 % = 1 200,00 € */
    expect(tulos.withholding.cents).toBe(120_000);
    expect(tulos.withholding.noTaxCard).toBe(true);
    expect(tulos.used.taxCardId).toBeNull();
  });

  it("kertoo puuttuvasta kortista huomautuksena", () => {
    const tulos = laske({ cards: [] });
    const huomio = tulos.issues.find((i) => i.kind === "no_tax_card");

    expect(huomio).toBeDefined();
    expect(huomio?.message).toContain("60");
  });
});

// ===========================================================================
// 9. Luontoisetu
// ===========================================================================

describe("luontoisedut", () => {
  it("laskee kuukausiedun kokonaisena täydeltä kuukaudelta", () => {
    expect(benefitsForPeriod([etu()], "2026-03-01", "2026-03-31")).toBe(2000);
  });

  it("jakaa edun päivien suhteessa puolikkaalla kaudella", () => {
    /* 20,00 € × 15/31 = 9,68 € */
    expect(benefitsForPeriod([etu()], "2026-03-01", "2026-03-15")).toBe(968);
  });

  it("summaa kaksi puolikasta takaisin kokonaiseksi kuukaudeksi", () => {
    const alku = benefitsForPeriod([etu()], "2026-03-01", "2026-03-15");
    const loppu = benefitsForPeriod([etu()], "2026-03-16", "2026-03-31");

    expect(alku + loppu).toBe(2000);
  });

  it("ei laske etua ennen voimassaolon alkua", () => {
    const myohemmin = etu({ validFrom: "2026-04-01" });
    expect(benefitsForPeriod([myohemmin], "2026-03-01", "2026-03-31")).toBe(0);
  });

  it("kasvattaa veronalaista palkkaa muttei nettopalkkaa", () => {
    const ilman = laske();
    const kanssa = laske({ benefits: [etu({ monthlyValueCents: 8800 })] });

    expect(kanssa.taxableCents).toBe(ilman.taxableCents + 8800);

    /*
     * Etu ei tule tilille. Nettopalkan on siis oltava pienempi kuin
     * ilman etua: veronalainen palkka kasvoi, joten pidätys ja
     * vakuutusmaksut kasvoivat, mutta rahaa ei tullut lisää.
     */
    expect(kanssa.netCents).toBeLessThan(ilman.netCents);
  });
});

// ===========================================================================
// 10. Työntekijän vakuutusmaksut
// ===========================================================================

describe("työntekijän vakuutusmaksut", () => {
  it("perii työeläke- ja työttömyysvakuutusmaksun erikseen", () => {
    const tulos = laske();

    /* 2 000,00 € × 7,30 % = 146,00 € */
    expect(tulos.employeePensionCents).toBe(14_600);
    /* 2 000,00 € × 0,89 % = 17,80 € */
    expect(tulos.employeeUnemploymentCents).toBe(1780);
  });

  it("laskee nettopalkan kaikkien kolmen vähennyksen jälkeen", () => {
    const tulos = laske();

    /* 2 000,00 − 400,00 − 146,00 − 17,80 = 1 436,20 € */
    expect(tulos.withholding.cents).toBe(40_000);
    expect(tulos.netCents).toBe(143_620);
  });

  it("ei peri eläkemaksua ikärajan ulkopuolella", () => {
    /* 16-vuotias maksupäivänä: alle 17 vuoden alarajan. */
    const tulos = laske({ birthDate: "2010-01-01", payDate: "2026-04-15" });

    expect(tulos.employeePensionCents).toBe(0);
    expect(tulos.used.employeePensionRate).toBe(0);
  });

  it("perii maksut normaalisti kun syntymäaika puuttuu", () => {
    const tulos = laske({ birthDate: null });

    expect(tulos.employeePensionCents).toBe(14_600);
    expect(tulos.issues.some((i) => i.kind === "unknown_age")).toBe(true);
  });
});

// ===========================================================================
// 11. Työnantajan kustannukset
// ===========================================================================

describe("työnantajan kustannukset", () => {
  it("laskee eläke-, sairausvakuutus- ja työttömyysmaksun", () => {
    const tulos = laske();

    /* 2 000,00 € × 17,10 % = 342,00 € */
    expect(tulos.employerPensionCents).toBe(34_200);
    /* 2 000,00 € × 1,91 % = 38,20 € */
    expect(tulos.employerHealthCents).toBe(3820);
    /* 2 000,00 € × 0,31 % = 6,20 € */
    expect(tulos.employerUnemploymentCents).toBe(620);
  });

  it("laskee kokonaiskustannuksen palkan ja maksujen summana", () => {
    const tulos = laske();

    /* 2 000,00 + 342,00 + 38,20 + 6,20 = 2 386,40 € */
    expect(tulos.employerTotalCents).toBe(238_640);
  });

  it("käyttää ravintolan omaa eläkeprosenttia kun se on annettu", () => {
    const tulos = laske({
      employer: { pensionRate: 16.5, accidentRate: 0.8, groupLifeRate: 0.06 },
    });

    expect(tulos.employerPensionCents).toBe(33_000);
    expect(tulos.employerAccidentCents).toBe(1600);
    expect(tulos.employerGroupLifeCents).toBe(120);
    expect(tulos.issues.some((i) => i.kind === "estimated_employer_cost")).toBe(
      false,
    );
  });

  it("kertoo kun kustannus on kansallisen keskiarvon varassa", () => {
    expect(laske().issues.some((i) => i.kind === "estimated_employer_cost")).toBe(
      true,
    );
  });

  it("porrastaa työttömyysvakuutusmaksun rajan yli", () => {
    /*
     * Palkkasummaa ennen tätä 2 500 000 €, raja 2 509 500 €.
     * Palkasta 20 000 € mahtuu 9 500 € alempaan ja 10 500 € ylempään.
     *
     * 9 500 × 0,31 %  =  29,45 €
     * 10 500 × 1,23 % = 129,15 €
     *                   158,60 €
     */
    const tulos = employerUnemploymentFor({
      taxableCents: 2_000_000,
      payrollBeforeCents: 250_000_000,
      rules: RULES_2026,
    });

    expect(tulos.cents).toBe(15_860);
  });

  it("ei peri työnantajan maksuja kahdesti luontoiseduista", () => {
    const tulos = laske({ benefits: [etu({ monthlyValueCents: 8800 })] });

    /* Kustannus lasketaan veronalaisesta palkasta, joka on 2 088,00 €. */
    expect(tulos.taxableCents).toBe(208_800);
    expect(tulos.employerHealthCents).toBe(percent(208_800, 1.91));
  });
});

function percent(cents: number, rate: number): number {
  return Math.round((cents * rate) / 100);
}

// ===========================================================================
// 16. Historiallinen palkka ei muutu sääntöjen muuttuessa
// ===========================================================================

describe("käytetyt arvot", () => {
  it("palauttaa kaikki laskennassa käytetyt prosentit", () => {
    const tulos = laske();

    expect(tulos.used.taxYear).toBe(2026);
    expect(tulos.used.basePercent).toBe(20);
    expect(tulos.used.additionalPercent).toBe(42);
    expect(tulos.used.employeePensionRate).toBe(7.3);
    expect(tulos.used.employeeUnemploymentRate).toBe(0.89);
    expect(tulos.used.employerPensionRate).toBe(17.1);
    expect(tulos.used.employerHealthRate).toBe(1.91);
    expect(tulos.used.employerUnemploymentRate).toBe(0.31);
  });

  it("antaa vuoden 2027 säännöillä eri tuloksen samasta palkasta", () => {
    /*
     * Tämä on se syy miksi käytetyt arvot tallennetaan laskelmalle.
     * Sääntöjen muuttuminen muuttaa uuden laskennan tulosta — vanhan
     * laskelman lukuja se ei saa muuttaa, ja siksi ne eivät saa tulla
     * sääntötaulusta lukuhetkellä.
     */
    const ensi: TaxRules = { ...RULES_2026, taxYear: 2027, employeePensionRate: 7.9 };

    const nyt = laske();
    const sitten = laske({ rules: ensi });

    expect(nyt.employeePensionCents).toBe(14_600);
    expect(sitten.employeePensionCents).toBe(15_800);
    expect(sitten.used.taxYear).toBe(2027);
  });
});

// ===========================================================================
// Ikä
// ===========================================================================

describe("ageOn", () => {
  it("laskee iän täyttyneinä vuosina", () => {
    expect(ageOn("1990-05-20", "2026-05-19")).toBe(35);
    expect(ageOn("1990-05-20", "2026-05-20")).toBe(36);
    expect(ageOn("1990-05-20", "2026-05-21")).toBe(36);
  });

  it("palauttaa null kelvottomasta päivästä", () => {
    expect(ageOn("", "2026-05-20")).toBeNull();
    expect(ageOn("1990-05-20", "eilen")).toBeNull();
  });
});

// ===========================================================================
// Kuukausiarvon jaksotus
// ===========================================================================

describe("prorateMonthly", () => {
  it("antaa koko kuukauden täydeltä kuukaudelta", () => {
    expect(prorateMonthly(250_000, "2026-03-01", "2026-03-31")).toBe(250_000);
  });

  it("jakaa päivien suhteessa, ei puolina", () => {
    /* 2 500,00 € × 15/31 = 1 209,68 € */
    expect(prorateMonthly(250_000, "2026-03-01", "2026-03-15")).toBe(120_968);
  });

  it("summaa kaksi puolikasta takaisin kokonaiseksi", () => {
    const alku = prorateMonthly(250_000, "2026-02-01", "2026-02-14");
    const loppu = prorateMonthly(250_000, "2026-02-15", "2026-02-28");
    expect(alku + loppu).toBe(250_000);
  });

  it("laskee kahden kuukauden yli", () => {
    expect(prorateMonthly(250_000, "2026-03-01", "2026-04-30")).toBe(500_000);
  });

  it("rajaa voimassaoloon", () => {
    /* Etu alkaa 16.3.: 16/31 kuukaudesta. */
    expect(
      prorateMonthly(3100, "2026-03-01", "2026-03-31", "2026-03-16", null),
    ).toBe(1600);
  });
});

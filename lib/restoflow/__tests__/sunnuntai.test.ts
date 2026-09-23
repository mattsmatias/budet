import { describe, expect, it } from "vitest";
import { staffCost } from "../staff-cost";
import { datesWithoutTes, type TesAgreement } from "../tes";
import { easterSunday, isPublicHoliday, isSundayOrHoliday } from "../holidays";
import type { Employee, TimeEntry } from "../employees";
import { DEFAULT_PAYROLL } from "../payroll";

/*
 * Sunnuntai- ja pyhatyon korotus.
 *
 * MaRa 17 §: sunnuntaina, kirkollisena juhlapaivana, vappuna ja
 * itsenaisyyspaivana korotetaan peruspalkka seka ilta- ja yolisa
 * sadalla prosentilla. Korotus kohdistuu palkkaeriin eika
 * loppusummaan: lomakustannus ja sivukulut lasketaan vasta taman
 * jalkeen eika niita koroteta uudestaan.
 *
 * Aiemmin korotus laskettiin vain peruspalkasta, joten sunnuntai-illan
 * arvio jai iltalisan verran liian pieneksi.
 */

const AIKA = "Europe/Helsinki";
const PALKKA = 1450;

function saanto(
  ruleType: "evening" | "night" | "sunday",
  value: number,
  unit: "eur_per_hour" | "percent",
  startTime: string | null = null,
  endTime: string | null = null,
) {
  return {
    id: ruleType,
    ruleType,
    name: ruleType,
    unit,
    value,
    startTime,
    endTime,
  };
}

/** MaRa 1.9.2025 alkaen. */
const TES: TesAgreement = {
  id: "v1",
  slug: "marava",
  name: "MaRa",
  industry: "restaurant",
  validFrom: "2025-09-01",
  validUntil: "2027-06-30",
  isActive: true,
  rules: [
    saanto("evening", 1.4, "eur_per_hour", "18:00", "24:00"),
    saanto("night", 2.37, "eur_per_hour", "00:00", "06:00"),
    saanto("sunday", 100, "percent"),
  ],
};

const TESTI: Employee = {
  id: "a",
  firstName: "Testi",
  lastName: "Test",
  email: null,
  jobTitle: null,
  hourlyCents: PALKKA,
  active: true,
  linked: false,
};

function vuoro(date: string, kello: string, minutes: number): TimeEntry {
  const alku = new Date(`${date}T${kello}:00+03:00`);

  return {
    id: `${date}-${kello}`,
    employeeId: "a",
    date,
    clockIn: alku.toISOString(),
    clockOut: new Date(alku.getTime() + minutes * 60_000).toISOString(),
    minutes,
  };
}

/** Palkka ja lisat ilman lomakustannusta ja sivukuluja. */
function kulu(date: string, kello: string, minutes: number) {
  return staffCost(
    [TESTI],
    [vuoro(date, kello, minutes)],
    date.slice(0, 7),
    AIKA,
    DEFAULT_PAYROLL,
    [TES],
  ).total;
}

/*
 * 6.9.2026 on sunnuntai ja 7.9.2026 maanantai.
 */
const SUNNUNTAI = "2026-09-06";
const MAANANTAI = "2026-09-07";

describe("sunnuntaikorotus kohdistuu palkkaeriin", () => {
  it("A: sunnuntai 12–13 korottaa peruspalkan eika anna iltalisaa", () => {
    const cost = kulu(SUNNUNTAI, "12:00", 60);

    expect(cost.baseCents).toBe(1450);
    /* Pelkka peruspalkan korotus 14,50 e. */
    expect(cost.supplementCents).toBe(1450);
    expect(cost.totalCents).toBe(2900);
  });

  it("B: sunnuntai 18–19 korottaa seka peruspalkan etta iltalisan", () => {
    const cost = kulu(SUNNUNTAI, "18:00", 60);

    /* 14,50 e + 1,40 e ja molemmat kahdesti = 31,80 e. */
    expect(cost.baseCents).toBe(1450);
    expect(cost.supplementCents).toBe(1450 + 140 + 140);
    expect(cost.totalCents).toBe(3180);
  });

  it("C: sunnuntai 00–01 korottaa peruspalkan ja yolisan", () => {
    const cost = kulu(SUNNUNTAI, "00:00", 60);

    /* 14,50 e + 2,37 e ja molemmat kahdesti = 33,74 e. */
    expect(cost.supplementCents).toBe(1450 + 237 + 237);
    expect(cost.totalCents).toBe(3374);
  });

  it("D: sunnuntai 05–07 korottaa molemmat tunnit, yolisan vain yolta", () => {
    const cost = kulu(SUNNUNTAI, "05:00", 120);

    /*
     * Peruspalkka 2 h = 29,00 e ja sen korotus 29,00 e.
     * Yolisa vain klo 05–06: 2,37 e ja sen korotus 2,37 e.
     */
    expect(cost.baseCents).toBe(2900);
    expect(cost.supplementCents).toBe(2900 + 237 + 237);
    expect(cost.totalCents).toBe(2900 + 2900 + 237 + 237);
  });

  it("E: maanantai 18–19 on tavallinen iltatunti", () => {
    const cost = kulu(MAANANTAI, "18:00", 60);

    expect(cost.baseCents).toBe(1450);
    expect(cost.supplementCents).toBe(140);
    expect(cost.totalCents).toBe(1590);
  });
});

describe("korotus ei kertaudu", () => {
  it("lomakustannus ja sivukulut lasketaan korotetusta palkasta kerran", () => {
    const asetukset = {
      ...DEFAULT_PAYROLL,
      holidayRate: 0.115,
      sideCostRate: 0.23,
    };

    const cost = staffCost(
      [TESTI],
      [vuoro(SUNNUNTAI, "18:00", 60)],
      "2026-09",
      AIKA,
      asetukset,
      [TES],
    ).total;

    const palkka = 1450;
    const lisat = 1450 + 140 + 140;
    const loma = Math.round((palkka + lisat) * 0.115);
    const sivu = Math.round((palkka + lisat + loma) * 0.23);

    expect(cost.supplementCents).toBe(lisat);
    expect(cost.holidayCents).toBe(loma);
    expect(cost.sideCostCents).toBe(sivu);
    expect(cost.totalCents).toBe(palkka + lisat + loma + sivu);
  });

  it("puolet vuorosta sunnuntaina korottaa vain sunnuntain minuutit", () => {
    /* Lauantai 5.9.2026 klo 23 – sunnuntai klo 01. */
    const cost = staffCost(
      [TESTI],
      [vuoro("2026-09-05", "23:00", 120)],
      "2026-09",
      AIKA,
      DEFAULT_PAYROLL,
      [TES],
    ).total;

    /*
     * 23–24 lauantaina: iltalisa 1,40 e ilman korotusta.
     * 00–01 sunnuntaina: yolisa 2,37 e, peruspalkan korotus 14,50 e
     * ja yolisan korotus 2,37 e.
     */
    expect(cost.supplementCents).toBe(140 + 237 + 1450 + 237);
  });
});

describe("pyhapaivat", () => {
  it("tunnistaa kiinteat juhlapaivat", () => {
    expect(isPublicHoliday("2026-01-01")).toBe(true);
    expect(isPublicHoliday("2026-01-06")).toBe(true);
    expect(isPublicHoliday("2026-05-01")).toBe(true);
    expect(isPublicHoliday("2026-12-06")).toBe(true);
    expect(isPublicHoliday("2026-12-25")).toBe(true);
    expect(isPublicHoliday("2026-12-26")).toBe(true);
  });

  it("laskee paasiaisen oikein", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
    expect(easterSunday(2025)).toBe("2025-04-20");
  });

  it("tunnistaa paasiaisesta johdetut paivat", () => {
    expect(isPublicHoliday("2026-04-03")).toBe(true); // pitkaperjantai
    expect(isPublicHoliday("2026-04-06")).toBe(true); // 2. paasiaispaiva
    expect(isPublicHoliday("2026-05-14")).toBe(true); // helatorstai
    expect(isPublicHoliday("2026-05-24")).toBe(true); // helluntai
  });

  it("tunnistaa juhannus- ja pyhainpaivan lauantaina", () => {
    expect(isPublicHoliday("2026-06-20")).toBe(true);
    expect(isPublicHoliday("2026-10-31")).toBe(true);
  });

  it("ei pida aattoja eika tavallisia paivia pyhina", () => {
    expect(isPublicHoliday("2026-12-24")).toBe(false);
    expect(isPublicHoliday("2026-09-07")).toBe(false);
    expect(isPublicHoliday("2026-02-11")).toBe(false);
  });

  it("sunnuntai on pyha ilman paivalistaa", () => {
    expect(isSundayOrHoliday("2026-09-06", 0)).toBe(true);
    expect(isSundayOrHoliday("2026-09-07", 1)).toBe(false);
    expect(isSundayOrHoliday("2026-12-25", 5)).toBe(true);
  });

  it("itsenaisyyspaivan arkivuoro saa sunnuntaikorotuksen", () => {
    /* 6.12.2026 on sunnuntai, joten otetaan vappu: 1.5.2026 on perjantai. */
    const cost = kulu("2026-05-01", "12:00", 60);

    expect(cost.supplementCents).toBe(1450);
    expect(cost.totalCents).toBe(2900);
  });
});

describe("puuttuva sopimusversio", () => {
  it("kertoo paivat joille versiota ei ole", () => {
    expect(datesWithoutTes([TES], ["2025-08-31", "2025-09-01"])).toEqual([
      "2025-08-31",
    ]);
  });

  it("ei vaita mitaan kun sopimusta ei ole lainkaan", () => {
    expect(datesWithoutTes([], ["2025-08-31"])).toEqual([]);
  });

  it("nostaa puuttuvan paivan laskennan tulokseen", () => {
    const tulos = staffCost(
      [TESTI],
      [vuoro("2025-08-31", "12:00", 60)],
      "2025-08",
      AIKA,
      DEFAULT_PAYROLL,
      [TES],
    );

    expect(tulos.missingTes).toEqual(["2025-08-31"]);
    /* Arvio tehdaan yrityksen omilla asetuksilla, ei arvatuilla lisilla. */
    expect(tulos.total.supplementCents).toBe(0);
    expect(tulos.total.baseCents).toBe(1450);
  });

  it("ei varoita paivista joille versio loytyy", () => {
    const tulos = staffCost(
      [TESTI],
      [vuoro(SUNNUNTAI, "12:00", 60)],
      "2026-09",
      AIKA,
      DEFAULT_PAYROLL,
      [TES],
    );

    expect(tulos.missingTes).toEqual([]);
  });
});

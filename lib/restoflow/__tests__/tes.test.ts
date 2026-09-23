import { describe, expect, it } from "vitest";
import {
  formatTesValidity,
  minuteOfDay,
  settingsFromTes,
  settingsResolver,
  versionFor,
  type TesAgreement,
} from "../tes";
import { DEFAULT_PAYROLL, type PayrollSettings } from "../payroll";

const YRITYS: PayrollSettings = {
  ...DEFAULT_PAYROLL,
  sideCostRate: 0.23,
  holidayRate: 0.115,
};

function tes(
  id: string,
  validFrom: string,
  validUntil: string | null,
  extra: Partial<TesAgreement> = {},
): TesAgreement {
  return {
    id,
    slug: "marava",
    name: `Marava ${validFrom}`,
    industry: "restaurant",
    validFrom,
    validUntil,
    isActive: true,
    rules: [],
    ...extra,
  };
}

describe("TES-version valinta", () => {
  const versiot = [
    tes("a", "2025-04-01", "2028-03-31"),
    tes("b", "2028-04-01", "2030-03-31"),
  ];

  it("valitsee voimassa olleen version", () => {
    expect(versionFor(versiot, "2026-09-23")?.id).toBe("a");
    expect(versionFor(versiot, "2029-01-15")?.id).toBe("b");
  });

  /* Vanha vuoro lasketaan silloin voimassa olleilla lisillä. */
  it("ei käytä uutta versiota vanhaan vuoroon", () => {
    expect(versionFor(versiot, "2028-03-31")?.id).toBe("a");
    expect(versionFor(versiot, "2028-04-01")?.id).toBe("b");
  });

  it("ei löydä mitään ennen ensimmäistä versiota", () => {
    expect(versionFor(versiot, "2024-12-31")).toBeNull();
  });

  it("ohittaa käytöstä poistetun version", () => {
    const poistettu = [tes("a", "2025-04-01", null, { isActive: false })];
    expect(versionFor(poistettu, "2026-09-23")).toBeNull();
  });

  it("hyväksyy toistaiseksi voimassa olevan", () => {
    expect(versionFor([tes("a", "2025-04-01", null)], "2099-01-01")?.id).toBe(
      "a",
    );
  });
});

describe("TES-säännöt asetuksiksi", () => {
  const sopimus = tes("a", "2025-04-01", null, {
    rules: [
      {
        id: "1",
        ruleType: "evening",
        name: "Iltalisä",
        unit: "eur_per_hour",
        value: 1.4,
        startTime: "18:00",
        endTime: "23:00",
      },
      {
        id: "2",
        ruleType: "night",
        name: "Yölisä",
        unit: "eur_per_hour",
        value: 2.37,
        startTime: "23:00",
        endTime: "06:00",
      },
      {
        id: "3",
        ruleType: "sunday",
        name: "Sunnuntaikorotus",
        unit: "percent",
        value: 100,
        startTime: null,
        endTime: null,
      },
    ],
  });

  it("lukee euromääräisen lisän sentteinä", () => {
    const s = settingsFromTes(sopimus, YRITYS);
    expect(s.evening).toEqual({ cents: 140, rate: 0 });
    expect(s.night).toEqual({ cents: 237, rate: 0 });
  });

  it("lukee prosenttilisän osuutena", () => {
    expect(settingsFromTes(sopimus, YRITYS).sunday).toEqual({
      cents: 0,
      rate: 1,
    });
  });

  it("lukee kellonaikavälit säännöstä", () => {
    const s = settingsFromTes(sopimus, YRITYS);
    expect(s.eveningStartMinute).toBe(1080);
    expect(s.eveningEndMinute).toBe(1380);
    expect(s.nightStartMinute).toBe(1380);
    expect(s.nightEndMinute).toBe(360);
  });

  /* Sivukulut ja lomakustannus ovat yrityksen, eivät sopimuksen. */
  it("säilyttää yrityksen omat kulut", () => {
    const s = settingsFromTes(sopimus, YRITYS);
    expect(s.sideCostRate).toBe(0.23);
    expect(s.holidayRate).toBe(0.115);
  });

  it("jättää puuttuvan lisän nollaksi", () => {
    expect(settingsFromTes(sopimus, YRITYS).saturday).toEqual({
      cents: 0,
      rate: 0,
    });
  });

  /*
   * Ilman sopimusta yritys jatkaa omilla asetuksillaan.
   *
   * Ennen TES-hallintaa perustetut yritykset eivät saa rikkoutua
   * eikä kenenkään arvio muuttua tämän muutoksen takia.
   */
  it("palauttaa yrityksen asetukset ilman sopimusta", () => {
    expect(settingsFromTes(null, YRITYS)).toBe(YRITYS);
  });
});

describe("asetukset vuoron päivän mukaan", () => {
  const versiot = [
    tes("a", "2025-04-01", "2028-03-31", {
      rules: [
        {
          id: "1",
          ruleType: "evening",
          name: "Iltalisä",
          unit: "eur_per_hour",
          value: 1.4,
          startTime: "18:00",
          endTime: "23:00",
        },
      ],
    }),
    tes("b", "2028-04-01", null, {
      rules: [
        {
          id: "2",
          ruleType: "evening",
          name: "Iltalisä",
          unit: "eur_per_hour",
          value: 1.9,
          startTime: "18:00",
          endTime: "23:00",
        },
      ],
    }),
  ];

  it("antaa eri lisän eri kausille", () => {
    const resolve = settingsResolver(versiot, YRITYS);
    expect(resolve("2026-09-23").evening.cents).toBe(140);
    expect(resolve("2029-09-23").evening.cents).toBe(190);
  });

  it("palauttaa yrityksen asetukset kauden ulkopuolelta", () => {
    const resolve = settingsResolver(versiot, YRITYS);
    expect(resolve("2024-01-01").evening.cents).toBe(0);
  });
});

describe("kellonajan luku", () => {
  it("lukee tunnit ja minuutit", () => {
    expect(minuteOfDay("18:00")).toBe(1080);
    expect(minuteOfDay("06:30")).toBe(390);
    expect(minuteOfDay("23:00:00")).toBe(1380);
  });

  it("hylkää kelvottoman", () => {
    expect(minuteOfDay(null)).toBeNull();
    expect(minuteOfDay("kello")).toBeNull();
    expect(minuteOfDay("25:00")).toBeNull();
  });
});

describe('formatTesValidity', () => {
  it('nayttaa paivat kielen muodossa', () => {
    const teksti = formatTesValidity(
      { validFrom: '2025-04-01', validUntil: '2028-03-31' },
      'fi',
      'toistaiseksi',
    );

    expect(teksti).toBe('1.4.2025 – 31.3.2028');
  });

  it('kertoo avoimen voimassaolon sanoin', () => {
    const teksti = formatTesValidity(
      { validFrom: '2025-04-01', validUntil: null },
      'fi',
      'toistaiseksi',
    );

    expect(teksti).toBe('1.4.2025 – toistaiseksi');
  });
});

import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAYROLL,
  addSplits,
  employerCost,
  formatPercent,
  parsePercent,
  splitMinutes,
  type PayrollSettings,
} from "../payroll";
import type { TimeEntry } from "../employees";

const ZONE = "Europe/Helsinki";

const SETTINGS: PayrollSettings = {
  ...DEFAULT_PAYROLL,
  sideCostRate: 0.23,
  holidayRate: 0.115,
  eveningRate: 0.15,
  saturdayRate: 0.2,
  sundayRate: 1,
};

/** Vuoro paikallisessa ajassa: 2026-09-23 on keskiviikko. */
function shift(clockIn: string, minutes: number): TimeEntry {
  const start = new Date(clockIn);
  return {
    id: clockIn,
    employeeId: "a",
    date: clockIn.slice(0, 10),
    clockIn,
    clockOut: new Date(start.getTime() + minutes * 60_000).toISOString(),
    minutes,
  };
}

describe("vuoron jako lisäluokkiin", () => {
  /* Keskiviikko 09–15 paikallista aikaa: pelkkää perustuntia. */
  it("laskee päivätyön perustunneiksi", () => {
    const split = splitMinutes(
      shift("2026-09-23T06:00:00Z", 360),
      ZONE,
      SETTINGS,
    );
    expect(split).toEqual({ base: 360, evening: 0, saturday: 0, sunday: 0 });
  });

  /*
   * Keskiviikko 16–20 paikallista aikaa. Iltalisä alkaa kuudelta, joten
   * kaksi ensimmäistä tuntia ovat perustuntia ja kaksi viimeistä iltaa.
   */
  it("jakaa vuoron illan rajalla", () => {
    const split = splitMinutes(
      shift("2026-09-23T13:00:00Z", 240),
      ZONE,
      SETTINGS,
    );
    expect(split.base).toBe(120);
    expect(split.evening).toBe(120);
  });

  /* Lauantai on lauantaita myös illalla: suurin lisä voittaa. */
  it("antaa viikonpäivän voittaa illan", () => {
    const split = splitMinutes(
      shift("2026-09-26T17:00:00Z", 120),
      ZONE,
      SETTINGS,
    );
    expect(split.saturday).toBe(120);
    expect(split.evening).toBe(0);
  });

  /* Lauantai-illasta sunnuntain puolelle: minuutit jakautuvat. */
  it("seuraa keskiyön ylitystä", () => {
    const split = splitMinutes(
      shift("2026-09-26T20:00:00Z", 240),
      ZONE,
      SETTINGS,
    );
    expect(split.saturday).toBe(60);
    expect(split.sunday).toBe(180);
  });

  it("ei laske kesken olevaa vuoroa", () => {
    const kesken: TimeEntry = {
      id: "x",
      employeeId: "a",
      date: "2026-09-23",
      clockIn: "2026-09-23T06:00:00Z",
      clockOut: null,
      minutes: null,
    };
    expect(splitMinutes(kesken, ZONE, SETTINGS)).toEqual({
      base: 0,
      evening: 0,
      saturday: 0,
      sunday: 0,
    });
  });

  it("summaa jaot", () => {
    expect(
      addSplits(
        { base: 60, evening: 30, saturday: 0, sunday: 10 },
        { base: 15, evening: 0, saturday: 45, sunday: 0 },
      ),
    ).toEqual({ base: 75, evening: 30, saturday: 45, sunday: 10 });
  });
});

describe("työnantajan kustannus", () => {
  /*
   * Kahdeksan tuntia perustyötä 15 €/h.
   *
   * Palkka 120,00 €, lomakorvaus 11,5 % = 13,80 €, sivukulut 23 %
   * summasta 133,80 € = 30,77 €. Yhteensä 164,57 €.
   */
  it("laskee palkan, lomakorvauksen ja sivukulut", () => {
    const cost = employerCost(
      { base: 480, evening: 0, saturday: 0, sunday: 0 },
      1500,
      SETTINGS,
    );

    expect(cost.baseCents).toBe(12000);
    expect(cost.supplementCents).toBe(0);
    expect(cost.holidayCents).toBe(1380);
    expect(cost.sideCostCents).toBe(3077);
    expect(cost.totalCents).toBe(16457);
  });

  /* Sunnuntailisä sata prosenttia kaksinkertaistaa tunnin. */
  it("lisää sunnuntain korotuksen", () => {
    const cost = employerCost(
      { base: 0, evening: 0, saturday: 0, sunday: 60 },
      1500,
      { ...DEFAULT_PAYROLL, sundayRate: 1 },
    );

    expect(cost.baseCents).toBe(1500);
    expect(cost.supplementCents).toBe(1500);
    expect(cost.totalCents).toBe(3000);
  });

  it("on nolla ilman tunteja tai palkkaa", () => {
    expect(
      employerCost({ base: 0, evening: 0, saturday: 0, sunday: 0 }, 1500, SETTINGS)
        .totalCents,
    ).toBe(0);
    expect(
      employerCost({ base: 480, evening: 0, saturday: 0, sunday: 0 }, 0, SETTINGS)
        .totalCents,
    ).toBe(0);
  });

  /* Tyhjillä asetuksilla arvio on pelkkä bruttopalkka kuten ennen. */
  it("palautuu pelkkään palkkaan ilman asetuksia", () => {
    const cost = employerCost(
      { base: 480, evening: 0, saturday: 0, sunday: 0 },
      1500,
      DEFAULT_PAYROLL,
    );
    expect(cost.totalCents).toBe(12000);
  });
});

describe("prosenttiluvun luku", () => {
  it("lukee prosentin osuudeksi", () => {
    expect(parsePercent("23")).toBe(0.23);
    expect(parsePercent("23,5")).toBe(0.235);
    expect(parsePercent("11.5")).toBe(0.115);
    expect(parsePercent("")).toBe(0);
  });

  it("hylkää kelvottoman", () => {
    expect(parsePercent("abc")).toBeNull();
    expect(parsePercent("-5")).toBeNull();
    expect(parsePercent("250")).toBeNull();
  });

  it("kirjoittaa osuuden takaisin prosentiksi", () => {
    expect(formatPercent(0.23)).toBe("23");
    expect(formatPercent(0.235)).toBe("23,5");
    expect(formatPercent(0)).toBe("0");
  });
});

import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAYROLL,
  addSplits,
  costPerHourCents,
  employerCost,
  formatEuroPerHour,
  formatPercent,
  parseEuroPerHour,
  parsePercent,
  splitMinutes,
  type PayrollSettings,
} from "../payroll";
import type { TimeEntry } from "../employees";

const ZONE = "Europe/Helsinki";

/**
 * Ravintola-alan tapaan: iltalisä euroina tunnilta, sunnuntaikorotus
 * prosenttina. Juuri tämä ero oli se mitä pelkkä prosenttikenttä ei
 * osannut esittää.
 */
const SETTINGS: PayrollSettings = {
  ...DEFAULT_PAYROLL,
  sideCostRate: 0.23,
  holidayRate: 0.115,
  evening: { cents: 140, rate: 0 },
  saturday: { cents: 200, rate: 0 },
  sunday: { cents: 0, rate: 1 },
  night: { cents: 300, rate: 0 },
};

/** 2026-09-23 on keskiviikko, 26.9. lauantai ja 27.9. sunnuntai. */
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

describe("vuoron jako luokkiin", () => {
  it("laskee päivätyön pelkiksi tunneiksi", () => {
    const split = splitMinutes(
      shift("2026-09-23T06:00:00Z", 360),
      ZONE,
      SETTINGS,
    );
    expect(split.total).toBe(360);
    expect(split.evening).toBe(0);
    expect(split.night).toBe(0);
  });

  /* Keskiviikko 16–20 paikallista: kaksi tuntia päivää, kaksi iltaa. */
  it("jakaa vuoron illan rajalla", () => {
    const split = splitMinutes(
      shift("2026-09-23T13:00:00Z", 240),
      ZONE,
      SETTINGS,
    );
    expect(split.total).toBe(240);
    expect(split.evening).toBe(120);
  });

  /* Ilta päättyy 23, yö alkaa 23: 22–01 on tunti iltaa ja kaksi yötä. */
  it("erottaa yön illasta", () => {
    const split = splitMinutes(
      shift("2026-09-23T19:00:00Z", 180),
      ZONE,
      SETTINGS,
    );
    expect(split.evening).toBe(60);
    expect(split.night).toBe(120);
  });

  /*
   * Sunnuntai-illan minuutti on sekä sunnuntaita että iltaa.
   *
   * Luokat menevät päällekkäin tarkoituksella: kumpi lisä pätee ja
   * kertyvätkö ne, on yrityksen asetus eikä Katen sääntö.
   */
  it("laskee minuutin sekä viikonpäivään että kellonaikaan", () => {
    const split = splitMinutes(
      shift("2026-09-27T16:00:00Z", 60),
      ZONE,
      SETTINGS,
    );
    expect(split.total).toBe(60);
    expect(split.sunday).toBe(60);
    expect(split.evening).toBe(60);
  });

  it("seuraa keskiyön ylitystä lauantaista sunnuntaihin", () => {
    const split = splitMinutes(
      shift("2026-09-26T20:00:00Z", 240),
      ZONE,
      SETTINGS,
    );
    expect(split.saturday).toBe(60);
    expect(split.sunday).toBe(180);
    expect(split.total).toBe(240);
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
    expect(splitMinutes(kesken, ZONE, SETTINGS).total).toBe(0);
  });

  it("summaa jaot", () => {
    expect(
      addSplits(
        { total: 60, evening: 30, night: 0, saturday: 0, sunday: 10 },
        { total: 45, evening: 0, night: 15, saturday: 45, sunday: 0 },
      ),
    ).toEqual({
      total: 105,
      evening: 30,
      night: 15,
      saturday: 45,
      sunday: 10,
    });
  });
});

describe("työnantajan kustannus", () => {
  /*
   * Kahdeksan tuntia päivätyötä 15 €/h.
   *
   * Palkka 120,00 €, lomakustannus 11,5 % = 13,80 €, sivukulut 23 %
   * summasta 133,80 € = 30,77 €. Yhteensä 164,57 €.
   */
  it("laskee palkan, lomakustannuksen ja sivukulut", () => {
    const cost = employerCost(
      { total: 480, evening: 0, night: 0, saturday: 0, sunday: 0 },
      1500,
      SETTINGS,
    );

    expect(cost.baseCents).toBe(12000);
    expect(cost.supplementCents).toBe(0);
    expect(cost.holidayCents).toBe(1380);
    expect(cost.sideCostCents).toBe(3077);
    expect(cost.totalCents).toBe(16457);
  });

  /* Iltatunti 15 €/h + 1,40 €/h = 16,40 € — käyttäjän oma esimerkki. */
  it("lisää euromääräisen iltalisän", () => {
    const cost = employerCost(
      { total: 60, evening: 60, night: 0, saturday: 0, sunday: 0 },
      1500,
      { ...DEFAULT_PAYROLL, evening: { cents: 140, rate: 0 } },
    );

    expect(cost.baseCents).toBe(1500);
    expect(cost.supplementCents).toBe(140);
    expect(cost.totalCents).toBe(1640);
  });

  /* Sunnuntaitunti sadan prosentin korotuksella: 15 € + 15 € = 30 €. */
  it("lisää prosenttimääräisen sunnuntaikorotuksen", () => {
    const cost = employerCost(
      { total: 60, evening: 0, night: 0, saturday: 0, sunday: 60 },
      1500,
      { ...DEFAULT_PAYROLL, sunday: { cents: 0, rate: 1 } },
    );

    expect(cost.totalCents).toBe(3000);
  });

  /*
   * Sunnuntai-ilta: molemmat lisät pätevät.
   *
   * 15 € + sunnuntai 15 € + ilta 1,40 € = 31,40 €. Kertyvätkö ne
   * oikeasti, riippuu työehtosopimuksesta — Kate laskee sen minkä
   * käyttäjä on asettanut.
   */
  it("laskee viikonpäivän ja kellonajan lisät yhteen", () => {
    const cost = employerCost(
      { total: 60, evening: 60, night: 0, saturday: 0, sunday: 60 },
      1500,
      {
        ...DEFAULT_PAYROLL,
        sunday: { cents: 0, rate: 1 },
        evening: { cents: 140, rate: 0 },
      },
    );

    expect(cost.totalCents).toBe(3140);
  });

  it("on nolla ilman tunteja", () => {
    expect(
      employerCost(
        { total: 0, evening: 0, night: 0, saturday: 0, sunday: 0 },
        1500,
        SETTINGS,
      ).totalCents,
    ).toBe(0);
  });

  /* Tyhjillä asetuksilla arvio on pelkkä tuntipalkka kuten ennen. */
  it("palautuu pelkkään palkkaan ilman asetuksia", () => {
    const cost = employerCost(
      { total: 480, evening: 0, night: 0, saturday: 0, sunday: 0 },
      1500,
      DEFAULT_PAYROLL,
    );
    expect(cost.totalCents).toBe(12000);
  });

  /*
   * Todellinen tuntikustannus: 15 €/h maksaa lisineen ja sivukuluineen
   * enemmän, ja juuri se luku kiinnostaa yrittäjää.
   */
  it("kertoo kustannuksen tunnilta", () => {
    const cost = employerCost(
      { total: 480, evening: 0, night: 0, saturday: 0, sunday: 0 },
      1500,
      SETTINGS,
    );
    expect(costPerHourCents(cost)).toBe(2057);
    expect(costPerHourCents({ ...cost, minutes: 0 })).toBeNull();
  });
});

describe("lukujen luku ja kirjoitus", () => {
  it("lukee prosentin osuudeksi", () => {
    expect(parsePercent("23")).toBe(0.23);
    expect(parsePercent("23,5")).toBe(0.235);
    expect(parsePercent("")).toBe(0);
    expect(parsePercent("abc")).toBeNull();
    expect(parsePercent("250")).toBeNull();
  });

  it("lukee euromäärän sentteinä", () => {
    expect(parseEuroPerHour("1,40")).toBe(140);
    expect(parseEuroPerHour("1.40")).toBe(140);
    expect(parseEuroPerHour("2")).toBe(200);
    expect(parseEuroPerHour("")).toBe(0);
    expect(parseEuroPerHour("-1")).toBeNull();
    expect(parseEuroPerHour("abc")).toBeNull();
  });

  it("kirjoittaa arvot takaisin kenttään", () => {
    expect(formatPercent(0.23)).toBe("23");
    expect(formatEuroPerHour(140)).toBe("1,40");
    /* Nolla jää tyhjäksi: kenttä ei väitä lisää jota ei ole. */
    expect(formatEuroPerHour(0)).toBe("");
  });
});

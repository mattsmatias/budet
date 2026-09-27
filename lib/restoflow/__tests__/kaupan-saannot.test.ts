import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAYROLL,
  employerCost,
  splitMinutes,
  type PayrollSettings,
} from "../payroll";
import type { TimeEntry } from "../employees";

/*
 * Lisän rajaus viikonpäivään, pyhään ja korotuksen pohjaan.
 *
 * MIKSI NÄMÄ OVAT OLEMASSA.
 *
 * Kaupan alan sopimuksessa iltalisää ei makseta arkilauantai-iltana,
 * yölisää ei makseta sunnuntai- eikä juhlapäiväyönä, ja
 * sunnuntaikorotus lasketaan vain peruspalkasta. MaRassa yksikään
 * näistä rajauksista ei päde. Ero on sopimuksen eikä laskennan, joten
 * se on sopimuksen kentissä — ja siksi molemmat tavat on testattava.
 */

const AIKA = "Europe/Helsinki";

/**
 * Aikavyöhykkeen siirtymä minuutteina annetulla hetkellä.
 *
 * Kiinteä "+03:00" olisi väärin talvella: joulukuun vuoro alkaisi
 * tuntia liian aikaisin ja osuisi edelliselle päivälle. Juuri sitä
 * nämä testit tutkivat, joten siirtymä on laskettava.
 */
function siirtyma(hetki: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: AIKA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(hetki);

  const osa = (tyyppi: string) =>
    Number(parts.find((p) => p.type === tyyppi)?.value ?? 0);

  const paikallisena = Date.UTC(
    osa("year"),
    osa("month") - 1,
    osa("day"),
    osa("hour"),
    osa("minute"),
  );

  return (paikallisena - hetki.getTime()) / 60_000;
}

/** Vuoro annettuna päivänä, kellonajat yrityksen vyöhykkeellä. */
function vuoro(date: string, alku: string, minuutit: number): TimeEntry {
  const arvaus = new Date(`${date}T${alku}:00Z`);
  const alkaa = new Date(arvaus.getTime() - siirtyma(arvaus) * 60_000);

  return {
    id: `${date}-${alku}`,
    employeeId: "a",
    date,
    clockIn: alkaa.toISOString(),
    clockOut: new Date(alkaa.getTime() + minuutit * 60_000).toISOString(),
    minutes: minuutit,
  };
}

/* Kaupan lisät: ilta ma–pe ja su, yö ma–la ei pyhänä, lauantai arkena. */
const KAUPPA: PayrollSettings = {
  ...DEFAULT_PAYROLL,
  evening: { cents: 400, rate: 0, days: [1, 2, 3, 4, 5, 7] },
  eveningStartMinute: 18 * 60,
  eveningEndMinute: 24 * 60,
  night: { cents: 601, rate: 0, days: [1, 2, 3, 4, 5, 6], notOnHolidays: true },
  nightStartMinute: 0,
  nightEndMinute: 6 * 60,
  saturday: { cents: 527, rate: 0, notOnHolidays: true },
  saturdayStartMinute: 13 * 60,
  saturdayEndMinute: 24 * 60,
  sunday: { cents: 0, rate: 1, baseOnly: true },
};

describe("iltalisän päivärajaus", () => {
  it("maksetaan arkena", () => {
    /* Keskiviikko 16.9.2026 klo 18–20. */
    const split = splitMinutes(vuoro("2026-09-16", "18:00", 120), AIKA, KAUPPA);
    expect(split.evening).toBe(120);
  });

  it("ei makseta arkilauantai-iltana", () => {
    /* Lauantai 19.9.2026 klo 18–20: lauantailisä kyllä, iltalisä ei. */
    const split = splitMinutes(vuoro("2026-09-19", "18:00", 120), AIKA, KAUPPA);
    expect(split.evening).toBe(0);
    expect(split.saturday).toBe(120);
  });

  it("maksetaan sunnuntai-iltana", () => {
    /* Sunnuntai 20.9.2026 klo 18–20. */
    const split = splitMinutes(vuoro("2026-09-20", "18:00", 120), AIKA, KAUPPA);
    expect(split.evening).toBe(120);
    expect(split.sunday).toBe(120);
  });
});

describe("yölisän pyhärajaus", () => {
  it("maksetaan arkiyönä", () => {
    /* Torstai 17.9.2026 klo 00–04. */
    const split = splitMinutes(vuoro("2026-09-17", "00:00", 240), AIKA, KAUPPA);
    expect(split.night).toBe(240);
  });

  it("ei makseta juhlapäivän yönä", () => {
    /* Itsenäisyyspäivä 6.12.2026 klo 00–04. */
    const split = splitMinutes(vuoro("2026-12-06", "00:00", 240), AIKA, KAUPPA);
    expect(split.night).toBe(0);
    expect(split.sunday).toBe(240);
  });
});

describe("lauantailisä vain arkilauantaina", () => {
  it("ei makseta kun lauantai on juhlapäivä", () => {
    /* Itsenäisyyspäivä 6.12.2025 on lauantai. */
    const split = splitMinutes(vuoro("2025-12-06", "14:00", 120), AIKA, KAUPPA);
    expect(split.saturday).toBe(0);
    expect(split.sunday).toBe(120);
  });
});

describe("sunnuntaikorotuksen pohja", () => {
  const PALKKA = 1450;

  it("kaupan mallissa korotus vain peruspalkasta", () => {
    /* Sunnuntai 20.9.2026 klo 18–20: 2 h iltaa ja sunnuntaita. */
    const split = splitMinutes(vuoro("2026-09-20", "18:00", 120), AIKA, KAUPPA);
    const cost = employerCost(split, PALKKA, KAUPPA);

    /*
     * Peruspalkka 2 × 14,50 = 29,00
     * Iltalisä    2 × 4,00  =  8,00
     * Sunnuntai   100 % vain peruspalkasta = 29,00
     * Lisät yhteensä 37,00
     */
    expect(cost.baseCents).toBe(2900);
    expect(cost.supplementCents).toBe(3700);
  });

  it("MaRan mallissa korotus koskee myös iltalisää", () => {
    const mara: PayrollSettings = {
      ...KAUPPA,
      evening: { cents: 400, rate: 0 },
      sunday: { cents: 0, rate: 1 },
    };

    const split = splitMinutes(vuoro("2026-09-20", "18:00", 120), AIKA, mara);
    const cost = employerCost(split, PALKKA, mara);

    /*
     * Sama vuoro, mutta korotus lasketaan peruspalkasta ja iltalisästä:
     * 29,00 + 8,00 = 37,00 → korotus 37,00. Lisät yhteensä 45,00.
     */
    expect(cost.supplementCents).toBe(4500);
  });
});

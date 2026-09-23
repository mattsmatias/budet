import { describe, expect, it } from "vitest";
import { staffCost } from "../staff-cost";
import type { TesAgreement } from "../tes";
import { isEve, isEveWithSupplement, isPublicHoliday } from "../holidays";
import type { Employee, TimeEntry } from "../employees";
import { DEFAULT_PAYROLL } from "../payroll";

/*
 * Aattotyon korotus.
 *
 * MaRa 17 § 2: uudenvuodenaattona, paasiaislauantaina, vapunaattona,
 * juhannusaattona ja jouluaattona klo 15 jalkeen tehdysta tyosta
 * korotetaan peruspalkka ja iltatyolisa 50 %:lla. Aattolisaa ei makseta
 * pyhapaivalle sijoittuvalta aatolta.
 *
 * Korotus kohdistuu palkkaeriin: lomakustannus ja sivukulut lasketaan
 * vasta korotetusta summasta eika niita koroteta erikseen.
 */

const AIKA = "Europe/Helsinki";
const PALKKA = 1450;

function saanto(
  ruleType: "evening" | "night" | "sunday" | "eve",
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
    saanto("eve", 50, "percent", "15:00", "24:00"),
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
  const alku = new Date(`${date}T${kello}:00+02:00`);

  return {
    id: `${date}-${kello}`,
    employeeId: "a",
    date,
    clockIn: alku.toISOString(),
    clockOut: new Date(alku.getTime() + minutes * 60_000).toISOString(),
    minutes,
  };
}

/** Kesaaika: kesa-heinakuun vuorot ovat UTC+3. */
function kesavuoro(date: string, kello: string, minutes: number): TimeEntry {
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

function kulu(entries: TimeEntry[], month: string) {
  return staffCost([TESTI], entries, month, AIKA, DEFAULT_PAYROLL, [TES]).total;
}

describe("aattokorotus", () => {
  it("1: tavallinen maanantai 18–19 ei saa aattokorotusta", () => {
    /* 7.9.2026 on maanantai. */
    const cost = kulu([vuoro("2026-09-07", "18:00", 60)], "2026-09");

    expect(cost.baseCents).toBe(1450);
    expect(cost.supplementCents).toBe(140);
    expect(cost.totalCents).toBe(1590);
  });

  it("2: jouluaatto 14–16 korottaa vain klo 15 jalkeisen tunnin", () => {
    const cost = kulu([vuoro("2026-12-24", "14:00", 120)], "2026-12");

    /* Peruspalkka 2 h = 29,00 e ja korotus vain toiselta tunnilta. */
    expect(cost.baseCents).toBe(2900);
    expect(cost.supplementCents).toBe(725);
    expect(cost.totalCents).toBe(3625);
  });

  it("3: jouluaatto 18–19 korottaa peruspalkan ja iltalisan", () => {
    const cost = kulu([vuoro("2026-12-24", "18:00", 60)], "2026-12");

    /*
     * Peruspalkka 14,50 e, iltalisa 1,40 e ja niiden puolikkaat
     * 7,25 e + 0,70 e = yhteensa 23,85 e.
     */
    expect(cost.baseCents).toBe(1450);
    expect(cost.supplementCents).toBe(140 + 725 + 70);
    expect(cost.totalCents).toBe(2385);
  });

  it("4: uudenvuodenaatto 15–16", () => {
    /* 31.12.2026 on torstai. */
    const cost = kulu([vuoro("2026-12-31", "15:00", 60)], "2026-12");

    expect(cost.supplementCents).toBe(725);
    expect(cost.totalCents).toBe(2175);
  });

  it("5: paasiaislauantai 15–16", () => {
    /* Paasiainen 2026 on 5.4., joten lauantai on 4.4. */
    const cost = kulu([vuoro("2026-04-04", "15:00", 60)], "2026-04");

    expect(isEve("2026-04-04")).toBe(true);
    expect(cost.supplementCents).toBe(725);
  });

  it("6: vapunaatto 15–16", () => {
    /* 30.4.2026 on torstai. */
    const cost = kulu([vuoro("2026-04-30", "15:00", 60)], "2026-04");

    expect(cost.supplementCents).toBe(725);
  });

  it("7: juhannusaatto 15–16", () => {
    /* Juhannuspaiva 2026 on lauantai 20.6., aatto perjantai 19.6. */
    expect(isEve("2026-06-19")).toBe(true);

    const cost = kulu([kesavuoro("2026-06-19", "15:00", 60)], "2026-06");

    expect(cost.supplementCents).toBe(725);
  });

  it("8: pyhapaivalle sijoittuva aatto ei saa aattolisaa", () => {
    /* 24.12.2028 on sunnuntai — tarkistetaan se kalenterista. */
    const viikonpaiva = new Date("2028-12-24T12:00:00Z").getUTCDay();
    expect(viikonpaiva).toBe(0);

    expect(isEve("2028-12-24")).toBe(true);
    expect(isEveWithSupplement("2028-12-24", viikonpaiva)).toBe(false);

    /* Sopimuskausi ulottuu tahan vuoroon asti. */
    const voimassa: TesAgreement = { ...TES, validUntil: null };

    const cost = staffCost(
      [TESTI],
      [vuoro("2028-12-24", "18:00", 60)],
      "2028-12",
      AIKA,
      DEFAULT_PAYROLL,
      [voimassa],
    ).total;

    /* Sunnuntaikorotus peruspalkasta ja iltalisasta, ei 50 %:n lisaa. */
    expect(cost.supplementCents).toBe(140 + 1450 + 140);
  });

  it("8: joulupaiva on pyha eika aatto", () => {
    expect(isPublicHoliday("2026-12-25")).toBe(true);
    expect(isEve("2026-12-25")).toBe(false);

    const cost = kulu([vuoro("2026-12-25", "15:00", 60)], "2026-12");

    /* Sadan prosentin korotus, ei viidenkymmenen. */
    expect(cost.supplementCents).toBe(1450);
  });

  it("9: vuoro alkaa ennen klo 15 ja jatkuu sen jalkeen", () => {
    /* Jouluaatto 12:00–20:00. */
    const cost = kulu([vuoro("2026-12-24", "12:00", 480)], "2026-12");

    /*
     * Peruspalkka 8 h = 116,00 e.
     * Aattokorotus 5 h peruspalkasta = 36,25 e.
     * Iltalisa 2 h (18–20) = 2,80 e ja sen korotus 1,40 e.
     */
    expect(cost.baseCents).toBe(11600);
    expect(cost.supplementCents).toBe(3625 + 280 + 140);
  });

  it("10: vuoro jatkuu keskiyon yli joulupaivan puolelle", () => {
    /* Jouluaatto 22:00 – joulupaiva 02:00. */
    const cost = kulu([vuoro("2026-12-24", "22:00", 240)], "2026-12");

    /*
     * 22–24 aattona: iltalisa 2,80 e, aattokorotus peruspalkasta
     * 14,50 e ja iltalisasta 1,40 e.
     * 00–02 joulupaivana: yolisa 4,74 e, sunnuntaikorotus
     * peruspalkasta 29,00 e ja yolisasta 4,74 e.
     */
    expect(cost.baseCents).toBe(5800);
    expect(cost.supplementCents).toBe(280 + 1450 + 140 + 474 + 2900 + 474);
  });
});

describe("aatto ei kertaudu muihin eriin", () => {
  it("lomakustannus ja sivukulut lasketaan korotetusta palkasta", () => {
    const asetukset = {
      ...DEFAULT_PAYROLL,
      holidayRate: 0.115,
      sideCostRate: 0.23,
    };

    const cost = staffCost(
      [TESTI],
      [vuoro("2026-12-24", "18:00", 60)],
      "2026-12",
      AIKA,
      asetukset,
      [TES],
    ).total;

    const palkka = 1450;
    const lisat = 140 + 725 + 70;
    const loma = Math.round((palkka + lisat) * 0.115);
    const sivu = Math.round((palkka + lisat + loma) * 0.23);

    expect(cost.supplementCents).toBe(lisat);
    expect(cost.holidayCents).toBe(loma);
    expect(cost.sideCostCents).toBe(sivu);
    expect(cost.totalCents).toBe(palkka + lisat + loma + sivu);
  });

  it("ilman aattosaantoa aatto on tavallinen paiva", () => {
    const ilmanAattoa: TesAgreement = {
      ...TES,
      rules: TES.rules.filter((r) => r.ruleType !== "eve"),
    };

    const cost = staffCost(
      [TESTI],
      [vuoro("2026-12-24", "18:00", 60)],
      "2026-12",
      AIKA,
      DEFAULT_PAYROLL,
      [ilmanAattoa],
    ).total;

    expect(cost.supplementCents).toBe(140);
  });
});

describe("aattopaivat", () => {
  it("tunnistaa sopimuksen tuntemat aatot", () => {
    expect(isEve("2026-12-31")).toBe(true);
    expect(isEve("2026-04-30")).toBe(true);
    expect(isEve("2026-12-24")).toBe(true);
    expect(isEve("2026-04-04")).toBe(true); // paasiaislauantai
    expect(isEve("2026-06-19")).toBe(true); // juhannusaatto
  });

  it("ei pida muita paivia aattoina", () => {
    expect(isEve("2026-12-23")).toBe(false);
    expect(isEve("2026-12-25")).toBe(false);
    expect(isEve("2026-09-07")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  compareSales,
  labourShareOfSales,
  missingSalesDays,
  roughResult,
  salesBetween,
  totalSalesCents,
  type DailySales,
} from "../sales";

function day(date: string, netCents: number, targetCents: number | null = null): DailySales {
  return {
    date,
    netCents,
    targetCents,
    note: null,
    grossCents: null,
    vatCents: null,
    transactions: null,
    source: "manual",
  };
}

// 2026-08-24 on maanantai, 2026-08-28 perjantai.
const MA = "2026-08-24";

describe("vertailu tavoitteeseen", () => {
  it("verrataan tavoitteeseen kun se on asetettu", () => {
    const c = compareSales(day(MA, 267000, 250000), []);
    expect(c.kind).toBe("target");
    if (c.kind === "target") {
      expect(c.diffCents).toBe(17000);
      expect(c.ratio).toBeCloseTo(1.068, 3);
    }
  });

  /*
   * Tavoite voittaa historian. Se on ravintoloitsijan oma päätös siitä
   * mikä on hyvä päivä; historia on vain arvaus siitä.
   */
  it("tavoite ohittaa historian", () => {
    const historia = [day("2026-08-17", 100000), day("2026-08-10", 100000)];
    expect(compareSales(day(MA, 267000, 250000), historia).kind).toBe("target");
  });

  it("nollatavoitetta ei käytetä", () => {
    expect(compareSales(day(MA, 267000, 0), []).kind).toBe("none");
  });
});

describe("vertailu saman viikonpäivän historiaan", () => {
  const maanantait = [
    day("2026-08-17", 200000),
    day("2026-08-10", 240000),
    day("2026-08-03", 220000),
  ];

  it("laskee saman viikonpäivän keskiarvon", () => {
    const c = compareSales(day(MA, 231000), maanantait);
    expect(c.kind).toBe("weekday");
    if (c.kind === "weekday") {
      expect(c.averageCents).toBe(220000);
      expect(c.samples).toBe(3);
      expect(c.ratio).toBeCloseTo(1.05, 2);
    }
  });

  /*
   * Muut viikonpäivät eivät kelpaa vertailuun. Maanantai ei ole
   * perjantai, ja sekoittaminen tekisi jokaisesta maanantaista huonon.
   */
  it("ohittaa muut viikonpäivät", () => {
    const perjantait = [day("2026-08-21", 500000), day("2026-08-14", 500000)];
    expect(compareSales(day(MA, 231000), perjantait).kind).toBe("none");
  });

  it("ei vertaa yhteen havaintoon", () => {
    expect(compareSales(day(MA, 231000), [day("2026-08-17", 200000)]).kind).toBe("none");
  });

  it("ei laske itseään mukaan keskiarvoon", () => {
    const kanssa = [day(MA, 999999), ...maanantait];
    const c = compareSales(day(MA, 231000), kanssa);
    if (c.kind === "weekday") expect(c.averageCents).toBe(220000);
  });

  // Vertailukohtaa ei keksitä: ilman historiaa luku näytetään sellaisenaan.
  it("ei vertaa tyhjään historiaan", () => {
    expect(compareSales(day(MA, 231000), []).kind).toBe("none");
  });
});

describe("työvoiman osuus myynnistä", () => {
  it("laskee osuuden", () => {
    expect(labourShareOfSales(61200, 306000)).toBeCloseTo(0.2, 5);
  });

  it("on null ilman myyntiä", () => {
    expect(labourShareOfSales(61200, 0)).toBeNull();
  });
});

describe("karkea tulos", () => {
  it("vähentää kulut ja työvoiman myynnistä", () => {
    expect(roughResult({ netSalesCents: 400000, expenseCents: 120000, labourCents: 90000 }))
      .toBe(190000);
  });

  it("voi olla negatiivinen", () => {
    expect(roughResult({ netSalesCents: 100000, expenseCents: 120000, labourCents: 90000 }))
      .toBeLessThan(0);
  });
});

describe("aikavälit ja summat", () => {
  const kaikki = [day("2026-08-01", 100), day("2026-08-15", 200), day("2026-09-01", 400)];

  it("rajaa aikavälille", () => {
    expect(salesBetween(kaikki, "2026-08-01", "2026-08-31").map((s) => s.date)).toEqual([
      "2026-08-01",
      "2026-08-15",
    ]);
  });

  it("summaa", () => {
    expect(totalSalesCents(kaikki)).toBe(700);
  });
});

describe("puuttuvat päivät", () => {
  const paivat = ["2026-08-22", "2026-08-23", "2026-08-24"];

  it("löytää menneen päivän jolta myynti puuttuu", () => {
    const kirjatut = [day("2026-08-22", 100)];
    expect(missingSalesDays(paivat, kirjatut, "2026-08-24")).toEqual(["2026-08-23"]);
  });

  /*
   * Tätä päivää ei lasketa puuttuvaksi: myynti kirjataan illan
   * päätteeksi, eikä aamulla puuttuva luku ole virhe.
   */
  it("ei pidä tätä päivää puuttuvana", () => {
    expect(missingSalesDays(paivat, [], "2026-08-24")).not.toContain("2026-08-24");
  });
});

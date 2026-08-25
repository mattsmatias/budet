import { describe, expect, it } from "vitest";
import { lineVatCents, vatByRate } from "../vat";


describe("vatByRate", () => {
  /*
   * TEHTÄVÄNANNON §6.
   *
   * Ruokaa 100 € 14 %:lla ja alkoholia 50 € 25,5 %:lla. Kuittia ei
   * pakoteta yhteen kantaan: rivit tallennetaan ja summataan
   * erikseen.
   */
  it("erittelee sekakuitin kannoittain", () => {
    const rates = vatByRate([
      { totalCents: 10000, vatRate: 0.14 },
      { totalCents: 5000, vatRate: 0.255 },
    ]);

    expect(rates).toHaveLength(2);
    expect(rates[0].rate).toBe(0.255);
    expect(rates[0].grossCents).toBe(5000);
    expect(rates[1].rate).toBe(0.14);
    expect(rates[1].grossCents).toBe(10000);
  });

  it("summaa saman kannan rivit yhteen", () => {
    const rates = vatByRate([
      { totalCents: 10000, vatRate: 0.14 },
      { totalCents: 4000, vatRate: 0.14 },
    ]);

    expect(rates).toHaveLength(1);
    expect(rates[0].grossCents).toBe(14000);
  });

  it("pitää summan tasan jokaisessa ryhmässä", () => {
    const rates = vatByRate([
      { totalCents: 3333, vatRate: 0.14 },
      { totalCents: 777, vatRate: 0.255 },
      { totalCents: 101, vatRate: 0 },
    ]);

    for (const rate of rates) {
      expect(rate.vatCents + rate.netCents).toBe(rate.grossCents);
    }
  });

  /*
   * Kannaton rivi on oma ryhmänsä eikä oletus.
   *
   * Jos se sulautettaisiin yleiseen kantaan, puute katoaisi näkyvistä
   * ja kirjanpitäjä vähentäisi veroa jota ei ole todettu.
   */
  it("pitää kannattoman rivin erillään ja viimeisenä", () => {
    const rates = vatByRate([
      { totalCents: 5000, vatRate: null },
      { totalCents: 10000, vatRate: 0.14 },
    ]);

    expect(rates[1].rate).toBeNull();
    expect(rates[1].vatCents).toBe(0);
    expect(rates[1].netCents).toBe(5000);
  });

  it("kestää tyhjän kuitin", () => {
    expect(vatByRate([])).toEqual([]);
  });
});

describe("lineVatCents", () => {
  it("irrottaa veron brutosta", () => {
    expect(lineVatCents(11400, 0.14)).toBe(1400);
    expect(lineVatCents(12550, 0.255)).toBe(2550);
  });

  it("palauttaa nollan nollakannalla", () => {
    expect(lineVatCents(5000, 0)).toBe(0);
  });

  /* Tuntematon kanta ei tuota nollaa vaan tuntemattoman. */
  it("palauttaa null ilman kantaa", () => {
    expect(lineVatCents(5000, null)).toBeNull();
  });
});

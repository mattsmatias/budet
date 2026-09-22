import { describe, expect, it } from "vitest";
import { linesMatchShares, vatSharesOf } from "../receipt-ai";

/**
 * Kuitin oma ALV-erittely.
 *
 * Esimerkit ovat oikealta Lidlin kuitilta: A 25,5 % 6,71 / 33,00 ja
 * B 13,5 % 15,21 / 127,87, loppusumma 160,87 ja ALV 21,92. Juuri tämä
 * kuitti merkittiin ennen virheelliseksi, koska koko kuitin summista
 * päätelty kanta oli 15,8 % — luku jota ei ole olemassa.
 */
describe("ALV-erittely kuitilta", () => {
  it("lukee kannat suurin ensin", () => {
    const shares = vatSharesOf([
      { rate: 0.255, vatCents: 671, grossCents: 3300 },
      { rate: 0.135, vatCents: 1521, grossCents: 12787 },
    ]);

    expect(shares).toHaveLength(2);
    expect(shares[0].rate).toBe(0.255);
    expect(shares.reduce((s, r) => s + r.vatCents, 0)).toBe(2192);
  });

  it("hyväksyy prosenttiluvun murtoluvun sijaan", () => {
    expect(vatSharesOf([{ rate: 25.5, vatCents: 671, grossCents: 3300 }])[0].rate).toBe(
      0.255,
    );
  });

  /* Väärin luettu rivi menisi kaiken muun edelle, joten se hylätään. */
  it("hylkää rivin jonka vero ei vastaa kantaa", () => {
    expect(
      vatSharesOf([{ rate: 0.255, vatCents: 100, grossCents: 3300 }]),
    ).toEqual([]);
  });

  it("hylkää saman kannan toisen kerran", () => {
    const shares = vatSharesOf([
      { rate: 0.135, vatCents: 1521, grossCents: 12787 },
      { rate: 0.135, vatCents: 1521, grossCents: 12787 },
    ]);
    expect(shares).toHaveLength(1);
  });

  it("hylkää kelvottoman kannan", () => {
    expect(vatSharesOf([{ rate: null, vatCents: 10, grossCents: 100 }])).toEqual([]);
  });
});

describe("rivit vastaan erittely", () => {
  const shares = vatSharesOf([
    { rate: 0.255, vatCents: 671, grossCents: 3300 },
    { rate: 0.135, vatCents: 1521, grossCents: 12787 },
  ]);

  it("täsmää kun kannoittaiset summat ovat erittelyn mukaiset", () => {
    expect(
      linesMatchShares(
        [
          { totalCents: 3300, vatRate: 0.255 },
          { totalCents: 12987, vatRate: 0.135 },
          { totalCents: -200, vatRate: 0.135 },
        ],
        shares,
      ),
    ).toBe(true);
  });

  it("ei täsmää kun alennus on väärällä kannalla", () => {
    expect(
      linesMatchShares(
        [
          { totalCents: 3300, vatRate: 0.255 },
          { totalCents: 12787, vatRate: 0.135 },
          { totalCents: -200, vatRate: 0.255 },
          { totalCents: 200, vatRate: 0.135 },
        ],
        shares,
      ),
    ).toBe(false);
  });

  it("ei täsmää kun riviltä puuttuu kanta", () => {
    expect(
      linesMatchShares([{ totalCents: 3300, vatRate: null }], shares),
    ).toBe(false);
  });

  /* Ilman erittelyä ei ole mitään mitä vastaan verrata. */
  it("vaikenee ilman erittelyä", () => {
    expect(linesMatchShares([{ totalCents: 100, vatRate: 0.255 }], [])).toBe(true);
  });
});

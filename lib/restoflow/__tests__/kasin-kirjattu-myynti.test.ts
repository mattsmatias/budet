import { describe, expect, it } from "vitest";
import {
  commonVatRate,
  defaultSalesGroup,
  lineFromNet,
  type SalesGroup,
} from "../sales-vat";

/*
 * Käsin kirjatun päivän verokanta.
 *
 * MIKSI TÄMÄ ON OMA TESTINSÄ.
 *
 * Yhden luvun päivä jäi ennen kokonaan kirjanpidon ulkopuolelle.
 * Korjaus päättelee veron yrityksen ainoasta verokannasta — ja juuri
 * siksi rajan on oltava tarkka: yksi kanta saa päätellä, useampi ei
 * saa arvata. Väärä arvaus menisi kirjanpitoon ja ALV-ilmoitukseen.
 */

function ryhma(extra: Partial<SalesGroup> & { vatRate: number }): SalesGroup {
  return {
    id: extra.id ?? "a",
    name: extra.name ?? "Ryhmä",
    active: true,
    isDefault: false,
    sortOrder: 0,
    ...extra,
  };
}

describe("commonVatRate", () => {
  it("parturin kaksi ryhmää samalla kannalla päätellään", () => {
    const rate = commonVatRate([
      ryhma({ id: "p", name: "Palvelumyynti", vatRate: 0.255, isDefault: true }),
      ryhma({ id: "t", name: "Tuotemyynti", vatRate: 0.255 }),
    ]);

    expect(rate).toBe(0.255);
  });

  it("ravintolan eri kannat eivät päättele mitään", () => {
    const rate = commonVatRate([
      ryhma({ id: "r", name: "Ravintolamyynti", vatRate: 0.135, isDefault: true }),
      ryhma({ id: "a", name: "Alkoholimyynti", vatRate: 0.255 }),
    ]);

    expect(rate).toBeNull();
  });

  it("käytöstä poistettu ryhmä ei estä päättelyä", () => {
    const rate = commonVatRate([
      ryhma({ id: "p", name: "Palvelumyynti", vatRate: 0.255, isDefault: true }),
      ryhma({ id: "v", name: "Vanha kanta", vatRate: 0.24, active: false }),
    ]);

    expect(rate).toBe(0.255);
  });

  it("ilman ryhmiä ei päätellä", () => {
    expect(commonVatRate([])).toBeNull();
    expect(commonVatRate([ryhma({ vatRate: 0.255, active: false })])).toBeNull();
  });
});

describe("defaultSalesGroup", () => {
  it("oletusryhmä voittaa järjestyksen", () => {
    const groups = [
      ryhma({ id: "t", name: "Tuotemyynti", vatRate: 0.255, sortOrder: 1 }),
      ryhma({
        id: "p",
        name: "Palvelumyynti",
        vatRate: 0.255,
        isDefault: true,
        sortOrder: 0,
      }),
    ];

    expect(defaultSalesGroup(groups)?.id).toBe("p");
  });

  it("ilman oletusta otetaan ensimmäinen käytössä oleva", () => {
    const groups = [
      ryhma({ id: "vanha", vatRate: 0.24, active: false }),
      ryhma({ id: "uusi", vatRate: 0.255 }),
    ];

    expect(defaultSalesGroup(groups)?.id).toBe("uusi");
    expect(defaultSalesGroup([])).toBeNull();
  });
});

describe("lineFromNet", () => {
  it("laskee veron verottomasta summasta", () => {
    /* 420,00 € × 25,5 % = 107,10 € → brutto 527,10 € */
    const line = lineFromNet(42000, 0.255);

    expect(line.netCents).toBe(42000);
    expect(line.vatCents).toBe(10710);
    expect(line.grossCents).toBe(52710);
  });

  it("brutto on aina veroton plus vero", () => {
    for (const net of [1, 7, 333, 99999, 1234567]) {
      const line = lineFromNet(net, 0.255);
      expect(line.grossCents).toBe(line.netCents + line.vatCents);
    }
  });
});

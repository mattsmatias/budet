import { describe, expect, it } from "vitest";
import {
  netFromGross,
  parseAmountToCents,
  roundHalfUp,
  vatFromGross,
  vatFromNet,
} from "../money";

describe("roundHalfUp", () => {
  it("pyöristää puolikkaat ylöspäin", () => {
    expect(roundHalfUp(0.5)).toBe(1);
    expect(roundHalfUp(1.5)).toBe(2);
    expect(roundHalfUp(2.5)).toBe(3);
  });

  it("kohtelee negatiivisia itseisarvon mukaan", () => {
    expect(roundHalfUp(-0.5)).toBe(-1);
    expect(roundHalfUp(-1.5)).toBe(-2);
  });
});

describe("vatFromNet", () => {
  it("laskee ALV:n verottomasta summasta", () => {
    // 4 536,30 € 13,5 %:n kannalla
    expect(vatFromNet(453630, 0.135)).toBe(61240);
  });

  it("laskee yleisen kannan", () => {
    expect(vatFromNet(72235, 0.255)).toBe(18420);
  });

  it("palauttaa nollan nollakannalla", () => {
    expect(vatFromNet(100000, 0)).toBe(0);
  });

  it("hylkää liukuluvut senttiargumentissa", () => {
    expect(() => vatFromNet(100.5, 0.255)).toThrow(TypeError);
  });

  it("hylkää verokannan joka on annettu prosentteina", () => {
    expect(() => vatFromNet(10000, 25.5)).toThrow(RangeError);
  });
});

describe("vatFromGross", () => {
  it("erottaa ALV:n verollisesta summasta", () => {
    // 124,00 € sisältää 25,5 %: 12400 × 0,255 ÷ 1,255 = 2519,52 → 2520
    expect(vatFromGross(12400, 0.255)).toBe(2520);
  });

  it("net + vat palautuu bruttoon", () => {
    const gross = 12400;
    const vat = vatFromGross(gross, 0.255);
    expect(netFromGross(gross, 0.255) + vat).toBe(gross);
  });
});

describe("parseAmountToCents", () => {
  it("hyväksyy pilkun desimaalierottimena", () => {
    expect(parseAmountToCents("45,36")).toBe(4536);
  });

  it("hyväksyy välilyönnit tuhaterottimena", () => {
    expect(parseAmountToCents("4 536,30")).toBe(453630);
  });

  it("hylkää roskan", () => {
    expect(parseAmountToCents("noin sata")).toBeNull();
    expect(parseAmountToCents("12,345")).toBeNull();
  });
});

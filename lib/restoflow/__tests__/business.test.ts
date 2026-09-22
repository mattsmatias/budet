import { describe, expect, it } from "vitest";
import {
  BUSINESS_TYPES,
  businessDescription,
  categoriesFor,
  categoriesWith,
  categoryOptions,
  isBusinessType,
  withBusiness,
} from "../business";
import { labels } from "@/lib/i18n/labels";
import { CATEGORY_ORDER, EXPECTED_VAT_RATES } from "../types";

/*
 * Toimialat.
 *
 * Toimiala rajaa mitä uudelle kuitille tarjotaan. Se ei saa hävittää
 * vanhan kuitin kategoriaa näkyvistä eikä päästää valikkoon kategoriaa,
 * jota ei ole olemassa.
 */

describe("categoriesFor", () => {
  it("antaa parturille hoitotuotteet eikä ruokaa tai alkoholia", () => {
    const barber = categoriesFor("barber");
    expect(barber).toContain("products");
    expect(barber).not.toContain("food");
    expect(barber).not.toContain("alcohol");
    expect(barber).not.toContain("kitchen_supplies");
  });

  it("antaa kahvilalle ruoan mutta ei alkoholia", () => {
    const cafe = categoriesFor("cafe");
    expect(cafe).toContain("food");
    expect(cafe).toContain("soft_drinks");
    expect(cafe).not.toContain("alcohol");
  });

  it("pitää ravintolan nykyiset kategoriat", () => {
    const restaurant = categoriesFor("restaurant");
    for (const c of [
      "food",
      "alcohol",
      "soft_drinks",
      "kitchen_supplies",
      "packaging",
      "cleaning",
      "transport",
      "staff",
      "other",
    ] as const) {
      expect(restaurant).toContain(c);
    }
  });

  it("antaa jokaiselle toimialalle henkilöstön, vuokran ja muut kulut", () => {
    for (const type of BUSINESS_TYPES) {
      const list = categoriesFor(type);
      expect(list).toContain("staff");
      expect(list).toContain("rent");
      expect(list).toContain("other");
    }
  });

  it("käyttää vain olemassa olevia kategorioita, joilla on ALV-odotus", () => {
    for (const type of BUSINESS_TYPES) {
      for (const c of categoriesFor(type)) {
        expect(CATEGORY_ORDER).toContain(c);
        expect(EXPECTED_VAT_RATES[c].length).toBeGreaterThan(0);
      }
    }
  });
});

describe("categoriesWith ja categoryOptions", () => {
  it("näyttää vanhan kuitin kategorian vaikka toimiala ei sitä tarjoa", () => {
    expect(categoriesWith("barber", "food")).toContain("food");
    expect(categoriesWith("barber", "products")).toEqual(categoriesFor("barber"));
  });

  it("rakentaa valikon toimialan kategorioista", () => {
    const nimet = withBusiness(labels("fi"), "barber");
    const options = categoryOptions(nimet);
    expect(options.map(([key]) => key)).toEqual(categoriesFor("barber"));
    expect(options[0][1]).toBe("Hoitotuotteet");
  });

  it("lisää nykyisen arvon valikon loppuun", () => {
    const nimet = withBusiness(labels("fi"), "cafe");
    const keys = categoryOptions(nimet, "alcohol").map(([key]) => key);
    expect(keys.at(-1)).toBe("alcohol");
  });

  it("näyttää kaikki kategoriat, jos toimialaa ei ole liitetty", () => {
    expect(categoryOptions(labels("fi"))).toHaveLength(CATEGORY_ORDER.length);
  });
});

describe("isBusinessType ja businessDescription", () => {
  it("tunnistaa vain tunnetut toimialat", () => {
    expect(isBusinessType("barber")).toBe(true);
    expect(isBusinessType("florist")).toBe(false);
    expect(isBusinessType(null)).toBe(false);
  });

  it("kuvaa toimialan tekoälylle", () => {
    expect(businessDescription("barber")).toContain("parturi");
    expect(businessDescription("cafe")).toContain("kahvila");
    expect(businessDescription("restaurant")).toBe("ravintola");
  });
});

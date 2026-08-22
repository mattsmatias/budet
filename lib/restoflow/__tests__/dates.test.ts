import { describe, expect, it } from "vitest";
import {
  ISO_DATE,
  ISO_MONTH,
  isIsoDate,
  isIsoMonth,
  isoDateOr,
  isoMonthOr,
} from "../dates";

/**
 * Nämä testit ovat olemassa yhdestä syystä.
 *
 * Kuvio oli kirjoitettu käsin kahteenkymmeneen paikkaan, ja kahdesta
 * niistä olivat kenoviivat kadonneet. /^d{4}-d{2}-d{2}$/ kääntyy ja
 * läpäisee linttauksen — se vain ei hyväksy yhtäkään päivämäärää.
 *
 * Testi joka hyväksyy oikean päivän olisi kaatunut heti.
 */

describe("päivämäärän muoto", () => {
  it("hyväksyy oikean päivän", () => {
    expect(isIsoDate("2026-08-24")).toBe(true);
    expect(isIsoDate("2026-01-01")).toBe(true);
    expect(isIsoDate("1999-12-31")).toBe(true);
  });

  // Tämä on se testi joka olisi paljastanut vian: kadonneiden
  // kenoviivojen jälkeen kuvio hyväksyy vain kirjaimet.
  it("ei hyväksy kirjaimia numeroiden tilalla", () => {
    expect(isIsoDate("dddd-dd-dd")).toBe(false);
    expect(ISO_DATE.test("dddd-dd-dd")).toBe(false);
  });

  it("hylkää muut muodot", () => {
    expect(isIsoDate("24.8.2026")).toBe(false);
    expect(isIsoDate("2026-8-4")).toBe(false);
    expect(isIsoDate("2026-08")).toBe(false);
    expect(isIsoDate("2026-08-24T12:00")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });

  it("hylkää muun kuin merkkijonon", () => {
    expect(isIsoDate(null)).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
    expect(isIsoDate(20260824)).toBe(false);
    expect(isIsoDate(["2026-08-24"])).toBe(false);
  });
});

describe("kuukauden muoto", () => {
  it("hyväksyy oikean kuukauden", () => {
    expect(isIsoMonth("2026-08")).toBe(true);
    expect(isIsoMonth("2026-12")).toBe(true);
  });

  it("ei hyväksy kirjaimia numeroiden tilalla", () => {
    expect(isIsoMonth("dddd-dd")).toBe(false);
    expect(ISO_MONTH.test("dddd-dd")).toBe(false);
  });

  it("hylkää päivämäärän ja muut muodot", () => {
    expect(isIsoMonth("2026-08-24")).toBe(false);
    expect(isIsoMonth("elokuu")).toBe(false);
    expect(isIsoMonth("2026-8")).toBe(false);
  });
});

describe("varasija", () => {
  it("palauttaa arvon kun se kelpaa", () => {
    expect(isoDateOr("2026-08-24", "2026-01-01")).toBe("2026-08-24");
    expect(isoMonthOr("2026-07", "2026-08")).toBe("2026-07");
  });

  it("palauttaa varasijan kun arvo ei kelpaa", () => {
    expect(isoDateOr("roska", "2026-01-01")).toBe("2026-01-01");
    expect(isoDateOr(undefined, "2026-01-01")).toBe("2026-01-01");
    expect(isoMonthOr(null, "2026-08")).toBe("2026-08");
  });
});

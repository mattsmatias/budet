import { describe, expect, it } from "vitest";
import {
  startOfDayIso,
  ISO_DATE,
  ISO_MONTH,
  isIsoDate,
  isIsoMonth,
  isoDateOr,
  isoMonthOr,
  pickedMonth,
  rangeForMonth,
  weekRange,
  yearRange,
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

describe("pickedMonth", () => {
  const months = ["2026-08", "2026-07", "2026-06"];

  it("näyttää osoitteessa valitun kuukauden", () => {
    expect(pickedMonth("2026-07", "2026-08", months)).toBe("2026-07");
  });

  it("näyttää kuluvan kuukauden kun valintaa ei ole", () => {
    expect(pickedMonth(null, "2026-08", months)).toBe("2026-08");
  });

  /*
   * Osoiterivin voi kirjoittaa itse. Roskan tai listan ulkopuolisen
   * kuukauden ei saa jäädä painikkeeseen näkyviin — sivu ei näytä
   * niiden lukuja, joten painike valehtelisi.
   */
  it("hylkää kelvottoman arvon", () => {
    expect(pickedMonth("2026-99", "2026-08", months)).toBe("2026-08");
    expect(pickedMonth("elokuu", "2026-08", months)).toBe("2026-08");
    expect(pickedMonth("", "2026-08", months)).toBe("2026-08");
  });

  it("hylkää listan ulkopuolisen kuukauden", () => {
    expect(pickedMonth("2019-01", "2026-08", months)).toBe("2026-08");
  });
});

describe("startOfDayIso", () => {
  /*
   * Suomen kesäaika on UTC+3.
   *
   * Paikallinen keskiyö on siis edellisen päivän 21:00 UTC. Pelkkä
   * päivämäärä suodattimena leikkaisi kolme ensimmäistä tuntia pois.
   */
  it("antaa paikallisen keskiyön kesäaikana", () => {
    expect(startOfDayIso("2026-08-26", "Europe/Helsinki")).toBe(
      "2026-08-25T21:00:00.000Z",
    );
  });

  it("antaa paikallisen keskiyön talviaikana", () => {
    // Talvella UTC+2.
    expect(startOfDayIso("2026-01-15", "Europe/Helsinki")).toBe(
      "2026-01-14T22:00:00.000Z",
    );
  });

  it("on sama hetki UTC-vyöhykkeellä", () => {
    expect(startOfDayIso("2026-08-26", "UTC")).toBe("2026-08-26T00:00:00.000Z");
  });

  it("kestää kellonsiirtoyön", () => {
    // Kesäaika alkaa 29.3.2026: kello siirtyy 03:00 → 04:00.
    expect(startOfDayIso("2026-03-29", "Europe/Helsinki")).toBe(
      "2026-03-28T22:00:00.000Z",
    );
  });
});

// ===========================================================================
// Viikko ja vuosi
// ===========================================================================

describe("weekRange", () => {
  it("antaa maanantaista sunnuntaihin", () => {
    /* 2026-09-03 on torstai. */
    expect(weekRange("2026-09-03")).toEqual({
      from: "2026-08-31",
      to: "2026-09-06",
    });
  });

  it("pitää sunnuntain saman viikon lopussa", () => {
    /*
     * Sunnuntai on viikon viimeinen päivä eikä seuraavan ensimmäinen:
     * ravintolan viikonloppu ei saa katketa kahtia.
     */
    expect(weekRange("2026-09-06")).toEqual({
      from: "2026-08-31",
      to: "2026-09-06",
    });
  });

  it("ylittää kuukauden vaihteen", () => {
    expect(weekRange("2026-09-01")).toEqual({
      from: "2026-08-31",
      to: "2026-09-06",
    });
  });
});

describe("yearRange", () => {
  it("kattaa koko vuoden", () => {
    expect(yearRange(2026)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });
});

describe("rangeForMonth", () => {
  it("antaa kuukauden sellaisenaan", () => {
    expect(rangeForMonth("kuukausi", "2026-09", "2026-09-03")).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("laskee viikon kuluvasta päivästä kun kuukausi on tämä", () => {
    expect(rangeForMonth("viikko", "2026-09", "2026-09-03")).toEqual({
      from: "2026-08-31",
      to: "2026-09-06",
    });
  });

  it("laskee viikon kuukauden lopusta kun kuukausi on mennyt", () => {
    /*
     * Menneessä kuukaudessa ei ole kuluvaa viikkoa. Kuukauden viimeinen
     * viikko on ainoa jonka valinnasta voi päätellä mitä tarkoitettiin.
     */
    expect(rangeForMonth("viikko", "2026-07", "2026-09-03")).toEqual({
      from: "2026-07-27",
      to: "2026-08-02",
    });
  });

  it("laskee vuoden kuukauden vuodesta", () => {
    expect(rangeForMonth("vuosi", "2026-07", "2026-09-03")).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });
});

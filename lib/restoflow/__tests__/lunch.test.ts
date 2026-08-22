import { describe, expect, it } from "vitest";
import {
  addDays,
  daysWithContent,
  formatWeekRange,
  hasContent,
  hasUnpublishedChanges,
  isWeekend,
  isoWeekNumber,
  nextWeek,
  previousWeek,
  weekDates,
  weekStartOf,
  weekdayName,
  weekdayShort,
  type LunchWeek,
} from "../lunch";

function week(partial: Partial<LunchWeek> = {}): LunchWeek {
  return {
    id: "m1",
    weekStart: "2026-08-24",
    weekEnd: "2026-08-30",
    status: "draft",
    publishedAt: null,
    contentUpdatedAt: "2026-08-24T10:00:00.000Z",
    days: [],
    ...partial,
  };
}

describe("viikon alku", () => {
  it("pyöristää minkä tahansa päivän maanantaihin", () => {
    expect(weekStartOf("2026-08-24")).toBe("2026-08-24"); // maanantai
    expect(weekStartOf("2026-08-26")).toBe("2026-08-24"); // keskiviikko
    expect(weekStartOf("2026-08-29")).toBe("2026-08-24"); // lauantai
  });

  /*
   * getUTCDay antaa sunnuntaille nollan. Ilman korjausta sunnuntai
   * hyppäisi seuraavan viikon maanantaihin, ja sunnuntain lounas
   * ilmestyisi väärälle viikolle.
   */
  it("pitää sunnuntain edellisessä viikossa", () => {
    expect(weekStartOf("2026-08-30")).toBe("2026-08-24");
    expect(weekStartOf("2026-08-31")).toBe("2026-08-31"); // seuraava maanantai
  });

  it("ylittää kuukauden ja vuoden vaihteen", () => {
    expect(weekStartOf("2026-09-01")).toBe("2026-08-31");
    expect(weekStartOf("2027-01-01")).toBe("2026-12-28");
  });
});

describe("viikon liikkuminen", () => {
  it("siirtyy seitsemän päivää kerrallaan", () => {
    expect(nextWeek("2026-08-24")).toBe("2026-08-31");
    expect(previousWeek("2026-08-24")).toBe("2026-08-17");
  });

  it("kestää kesäajan vaihtumisen", () => {
    // Suomessa kello siirtyy 25.10.2026. Päivä ei saa liukua.
    expect(addDays("2026-10-23", 7)).toBe("2026-10-30");
    expect(weekStartOf("2026-10-26")).toBe("2026-10-26");
  });

  it("antaa viikon seitsemän päivää järjestyksessä", () => {
    expect(weekDates("2026-08-24")).toEqual([
      "2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27",
      "2026-08-28", "2026-08-29", "2026-08-30",
    ]);
  });
});

describe("viikkonumero", () => {
  it("laskee ISO-viikon", () => {
    expect(isoWeekNumber("2026-08-24")).toBe(35);
    expect(isoWeekNumber("2026-01-05")).toBe(2);
  });

  /*
   * Vuoden ensimmäinen viikko on se johon torstai osuu. 1.1.2027 on
   * perjantai, joten se kuuluu vielä vuoden 2026 viimeiseen viikkoon.
   */
  it("hoitaa vuodenvaihteen oikein", () => {
    expect(isoWeekNumber("2027-01-01")).toBe(53);
    expect(isoWeekNumber("2026-01-01")).toBe(1);
  });
});

describe("päivien nimet", () => {
  it("nimeää viikonpäivät", () => {
    expect(weekdayName("2026-08-24")).toBe("Maanantai");
    expect(weekdayName("2026-08-30")).toBe("Sunnuntai");
    expect(weekdayShort("2026-08-28")).toBe("PE");
  });

  it("tunnistaa viikonlopun", () => {
    expect(isWeekend("2026-08-28")).toBe(false);
    expect(isWeekend("2026-08-29")).toBe(true);
    expect(isWeekend("2026-08-30")).toBe(true);
  });
});

describe("viikkoväli tekstinä", () => {
  it("kirjoittaa vuoden kerran", () => {
    expect(formatWeekRange("2026-08-24")).toBe("24.8.–30.8.2026");
  });

  // Vuodenvaihteen yli menevä viikko tarvitsee molemmat vuodet, muuten
  // se väittäisi joulukuun kuuluvan tammikuulle.
  it("kirjoittaa molemmat vuodet vuodenvaihteessa", () => {
    expect(formatWeekRange("2026-12-28")).toBe("28.12.2026–3.1.2027");
  });
});

describe("julkaisemattomat muutokset", () => {
  it("huomaa muutoksen julkaisun jälkeen", () => {
    expect(
      hasUnpublishedChanges(
        week({
          status: "published",
          publishedAt: "2026-08-22T14:32:00.000Z",
          contentUpdatedAt: "2026-08-23T09:00:00.000Z",
        }),
      ),
    ).toBe(true);
  });

  it("ei väitä muutosta kun mitään ei ole muutettu", () => {
    expect(
      hasUnpublishedChanges(
        week({
          status: "published",
          publishedAt: "2026-08-22T14:32:00.000Z",
          contentUpdatedAt: "2026-08-22T14:31:00.000Z",
        }),
      ),
    ).toBe(false);
  });

  // Luonnos on kokonaan julkaisematon. "Muutoksia julkaistuun" olisi
  // siitä väärä väite eikä hyödyllinen kehotus.
  it("ei koske luonnokseen", () => {
    expect(
      hasUnpublishedChanges(
        week({ status: "draft", contentUpdatedAt: "2026-08-23T09:00:00.000Z" }),
      ),
    ).toBe(false);
  });
});

describe("sisältö", () => {
  const withItems = week({
    days: [
      { id: "d1", date: "2026-08-24", prices: [], items: [
        { id: "i1", name: "Lohikeitto", description: null, sortOrder: 0, diets: [], allergens: [] },
      ] },
      { id: "d2", date: "2026-08-25", prices: [], items: [] },
    ],
  });

  it("tietää onko viikossa ruokia", () => {
    expect(hasContent(withItems)).toBe(true);
    expect(hasContent(week({ days: [{ id: "d", date: "2026-08-24", prices: [], items: [] }] }))).toBe(false);
  });

  // Tyhjä päivä julkisella sivulla näyttäisi siltä että ravintola on
  // kiinni, vaikka lista on vain kesken.
  it("jättää tyhjät päivät pois", () => {
    expect(daysWithContent(withItems).map((d) => d.date)).toEqual(["2026-08-24"]);
  });
});

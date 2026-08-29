import { describe, expect, it } from "vitest";
import {
  addDays,
  daysWithContent,
  formatWeekRange,
  hasContent,
  hasUnpublishedChanges,
  needsPublish,
  priceSortOrder,
  includedExtras,
  includedSentence,
  inheritedIncludes,
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
    prices: [],
    includesDessert: false,
    includesCoffee: false,
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
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
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
      {
        id: "d1",
        date: "2026-08-24",
        items: [
          {
            id: "i1",
            name: "Lohikeitto",
            description: null,
            sortOrder: 0,
            diets: [],
            allergens: [],
          },
        ],
      },
      { id: "d2", date: "2026-08-25", items: [] },
    ],
  });

  it("tietää onko viikossa ruokia", () => {
    expect(hasContent(withItems)).toBe(true);
    expect(
      hasContent(week({ days: [{ id: "d", date: "2026-08-24", items: [] }] })),
    ).toBe(false);
  });

  // Tyhjä päivä julkisella sivulla näyttäisi siltä että ravintola on
  // kiinni, vaikka lista on vain kesken.
  it("jättää tyhjät päivät pois", () => {
    expect(daysWithContent(withItems).map((d) => d.date)).toEqual([
      "2026-08-24",
    ]);
  });
});

// ---------------------------------------------------------------------------

describe("mitä hintaan sisältyy", () => {
  it("luettelee molemmat", () => {
    expect(
      includedSentence({ includesDessert: true, includesCoffee: true }),
    ).toBe("Hintaan sisältyy jälkiruoka ja kahvi.");
  });

  it("luettelee vain sen mikä sisältyy", () => {
    expect(
      includedSentence({ includesDessert: false, includesCoffee: true }),
    ).toBe("Hintaan sisältyy kahvi.");

    expect(
      includedSentence({ includesDessert: true, includesCoffee: false }),
    ).toBe("Hintaan sisältyy jälkiruoka.");
  });

  /*
   * Tyhjä lause olisi "Hintaan sisältyy." — kielioppivirhe joka näyttää
   * puuttuvalta tiedolta. Null tarkoittaa ettei riviä näytetä.
   */
  it("ei tuota tyhjää lausetta", () => {
    expect(
      includedSentence({ includesDessert: false, includesCoffee: false }),
    ).toBeNull();
  });

  it("antaa myös pelkän listan", () => {
    expect(
      includedExtras({ includesDessert: true, includesCoffee: false }),
    ).toEqual(["jälkiruoka"]);

    expect(
      includedExtras({ includesDessert: false, includesCoffee: false }),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

/**
 * Periytyminen.
 *
 * Tämä oli aluksi mallin vastuulla: kehote pyysi sitä perimään
 * asetuksen edelliseltä viikolta. Elävä testi paljasti että se
 * muisti sen joskus ja joskus ei.
 *
 * Periminen on datan kopioimista, ei harkintaa. Sääntö joka pätee
 * aina on parempi kuin malli joka useimmiten muistaa.
 */
describe("jälkiruoan ja kahvin periytyminen", () => {
  it("perii edelliseltä viikolta kun mitään ei ole sanottu", () => {
    expect(
      inheritedIncludes({}, { includesDessert: false, includesCoffee: true }),
    ).toEqual({ includesDessert: false, includesCoffee: true });
  });

  // Nimenomainen valinta voittaa perinnön. Kun käyttäjä sanoo "ei
  // kahvia", sitä ei kumota edellisellä viikolla.
  it("antaa nimenomaisen valinnan voittaa", () => {
    expect(
      inheritedIncludes(
        { includesCoffee: false },
        { includesDessert: true, includesCoffee: true },
      ),
    ).toEqual({ includesDessert: true, includesCoffee: false });
  });

  it("perii vain sen mitä ei ole sanottu", () => {
    expect(
      inheritedIncludes(
        { includesDessert: true },
        { includesDessert: false, includesCoffee: true },
      ),
    ).toEqual({ includesDessert: true, includesCoffee: true });
  });

  // Ensimmäinen viikko: ei perittävää eikä keksittävää.
  it("jättää molemmat pois kun edellistä viikkoa ei ole", () => {
    expect(inheritedIncludes({}, null)).toEqual({
      includesDessert: false,
      includesCoffee: false,
    });
  });

  it("toimii ilman edellistä viikkoa kun valinta on annettu", () => {
    expect(inheritedIncludes({ includesCoffee: true }, null)).toEqual({
      includesDessert: false,
      includesCoffee: true,
    });
  });
});

// ---------------------------------------------------------------------------

/**
 * Julkaisupainikkeen näkyvyys.
 *
 * Painike näkyi aina kun viikossa oli ruokaa — myös julkaistulla
 * viikolla johon ei ollut koskettu. Se lupasi muutosta jota ei ollut,
 * ja sai luulemaan että jotain on tallentamatta.
 */
describe("onko julkaistavaa", () => {
  const ruoka = {
    id: "d1",
    date: "2026-08-24",
    items: [
      {
        id: "i1",
        name: "Lohikeitto",
        description: null,
        sortOrder: 0,
        diets: [],
        allergens: [],
      },
    ],
  };

  it("luonnos jossa on ruokaa on julkaistava", () => {
    expect(needsPublish(week({ status: "draft", days: [ruoka] }))).toBe(true);
  });

  it("tyhjää luonnosta ei julkaista", () => {
    expect(needsPublish(week({ status: "draft", days: [] }))).toBe(false);
  });

  // Tämä on se vika jonka takia painike oli aina näkyvissä.
  it("julkaistu ilman muutoksia ei tarvitse painiketta", () => {
    expect(
      needsPublish(
        week({
          status: "published",
          days: [ruoka],
          publishedAt: "2026-08-24T12:00:00.000Z",
          contentUpdatedAt: "2026-08-24T11:59:00.000Z",
        }),
      ),
    ).toBe(false);
  });

  it("julkaistu jossa on muutoksia on julkaistava", () => {
    expect(
      needsPublish(
        week({
          status: "published",
          days: [ruoka],
          publishedAt: "2026-08-24T12:00:00.000Z",
          contentUpdatedAt: "2026-08-24T12:05:00.000Z",
        }),
      ),
    ).toBe(true);
  });

  it("arkistoitua ei julkaista uudelleen", () => {
    expect(
      needsPublish(
        week({
          status: "archived",
          days: [ruoka],
          publishedAt: "2026-08-24T12:00:00.000Z",
          contentUpdatedAt: "2026-08-24T12:05:00.000Z",
        }),
      ),
    ).toBe(false);
  });

  it("olematon viikko ei ole julkaistava", () => {
    expect(needsPublish(null)).toBe(false);
  });
});

describe("hintojen järjestys", () => {
  it("pitää täyden hinnan ensimmäisenä", () => {
    expect(priceSortOrder("Lounas")).toBe(0);
  });

  // Aakkosjärjestys olisi nostanut eläkeläishinnan ensimmäiseksi.
  it("järjestää alennukset hinnaston mukaan eikä aakkosittain", () => {
    expect(priceSortOrder("Opiskelija")).toBeLessThan(priceSortOrder("Lapsi"));
    expect(priceSortOrder("Lapsi")).toBeLessThan(priceSortOrder("Eläkeläinen"));
  });

  it("siirtää oman hinnan loppuun", () => {
    expect(priceSortOrder("Annos mukaan")).toBeGreaterThan(
      priceSortOrder("Eläkeläinen"),
    );
  });
});

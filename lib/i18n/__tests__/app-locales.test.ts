import { describe, expect, it } from "vitest";
import {
  APP_LOCALES,
  DEFAULT_APP_LOCALE,
  LOCALE_INFO,
  isAppLocale,
  isRtl,
  localesForMenu,
  matchBrowserLocale,
} from "../app-locales";
import { date, decimal, money, percent } from "../format";

describe("kielirekisteri", () => {
  it("sisältää kolmekymmentä kieltä", () => {
    expect(APP_LOCALES).toHaveLength(30);
    expect(new Set(APP_LOCALES).size).toBe(30);
  });

  it("kuvailee jokaisen kielen", () => {
    for (const code of APP_LOCALES) {
      const info = LOCALE_INFO[code];
      expect(info?.name, code).toBeTruthy();
      expect(info.dir, code).toMatch(/^(ltr|rtl)$/);
      expect(info.tag, code).toBeTruthy();
    }
  });

  /*
   * Intl on lopullinen tuomari: keksitty tunniste kaatuisi vasta
   * ajossa, ja silloin näkymä olisi jo rikki.
   */
  it("antaa Intlin hyväksymät tunnisteet", () => {
    for (const code of APP_LOCALES) {
      expect(
        () => new Intl.NumberFormat(LOCALE_INFO[code].tag),
        `${code}: ${LOCALE_INFO[code].tag}`,
      ).not.toThrow();
    }
  });

  it("merkitsee arabian ja heprean oikealta vasemmalle", () => {
    expect(isRtl("ar")).toBe(true);
    expect(isRtl("he")).toBe(true);
    expect(isRtl("fi")).toBe(false);
    expect(isRtl("ja")).toBe(false);
  });

  it("tunnistaa kelvollisen ja hylkää kelvottoman", () => {
    expect(isAppLocale("tr")).toBe(true);
    expect(isAppLocale("zh-CN")).toBe(true);
    expect(isAppLocale("klingon")).toBe(false);
    expect(isAppLocale(null)).toBe(false);
  });
});

describe("valikon järjestys", () => {
  it("pitää oletuskielen ensimmäisenä", () => {
    expect(localesForMenu()[0].code).toBe(DEFAULT_APP_LOCALE);
  });

  it("sisältää kaikki kielet kerran", () => {
    const menu = localesForMenu();
    expect(menu).toHaveLength(30);
    expect(new Set(menu.map((l) => l.code)).size).toBe(30);
  });
});

/*
 * Accept-Language on selaimen toive eikä komento. Näiden tapausten
 * pitää osua, koska ne ovat ne joita oikeasti tulee.
 */
describe("selaimen kielitoive", () => {
  it("ottaa tarkan osuman", () => {
    expect(matchBrowserLocale("tr-TR,tr;q=0.9")).toBe("tr");
  });

  it("noudattaa laatupainoja eikä järjestystä", () => {
    expect(matchBrowserLocale("xx;q=0.5,de;q=0.9")).toBe("de");
  });

  it("pudottaa tuntemattoman alueen peruskieleen", () => {
    expect(matchBrowserLocale("de-AT")).toBe("de");
    expect(matchBrowserLocale("pt-PT")).toBe("pt");
  });

  it("säilyttää omat alueelliset kielensä", () => {
    expect(matchBrowserLocale("pt-BR")).toBe("pt-BR");
    expect(matchBrowserLocale("zh-CN")).toBe("zh-CN");
  });

  // "zh" yksin on yleisin tapa pyytää kiinaa.
  it("ohjaa kiinan yksinkertaistettuun", () => {
    expect(matchBrowserLocale("zh")).toBe("zh-CN");
    expect(matchBrowserLocale("zh-TW")).toBe("zh-CN");
  });

  it("palauttaa nullin kun mikään ei osu", () => {
    expect(matchBrowserLocale("xx,yy")).toBeNull();
    expect(matchBrowserLocale(null)).toBeNull();
  });
});

/**
 * Muotoilu.
 *
 * Testataan rakenne eikä tarkkaa merkkijonoa: erotinmerkit ovat
 * Intlin ja käyttöjärjestelmän tietokannan asia, ja niiden
 * kiinnittäminen tekisi testistä sen joka rikkoutuu kun Node
 * päivittyy.
 */
describe("locale-muotoilu", () => {
  it("käyttää kielen omaa desimaalierotinta", () => {
    expect(money(284550, "fi")).toContain(",");
    expect(money(284550, "en")).toContain(".");
  });

  it("näyttää valuutan jokaisella kielellä", () => {
    for (const code of APP_LOCALES) {
      const out = money(284550, code);
      expect(out, code).toMatch(/\d/);
      expect(out.length, code).toBeGreaterThan(3);
    }
  });

  it("muotoilee päivän ilman aikavyöhykesiirtymää", () => {
    // Keskiyö UTC:ssä siirtyisi edelliseen päivään lännessä.
    for (const code of APP_LOCALES) {
      expect(date("2026-08-28", code), code).toMatch(/28|٢٨|28日/);
    }
  });

  it("laskee prosentin osuudesta eikä valmiista luvusta", () => {
    expect(percent(0.255, "fi")).toContain("25,5");
    expect(percent(0.255, "en")).toContain("25.5");
  });

  it("antaa desimaalit pyydetyllä tarkkuudella", () => {
    expect(decimal(7.25, "en", 1)).toBe("7.3");
    expect(decimal(7.25, "en", 0)).toBe("7");
  });
});

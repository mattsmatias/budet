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
import { LOCALES, LOCALE_NAMES, LOCALE_TAGS } from "../locales";
import { date, decimal, money, percent } from "../format";

describe("kielirekisteri", () => {
  /*
   * Tämä on koko tiedoston tärkein testi.
   *
   * Sovelluksessa oli oma kolmenkymmenen kielen luettelo ja julkisilla
   * sivuilla kuuden. Ne olivat jo ehtineet erota: virosta oli sivu
   * muttei valintaa sovelluksessa. Nyt lista on johdettu, ja tämä
   * kaatuu jos joku palauttaa kopion.
   */
  it("on sama lista kuin julkisilla sivuilla", () => {
    expect(APP_LOCALES).toBe(LOCALES);
  });

  it("kuvailee jokaisen kielen", () => {
    for (const code of APP_LOCALES) {
      const info = LOCALE_INFO[code];
      expect(info?.name, code).toBe(LOCALE_NAMES[code]);
      expect(info.tag, code).toBe(LOCALE_TAGS[code]);
      expect(info.dir, code).toMatch(/^(ltr|rtl)$/);
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

  /*
   * Kaikki kuusi kirjoitetaan vasemmalta oikealle. Testi on silti
   * olemassa: jos joku lisää arabian eikä merkitse sitä RTL-joukkoon,
   * tämä ei huomaa sitä — mutta jos joku rikkoo isRtl-funktion, huomaa.
   */
  it("ei merkitse yhtäkään nykyistä kieltä oikealta vasemmalle", () => {
    for (const code of APP_LOCALES) {
      expect(isRtl(code), code).toBe(false);
    }
  });

  it("tunnistaa kelvollisen ja hylkää kelvottoman", () => {
    expect(isAppLocale("tr")).toBe(true);
    expect(isAppLocale("et")).toBe(true);
    // Poistettu kieli ei saa kelvata: valinta jäisi näkymään mutta
    // mikään ei kääntyisi.
    expect(isAppLocale("de")).toBe(false);
    expect(isAppLocale("zh-CN")).toBe(false);
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
    expect(menu).toHaveLength(APP_LOCALES.length);
    expect(new Set(menu.map((l) => l.code)).size).toBe(APP_LOCALES.length);
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
    expect(matchBrowserLocale("xx;q=0.5,sv;q=0.9")).toBe("sv");
  });

  it("pudottaa tuntemattoman alueen peruskieleen", () => {
    expect(matchBrowserLocale("sv-FI")).toBe("sv");
    expect(matchBrowserLocale("et-EE")).toBe("et");
  });

  it("palauttaa nullin kun kieltä ei enää tueta", () => {
    expect(matchBrowserLocale("de-AT")).toBeNull();
    expect(matchBrowserLocale("ja")).toBeNull();
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
      expect(date("2026-08-28", code), code).toContain("28");
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

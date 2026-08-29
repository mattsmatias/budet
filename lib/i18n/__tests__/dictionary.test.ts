import { describe, expect, it } from "vitest";
import { dictionary } from "../dictionary";
import { LOCALES, LOCALE_NAMES, aboutSlug, pathFor } from "../locales";

/**
 * Käännösten tarkistukset.
 *
 * Tyyppijärjestelmä takaa jo että jokaisella kielellä on jokainen
 * avain. Nämä testit koskevat sitä mitä tyyppi ei näe: onko arvo
 * tyhjä, onko se jäänyt kääntämättä, ja mahtuuko se siihen paikkaan
 * johon se piirretään.
 */

const dicts = LOCALES.map((locale) => [locale, dictionary(locale)] as const);

function everyString(d: ReturnType<typeof dictionary>): [string, string][] {
  const out: [string, string][] = [];
  for (const [section, values] of Object.entries(d)) {
    for (const [key, value] of Object.entries(values)) {
      out.push([`${section}.${key}`, value]);
    }
  }
  return out;
}

describe("jokainen kieli on täydellinen", () => {
  it.each(dicts)("%s ei sisällä tyhjiä arvoja", (_locale, d) => {
    for (const [path, value] of everyString(d)) {
      expect(value.trim(), path).not.toBe("");
    }
  });

  it("kaikilla kielillä on samat avaimet", () => {
    const reference = everyString(dictionary("fi"))
      .map(([path]) => path)
      .sort();

    for (const [locale, d] of dicts) {
      const keys = everyString(d)
        .map(([path]) => path)
        .sort();
      expect(keys, locale).toEqual(reference);
    }
  });
});

/**
 * Kääntämättä jäänyt teksti.
 *
 * Kopioitu suomenkielinen arvo menee tyypintarkistuksesta läpi, koska
 * se on merkkijono. Nämä sanat esiintyvät suomen käännöksissä eivätkä
 * kuulu muihin kieliin — jos sellainen löytyy, rivi on jäänyt
 * kääntämättä.
 *
 * Tuotenimi Kate ja avustajan nimi Matti ovat erikseen sallittuja:
 * ne ovat nimiä eivätkä käännettävää tekstiä.
 */
describe("mikään ei ole jäänyt suomeksi", () => {
  const finnishOnly = [
    "ravintolan",
    "kuitit",
    "kirjanpito",
    "yhdessä",
    "paikassa",
    "kuukausi",
    "myynti",
    "veroasiat",
  ];

  it.each(dicts.filter(([locale]) => locale !== "fi"))(
    "%s ei sisällä suomenkielisiä sanoja",
    (_locale, d) => {
      for (const [path, value] of everyString(d)) {
        const lower = value.toLowerCase();
        for (const word of finnishOnly) {
          expect(lower.includes(word), `${path}: "${value}"`).toBe(false);
        }
      }
    },
  );
});

/**
 * Pituusrajat.
 *
 * KORTTI EI VENY.
 *
 * Ruudukon otsikot ja pillerit piirretään kiinteän levyisiin
 * paikkoihin. Suomeksi yhden sanan mittainen otsikko voi olla
 * turkiksi kolme, ja liian pitkä teksti joko katkeaa tai repii rivin
 * korkeammaksi kuin naapurit.
 *
 * Rajat on mitattu käyttöliittymästä eikä arvattu: ne ovat se pituus
 * jolla teksti vielä mahtuu kapeimmalle riville jolla se esiintyy.
 */
describe("käännökset mahtuvat käyttöliittymään", () => {
  const limits: { path: string; max: number }[] = [
    // Ominaisuusruudukon otsikot: neljä saraketta leveällä ruudulla.
    { path: "features.receipts", max: 26 },
    { path: "features.expenses", max: 26 },
    { path: "features.sales", max: 26 },
    { path: "features.till", max: 26 },
    { path: "features.ledger", max: 26 },
    { path: "features.vat", max: 26 },
    { path: "features.reports", max: 26 },
    { path: "features.staff", max: 26 },
    // Vuokaavion askeleet: viisi vierekkäin.
    { path: "flow.step1", max: 22 },
    { path: "flow.step2", max: 22 },
    { path: "flow.step3", max: 22 },
    { path: "flow.step4", max: 22 },
    { path: "flow.step5", max: 22 },
    { path: "flow.step1Note", max: 26 },
    { path: "flow.step2Note", max: 26 },
    { path: "flow.step3Note", max: 26 },
    { path: "flow.step4Note", max: 26 },
    { path: "flow.step5Note", max: 26 },
    // Esikatselun avainluvut ja pillerit.
    { path: "preview.sales", max: 16 },
    { path: "preview.expenses", max: 16 },
    { path: "preview.result", max: 16 },
    { path: "preview.receipts", max: 16 },
    { path: "preview.vat", max: 16 },
    { path: "preview.synced", max: 34 },
    { path: "preview.ready", max: 34 },
    // Navigaatio: neljä linkkiä, kielivalitsin ja kaksi painiketta.
    { path: "nav.product", max: 18 },
    { path: "nav.features", max: 18 },
    { path: "nav.pricing", max: 18 },
    { path: "nav.about", max: 18 },
    { path: "nav.login", max: 18 },
    { path: "nav.start", max: 24 },
    { path: "nav.openApp", max: 20 },
    // Hinnoittelun rasti-lista: kaksi saraketta kapeassa kortissa.
    { path: "pricing.incReceipts", max: 24 },
    { path: "pricing.incExpenses", max: 24 },
    { path: "pricing.incSales", max: 24 },
    { path: "pricing.incLedger", max: 24 },
    { path: "pricing.incVat", max: 24 },
    { path: "pricing.incReports", max: 24 },
    { path: "pricing.incStaff", max: 24 },
    { path: "pricing.incAssistant", max: 24 },
    { path: "pricing.perMonth", max: 12 },
  ];

  it.each(dicts)("%s pysyy mitoissa", (_locale, d) => {
    const values = new Map(everyString(d));

    for (const { path, max } of limits) {
      const value = values.get(path);
      expect(value, path).toBeDefined();
      expect(value!.length, `${path}: "${value}"`).toBeLessThanOrEqual(max);
    }
  });
});

describe("osoitteet", () => {
  it("suomi on juuressa ilman etuliitettä", () => {
    expect(pathFor("fi", "home")).toBe("/");
    expect(pathFor("fi", "about")).toBe("/meista");
  });

  it("muilla kielillä on oma etuliite", () => {
    for (const locale of LOCALES) {
      if (locale === "fi") continue;
      expect(pathFor(locale, "home")).toBe(`/${locale}`);
      expect(pathFor(locale, "about")).toMatch(new RegExp(`^/${locale}/`));
    }
  });

  /*
   * Osoite on osa käännöstä: /sv/about olisi ruotsinkielinen sivu
   * englanninkielisessä osoitteessa.
   */
  it("antaa jokaiselle kielelle oman tunnuksen", () => {
    const slugs = LOCALES.map(aboutSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("nimeää kielen sen omalla kielellä", () => {
    expect(LOCALE_NAMES.tr).toBe("Türkçe");
    expect(LOCALE_NAMES.et).toBe("Eesti");
    expect(LOCALE_NAMES.sv).toBe("Svenska");
  });
});

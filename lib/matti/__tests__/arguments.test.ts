import { describe, expect, it } from "vitest";
import { TOOLS, findTool } from "../tools";

/**
 * Ehdotuksen argumentit ja niiden hyväksyntä.
 *
 * Tämä tiedosto on olemassa yhden tuotantovirheen takia.
 *
 * Matti ehdotti viikon lounaslistaa, ehdotus näkyi käyttäjälle
 * oikein, ja Hyväksy kaatui virheeseen "En saanut muutosta tehtyä".
 * Syy: hyväksyntäpolulla oli käsin kirjoitettu kopio työkalun
 * skeemasta, ja kopion päivämääräkuviosta olivat kenoviivat
 * kadonneet. Ehdotus validoitui ehjällä skeemalla, hyväksyntä
 * rikkinäisellä.
 *
 * Nyt hyväksyntä käyttää työkalun omaa skeemaa. Nämä testit
 * varmistavat että skeema hyväksyy sen minkä se itse tuotti.
 */

/** Kuten malli sen antaa: viisi päivää, kolme ruokaa kussakin. */
const VIIKKO = {
  days: [
    { date: "2026-08-24", items: [{ name: "Juureskeitto" }, { name: "Lihapullat ja muusi" }] },
    { date: "2026-08-25", items: [{ name: "Tomaatti-basilikakeitto" }] },
    { date: "2026-08-26", items: [{ name: "Kanakeitto" }, { name: "Broilerpasta" }] },
    { date: "2026-08-27", items: [{ name: "Hernekeitto" }] },
    { date: "2026-08-28", items: [{ name: "Kalakeitto" }] },
  ],
  replace: true,
};

describe("lounaslistan argumentit", () => {
  /*
   * Tämä on se testi joka olisi estänyt virheen. Se ajaa täsmälleen
   * sen aineiston jonka hyväksyntä hylkäsi tuotannossa.
   */
  it("hyväksyy viikon jonka malli tuotti", () => {
    const tool = findTool("propose_lunch_items")!;
    const result = tool.schema.safeParse(VIIKKO);

    expect(result.success).toBe(true);
  });

  it("hyväksyy myös yhden päivän", () => {
    const tool = findTool("propose_lunch_items")!;

    expect(
      tool.schema.safeParse({
        days: [{ date: "2026-08-24", priceEuros: 15.5, items: [{ name: "Lohikeitto" }] }],
      }).success,
    ).toBe(true);
  });

  it("hyväksyy ruokavaliot ja allergeenit", () => {
    const tool = findTool("propose_lunch_items")!;

    expect(
      tool.schema.safeParse({
        days: [
          {
            date: "2026-08-24",
            items: [
              {
                name: "Kasvislasagne",
                description: "Kesäkurpitsaa ja pinaattia",
                diets: ["vegetarian"],
                allergens: ["gluten", "milk"],
              },
            ],
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("hylkää päivän väärässä muodossa", () => {
    const tool = findTool("propose_lunch_items")!;

    expect(
      tool.schema.safeParse({
        days: [{ date: "24.8.2026", items: [{ name: "Lohikeitto" }] }],
      }).success,
    ).toBe(false);
  });

  it("hylkää päivän ilman ruokia", () => {
    const tool = findTool("propose_lunch_items")!;

    expect(tool.schema.safeParse({ days: [{ date: "2026-08-24", items: [] }] }).success).toBe(
      false,
    );
  });
});

/*
 * Yleinen suoja: jokaisen kirjoittavan työkalun skeeman on hyväksyttävä
 * ainakin yksi kelvollinen esimerkki. Skeema jota mikään ei läpäise on
 * ominaisuus jota ei voi käyttää — ja juuri sellainen tämä oli.
 */
describe("kirjoittavien työkalujen skeemat", () => {
  const NAYTTEET: Record<string, unknown> = {
    propose_lunch_items: VIIKKO,
    propose_lunch_price: { date: "2026-08-24", euros: 16.5 },
    propose_copy_lunch_week: {
      fromWeekStart: "2026-08-17",
      toWeekStart: "2026-08-24",
    },
    propose_publish_lunch_week: { weekStart: "2026-08-24" },
  };

  it("hyväksyy kelvollisen esimerkin jokaiselle", () => {
    for (const tool of TOOLS.filter((t) => t.level === "write")) {
      const sample = NAYTTEET[tool.name];

      // Uusi kirjoittava työkalu ilman näytettä jää tähän kiinni.
      expect(sample, `puuttuva näyte: ${tool.name}`).toBeDefined();
      expect(
        tool.schema.safeParse(sample).success,
        `skeema hylkäsi näytteen: ${tool.name}`,
      ).toBe(true);
    }
  });
});

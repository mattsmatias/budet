import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/money";
import {
  daysWithFood,
  shortDiets,
  usedDietLegend,
  weekAsText,
  type PublicWeek,
} from "../public-lunch";

function week(partial: Partial<PublicWeek> = {}): PublicWeek {
  return {
    restaurantName: "Cafe Monami",
    theme: "light",
    weekStart: "2026-08-24",
    published: true,
    prices: [{ name: "Lounas", cents: 1550 }],
    includesDessert: false,
    includesCoffee: true,
    days: [
      {
        date: "2026-08-24",
        items: [
          {
            name: "Juureskeitto",
            description: "Kermainen",
            diets: [
              { label: "Vegaaninen", short: "VE" },
              { label: "Gluteeniton", short: "G" },
            ],
            allergens: ["Selleri"],
          },
          {
            name: "Lihapullat",
            description: null,
            diets: [],
            allergens: ["Gluteeni", "Maito"],
          },
        ],
      },
      { date: "2026-08-25", items: [] },
    ],
    ...partial,
  };
}

describe("päivien suodatus", () => {
  // Tyhjä päivä näyttäisi siltä että ravintola on kiinni.
  it("jättää ruoattomat päivät pois", () => {
    expect(daysWithFood(week()).map((d) => d.date)).toEqual(["2026-08-24"]);
  });
});

describe("ruokavaliolyhenteet", () => {
  it("poimii lyhenteet", () => {
    expect(
      shortDiets([
        { label: "Vegaaninen", short: "VE" },
        { label: "Gluteeniton", short: "G" },
      ]),
    ).toEqual(["VE", "G"]);
  });

  // Lyhenteetön ruokavalio jätetään pois merkinnöistä: tyhjä väli
  // nimen perässä näyttäisi kirjoitusvirheeltä.
  it("ohittaa lyhenteettömän", () => {
    expect(
      shortDiets([
        { label: "Vegaaninen", short: "VE" },
        { label: "Erikoisruokavalio", short: null },
      ]),
    ).toEqual(["VE"]);
  });
});

describe("selite", () => {
  it("listaa vain käytetyt lyhenteet", () => {
    const legend = usedDietLegend(daysWithFood(week()));

    expect([...legend]).toEqual([
      ["VE", "Vegaaninen"],
      ["G", "Gluteeniton"],
    ]);
  });

  it("on tyhjä kun merkintöjä ei ole", () => {
    const bare = week({
      days: [
        {
          date: "2026-08-24",
          items: [
            { name: "Keitto", description: null, diets: [], allergens: [] },
          ],
        },
      ],
    });

    expect(usedDietLegend(daysWithFood(bare)).size).toBe(0);
  });
});

describe("lista tekstinä", () => {
  const text = weekAsText(week(), "https://budet.fi/lounas/cafe-monami", "fi");

  /*
   * Hinta verrataan samalla muotoilijalla jolla se tuotetaan.
   *
   * Kirjoitettuna "15,50 €" testi kaatui: Intl käyttää euromerkin
   * edessä sitovaa välilyöntiä eikä tavallista. Kovakoodattu odotus
   * testaa siis välilyöntimerkkiä eikä hintaa.
   */
  it("kertoo ravintolan, viikon ja hinnan", () => {
    expect(text).toContain("Cafe Monami — lounas");
    expect(text).toContain("Viikko 35");
    expect(text).toContain(formatMoney(1550));
  });

  it("kertoo mitä hintaan sisältyy", () => {
    expect(text).toContain("Hintaan sisältyy kahvi.");
  });

  it("listaa päivät ja ruoat lyhenteineen", () => {
    expect(text).toContain("MA Juureskeitto VE G, Lihapullat");
  });

  // Tyhjä päivä ei kuulu julkaisuun sen paremmin kuin sivullekaan.
  it("jättää tyhjän päivän pois", () => {
    expect(text).not.toContain("TI");
  });

  it("selittää lyhenteet ja päättyy osoitteeseen", () => {
    expect(text).toContain("VE = Vegaaninen");
    expect(text).toContain("G = Gluteeniton");
    expect(text.trimEnd().endsWith("https://budet.fi/lounas/cafe-monami")).toBe(
      true,
    );
  });

  /*
   * Ei muotoiluja. Facebookin ja Instagramin tekstikentät eivät tue
   * niitä, ja tähtimerkit näkyisivät sellaisenaan julkaisussa.
   */
  it("ei sisällä markdown-muotoiluja", () => {
    expect(text).not.toMatch(/\*\*|__|^#/m);
  });

  it("kestää hinnattoman viikon", () => {
    const free = weekAsText(week({ prices: [] }), "https://x.fi", "fi");

    expect(free).toContain("Cafe Monami");
    expect(free).not.toContain("€");
    expect(free).not.toContain(formatMoney(1550));
  });

  it("nimeää useat hinnat", () => {
    const many = weekAsText(
      week({
        prices: [
          { name: "Lounas", cents: 1550 },
          { name: "Eläkeläinen", cents: 1350 },
        ],
      }),
      "https://x.fi",
      "fi",
    );

    expect(many).toContain(`Lounas ${formatMoney(1550)}`);
    expect(many).toContain(`Eläkeläinen ${formatMoney(1350)}`);
  });
});

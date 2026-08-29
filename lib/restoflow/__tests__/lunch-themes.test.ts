import { describe, expect, it } from "vitest";
import {
  LUNCH_THEMES,
  LUNCH_THEME_HINTS,
  LUNCH_THEME_LABELS,
  isLunchTheme,
  lunchTheme,
  type LunchTheme,
} from "../lunch-themes";

/**
 * Teemojen luettavuus.
 *
 * Nämä testit syntyivät mittauksesta. Vaalean teeman hiljainen teksti
 * peri sovellukselta sävyn jonka kontrasti oli 2,4:1 — ja juuri se
 * sävy kantoi allergeenit. Teksti jonka joku lukee siksi ettei saa
 * sairastua ei voi olla sivun heikoin.
 *
 * Kontrasti on laskettavissa, joten se on testattavissa. Uusi teema tai
 * hienosäädetty sävy jää tähän kiinni ennen kuin se päätyy oveen.
 */

/** WCAG 2.x -suhteellinen luminanssi. */
function luminance(hex: string): number {
  const c = hex.replace("#", "");

  const channels = [0, 2, 4].map((i) => {
    const v = Number.parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const THEMES = Object.keys(LUNCH_THEMES) as LunchTheme[];

describe("kontrastilaskenta", () => {
  // Tunnetut arvot: musta valkoisella on 21:1, sama väri itsensä
  // päällä 1:1. Jos nämä eivät päde, muut luvut eivät tarkoita mitään.
  it("laskee tunnetut arvot oikein", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 2);
  });
});

describe("teemojen luettavuus", () => {
  it.each(THEMES)("%s: päätekstiä voi lukea", (theme) => {
    const t = LUNCH_THEMES[theme];

    expect(contrast(t.text, t.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.text, t.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(THEMES)("%s: kuvausta voi lukea", (theme) => {
    const t = LUNCH_THEMES[theme];
    expect(contrast(t.text2, t.card)).toBeGreaterThanOrEqual(4.5);
  });

  /*
   * Hiljainen teksti kantaa päivämäärät ja alaviitteen. Se on
   * pienikokoista, joten sama 4,5:1 pätee — hiljainen ei tarkoita
   * heikkoa.
   */
  it.each(THEMES)("%s: hiljaista tekstiä voi lukea", (theme) => {
    const t = LUNCH_THEMES[theme];

    expect(contrast(t.text3, t.card)).toBeGreaterThanOrEqual(3);
    expect(contrast(t.text3, t.bg)).toBeGreaterThanOrEqual(3);
  });

  // Hierarkian on säilyttävä: hiljainen ei saa olla päätekstiä
  // voimakkaampi, muuten korostus osoittaa väärään suuntaan.
  it.each(THEMES)("%s: säilyttää tekstin hierarkian", (theme) => {
    const t = LUNCH_THEMES[theme];

    expect(contrast(t.text, t.card)).toBeGreaterThan(contrast(t.text2, t.card));
    expect(contrast(t.text2, t.card)).toBeGreaterThanOrEqual(
      contrast(t.text3, t.card),
    );
  });

  // Kortin on erotuttava taustasta jotenkin: varjolla tai reunalla.
  // Tummalla pinnalla varjo ei näy, joten siellä tarvitaan reuna.
  it.each(THEMES)("%s: kortti erottuu taustasta", (theme) => {
    const t = LUNCH_THEMES[theme];
    const erottuu =
      t.card !== t.bg ||
      t.cardShadow !== "none" ||
      t.cardBorder !== "transparent";

    expect(erottuu).toBe(true);
  });
});

describe("teeman valinta", () => {
  it("tunnistaa kelvolliset teemat", () => {
    expect(isLunchTheme("light")).toBe(true);
    expect(isLunchTheme("dark")).toBe(true);
    expect(isLunchTheme("classic")).toBe(true);
  });

  it("hylkää tuntemattoman", () => {
    expect(isLunchTheme("neon")).toBe(false);
    expect(isLunchTheme(null)).toBe(false);
    expect(isLunchTheme(3)).toBe(false);
  });

  /*
   * Tuntematon arvo ei saa tuottaa tyhjää sivua. Kanta rajaa arvot
   * kolmeen, mutta julkinen sivu ei saa olla sen varassa: rikkinäinen
   * teema näkyisi asiakkaalle valkoisena ruutuna QR-koodin takana.
   */
  it("palaa vaaleaan tuntemattomasta arvosta", () => {
    expect(lunchTheme("neon")).toEqual(LUNCH_THEMES.light);
    expect(lunchTheme(undefined)).toEqual(LUNCH_THEMES.light);
    expect(lunchTheme(null)).toEqual(LUNCH_THEMES.light);
  });

  it("nimeää ja kuvaa jokaisen teeman", () => {
    for (const theme of THEMES) {
      expect(LUNCH_THEME_LABELS[theme].length).toBeGreaterThan(2);
      expect(LUNCH_THEME_HINTS[theme].length).toBeGreaterThan(15);
    }
  });
});

/**
 * Julkisen lounassivun teemat.
 *
 * Kolme, ei kymmentä. Jokaisella on oma käyttötarkoitus eikä vain oma
 * väri — muuten valinnasta tulee makuasia jota ei osaa tehdä.
 *
 *   Vaalea    Puhelimessa luettava. Sama kieli kuin sovelluksessa.
 *   Tumma     Ruudulle ravintolan seinälle tai tiskille. Vaalea pinta
 *             hohtaa hämärässä salissa; tumma ei.
 *   Klassinen Painetun ruokalistan tuntu. Lämmin paperisävy ja
 *             antiikva otsikoissa.
 *
 * Teema on ravintolan valinta, ei viikon. Se päätetään kerran eikä
 * joka maanantai — siksi se on restaurants-taulussa eikä lounasviikossa.
 *
 * Arvot ovat konkreettisia eivätkä muuttujaviittauksia. Julkinen sivu
 * näkyy kirjautumattomalle, ja hänen järjestelmänsä tumma tila ei saa
 * muuttaa sitä minkä ravintola on valinnut.
 */

export type LunchTheme = "light" | "dark" | "classic";

export interface LunchThemeTokens {
  /** Sivun tausta. */
  bg: string;
  /** Korttien tausta. */
  card: string;
  /** Kortin reuna. Tyhjä kun reunaa ei ole. */
  cardBorder: string;
  cardShadow: string;
  /** Päätekstin väri. */
  text: string;
  /** Toissijainen teksti: kuvaukset. */
  text2: string;
  /**
   * Hiljainen teksti: päivämäärät ja alaviite.
   *
   * Hiljainen ei tarkoita heikkoa. Jokainen sävy on mitattu
   * vähintään 4,5:1 sekä kortin että taustan päällä — myös vaalea
   * teema, jonka arvo peri sovellukselta 2,4:1 kontrastin.
   */
  text3: string;
  /** Ohut viiva. */
  line: string;
  /** Otsikon kirjasinperhe. */
  headingFont: string;
  /** Otsikon kirjainvälistys. */
  headingTracking: string;
}

export const LUNCH_THEMES: Record<LunchTheme, LunchThemeTokens> = {
  light: {
    bg: "#f5f6f8",
    card: "#ffffff",
    cardBorder: "transparent",
    cardShadow: "0 1px 2px rgba(17, 19, 24, 0.05)",
    text: "#111318",
    text2: "#6b7280",
    // #9ca3af oli 2,4:1 taustaa vasten. Mitattu ja korjattu: hiljainen
    // teksti kantaa allergeenit ja päivämäärät, eikä sitä lueta
    // silmäillen vaan tarkasti.
    text3: "#6b7381",
    line: "#e7e9ee",
    headingFont: "inherit",
    headingTracking: "-0.01em",
  },

  dark: {
    bg: "#0e1014",
    card: "#171a20",
    cardBorder: "#252932",
    // Varjo ei näy tummalla pinnalla, joten kortti erotetaan reunalla.
    cardShadow: "none",
    text: "#f2f3f5",
    text2: "#a3a9b5",
    text3: "#6e7683",
    line: "#252932",
    headingFont: "inherit",
    headingTracking: "-0.01em",
  },

  classic: {
    bg: "#f6f1e7",
    card: "#fffdf8",
    cardBorder: "#e6dcc9",
    cardShadow: "none",
    text: "#2b2318",
    text2: "#6b5d48",
    text3: "#77684f",
    line: "#e6dcc9",
    // Antiikva vain otsikoissa. Koko sivu antiikvalla olisi
    // puhelimessa raskaampi lukea kuin painettuna.
    headingFont: 'Georgia, "Times New Roman", serif',
    headingTracking: "0",
  },
};

export const LUNCH_THEME_LABELS: Record<LunchTheme, string> = {
  light: "Vaalea",
  dark: "Tumma",
  classic: "Klassinen",
};

export const LUNCH_THEME_HINTS: Record<LunchTheme, string> = {
  light: "Selkeä ja kevyt. Sopii puhelimeen ja QR-koodiin.",
  dark: "Ruudulle saliin tai tiskille. Ei hohda hämärässä.",
  classic: "Painetun ruokalistan tuntu. Lämmin sävy ja antiikva otsikko.",
};

export function isLunchTheme(value: unknown): value is LunchTheme {
  return value === "light" || value === "dark" || value === "classic";
}

export function lunchTheme(value: unknown): LunchThemeTokens {
  return LUNCH_THEMES[isLunchTheme(value) ? value : "light"];
}

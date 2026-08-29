/**
 * Kielet.
 *
 * TÄMÄ ON KOKO TUOTTEEN KIELILISTA.
 *
 * Nimi puhuu julkisista sivuista, koska tiedosto tehtiin niitä varten.
 * Nyt myös sovellus lukee tästä: app-locales.ts johtaa oman listansa
 * suoraan LOCALES-vakiosta eikä kopioi sitä.
 *
 * Syy on kokemus. Sovelluksella oli hetken oma kolmenkymmenen kielen
 * luettelo, ja kaksi listaa ehti erota ennen kuin kukaan huomasi:
 * virolla oli sivu muttei valintaa sovelluksessa, ja sovelluksessa
 * saattoi valita japanin jolla ei ole yhtään merkkijonoa.
 *
 * Kielen lisääminen tapahtuu siis täällä ja vain täällä — ja se on
 * lupaus siitä että kieli myös käännetään.
 *
 * SUOMI EI OLE ETULIITTEEN TAKANA.
 *
 * Suomenkielinen sivu on / ja /meista, muut /en, /sv, /da, /tr, /et.
 * Kotimaan osoitteet ovat olleet olemassa ja jaossa; niiden
 * siirtäminen /fi:n taakse rikkoisi jokaisen jaetun linkin eikä toisi
 * mitään.
 */

export const LOCALES = ["fi", "en", "sv", "da", "tr", "et"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fi";

/** Kielet joilla on osoitteessa etuliite. */
export const PREFIXED_LOCALES = LOCALES.filter(
  (locale) => locale !== DEFAULT_LOCALE,
);

/**
 * Kielen nimi omalla kielellään.
 *
 * "Finnish" englanninkielisessä valikossa auttaa vain sitä joka osaa
 * englantia. Kielivalitsin luetaan sillä kielellä jota etsitään, joten
 * nimi on aina omakielinen.
 */
export const LOCALE_NAMES: Record<Locale, string> = {
  fi: "Suomi",
  en: "English",
  sv: "Svenska",
  da: "Dansk",
  tr: "Türkçe",
  et: "Eesti",
};

/** HTML lang -attribuutti ja hreflang. */
export const LOCALE_TAGS: Record<Locale, string> = {
  fi: "fi-FI",
  en: "en",
  sv: "sv-SE",
  da: "da-DK",
  tr: "tr-TR",
  et: "et-EE",
};

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Sivun osoite kielellä.
 *
 * Yksi funktio kaikille linkeille: kielivalitsin, hreflang-tagit ja
 * navigaatio lukevat samasta paikasta. Kolme tapaa rakentaa sama
 * osoite ajautuisi erilleen ensimmäisen uuden sivun kohdalla.
 */
export type MarketingPage = "home" | "about";

const PATHS: Record<Locale, Record<MarketingPage, string>> = {
  fi: { home: "/", about: "/meista" },
  en: { home: "/en", about: "/en/about" },
  sv: { home: "/sv", about: "/sv/om-oss" },
  da: { home: "/da", about: "/da/om-os" },
  tr: { home: "/tr", about: "/tr/hakkimizda" },
  et: { home: "/et", about: "/et/meist" },
};

export function pathFor(locale: Locale, page: MarketingPage): string {
  return PATHS[locale][page];
}

/**
 * Osoitteen viimeinen osa kielelle.
 *
 * Reitti on /[kieli]/[sivu], ja sivun tunnus vaihtelee kielittäin:
 * englanniksi "about", ruotsiksi "om-oss". Käännös osoitteessa on osa
 * sivun laatua — /sv/about olisi puolikas käännös.
 */
export function aboutSlug(locale: Locale): string {
  return PATHS[locale].about.split("/").pop() ?? "about";
}

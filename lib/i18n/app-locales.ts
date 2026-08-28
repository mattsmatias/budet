/**
 * Sovelluksen kielet.
 *
 * KOLMEKYMMENTÄ KIELTÄ, YKSI LUETTELO.
 *
 * Tämä on ainoa paikka jossa kielen tunnus, natiivi nimi, kirjoitus­
 * suunta ja Intl-tunniste on määritelty. Kielivalitsin, kielen
 * ratkaisu, muotoilu ja Matti lukevat kaikki tästä — kaksi luetteloa
 * ajautuisi erilleen ensimmäisen lisätyn kielen kohdalla.
 *
 * NATIIVI NIMI, EI KÄÄNNETTY.
 *
 * Kielivalikossa lukee "Français" eikä "ranska". Valikkoa lukee se
 * joka etsii omaa kieltään, eikä hän välttämättä osaa sitä kieltä
 * jolla käyttöliittymä nyt on.
 */

export const APP_LOCALES = [
  "fi", "en", "sv", "de", "fr", "es", "it", "pt", "nl", "da",
  "no", "is", "pl", "cs", "sk", "hu", "ro", "bg", "tr", "el",
  "uk", "ru", "ar", "he", "hi", "zh-CN", "ja", "ko", "vi", "pt-BR",
] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

/**
 * Oletuskieli.
 *
 * Suomi, koska sovellus on rakennettu suomeksi ja jokainen kääntämätön
 * merkkijono on suomea. Englanti oletuksena tarkoittaisi että
 * kääntämätön näkymä on sekoitus kahta kieltä.
 */
export const DEFAULT_APP_LOCALE: AppLocale = "fi";

/**
 * Varakieli kun käännös puuttuu.
 *
 * Ketju on: valittu kieli → englanti → suomi. Englanti on välissä
 * siksi, että useampi ymmärtää sitä kuin suomea; suomi on viimeisenä
 * koska se on ainoa kieli jolla kaikki merkkijonot varmasti ovat.
 */
export const FALLBACK_CHAIN: AppLocale[] = ["en", "fi"];

export interface LocaleInfo {
  /** Kielen nimi omalla kielellään. */
  name: string;
  /** Kirjoitussuunta. Arabia ja heprea oikealta vasemmalle. */
  dir: "ltr" | "rtl";
  /**
   * BCP-47-tunniste Intl-muotoiluun ja html lang -attribuuttiin.
   *
   * Useimmiten sama kuin avain, mutta ei aina: norjan bokmål on "nb",
   * ja alueelliset variantit tarvitsevat maan mukaan.
   */
  tag: string;
}

export const LOCALE_INFO: Record<AppLocale, LocaleInfo> = {
  fi: { name: "Suomi", dir: "ltr", tag: "fi-FI" },
  en: { name: "English", dir: "ltr", tag: "en-GB" },
  sv: { name: "Svenska", dir: "ltr", tag: "sv-SE" },
  de: { name: "Deutsch", dir: "ltr", tag: "de-DE" },
  fr: { name: "Français", dir: "ltr", tag: "fr-FR" },
  es: { name: "Español", dir: "ltr", tag: "es-ES" },
  it: { name: "Italiano", dir: "ltr", tag: "it-IT" },
  pt: { name: "Português", dir: "ltr", tag: "pt-PT" },
  nl: { name: "Nederlands", dir: "ltr", tag: "nl-NL" },
  da: { name: "Dansk", dir: "ltr", tag: "da-DK" },
  /* Bokmål on norjan yleisin kirjakieli ja Intlin tuntema tunniste. */
  no: { name: "Norsk", dir: "ltr", tag: "nb-NO" },
  is: { name: "Íslenska", dir: "ltr", tag: "is-IS" },
  pl: { name: "Polski", dir: "ltr", tag: "pl-PL" },
  cs: { name: "Čeština", dir: "ltr", tag: "cs-CZ" },
  sk: { name: "Slovenčina", dir: "ltr", tag: "sk-SK" },
  hu: { name: "Magyar", dir: "ltr", tag: "hu-HU" },
  ro: { name: "Română", dir: "ltr", tag: "ro-RO" },
  bg: { name: "Български", dir: "ltr", tag: "bg-BG" },
  tr: { name: "Türkçe", dir: "ltr", tag: "tr-TR" },
  el: { name: "Ελληνικά", dir: "ltr", tag: "el-GR" },
  uk: { name: "Українська", dir: "ltr", tag: "uk-UA" },
  ru: { name: "Русский", dir: "ltr", tag: "ru-RU" },
  ar: { name: "العربية", dir: "rtl", tag: "ar" },
  he: { name: "עברית", dir: "rtl", tag: "he-IL" },
  hi: { name: "हिन्दी", dir: "ltr", tag: "hi-IN" },
  "zh-CN": { name: "简体中文", dir: "ltr", tag: "zh-Hans-CN" },
  ja: { name: "日本語", dir: "ltr", tag: "ja-JP" },
  ko: { name: "한국어", dir: "ltr", tag: "ko-KR" },
  vi: { name: "Tiếng Việt", dir: "ltr", tag: "vi-VN" },
  "pt-BR": { name: "Português (Brasil)", dir: "ltr", tag: "pt-BR" },
};

export function isAppLocale(value: unknown): value is AppLocale {
  return (
    typeof value === "string" &&
    (APP_LOCALES as readonly string[]).includes(value)
  );
}

export function localeInfo(locale: AppLocale): LocaleInfo {
  return LOCALE_INFO[locale];
}

export function isRtl(locale: AppLocale): boolean {
  return LOCALE_INFO[locale].dir === "rtl";
}

/**
 * Kielet valikkoon, natiivin nimen mukaan.
 *
 * Järjestys on aakkosellinen nimen mukaan eikä tunnuksen: valikkoa
 * selataan nimillä. Suomi on silti ensimmäisenä, koska se on
 * sovelluksen kieli ja useimmiten etsitty.
 *
 * Vertailu tehdään Intl.Collatorilla, koska "Č", "Ü" ja "Å" eivät
 * mene oikein tavujärjestyksessä.
 */
export function localesForMenu(): { code: AppLocale; name: string }[] {
  const collator = new Intl.Collator("en");

  const rest = APP_LOCALES.filter((code) => code !== DEFAULT_APP_LOCALE)
    .map((code) => ({ code, name: LOCALE_INFO[code].name }))
    .sort((a, b) => collator.compare(a.name, b.name));

  return [
    { code: DEFAULT_APP_LOCALE, name: LOCALE_INFO[DEFAULT_APP_LOCALE].name },
    ...rest,
  ];
}

/**
 * Selaimen kielitoiveesta lähin tuettu kieli.
 *
 * Accept-Language antaa listan kuten "tr-TR,tr;q=0.9,en;q=0.8".
 * Tarkka osuma ensin, sitten pelkkä kielikoodi: "pt-PT" ei ole tuettu
 * mutta "pt" on, ja "de-AT" päätyy saksaan.
 *
 * Palauttaa nullin jos mikään ei osu — kutsuja päättää mitä silloin
 * tehdään.
 */
export function matchBrowserLocale(header: string | null): AppLocale | null {
  if (!header) return null;

  const wanted = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.trim(), q: q ? Number(q) : 1 };
    })
    .filter((entry) => entry.tag !== "" && !Number.isNaN(entry.q))
    .sort((a, b) => b.q - a.q);

  for (const { tag } of wanted) {
    if (isAppLocale(tag)) return tag;

    // "zh-CN" ja "pt-BR" ovat omia kieliään; muut alueet putoavat
    // peruskieleen.
    const base = tag.split("-")[0];
    if (isAppLocale(base)) return base;

    /*
     * Kiina ilman aluetta tai yksinkertaistetulla kirjoituksella
     * ohjataan zh-CN:ään. "zh" yksin on yleisin tapa pyytää sitä.
     */
    if (base === "zh") return "zh-CN";
  }

  return null;
}

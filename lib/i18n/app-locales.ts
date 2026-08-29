import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_NAMES,
  LOCALE_TAGS,
  type Locale,
} from "./locales";

/**
 * Sovelluksen kielet.
 *
 * SAMA LISTA KUIN JULKISILLA SIVUILLA — JOHDETTU, EI KOPIOITU.
 *
 * Tässä oli aiemmin oma kolmenkymmenen kielen luettelo. Se antoi
 * käyttäjälle valita esimerkiksi japanin, vaikka sovelluksessa ei ole
 * yhtään japaninkielistä merkkijonoa — valinta vaihtoi vain numeroiden
 * muodon ja Matin vastauskielen, ja näkymä jäi suomeksi. Valitsin
 * lupasi enemmän kuin sovellus osasi pitää.
 *
 * Kaksi luetteloa ehti myös ajautua erilleen: julkisilla sivuilla oli
 * viro, sovelluksessa ei. Nyt lista tulee locales.ts:stä, joten sitä
 * ei voi enää lisätä vain toiseen paikkaan.
 *
 * NATIIVI NIMI, EI KÄÄNNETTY.
 *
 * Kielivalikossa lukee "Eesti" eikä "viro". Valikkoa lukee se joka
 * etsii omaa kieltään, eikä hän välttämättä osaa sitä kieltä jolla
 * käyttöliittymä nyt on.
 */

export const APP_LOCALES = LOCALES;

export type AppLocale = Locale;

/**
 * Oletuskieli.
 *
 * Suomi, koska sovellus on rakennettu suomeksi ja jokainen kääntämätön
 * merkkijono on suomea. Englanti oletuksena tarkoittaisi että
 * kääntämätön näkymä on sekoitus kahta kieltä.
 */
export const DEFAULT_APP_LOCALE: AppLocale = DEFAULT_LOCALE;

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
  /** Kirjoitussuunta. */
  dir: "ltr" | "rtl";
  /** BCP-47-tunniste Intl-muotoiluun ja html lang -attribuuttiin. */
  tag: string;
}

/**
 * Oikealta vasemmalle kirjoitettavat kielet.
 *
 * Tyhjä juuri nyt: kaikki kuusi kirjoitetaan vasemmalta oikealle.
 * Joukko on silti olemassa, koska kirjoitussuunta on kielen
 * ominaisuus eikä sitä pidä päätellä uudelleen jokaisessa
 * kutsupaikassa — ja koska arabian tai heprean lisääminen listaan ei
 * saa vaatia muuta kuin yhden rivin tänne.
 */
const RTL: ReadonlySet<string> = new Set<string>();

export const LOCALE_INFO: Record<AppLocale, LocaleInfo> = Object.fromEntries(
  LOCALES.map((code) => [
    code,
    {
      name: LOCALE_NAMES[code],
      dir: RTL.has(code) ? "rtl" : "ltr",
      tag: LOCALE_TAGS[code],
    },
  ]),
) as Record<AppLocale, LocaleInfo>;

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
 * Vertailu tehdään Intl.Collatorilla, koska "Ü" ja "Å" eivät mene
 * oikein tavujärjestyksessä.
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
 * Tarkka osuma ensin, sitten pelkkä kielikoodi: "sv-FI" ei ole tuettu
 * mutta "sv" on.
 *
 * Palauttaa nullin jos mikään ei osu — kutsuja päättää mitä silloin
 * tehdään. Käytännössä se tarkoittaa oletuskieltä.
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

    const base = tag.split("-")[0];
    if (isAppLocale(base)) return base;
  }

  return null;
}

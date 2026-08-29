import type { Metadata } from "next";
import { getActiveRestaurant, getUser } from "@/lib/restoflow/session";
import { landingFor } from "@/lib/restoflow/permissions";
import { dictionary } from "./dictionary";
import {
  LOCALES,
  LOCALE_TAGS,
  pathFor,
  type Locale,
  type MarketingPage,
} from "./locales";

/**
 * Markkinointisivujen yhteinen alustus.
 *
 * KAKSITOISTA SIVUA, YKSI SÄÄNTÖ.
 *
 * Kuusi kieltä kertaa kaksi sivua on kaksitoista reittiä. Jos jokainen
 * rakentaisi omat metatietonsa ja oman kirjautumislinkkinsä, ne
 * ajautuisivat erilleen ensimmäisen muutoksen kohdalla — ja
 * hreflang-tagit ovat juuri sellaista tietoa jonka virhe ei näy
 * ihmiselle mutta näkyy hakukoneelle.
 */

/**
 * Mihin "Avaa Kate" vie.
 *
 * Kohde lasketaan roolista samalla funktiolla jota kirjautuminenkin
 * käyttää. Kirjautumaton saa nullin, jolloin sivu näyttää
 * "Aloita ilmaiseksi" -painikkeen.
 */
export async function appHrefForVisitor(): Promise<string | null> {
  const user = await getUser();
  if (!user) return null;

  const restaurant = await getActiveRestaurant();

  /*
   * Kirjautunut ilman ravintolaa menee aloitukseen.
   *
   * Se on tunnus jolla ei vielä ole mitään avattavaa: /aloitus luo
   * ravintolan tai lunastaa kutsukoodin.
   */
  return restaurant ? landingFor(restaurant.role) : "/aloitus";
}

/**
 * Metatiedot kielineen.
 *
 * Jokainen sivu kertoo kaikki kieliversionsa. Ilman hreflang-tagia
 * hakukone näkisi kuusi lähes samanlaista sivua ja valitsisi niistä
 * yhden — ja se yksi olisi harvoin se jota lukija etsii.
 */
export function marketingMetadata(
  locale: Locale,
  page: MarketingPage,
): Metadata {
  const t = dictionary(locale);

  /*
   * Otsikko ohittaa juurilayoutin mallin.
   *
   * Malli on "%s · Kate", ja nämä otsikot sisältävät jo tuotenimen:
   * ilman absolute-muotoa selaimen välilehdessä lukisi
   * "Meistä – Kate · Kate".
   *
   * Tunnuslause päättyy pisteeseen kappaleena mutta ei otsikkona,
   * joten se karsitaan tässä eikä kirjoiteta sanakirjaan kahdesti.
   */
  const tagline = t.footer.tagline.replace(/\.$/, "");

  const title = page === "about" ? t.about.metaTitle : `Kate – ${tagline}`;

  const description =
    page === "about"
      ? t.about.metaDescription
      : t.hero.body;

  const languages: Record<string, string> = {};
  for (const code of LOCALES) {
    languages[LOCALE_TAGS[code]] = pathFor(code, page);
  }
  /* Kielivalinnan ulkopuolinen oletus hakukoneelle. */
  languages["x-default"] = pathFor("fi", page);

  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: pathFor(locale, page),
      languages,
    },
    openGraph: {
      title,
      description,
      url: pathFor(locale, page),
      type: "website",
      locale: LOCALE_TAGS[locale].replace("-", "_"),
      siteName: "Kate",
    },
  };
}

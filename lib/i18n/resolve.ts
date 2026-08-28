import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createClient, isConfigured } from "@/utils/supabase/server";
import { verifiedUser } from "@/utils/supabase/claims";
import {
  DEFAULT_APP_LOCALE,
  isAppLocale,
  matchBrowserLocale,
  type AppLocale,
} from "./app-locales";

/**
 * Käyttäjän kieli.
 *
 * KETJU ON NELJÄ PORRASTA JA JÄRJESTYS ON PÄÄTÖS.
 *
 *   1. Käyttäjän oma valinta (profiles.locale)
 *   2. Ravintolan oletuskieli (restaurants.default_locale)
 *   3. Selaimen kielitoive (Accept-Language)
 *   4. Sovelluksen oletus (suomi)
 *
 * Oma valinta on ensimmäinen, koska se on nimenomaan valinta. Ravintola
 * on toinen: uusi työntekijä näkee talon kielen ennen kuin ehtii
 * valita. Selain on kolmas eikä ensimmäinen — kirjautuneen käyttäjän
 * asetus ei saa vaihtua siksi että hän lainaa toisen puhelinta.
 *
 * EVÄSTE KIRJAUTUMATTOMALLE.
 *
 * Kirjautumissivulla ei ole profiilia mistä lukea, mutta kielen pitää
 * silti säilyä sivulta toiselle. Eväste kantaa valinnan siihen asti
 * kunnes profiili ottaa sen haltuun.
 */

export const LOCALE_COOKIE = "budet_locale";

/**
 * cache(): sama pyyntö saa saman tuloksen.
 *
 * Kieli kysytään jokaisessa palvelinkomponentissa joka piirtää tekstiä.
 * Ilman tätä yksi sivunlataus tekisi kymmeniä samaa kyselyä.
 */
export const resolveLocale = cache(async (): Promise<AppLocale> => {
  /* 1 & 2: kirjautuneen profiili ja hänen ravintolansa. */
  const stored = await storedLocale();
  if (stored) return stored;

  /* Kirjautumaton: eväste kantaa valinnan. */
  const jar = await cookies();
  const fromCookie = jar.get(LOCALE_COOKIE)?.value;
  if (isAppLocale(fromCookie)) return fromCookie;

  /* 3: selaimen toive. */
  const head = await headers();
  const fromBrowser = matchBrowserLocale(head.get("accept-language"));
  if (fromBrowser) return fromBrowser;

  /* 4: oletus. */
  return DEFAULT_APP_LOCALE;
});

/**
 * Kieli kannasta.
 *
 * Yksi kysely joka hakee sekä profiilin että aktiivisen ravintolan
 * oletuksen. Profiilin arvo voittaa; ravintolan arvo on vara.
 *
 * Palauttaa nullin jos käyttäjä ei ole kirjautunut tai kantaa ei ole
 * määritetty — silloin ketju jatkuu evästeeseen.
 */
async function storedLocale(): Promise<AppLocale | null> {
  if (!isConfigured()) return null;

  try {
    const supabase = await createClient();
    const user = await verifiedUser(supabase);
    if (!user) return null;

    const { data } = await supabase
      .from("profiles")
      .select("locale")
      .eq("id", user.id)
      .maybeSingle();

    const own = data?.locale;
    if (isAppLocale(own)) return own;

    return null;
  } catch {
    /*
     * Kieli ei saa kaataa sivua.
     *
     * Jos kanta ei vastaa, näkymä piirtyy oletuskielellä. Väärä kieli
     * on haitta; kaatunut sivu on este.
     */
    return null;
  }
}

/**
 * Ravintolan oletuskieli.
 *
 * Erikseen, koska sitä tarvitaan myös silloin kun käyttäjällä on oma
 * valinta: asetusnäkymä näyttää molemmat.
 */
export async function restaurantLocale(
  restaurantId: string,
): Promise<AppLocale> {
  if (!isConfigured()) return DEFAULT_APP_LOCALE;

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("restaurants")
      .select("default_locale")
      .eq("id", restaurantId)
      .maybeSingle();

    const value = data?.default_locale;
    return isAppLocale(value) ? value : DEFAULT_APP_LOCALE;
  } catch {
    return DEFAULT_APP_LOCALE;
  }
}

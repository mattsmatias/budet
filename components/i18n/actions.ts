"use server";

import { cookies } from "next/headers";
import { createClient, isConfigured } from "@/utils/supabase/server";
import { verifiedUser } from "@/utils/supabase/claims";
import { isAppLocale, type AppLocale } from "@/lib/i18n/app-locales";
import { LOCALE_COOKIE } from "@/lib/i18n/resolve";

/**
 * Kielen valinta.
 *
 * KAHTEEN PAIKKAAN, EIKÄ VAIN YHTEEN.
 *
 * Eväste kantaa valinnan heti ja toimii myös kirjautumatta. Profiili
 * kantaa sen laitteelta toiselle ja uloskirjautumisen yli. Pelkkä
 * eväste katoaisi selainta vaihtaessa; pelkkä profiili ei toimisi
 * kirjautumissivulla, jossa kielivalitsinta eniten tarvitaan.
 *
 * Eväste on vuoden mittainen ja lax: se ei ole arkaluontoinen, ja
 * kielen katoaminen kesken ostoksen on tarpeeton pettymys.
 */
export async function chooseLocale(locale: string): Promise<void> {
  if (!isAppLocale(locale)) return;

  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });

  await storeForUser(locale);
}

/**
 * Kieli profiiliin, jos käyttäjä on kirjautunut.
 *
 * Kirjautumaton saa evästeen ja se riittää. Kun hän myöhemmin
 * kirjautuu, profiilin arvo voittaa — se on hänen oma valintansa
 * toiselta istunnolta eikä tämän selaimen sattuma.
 */
async function storeForUser(locale: AppLocale): Promise<void> {
  if (!isConfigured()) return;

  try {
    const supabase = await createClient();
    const user = await verifiedUser(supabase);
    if (!user) return;

    // Funktion kautta eikä suorana päivityksenä: käyttäjä saa vaihtaa
    // vain oman kielensä.
    await supabase.rpc("set_my_locale", { p_locale: locale });
  } catch {
    /*
     * Kielen tallennus ei saa kaataa vaihtoa.
     *
     * Eväste on jo asetettu, joten näkymä vaihtuu joka tapauksessa.
     * Epäonnistunut tallennus tarkoittaa että valinta ei seuraa
     * toiselle laitteelle — se on haitta, ei este.
     */
  }
}

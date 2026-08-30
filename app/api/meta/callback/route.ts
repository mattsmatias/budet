/**
 * Paluu Metan kirjautumisesta.
 *
 * Tämä reitti on koko integraation turvallisuuden solmukohta: se
 * ottaa vastaan arvon internetistä ja muuttaa sen ravintolan
 * Facebook-sivun julkaisuoikeudeksi. Siksi jokainen ehto on
 * tarkistettava, eikä yhtäkään voi ohittaa "koska Meta ohjasi tänne".
 *
 * Järjestys on tahallinen:
 *
 *   1. Perukoko käyttäjä?          Metan virheparametri.
 *   2. Onko state oikea?           CSRF-suoja ennen mitään muuta.
 *   3. Onko käyttäjä kirjautunut?  Kate-istunto, ei Metan.
 *   4. Onko oikea ravintola?       Aloitushetken ravintola, ei nykyinen.
 *   5. Onko esihenkilö?            Rooli tarkistetaan uudelleen.
 *
 * Vasta sen jälkeen koodi vaihdetaan tokeniksi.
 */

import { NextResponse } from "next/server";
import { can } from "@/lib/restoflow/permissions";
import { requireContext } from "@/lib/restoflow/session";
import { siteOrigin } from "@/lib/restoflow/site-origin";
import { encryptToken } from "@/lib/restoflow/meta-crypto";
import {
  MetaError,
  exchangeCode,
  grantedScopes,
  listPages,
  longLivedUserToken,
  meId,
} from "@/lib/restoflow/meta-api";
import {
  checkState,
  clearOauthCookies,
  holdUserToken,
  redirectUri,
} from "@/lib/restoflow/meta-oauth";
import { createClient } from "@/utils/supabase/server";

const ASETUKSET = "/admin/asetukset/some";

/** Palaa asetuksiin syyn kanssa. Evästeet siivotaan aina. */
async function palaa(syy: string): Promise<NextResponse> {
  await clearOauthCookies();
  return NextResponse.redirect(
    new URL(`${ASETUKSET}?virhe=${syy}`, await siteOrigin()),
  );
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  /*
   * Käyttäjä painoi Peruuta tai kielsi oikeudet.
   *
   * Metan error_reason on user_denied kummassakin. Se ei ole virhe
   * vaan päätös, ja siitä kerrotaan sen mukaisesti.
   */
  if (params.get("error")) {
    return palaa("peruttu");
  }

  const tila = await checkState(params.get("state"));
  if (!tila.ok || !tila.restaurantId) return palaa("state");

  const { restaurant, role } = await requireContext(ASETUKSET);

  /*
   * Aloitushetken ravintola, ei nykyinen.
   *
   * Käyttäjä voi vaihtaa aktiivista ravintolaa toisessa välilehdessä
   * kesken kierroksen. Silloin yhteys tallentuisi väärälle
   * ravintolalle eikä kukaan huomaisi ennen kuin lounaslista
   * julkaistaan väärälle sivulle.
   */
  if (restaurant.id !== tila.restaurantId) return palaa("ravintola");

  if (!can(role, "settings.edit")) return palaa("oikeus");

  const code = params.get("code");
  if (!code) return palaa("koodi");

  try {
    const origin = await siteOrigin();

    const lyhyt = await exchangeCode(code, redirectUri(origin));
    const pitka = await longLivedUserToken(lyhyt);

    const [scopes, pages, userId] = await Promise.all([
      grantedScopes(pitka),
      listPages(pitka),
      meId(pitka),
    ]);

    /*
     * Ilman sivua ei ole mitään mihin julkaista.
     *
     * Tavallisin syy: käyttäjällä on henkilökohtainen profiili muttei
     * roolia yhdelläkään Facebook-sivulla. Se on ohjeistettava
     * erikseen, koska "yhdistäminen epäonnistui" ei kerro mitä tehdä.
     */
    if (pages.length === 0) return palaa("ei-sivua");

    /*
     * Yksi sivu: ei valintaa. Valintanäkymä yhdellä vaihtoehdolla on
     * ylimääräinen klikkaus jolla ei ole sisältöä.
     */
    if (pages.length === 1) {
      const page = pages[0];
      const supabase = await createClient();

      const { error } = await supabase.rpc("meta_save_connection", {
        p_restaurant: restaurant.id,
        p_meta_user_id: userId,
        p_page_id: page.id,
        p_page_name: page.name,
        p_instagram_id: page.instagramId,
        p_instagram_username: page.instagramUsername,
        p_scopes: scopes,
        p_token: encryptToken(page.accessToken),
        p_expires_at: null,
      });

      await clearOauthCookies();

      if (error) return palaa("tallennus");

      return NextResponse.redirect(
        new URL(`${ASETUKSET}?tila=yhdistetty`, origin),
      );
    }

    /*
     * Monta sivua: käyttäjä valitsee. Käyttäjätokeni odottaa
     * salattuna httpOnly-evästeessä, sivutokenit eivät missään.
     */
    await holdUserToken(pitka);

    return NextResponse.redirect(new URL(`${ASETUKSET}?valitse=1`, origin));
  } catch (error) {
    /*
     * Tekninen virhe lokiin, käyttäjälle syy. Metan raakaviesti
     * puhuu OAuthExceptionista ja alakoodeista, mikä ei auta
     * ravintoloitsijaa.
     */
    console.error("meta callback", {
      code: error instanceof MetaError ? error.code : null,
      subcode: error instanceof MetaError ? error.subcode : null,
      message: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof MetaError && error.permissionMissing) {
      return palaa("oikeudet-puuttuu");
    }

    return palaa("meta");
  }
}

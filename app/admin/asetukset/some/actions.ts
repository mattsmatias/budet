"use server";

/**
 * Meta-yhteyden hallinta.
 *
 * Sivun valinta, katkaisu ja uudelleenyhdistys. Itse kirjautuminen on
 * reiteissä (app/api/meta), koska se on selaimen siirtymä eikä
 * lomakkeen lähetys.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { can } from "@/lib/restoflow/permissions";
import { requireContext } from "@/lib/restoflow/session";
import { createClient } from "@/utils/supabase/server";
import { encryptToken } from "@/lib/restoflow/meta-crypto";
import { MetaError, grantedScopes, listPages, meId } from "@/lib/restoflow/meta-api";
import { clearOauthCookies, takeUserToken } from "@/lib/restoflow/meta-oauth";

export interface MetaState {
  error?: string;
  notice?: string;
}

function revalidate(): void {
  revalidatePath("/admin/asetukset/some");
  revalidatePath("/admin/lounas");
}

/**
 * Käyttäjän valitseman sivun tallennus.
 *
 * Sivut haetaan uudelleen eikä luoteta lomakkeen mukana tulleeseen
 * nimeen tai tokeniin. Lomakkeesta tulee vain sivun tunniste, ja se
 * tarkistetaan Metalta saatua listaa vasten — muuten kuka tahansa
 * voisi lähettää oman sivunsa tunnisteen ja liittää sen ravintolaan.
 */
export async function selectPage(
  _prev: MetaState,
  formData: FormData,
): Promise<MetaState> {
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext("/admin/asetukset/some");

  if (!can(role, "settings.edit")) return { error: t.some.errNoAccess };

  const pageId = String(formData.get("pageId") ?? "");
  if (!z.string().min(1).max(64).safeParse(pageId).success) {
    return { error: t.some.errGeneric };
  }

  const userToken = await takeUserToken();
  if (!userToken) return { error: t.some.errExpiredChoice };

  try {
    const [pages, scopes, userId] = await Promise.all([
      listPages(userToken),
      grantedScopes(userToken),
      meId(userToken),
    ]);

    const page = pages.find((p) => p.id === pageId);
    if (!page) return { error: t.some.errPageGone };

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

    if (error) return { error: t.some.errGeneric };

    revalidate();
    return { notice: t.some.connected };
  } catch (error) {
    console.error("meta selectPage", {
      code: error instanceof MetaError ? error.code : null,
      message: error instanceof Error ? error.message : String(error),
    });

    await clearOauthCookies();
    return { error: t.some.errMeta };
  }
}

/**
 * Yhteyden katkaisu.
 *
 * Tokeni poistetaan kannasta. Metan päässä sovelluksen oikeudet jäävät
 * voimaan — ne perutaan Facebookin asetuksista, ja siitä kerrotaan
 * käyttäjälle. Väärä lupaus olisi sanoa että katkaisu poistaa
 * oikeudet myös Metalta.
 */
export async function disconnect(): Promise<MetaState> {
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext("/admin/asetukset/some");

  if (!can(role, "settings.edit")) return { error: t.some.errNoAccess };

  const supabase = await createClient();
  const { error } = await supabase.rpc("meta_disconnect", {
    p_restaurant: restaurant.id,
  });

  if (error) return { error: t.some.errGeneric };

  revalidate();
  return { notice: t.some.disconnected };
}

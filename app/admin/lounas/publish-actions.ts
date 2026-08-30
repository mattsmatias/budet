"use server";

/**
 * Lounaslistan julkaisu Facebookiin ja Instagramiin.
 *
 * ---------------------------------------------------------------------
 * KUMPIKIN KANAVA ERIKSEEN
 * ---------------------------------------------------------------------
 *
 * Facebook voi onnistua ja Instagram epäonnistua. Se ei ole
 * poikkeustilanne vaan tavallinen: Instagram-tili voi olla
 * väärän tyyppinen, kuva voi jäädä noutamatta, päivän raja voi
 * täyttyä. Molempien tulos kirjataan erikseen, eikä toisen
 * epäonnistuminen peru toista — julkaistua Facebook-postausta ei voi
 * ottaa takaisin, eikä sitä pidä yrittääkään.
 *
 * ---------------------------------------------------------------------
 * ONNISTUMINEN ON METAN VAHVISTUS, EI KUTSUN LÄHETYS
 * ---------------------------------------------------------------------
 *
 * Tila kirjataan vasta kun Meta on palauttanut julkaisun tunnisteen.
 * Ilman tunnistetta tulos on epäonnistuminen, vaikka kutsu ei
 * heittäisi virhettä.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminText } from "@/lib/i18n/admin-text";
import type { AdminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { can } from "@/lib/restoflow/permissions";
import { requireContext } from "@/lib/restoflow/session";
import { createClient } from "@/utils/supabase/server";
import { decryptToken } from "@/lib/restoflow/meta-crypto";
import {
  MetaError,
  publishToInstagram,
  publishToPage,
} from "@/lib/restoflow/meta-api";
import {
  loadMetaConnection,
  loadPageToken,
  type PublishStatus,
} from "@/lib/restoflow/meta-queries";
import { renderLunchImage, type ImageTarget } from "@/lib/restoflow/meta-image";
import { IG_CAPTION_MAX } from "@/lib/restoflow/meta-post";
import { fetchLunchWeek } from "@/lib/restoflow/queries";
import { isLunchTheme } from "@/lib/restoflow/lunch-themes";

export interface PublishState {
  error?: string;
  notice?: string;
  facebook?: PublishStatus;
  instagram?: PublishStatus;
  facebookError?: string;
  instagramError?: string;
}

/**
 * Metan virhe käyttäjän kielelle.
 *
 * Raaka viesti puhuu OAuthExceptionista ja alakoodeista. Ravintoloitsija
 * tarvitsee tiedon siitä mitä hän voi tehdä, ja tekninen viesti menee
 * lokiin.
 */
function selita(error: unknown, t: AdminText): string {
  if (error instanceof MetaError) {
    if (error.tokenInvalid) return t.some.errTokenExpired;
    if (error.permissionMissing) return t.some.errPermission;
    if (error.retryable) return t.some.errTemporary;

    /* Metan oma käyttäjäviesti on usein ymmärrettävä, jos se on. */
    if (error.userMessage) return error.userMessage;
  }

  return t.some.errPublish;
}

/**
 * Kuva talteen ja allekirjoitettu osoite Metalle.
 *
 * Meta noutaa kuvan itse, joten osoitteen on oltava julkisesti
 * saavutettavissa. Allekirjoitettu osoite yksityisestä bucketista on
 * juuri sitä — arvaamaton ja vanheneva — toisin kuin julkinen bucket,
 * jossa jokainen luotu kuva jäisi pysyvästi esille.
 */
async function tallennaKuva(
  restaurantId: string,
  menuId: string,
  target: ImageTarget,
  bytes: Buffer,
): Promise<{ path: string; url: string } | null> {
  const supabase = await createClient();
  const path = `${restaurantId}/${menuId}-${target}-${Date.now()}.jpg`;

  const { error } = await supabase.storage
    .from("social")
    .upload(path, bytes, { contentType: "image/jpeg", upsert: true });

  if (error) return null;

  /*
   * Kuusi tuntia. Meta noutaa kuvan sekunneissa, mutta Instagramin
   * säiliö voi jäädä käsittelyyn — ja liian lyhyt voimassaolo
   * epäonnistuisi juuri silloin kun Metan päässä on ruuhkaa.
   */
  const { data } = await supabase.storage
    .from("social")
    .createSignedUrl(path, 6 * 60 * 60);

  if (!data?.signedUrl) return null;
  return { path, url: data.signedUrl };
}

const Syote = z.object({
  menuId: z.string().uuid(),
  message: z.string().trim().min(1).max(5000),
  toFacebook: z.boolean(),
  toInstagram: z.boolean(),
});

export async function publishLunch(
  _prev: PublishState,
  formData: FormData,
): Promise<PublishState> {
  const locale = await resolveLocale();
  const t = adminText(locale);
  const { restaurant, role } = await requireContext("/admin/lounas");

  if (!can(role, "lunch.manage")) return { error: t.some.errNoAccess };

  const parsed = Syote.safeParse({
    menuId: formData.get("menuId"),
    message: formData.get("message"),
    toFacebook: formData.get("facebook") === "1",
    toInstagram: formData.get("instagram") === "1",
  });

  if (!parsed.success) return { error: t.some.errFields };
  const { menuId, message, toFacebook, toInstagram } = parsed.data;

  if (!toFacebook && !toInstagram) return { error: t.some.errNoChannel };

  const connection = await loadMetaConnection(restaurant.id);
  if (!connection || connection.status === "disconnected") {
    return { error: t.some.errNotConnected };
  }

  if (toInstagram && !connection.instagramId) {
    return { error: t.some.errNoInstagram };
  }

  if (toInstagram && message.length > IG_CAPTION_MAX) {
    return { error: t.some.errCaptionLong };
  }

  const salattu = await loadPageToken(restaurant.id);
  if (!salattu) return { error: t.some.errNotConnected };

  let pageToken: string;
  try {
    pageToken = decryptToken(salattu);
  } catch {
    /*
     * Purkamaton tokeni tarkoittaa väärää avainta tai muokattua
     * riviä. Kumpikaan ei korjaannu yrittämällä uudelleen.
     */
    console.error("meta: tokenin purku epäonnistui", {
      restaurant: restaurant.id,
    });
    return { error: t.some.errTokenBroken };
  }

  /* Kuva tehdään viikosta, joten viikko haetaan tunnisteen kautta. */
  const supabase = await createClient();
  const { data: menuRow } = await supabase
    .from("lunch_menus")
    .select("week_start")
    .eq("id", menuId)
    .eq("restaurant_id", restaurant.id)
    .maybeSingle();

  if (!menuRow) return { error: t.some.errGeneric };

  const weekStart = String(menuRow.week_start);
  const viikko = await fetchLunchWeek(restaurant.id, weekStart);
  if (!viikko) return { error: t.some.errGeneric };

  const theme = isLunchTheme(restaurant.lunchTheme)
    ? restaurant.lunchTheme
    : "light";

  // --- Julkaisu ------------------------------------------------------

  let facebook: PublishStatus = "skipped";
  let instagram: PublishStatus = "skipped";
  let fbPostId: string | null = null;
  let igPostId: string | null = null;
  let fbError: string | null = null;
  let igError: string | null = null;
  let imagePath: string | null = null;

  if (toFacebook) {
    try {
      const kuva = await renderLunchImage({
        week: viikko,
        restaurantName: restaurant.name,
        theme,
        locale,
        target: "facebook",
      });

      const tallennettu = await tallennaKuva(
        restaurant.id,
        menuId,
        "facebook",
        kuva,
      );

      if (!tallennettu) throw new Error("kuvan tallennus epäonnistui");
      imagePath = tallennettu.path;

      fbPostId = await publishToPage(
        connection.pageId,
        pageToken,
        message,
        tallennettu.url,
      );
      facebook = "ok";
    } catch (error) {
      facebook = "failed";
      fbError = selita(error, t);
      console.error("meta: facebook-julkaisu", {
        restaurant: restaurant.id,
        code: error instanceof MetaError ? error.code : null,
        subcode: error instanceof MetaError ? error.subcode : null,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (toInstagram && connection.instagramId) {
    try {
      const kuva = await renderLunchImage({
        week: viikko,
        restaurantName: restaurant.name,
        theme,
        locale,
        target: "instagram",
      });

      const tallennettu = await tallennaKuva(
        restaurant.id,
        menuId,
        "instagram",
        kuva,
      );

      if (!tallennettu) throw new Error("kuvan tallennus epäonnistui");
      imagePath = imagePath ?? tallennettu.path;

      igPostId = await publishToInstagram(
        connection.instagramId,
        pageToken,
        message,
        tallennettu.url,
      );
      instagram = "ok";
    } catch (error) {
      instagram = "failed";
      igError = selita(error, t);
      console.error("meta: instagram-julkaisu", {
        restaurant: restaurant.id,
        code: error instanceof MetaError ? error.code : null,
        subcode: error instanceof MetaError ? error.subcode : null,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /*
   * Vanhentunut tokeni merkitään yhteyteen.
   *
   * Muuten asetusnäkymä näyttäisi vihreää ja julkaisu epäonnistuisi
   * joka kerta ilman että kukaan tietää miksi.
   */
  const tokeniPetti = [fbError, igError].some(
    (e) => e === t.some.errTokenExpired,
  );

  if (tokeniPetti) {
    await supabase.rpc("meta_set_status", {
      p_restaurant: restaurant.id,
      p_status: "expired",
      p_detail: null,
    });
  }

  await supabase.rpc("meta_record_publication", {
    p_restaurant: restaurant.id,
    p_menu: menuId,
    p_week_start: weekStart,
    p_message: message,
    p_image_path: imagePath,
    p_facebook_status: facebook,
    p_facebook_post_id: fbPostId,
    p_facebook_error: fbError,
    p_instagram_status: instagram,
    p_instagram_post_id: igPostId,
    p_instagram_error: igError,
  });

  revalidatePath("/admin/lounas");
  revalidatePath("/admin/asetukset/some");

  const onnistui =
    (facebook === "ok" || facebook === "skipped") &&
    (instagram === "ok" || instagram === "skipped");

  return {
    facebook,
    instagram,
    facebookError: fbError ?? undefined,
    instagramError: igError ?? undefined,
    notice: onnistui ? t.some.published : undefined,
    error: onnistui ? undefined : t.some.partial,
  };
}

"use server";

/**
 * Yrityksen profiilikuva.
 *
 * Kuva on yrityksen oma eikä Katen: se näkyy siellä missä yritys
 * tunnistetaan — asetuksissa, puhelimen tilikortissa ja tulostetun
 * raportin otsikossa.
 *
 * SELAIN PIENENTÄÄ, PALVELIN TARKISTAA.
 *
 * Selain piirtää kuvan neliöksi ennen lähetystä, jolloin puhelimen
 * kymmenen megatavun valokuva ei koskaan lähde verkkoon ja EXIF-tiedot
 * — myös sijainti — jäävät pois. Palvelin ei kuitenkaan luota siihen:
 * tyyppi, koko ja kohdekansio tarkistetaan täällä, ja kannassa vielä
 * kerran. Selaimelta tuleva arvo on toive, ei tosiasia.
 */

import { revalidatePath } from "next/cache";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { requireContext } from "@/lib/restoflow/session";
import { createClient } from "@/utils/supabase/server";
import { can } from "@/lib/restoflow/permissions";
import type { AdminState } from "../actions";

/**
 * Sallitut tyypit ja päätteet.
 *
 * Sama lista on säiliön määrittelyssä, joten väärä tyyppi torjutaan
 * myös silloin kun se ohittaisi tämän tarkistuksen.
 */
const TYYPIT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Kaksi megatavua. Neliöksi pienennetty kuva on murto-osa tästä. */
const YLARAJA = 2 * 1024 * 1024;

export async function updateRestaurantLogo(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext("/admin/asetukset");

  /*
   * Rooli tarkistetaan täällä eikä vain käyttöliittymässä.
   *
   * Piilotettu lomake ei ole pääsynhallintaa: toiminnon voi kutsua
   * ilman sivua. Kanta torjuu tämän vielä kerran, mutta virheen
   * paikka on siellä missä se osataan kertoa suomeksi.
   */
  if (!can(role, "settings.edit")) {
    return { error: t.toiminnot.ownerOnlyBody };
  }

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: t.asetus.logoMissing };
  }

  const pääte = TYYPIT[file.type];
  if (!pääte) return { error: t.asetus.logoWrongType };
  if (file.size > YLARAJA) return { error: t.asetus.logoTooBig };

  const supabase = await createClient();

  /*
   * Uusi nimi joka kerta.
   *
   * Sama polku uudelleen jäisi selaimen ja välimuistin varaan: vanha
   * kuva näkyisi vielä tallennuksen jälkeen. Vanha tiedosto poistetaan
   * vasta kun uusi on tallessa ja polku vaihdettu.
   */
  const { data: vanha } = await supabase
    .from("restaurants")
    .select("logo_path")
    .eq("id", restaurant.id)
    .maybeSingle();

  const polku = `${restaurant.id}/${crypto.randomUUID()}.${pääte}`;

  const { error: uploadError } = await supabase.storage
    .from("logos")
    .upload(polku, file, { contentType: file.type, upsert: false });

  if (uploadError) return { error: t.asetus.logoSaveFailed };

  const { error } = await supabase.rpc("set_restaurant_logo", {
    p_restaurant: restaurant.id,
    p_path: polku,
  });

  if (error) {
    // Polku ei vaihtunut, joten juuri lähetetty tiedosto on roskaa.
    await supabase.storage.from("logos").remove([polku]);
    return { error: t.asetus.logoSaveFailed };
  }

  const vanhaPolku = (vanha?.logo_path as string | null) ?? null;
  if (vanhaPolku && vanhaPolku !== polku) {
    await supabase.storage.from("logos").remove([vanhaPolku]);
  }

  revalidatePath("/admin", "layout");

  return { notice: t.asetus.logoSaved };
}

/** Kuvan poisto. Tilalle palaa yrityksen alkukirjain. */
/* Ilman parametreja: poisto ei lue lomaketta eikä edellistä tilaa. */
export async function removeRestaurantLogo(): Promise<AdminState> {
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext("/admin/asetukset");

  if (!can(role, "settings.edit")) {
    return { error: t.toiminnot.ownerOnlyBody };
  }

  const supabase = await createClient();

  const { data: vanha } = await supabase
    .from("restaurants")
    .select("logo_path")
    .eq("id", restaurant.id)
    .maybeSingle();

  const { error } = await supabase.rpc("set_restaurant_logo", {
    p_restaurant: restaurant.id,
    p_path: null,
  });

  if (error) return { error: t.asetus.logoSaveFailed };

  const polku = (vanha?.logo_path as string | null) ?? null;
  if (polku) await supabase.storage.from("logos").remove([polku]);

  revalidatePath("/admin", "layout");

  return { notice: t.asetus.logoRemoved };
}

"use server";

/**
 * Myyntiryhmien ja verokantojen hallinta.
 *
 * VEROKANTA VALIDOIDAAN PALVELIMELLA.
 *
 * Selaimen lomakkeeseen voi kirjoittaa mitä tahansa, ja verokanta
 * päätyy jokaisen tulevan myyntirivin laskentaan. Kanta tarkistetaan
 * tässä ja vielä kannan check-ehdossa — kaksi porttia, koska väärä
 * kanta ei näy mistään ennen kuin kirjanpitäjä huomaa sen.
 *
 * PROSENTTI TULEE LOMAKKEESTA, OSUUS MENEE KANTAAN.
 *
 * Käyttäjä kirjoittaa "13,5" tai "25,5". Kanta tallentaa 0.13500 ja
 * 0.25500. Muunnos on yhdessä paikassa, jottei jossain näkymässä
 * verrattaisi prosenttia osuuteen.
 */

import { revalidatePath } from "next/cache";
import type { AdminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { adminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { requireContext } from "@/lib/restoflow/session";
import { can } from "@/lib/restoflow/permissions";
import { parseRate } from "@/lib/restoflow/sales-vat";

export interface VatState {
  error?: string;
  notice?: string;
}

const PATH = "/admin/asetukset";

const groupSchema = (t: AdminText) =>
  z.object({
    name: z.string().trim().min(1, t.asetus.giveGroupName).max(60),
  });

export async function saveSalesGroup(
  _prev: VatState,
  formData: FormData,
): Promise<VatState> {
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext(PATH);
  if (!can(role, "settings.edit")) return { error: t.asetus.noRightSettings };

  const parsed = groupSchema(t).safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const rate = parseRate(formData.get("rate"));
  if (rate === null) {
    return { error: t.asetus.givePercentRate };
  }

  const id = String(formData.get("id") ?? "").trim();
  const active = formData.get("active") === "on";

  const supabase = await createClient();

  const row = {
    restaurant_id: restaurant.id,
    name: parsed.data.name,
    vat_rate: rate,
    active,
  };

  const { error } = id
    ? await supabase.from("sales_groups").update(row).eq("id", id)
    : await supabase.from("sales_groups").insert(row);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? t.asetus.groupExists
          : fill(t.asetus.saveFailedWith, { viesti: error.message }),
    };
  }

  revalidatePath("/admin", "layout");
  return { notice: id ? t.asetus.groupSaved : t.asetus.groupAdded };
}

/**
 * Oletusryhmän vaihto.
 *
 * Kaksi kirjoitusta yhden sijaan, koska kannassa on osittainen
 * yksikäsitteisyysindeksi: vanha oletus on nollattava ennen kuin uusi
 * voi ottaa paikan. Väärässä järjestyksessä indeksi hylkäisi
 * jälkimmäisen.
 */
export async function setDefaultSalesGroup(formData: FormData): Promise<void> {
  const { restaurant, role } = await requireContext(PATH);
  if (!can(role, "settings.edit")) return;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();

  await supabase
    .from("sales_groups")
    .update({ is_default: false })
    .eq("restaurant_id", restaurant.id)
    .eq("is_default", true);

  await supabase.from("sales_groups").update({ is_default: true }).eq("id", id);

  revalidatePath("/admin", "layout");
}

/**
 * Ryhmän poisto.
 *
 * Onnistuu vain jos ryhmää ei ole käytetty. Kannan viite-eheys estää
 * poiston (on delete restrict), ja se on oikea käytös: poistettu ryhmä
 * veisi mukanaan päivän myynnin. Käytössä oleva ryhmä otetaan pois
 * käytöstä eikä poisteta.
 */
export async function deleteSalesGroup(
  _prev: VatState,
  formData: FormData,
): Promise<VatState> {
  const t = adminText(await resolveLocale());
  const { role } = await requireContext(PATH);
  if (!can(role, "settings.edit")) return { error: t.asetus.noRightSettings };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return {};

  const supabase = await createClient();

  /*
   * KÄYTTÖ TARKISTETAAN ENNEN POISTOA.
   *
   * Kanta estää poiston viite-eheydellä, mutta virhekoodin
   * kiinniottaminen on hauras tapa saada se selville: koodi kulkee
   * kolmen kerroksen läpi ja voi kadota matkalla. Esitarkistus antaa
   * myös paremman viestin — käyttäjä näkee montako päivää estää
   * poiston.
   *
   * Alla oleva virhekäsittely jää varalta: kahden käyttäjän kilpailu
   * voi silti johtaa rikkomukseen.
   */
  const { count } = await supabase
    .from("daily_sales_lines")
    .select("id", { count: "exact", head: true })
    .eq("sales_group_id", id);

  if (count && count > 0) {
    return {
      error: fill(t.asetus.groupUsedOnRows, { maara: String(count) }),
    };
  }

  const { error } = await supabase.from("sales_groups").delete().eq("id", id);

  /*
   * Epäonnistuminen on kerrottava.
   *
   * Kanta estää käytössä olevan ryhmän poiston viite-eheydellä, ja
   * ilman virheilmoitusta nappi näytti tekevän jotain muttei tehnyt
   * mitään. Vaiettu epäonnistuminen on pahempi kuin estetty
   * toiminto: käyttäjä painaa uudestaan ja päättelee sovelluksen
   * olevan rikki.
   *
   * 23503 on viite-eheysrikkomus.
   */
  if (error) {
    return {
      error:
        error.code === "23503"
          ? t.asetus.groupInUseBody
          : fill(t.asetus.deleteFailedWith, { viesti: error.message }),
    };
  }

  revalidatePath("/admin", "layout");
  return { notice: t.asetus.groupDeleted };
}

// ---------------------------------------------------------------------------
// Kassaryhmien kohdistus
// ---------------------------------------------------------------------------

const mappingSchema = (t: AdminText) =>
  z.object({
    posName: z.string().trim().min(1, t.asetus.giveRegisterName).max(80),
    salesGroupId: z.string().uuid(t.asetus.chooseSalesGroup),
  });

export async function savePosMapping(
  _prev: VatState,
  formData: FormData,
): Promise<VatState> {
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext(PATH);
  if (!can(role, "settings.edit")) return { error: t.asetus.noRightSettings };

  const parsed = mappingSchema(t).safeParse({
    posName: formData.get("posName"),
    salesGroupId: formData.get("salesGroupId"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  /*
   * Kohdistus on upsert nimen perusteella.
   *
   * Sama kassaryhmä kahdesti tarkoittaisi että myynnin verokanta
   * riippuu siitä kumman kysely löytää ensin. Kannassa on
   * yksikäsitteisyysehto; tämä tekee toistosta korjauksen eikä
   * virheen.
   */
  const { error } = await supabase.from("pos_sales_groups").upsert(
    {
      restaurant_id: restaurant.id,
      pos_name: parsed.data.posName,
      sales_group_id: parsed.data.salesGroupId,
    },
    { onConflict: "restaurant_id,pos_name" },
  );

  if (error)
    return {
      error: fill(t.asetus.mappingSaveFailed, { viesti: error.message }),
    };

  revalidatePath("/admin", "layout");
  return { notice: t.asetus.mappingSaved };
}

export async function deletePosMapping(formData: FormData): Promise<void> {
  const { role } = await requireContext(PATH);
  if (!can(role, "settings.edit")) return;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("pos_sales_groups").delete().eq("id", id);

  revalidatePath("/admin", "layout");
}

/**
 * Suomen vakioryhmät ravintolalle jolla ei ole vielä yhtään.
 *
 * Sama pohja kuin uudella ravintolalla. Kanta tarkistaa ettei ryhmiä
 * ole ennestään — ravintola joka on määrittänyt omat ryhmänsä ei saa
 * löytää niiden joukosta kolmea uutta.
 */
export async function seedDefaultSalesGroups(): Promise<void> {
  const { restaurant, role } = await requireContext(PATH);
  if (!can(role, "settings.edit")) return;

  const supabase = await createClient();
  await supabase.rpc("seed_default_sales_groups", {
    p_restaurant: restaurant.id,
  });

  revalidatePath("/admin", "layout");
}

/**
 * Yleiset kassaryhmänimet kohdistuksiksi.
 *
 * Suomalaiset kassat käyttävät samoja sanoja: OLUT on olut joka
 * ravintolassa. Lista on lähtökohta jonka ravintola muokkaa.
 *
 * EI KIRJOITA PÄÄLLE.
 *
 * Kanta ohittaa nimet jotka ravintolalla on jo, myös silloin kun ne
 * osoittavat eri ryhmään kuin oletus. Oma kohdistus on tietoinen
 * päätös eikä oletuslistan pidä kumota sitä.
 */
export async function seedDefaultPosMappings(): Promise<void> {
  const { restaurant, role } = await requireContext(PATH);
  if (!can(role, "settings.edit")) return;

  const supabase = await createClient();
  await supabase.rpc("seed_default_pos_mappings", {
    p_restaurant: restaurant.id,
  });

  revalidatePath("/admin", "layout");
}

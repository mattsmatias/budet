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
 * Käyttäjä kirjoittaa "14" tai "25,5". Kanta tallentaa 0.14000 ja
 * 0.25500. Muunnos on yhdessä paikassa, jottei jossain näkymässä
 * verrattaisi prosenttia osuuteen.
 */

import { revalidatePath } from "next/cache";
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

const groupSchema = z.object({
  name: z.string().trim().min(1, "Anna myyntiryhmälle nimi.").max(60),
});

export async function saveSalesGroup(
  _prev: VatState,
  formData: FormData,
): Promise<VatState> {
  const { restaurant, role } = await requireContext(PATH);
  if (!can(role, "settings.edit")) return { error: "Ei oikeutta muuttaa asetuksia." };

  const parsed = groupSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const rate = parseRate(formData.get("rate"));
  if (rate === null) {
    return { error: "Anna verokanta prosentteina, esimerkiksi 14 tai 25,5." };
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
      error: error.code === "23505"
        ? "Samanniminen myyntiryhmä on jo olemassa."
        : `Tallennus epäonnistui: ${error.message}`,
    };
  }

  revalidatePath("/admin", "layout");
  return { notice: id ? "Myyntiryhmä tallennettu." : "Myyntiryhmä lisätty." };
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
export async function deleteSalesGroup(formData: FormData): Promise<void> {
  const { role } = await requireContext(PATH);
  if (!can(role, "settings.edit")) return;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("sales_groups").delete().eq("id", id);

  revalidatePath("/admin", "layout");
}

// ---------------------------------------------------------------------------
// Kassaryhmien kohdistus
// ---------------------------------------------------------------------------

const mappingSchema = z.object({
  posName: z.string().trim().min(1, "Anna kassan ryhmänimi.").max(80),
  salesGroupId: z.string().uuid("Valitse myyntiryhmä."),
});

export async function savePosMapping(
  _prev: VatState,
  formData: FormData,
): Promise<VatState> {
  const { restaurant, role } = await requireContext(PATH);
  if (!can(role, "settings.edit")) return { error: "Ei oikeutta muuttaa asetuksia." };

  const parsed = mappingSchema.safeParse({
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

  if (error) return { error: `Kohdistuksen tallennus epäonnistui: ${error.message}` };

  revalidatePath("/admin", "layout");
  return { notice: "Kohdistus tallennettu." };
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

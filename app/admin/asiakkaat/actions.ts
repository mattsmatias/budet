"use server";

import { revalidatePath } from "next/cache";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { requireContext } from "@/lib/restoflow/session";
import { createClient } from "@/utils/supabase/server";
import { can } from "@/lib/restoflow/permissions";
import { onKelvollinenYTunnus, siistiYTunnus } from "@/lib/restoflow/yritystunnus";
import { haeYtj, type YtjOsuma } from "@/lib/restoflow/ytj";
import { searchCustomers, type Customer } from "@/lib/restoflow/customers";
import type { AdminState } from "../actions";

export interface HakuTulos {
  omat: Customer[];
  ytj: YtjOsuma[];
  /** Tosi jos YTJ ei vastannut. Eri asia kuin "ei osumia". */
  ytjVirhe: boolean;
}

/**
 * Haku kahdesta lähteestä yhdellä sanalla.
 *
 * Omat asiakkaat ensin: jos yritys on jo rekisterissä, sitä ei lisätä
 * toista kertaa YTJ:stä. Rekisteristä löytyvät suodatetaan pois
 * YTJ-osumista Y-tunnuksen perusteella, jotta sama yritys ei näy
 * listassa kahdesti eri otsikon alla.
 *
 * YTJ-kutsu tehdään vasta kun hakusana on kolme merkkiä: lyhyempi
 * palauttaisi satoja osumia eikä kertoisi mitään.
 */
export async function searchRecipients(hakusana: string): Promise<HakuTulos> {
  const { restaurant, role } = await requireContext("/admin/asiakkaat");

  if (!can(role, "expenses.view")) {
    return { omat: [], ytj: [], ytjVirhe: false };
  }

  const sana = hakusana.trim();
  if (sana.length < 2) return { omat: [], ytj: [], ytjVirhe: false };

  const omat = await searchCustomers(restaurant.id, sana);

  const { osumat, virhe } = await haeYtj(sana);
  const omatTunnukset = new Set(
    omat.map((o) => o.businessId).filter((t): t is string => t !== null),
  );

  return {
    omat,
    ytj: osumat.filter((o) => !omatTunnukset.has(o.businessId)),
    ytjVirhe: virhe,
  };
}

/**
 * Asiakkaan tallennus.
 *
 * Sama teko YTJ:stä poimitulle ja käsin kirjoitetulle: molemmissa
 * kentät tulevat lomakkeelta, ja molemmat tarkistetaan samalla tavalla.
 * Eri polku kummallekin tarkoittaisi että toisen tarkistukset ehtivät
 * jäädä jälkeen.
 */
export async function saveCustomer(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const t = adminText(await resolveLocale());
  const { restaurant, role, user } = await requireContext("/admin/asiakkaat");

  if (!can(role, "expenses.view") || !can(role, "receipts.edit")) {
    return { error: t.toiminnot.ownerOnlyBody };
  }

  const teksti = (nimi: string) => String(formData.get(nimi) ?? "").trim();
  const taiNull = (arvo: string) => (arvo === "" ? null : arvo);

  const name = teksti("name");
  if (name === "") return { error: t.asiakkaat.nameRequired };

  /*
   * Y-tunnus tarkistetaan tarkistusnumeroa myöten.
   *
   * Näppäilyvirhe löytyy tässä eikä vasta kun lasku palaa perille
   * menemättömänä. Tyhjä on sallittu: yksityishenkilöllä ei ole
   * Y-tunnusta eikä sitä saa vaatia.
   */
  const tunnusSyote = teksti("businessId");
  let businessId: string | null = null;

  if (tunnusSyote !== "") {
    const siisti = siistiYTunnus(tunnusSyote);
    if (siisti === null || !onKelvollinenYTunnus(siisti)) {
      return { error: t.asiakkaat.badBusinessId };
    }
    businessId = siisti;
  }

  const rivi = {
    restaurant_id: restaurant.id,
    name: name.slice(0, 200),
    business_id: businessId,
    care_of: taiNull(teksti("careOf").slice(0, 120)),
    street: taiNull(teksti("street").slice(0, 160)),
    postal_code: taiNull(teksti("postalCode").slice(0, 12)),
    city: taiNull(teksti("city").slice(0, 80)),
    country: (teksti("country") || "FI").slice(0, 2).toUpperCase(),
    email: taiNull(teksti("email").slice(0, 200)),
    note: taiNull(teksti("note").slice(0, 500)),
  };

  const supabase = await createClient();
  const id = teksti("id");

  const { error } =
    id === ""
      ? await supabase.from("customers").insert({ ...rivi, created_by: user.id })
      : await supabase
          .from("customers")
          .update(rivi)
          .eq("id", id)
          .eq("restaurant_id", restaurant.id);

  if (error) {
    /* 23505 on ainutkertaisuus: sama Y-tunnus on jo rekisterissä. */
    if (error.code === "23505") return { error: t.asiakkaat.alreadySaved };
    return { error: t.asiakkaat.failed };
  }

  revalidatePath("/admin/asiakkaat");

  return { notice: t.asiakkaat.saved };
}

/**
 * Arkistointi, ei poisto.
 *
 * Asiakkaaseen voi liittyä laskuja, ja lasku ilman vastaanottajaa olisi
 * tosite ilman osapuolta. Rivi jää kantaan ja katoaa vain listalta.
 */
export async function archiveCustomer(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext("/admin/asiakkaat");

  if (!can(role, "receipts.edit")) {
    return { error: t.toiminnot.ownerOnlyBody };
  }

  const id = String(formData.get("id") ?? "");
  if (id === "") return { error: t.asiakkaat.failed };

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("restaurant_id", restaurant.id);

  if (error) return { error: t.asiakkaat.failed };

  revalidatePath("/admin/asiakkaat");

  return { notice: t.asiakkaat.archived };
}

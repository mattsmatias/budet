"use server";

/**
 * TES-pohjien hallinta.
 *
 * Vain Katen hallinta luo ja muokkaa sopimuksia. Yritysasiakas ei
 * syötä TES-lisiä: hän ei tiedä oman sopimuksensa iltalisää senttinä,
 * ja väärin syötetty luku näyttäisi tarkalta koko kuukauden ajan.
 *
 * Tarkistus tehdään sekä täällä että kannassa. Kannan rivikäytäntö on
 * se joka pitää; tämä on se joka osaa kertoa syyn suomeksi.
 */

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/restoflow/session";
import { createClient } from "@/utils/supabase/server";
import { isBusinessType } from "@/lib/restoflow/business";
import type { DevState } from "../actions";

const ISO_PAIVA = /^\d{4}-\d{2}-\d{2}$/;
const KELLO = /^\d{1,2}:\d{2}$/;

function teksti(data: FormData, name: string): string {
  return String(data.get(name) ?? "").trim();
}

/** "1,40" → 1.4. Kelvoton → null. Tyhjä → 0. */
function luku(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (cleaned === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export async function saveTes(
  _prev: DevState,
  data: FormData,
): Promise<DevState> {
  await requireSuperAdmin();

  const id = teksti(data, "id");
  const slug = teksti(data, "slug").toLowerCase();
  const name = teksti(data, "name");
  const industry = data.get("industry");
  const validFrom = teksti(data, "validFrom");
  const validUntil = teksti(data, "validUntil");

  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return { error: "Tunnus saa sisältää vain pieniä kirjaimia ja viivoja." };
  }
  if (name === "") return { error: "Nimi puuttuu." };
  if (!isBusinessType(industry)) return { error: "Toimiala puuttuu." };
  if (!ISO_PAIVA.test(validFrom)) {
    return { error: "Voimassaolon alku puuttuu." };
  }
  if (validUntil !== "" && !ISO_PAIVA.test(validUntil)) {
    return { error: "Voimassaolon loppu on väärässä muodossa." };
  }
  if (validUntil !== "" && validUntil < validFrom) {
    return { error: "Voimassaolo päättyy ennen alkuaan." };
  }

  const rivi = {
    slug,
    name,
    industry,
    valid_from: validFrom,
    valid_until: validUntil === "" ? null : validUntil,
    is_active: data.get("isActive") === "on",
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();

  const { error } = id
    ? await supabase.from("tes_agreements").update(rivi).eq("id", id)
    : await supabase.from("tes_agreements").insert(rivi);

  if (error) return { error: "Tallennus epäonnistui." };

  revalidatePath("/kehittaja/tes");
  return { notice: id ? "TES tallennettiin." : "TES lisättiin." };
}

/**
 * Yksi lisä sopimukseen.
 *
 * Nolla-arvo poistaa lisän: tyhjä kenttä on selvempi tapa sanoa
 * "tätä lisää ei ole" kuin erillinen poistonappi jokaiselle riville.
 */
export async function saveTesRule(
  _prev: DevState,
  data: FormData,
): Promise<DevState> {
  await requireSuperAdmin();

  const tesId = teksti(data, "tesId");
  const ruleType = teksti(data, "ruleType");
  const name = teksti(data, "name");
  const unit = teksti(data, "unit");
  const value = luku(teksti(data, "value"));
  const startTime = teksti(data, "startTime");
  const endTime = teksti(data, "endTime");

  if (tesId === "") return { error: "TES:iä ei tunnistettu." };
  if (!["evening", "night", "saturday", "sunday", "eve"].includes(ruleType)) {
    return { error: "Lisän lajia ei tunnistettu." };
  }
  if (!["eur_per_hour", "percent"].includes(unit)) {
    return { error: "Yksikkö puuttuu." };
  }
  if (value === null) return { error: "Arvo ei kelpaa." };
  if (startTime !== "" && !KELLO.test(startTime)) {
    return { error: "Alkuaika on väärässä muodossa." };
  }
  if (endTime !== "" && !KELLO.test(endTime)) {
    return { error: "Loppuaika on väärässä muodossa." };
  }

  const supabase = await createClient();

  if (value === 0) {
    await supabase
      .from("tes_rules")
      .delete()
      .eq("tes_id", tesId)
      .eq("rule_type", ruleType);

    revalidatePath("/kehittaja/tes");
    return { notice: "Lisä poistettiin." };
  }

  const { error } = await supabase.from("tes_rules").upsert(
    {
      tes_id: tesId,
      rule_type: ruleType,
      name: name === "" ? ruleType : name,
      unit,
      value,
      start_time: startTime === "" ? null : startTime,
      end_time: endTime === "" ? null : endTime,
    },
    { onConflict: "tes_id,rule_type" },
  );

  if (error) return { error: "Lisän tallennus epäonnistui." };

  revalidatePath("/kehittaja/tes");
  return { notice: "Lisä tallennettiin." };
}

/** Yrityksen sopimus. Toimiala voi ehdottaa, ihminen päättää. */
export async function setRestaurantTes(
  _prev: DevState,
  data: FormData,
): Promise<DevState> {
  await requireSuperAdmin();

  const restaurant = teksti(data, "restaurantId");
  const tes = teksti(data, "tesId");
  if (restaurant === "") return { error: "Yritystä ei tunnistettu." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("sa_set_restaurant_tes", {
    p_restaurant: restaurant,
    p_tes: tes === "" ? null : tes,
  });

  if (error) return { error: "TES:in asetus epäonnistui." };

  revalidatePath("/kehittaja", "layout");
  revalidatePath("/admin/asetukset");
  revalidatePath("/admin/palkat");

  return { notice: tes === "" ? "TES poistettiin." : "TES asetettiin." };
}

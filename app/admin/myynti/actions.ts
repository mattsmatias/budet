"use server";

/**
 * Päivän myynnin kirjaus.
 *
 * Yksi luku päivässä. Kaikki muu ohjauspaneelin myyntipuoli — vertailu,
 * työvoiman osuus, karkea tulos — johdetaan tästä, joten tämä on ainoa
 * paikka jossa myynti syntyy.
 */

import { revalidatePath } from "next/cache";
import { ISO_DATE } from "@/lib/restoflow/dates";
import { createClient } from "@/utils/supabase/server";
import { requireContext } from "@/lib/restoflow/session";
import { can } from "@/lib/restoflow/permissions";

export interface SalesState {
  error?: string;
  notice?: string;
}

const PATH = "/admin/myynti";

/** "1 234,50" tai "1234.5" → 123450. Tyhjä → null. */
function parseEuros(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "")
    .replace(/\s| /g, "")
    .replace(",", ".");

  if (text === "") return null;

  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) return null;

  return Math.round(amount * 100);
}

export async function saveDailySales(
  _prev: SalesState,
  formData: FormData,
): Promise<SalesState> {
  const { restaurant, role, user } = await requireContext(PATH);
  if (!can(role, "sales.manage")) return { error: "Ei oikeutta kirjata myyntiä." };

  const date = String(formData.get("date") ?? "");
  if (!ISO_DATE.test(date)) return { error: "Tarkista päivämäärä." };

  const net = parseEuros(formData.get("net"));
  if (net === null) return { error: "Syötä päivän veroton myynti." };

  const target = parseEuros(formData.get("target"));
  const note = String(formData.get("note") ?? "").trim() || null;

  const supabase = await createClient();
  const { error } = await supabase.from("daily_sales").upsert(
    {
      restaurant_id: restaurant.id,
      sales_date: date,
      net_sales_cents: net,
      target_cents: target,
      note,
      created_by: user.id,
    },
    { onConflict: "restaurant_id,sales_date" },
  );

  if (error) {
    return { error: `Myynnin tallennus epäonnistui: ${error.message}` };
  }

  // Myynti muuttaa yleiskuvan, raportit ja budjetin, joten koko
  // hallintapuoli on päivitettävä eikä vain tämä sivu.
  revalidatePath("/admin", "layout");
  return { notice: "Myynti tallennettu." };
}

/** Poistaa päivän merkinnän. Väärin kirjattu luku on pahempi kuin puuttuva. */
export async function deleteDailySales(formData: FormData): Promise<void> {
  const { restaurant, role } = await requireContext(PATH);
  if (!can(role, "sales.manage")) return;

  const date = String(formData.get("date") ?? "");
  if (!ISO_DATE.test(date)) return;

  const supabase = await createClient();
  await supabase
    .from("daily_sales")
    .delete()
    .eq("restaurant_id", restaurant.id)
    .eq("sales_date", date);

  revalidatePath("/admin", "layout");
}

"use server";

/**
 * Tuonnin palvelinpuoli.
 *
 * Tiedosto luetaan ja tulkitaan selaimessa: sinne se on jo valittu, ja
 * tulkinta on puhdasta laskentaa jonka tulos on nähtävä ennen kuin
 * mitään tallennetaan. Palvelimelle lähtee siis valmis rivilista eikä
 * tiedostoa — silloin asiakkaiden nimiä ja numeroita ei myöskään
 * päädy palvelimen lokeihin tiedostona jota kukaan ei pyytänyt.
 *
 * Tämä kerros tarkistaa muodon ja välittää rivit kannan funktiolle.
 * Säännöt — onko pöytä vapaa, onko rivi jo tuotu — ovat siellä, koska
 * ne ovat samat riippumatta siitä mistä rivit tulevat.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminText } from "@/lib/i18n/admin-text";
import { ISO_DATE } from "@/lib/restoflow/dates";
import { resolveLocale } from "@/lib/i18n/resolve";
import { createClient } from "@/utils/supabase/server";
import { requireContext } from "@/lib/restoflow/session";

const REITTI = "/admin/varaukset/tuonti";

export interface ImportRowResult {
  row: number;
  ok: boolean;
  skipped?: boolean;
  error?: string;
  name?: string;
  unknownTables?: string | null;
}

export interface ImportResult {
  error?: string;
  added: number;
  skipped: number;
  failed: number;
  rows: ImportRowResult[];
}

const tyhja: ImportResult = { added: 0, skipped: 0, failed: 0, rows: [] };

const PoytaSchema = z.object({
  name: z.string().trim().min(1).max(60),
  seatsMin: z.number().int().min(1).max(200),
  seatsMax: z.number().int().min(1).max(200),
  area: z.string().trim().max(60).optional(),
  shape: z.enum(["round", "square", "rect"]).optional(),
});

const VarausSchema = z.object({
  date: z.string().regex(ISO_DATE),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  partySize: z.number().int().min(1).max(200),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(160).optional(),
  note: z.string().trim().max(500).optional(),
  allergies: z.string().trim().max(200).optional(),
  status: z
    .enum(["pending", "confirmed", "arrived", "completed", "cancelled", "no_show"])
    .optional(),
  tables: z.array(z.string().trim().min(1).max(60)).max(8).optional(),
});

/**
 * Pöydät kantaan.
 *
 * Yläraja on kannan sama raja: viisisataa riviä kerralla. Selain
 * paloittelee suuremman tiedoston, jotta yksikään kutsu ei jää auki
 * minuutiksi.
 */
export async function importTables(
  rows: unknown[],
): Promise<ImportResult> {
  const t = adminText(await resolveLocale());
  const { restaurant } = await requireContext(REITTI);

  const parsed = z.array(PoytaSchema).max(500).safeParse(rows);
  if (!parsed.success) return { ...tyhja, error: t.varausTuonti.errRows };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reservation_import_tables", {
    p_restaurant: restaurant.id,
    p_rows: parsed.data,
  });

  if (error || !data) return { ...tyhja, error: t.varausTuonti.errGeneric };

  revalidatePath("/admin/varaukset/asetukset");
  revalidatePath("/admin/varaukset");

  return data as unknown as ImportResult;
}

/**
 * Varaukset kantaan.
 *
 * Pienempi pala kuin pöydissä: jokainen rivi kulkee varausmoottorin
 * läpi ja ottaa ravintolakohtaisen lukon, joten sata riviä on jo
 * sekuntien työ. Pala kerrallaan tarkoittaa myös, että keskeytynyt
 * tuonti on puoliksi tehty eikä kokonaan hukassa.
 */
export async function importReservations(
  rows: unknown[],
): Promise<ImportResult> {
  const t = adminText(await resolveLocale());
  const { restaurant } = await requireContext(REITTI);

  const parsed = z.array(VarausSchema).max(200).safeParse(rows);
  if (!parsed.success) return { ...tyhja, error: t.varausTuonti.errRows };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "reservation_import_reservations",
    {
      p_restaurant: restaurant.id,
      p_rows: parsed.data,
    },
  );

  if (error || !data) return { ...tyhja, error: t.varausTuonti.errGeneric };

  revalidatePath("/admin/varaukset");
  revalidatePath("/admin/varaukset/lista");

  return data as unknown as ImportResult;
}

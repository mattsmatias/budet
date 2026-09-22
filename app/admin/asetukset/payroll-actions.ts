"use server";

/**
 * Palkkakulujen asetukset.
 *
 * Prosentit ovat yrityksen omia: ne riippuvat työehtosopimuksesta ja
 * muuttuvat vuosittain. Kate ei tiedä oikeaa lukua eikä arvaa sitä —
 * tyhjä kenttä tarkoittaa nollaa, jolloin arvio on pelkkä bruttopalkka.
 */

import { revalidatePath } from "next/cache";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { requireContext } from "@/lib/restoflow/session";
import { createClient } from "@/utils/supabase/server";
import { can } from "@/lib/restoflow/permissions";
import { parsePercent } from "@/lib/restoflow/payroll";
import type { AdminState } from "../actions";

/** "18:00" → 1080. Kelvoton → null. */
function parseClock(raw: string): number | null {
  const match = raw.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

export async function updatePayrollSettings(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext("/admin/asetukset");

  if (!can(role, "settings.edit")) {
    return { error: t.toiminnot.ownerOnlyBody };
  }

  const kentat = {
    side_cost_rate: parsePercent(String(formData.get("sideCost") ?? "")),
    holiday_rate: parsePercent(String(formData.get("holiday") ?? "")),
    evening_rate: parsePercent(String(formData.get("evening") ?? "")),
    saturday_rate: parsePercent(String(formData.get("saturday") ?? "")),
    sunday_rate: parsePercent(String(formData.get("sunday") ?? "")),
  };

  for (const arvo of Object.values(kentat)) {
    if (arvo === null) return { error: t.palkkaAs.percentInvalid };
  }

  const start = parseClock(String(formData.get("eveningStart") ?? ""));
  const end = parseClock(String(formData.get("eveningEnd") ?? ""));
  if (start === null || end === null) {
    return { error: t.palkkaAs.clockInvalid };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("payroll_settings").upsert(
    {
      restaurant_id: restaurant.id,
      ...kentat,
      evening_start_minute: start,
      evening_end_minute: end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "restaurant_id" },
  );

  if (error) return { error: t.toiminnot.settingsSaveFailed };

  revalidatePath("/admin/asetukset");
  revalidatePath("/admin/tyontekijat");
  revalidatePath("/admin");

  return { notice: t.toiminnot.restaurantSaved };
}

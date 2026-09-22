"use server";

/**
 * Palkkakulujen asetukset.
 *
 * Arvot ovat yrityksen omia: ne riippuvat työehtosopimuksesta ja
 * muuttuvat vuosittain. Kate ei tiedä oikeaa lukua eikä arvaa sitä —
 * tyhjä kenttä tarkoittaa nollaa.
 *
 * Jokaisella lisällä on euromäärä ja prosentti, koska ravintola-alan
 * iltalisä on euroja tunnilta ja sunnuntaikorotus prosentti. Molemmat
 * tallennetaan ja lasketaan yhteen.
 */

import { revalidatePath } from "next/cache";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { requireContext } from "@/lib/restoflow/session";
import { createClient } from "@/utils/supabase/server";
import { can } from "@/lib/restoflow/permissions";
import { parseEuroPerHour, parsePercent } from "@/lib/restoflow/payroll";
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

  const teksti = (nimi: string) => String(formData.get(nimi) ?? "");

  const prosentit = {
    side_cost_rate: parsePercent(teksti("sideCost")),
    holiday_rate: parsePercent(teksti("holiday")),
    evening_rate: parsePercent(teksti("eveningRate")),
    night_rate: parsePercent(teksti("nightRate")),
    saturday_rate: parsePercent(teksti("saturdayRate")),
    sunday_rate: parsePercent(teksti("sundayRate")),
  };

  const eurot = {
    evening_cents: parseEuroPerHour(teksti("eveningCents")),
    night_cents: parseEuroPerHour(teksti("nightCents")),
    saturday_cents: parseEuroPerHour(teksti("saturdayCents")),
    sunday_cents: parseEuroPerHour(teksti("sundayCents")),
  };

  for (const arvo of Object.values(prosentit)) {
    if (arvo === null) return { error: t.palkkaAs.percentInvalid };
  }
  for (const arvo of Object.values(eurot)) {
    if (arvo === null) return { error: t.palkkaAs.euroInvalid };
  }

  const kellot = {
    evening_start_minute: parseClock(teksti("eveningStart")),
    evening_end_minute: parseClock(teksti("eveningEnd")),
    night_start_minute: parseClock(teksti("nightStart")),
    night_end_minute: parseClock(teksti("nightEnd")),
  };

  for (const arvo of Object.values(kellot)) {
    if (arvo === null) return { error: t.palkkaAs.clockInvalid };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("payroll_settings").upsert(
    {
      restaurant_id: restaurant.id,
      ...prosentit,
      ...eurot,
      ...kellot,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "restaurant_id" },
  );

  if (error) return { error: t.toiminnot.settingsSaveFailed };

  revalidatePath("/admin/asetukset");
  revalidatePath("/admin/palkat");
  revalidatePath("/admin");

  return { notice: t.toiminnot.restaurantSaved };
}

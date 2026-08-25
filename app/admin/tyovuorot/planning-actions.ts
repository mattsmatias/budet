"use server";

/**
 * Suunnittelun joukkotoiminnot.
 *
 * Kopiointi ja toistuvat vuorot tekevät monta riviä kerralla, joten
 * niiden pitää kertoa myös mitä EI tehty. Hiljaa ohitettu päällekkäinen
 * vuoro näyttäisi siltä että kopiointi epäonnistui puoliksi.
 */

import { revalidatePath } from "next/cache";
import { ISO_DATE } from "@/lib/restoflow/dates";
import { createClient } from "@/utils/supabase/server";
import { requireContext } from "@/lib/restoflow/session";
import { can } from "@/lib/restoflow/permissions";
import { defaultShiftFor } from "@/lib/restoflow/shift-defaults";
import { fetchShifts } from "@/lib/restoflow/queries";
import type { StaffPosition } from "@/lib/restoflow/types";
import type { AdminState } from "../actions";

/** Kannan funktio palauttaa yhden rivin: luodut ja ohitetut. */
interface CopyResult {
  created: number;
  skipped: number;
}

function readResult(data: unknown): CopyResult {
  const row = Array.isArray(data) ? data[0] : data;
  const value = (row ?? {}) as { created?: number; skipped?: number };

  return {
    created: Number(value.created ?? 0),
    skipped: Number(value.skipped ?? 0),
  };
}

/**
 * Kertoo tuloksen niin että sen voi tarkistaa.
 *
 * Pelkkä "kopioitu" jättää auki kopioitiinko kaikki. Ohitettujen määrä
 * on se luku jonka takia kalenteri kannattaa katsoa läpi.
 */
function describe({ created, skipped }: CopyResult): string {
  if (created === 0 && skipped === 0) return "Ei kopioitavia vuoroja.";

  const luodut = `${created} ${created === 1 ? "vuoro" : "vuoroa"} luotu luonnoksena`;

  if (skipped === 0) return `${luodut}.`;

  return (
    `${luodut}. ${skipped} ${skipped === 1 ? "ohitettiin" : "ohitettiin"} — ` +
    "niissä tekijällä oli jo päällekkäinen vuoro."
  );
}

export async function copyShiftRange(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const { restaurant, role } = await requireContext("/admin/tyovuorot");
  if (!can(role, "shifts.manage")) return { error: "Ei oikeutta kopioida vuoroja." };

  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  const offset = Number(formData.get("offset") ?? 0);

  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return { error: "Tarkista kopioitava jakso." };
  }

  if (!Number.isInteger(offset) || offset === 0) {
    return { error: "Tarkista mihin kopioidaan." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("copy_shifts", {
    p_restaurant: restaurant.id,
    p_from: from,
    p_to: to,
    p_offset: offset,
  });

  if (error) return { error: error.message ?? "Kopiointi epäonnistui." };

  revalidatePath("/admin", "layout");
  return { notice: describe(readResult(data)) };
}

/**
 * Yhden vuoron kopiointi viikoksi eteenpäin.
 *
 * Sama viikonpäivä, sama kello, sama tekijä. Se on ravintolan
 * tavallisin toisto, ja siihen ei tarvita lomaketta.
 */
export async function copyShiftNextWeek(formData: FormData): Promise<void> {
  const date = String(formData.get("date") ?? "");
  if (!ISO_DATE.test(date)) return;

  const { restaurant, role } = await requireContext("/admin/tyovuorot");
  if (!can(role, "shifts.manage")) return;

  const supabase = await createClient();
  await supabase.rpc("copy_shifts", {
    p_restaurant: restaurant.id,
    p_from: date,
    p_to: date,
    p_offset: 7,
  });

  revalidatePath("/admin", "layout");
}

/**
 * Vuoro raahaamalla: kuka ja mikä päivä, ajat päätellään.
 *
 * Kellonajat tulevat työntekijän viimeisimmästä vuorosta. Ravintolassa
 * sama ihminen tekee lähes aina samaa vuoroa, joten arvaus osuu
 * useimmiten — ja väärinkin osuessaan se on lähempänä kuin tyhjä
 * lomake.
 *
 * Syntyy luonnoksena kuten kaikki muutkin vuorot, joten väärä aika ei
 * mene kenellekään ennen julkaisua.
 */
export async function createShiftByDrop(formData: FormData): Promise<void> {
  const userId = String(formData.get("userId") ?? "");
  const date = String(formData.get("date") ?? "");

  if (!userId || !ISO_DATE.test(date)) return;

  const { restaurant, role } = await requireContext("/admin/tyovuorot");
  if (!can(role, "shifts.manage")) return;

  const shifts = await fetchShifts(restaurant.id);
  const defaults = defaultShiftFor(userId, shifts);

  const supabase = await createClient();
  await supabase.rpc("upsert_shift", {
    p_restaurant: restaurant.id,
    p_shift: null,
    p_user: userId,
    p_date: date,
    p_start: defaults.startTime,
    p_end: defaults.endTime,
    p_location: "",
    p_position: null,
    p_break: defaults.breakMinutes,
    p_note: null,
  });

  revalidatePath("/admin", "layout");
}

export async function createRecurringShifts(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const { restaurant, role } = await requireContext("/admin/tyovuorot");
  if (!can(role, "shifts.manage")) return { error: "Ei oikeutta luoda vuoroja." };

  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");

  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return { error: "Tarkista jakson päivämäärät." };
  }

  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
    return { error: "Tarkista kellonajat." };
  }

  if (start === end) return { error: "Alku- ja loppuaika ovat samat." };

  const weekdays = formData
    .getAll("weekday")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7);

  if (weekdays.length === 0) return { error: "Valitse vähintään yksi viikonpäivä." };

  const breakRaw = Number(String(formData.get("break") ?? "0").trim() || "0");
  const position = String(formData.get("position") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_recurring_shifts", {
    p_restaurant: restaurant.id,
    p_user: String(formData.get("userId") ?? "") || null,
    p_weekdays: weekdays,
    p_start: start,
    p_end: end,
    p_from: from,
    p_to: to,
    p_break: Number.isFinite(breakRaw) && breakRaw > 0 ? Math.round(breakRaw) : 0,
    p_position: (position || null) as StaffPosition | null,
    p_location: String(formData.get("location") ?? ""),
    p_note: String(formData.get("note") ?? "") || null,
  });

  if (error) return { error: error.message ?? "Vuorojen luonti epäonnistui." };

  const result = readResult(data);

  revalidatePath("/admin", "layout");

  return {
    notice:
      result.created === 0 && result.skipped === 0
        ? "Jaksolle ei osunut yhtään valittua viikonpäivää."
        : describe(result),
  };
}

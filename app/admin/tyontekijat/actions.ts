"use server";

/**
 * Työntekijöiden hallinta ja työajan leimaus.
 *
 * Kaksi eri asiaa samassa tiedostossa, koska ne koskevat samaa
 * aineistoa: omistaja ylläpitää luetteloa, työntekijä leimaa itsensä.
 * Rooliraja kulkee funktioiden välissä eikä niiden sisällä.
 *
 * KANTA ON VIIMEINEN SANA.
 *
 * Leimaus kulkee kannan funktioiden kautta, jotka päättelevät tekijän
 * istunnosta. Clientilta tuleva työntekijätunniste ei kelpaa
 * miksikään — sitä ei edes lähetetä.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminText, type AdminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { requireContext } from "@/lib/restoflow/session";
import { createClient } from "@/utils/supabase/server";
import { can } from "@/lib/restoflow/permissions";
import { parseHourly } from "@/lib/restoflow/employees";
import type { AdminState } from "../actions";

const employeeSchema = (t: AdminText) =>
  z.object({
    id: z.string().uuid().nullable(),
    firstName: z.string().trim().min(1, t.tyo.firstNameMissing).max(80),
    lastName: z.string().trim().min(1, t.tyo.lastNameMissing).max(80),
    /*
     * Sähköposti on vapaaehtoinen mutta ratkaisee leimauksen.
     *
     * Työntekijän tili liitetään riviin sähköpostilla. Ilman sitä
     * työntekijä on luettelossa mutta ei voi leimata, ja se sanotaan
     * käyttöliittymässä ääneen.
     */
    email: z
      .string()
      .trim()
      .max(160)
      .transform((v) => (v === "" ? null : v.toLowerCase()))
      .nullable()
      .refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), {
        message: t.tyo.emailInvalid,
      }),
    jobTitle: z
      .string()
      .trim()
      .max(80)
      .transform((v) => (v === "" ? null : v)),
    hourlyCents: z.number().int().min(0).max(100000),
    active: z.boolean(),
  });

export async function saveEmployee(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext("/admin/tyontekijat");

  if (!can(role, "employees.manage")) {
    return { error: t.toiminnot.ownerOnlyBody };
  }

  const hourly = parseHourly(String(formData.get("hourly") ?? ""));
  if (hourly === null) return { error: t.tyo.hourlyInvalid };

  const parsed = employeeSchema(t).safeParse({
    id: (formData.get("id") as string) || null,
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email") ?? "",
    jobTitle: formData.get("jobTitle") ?? "",
    hourlyCents: hourly,
    active: formData.get("active") === "on",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const rivi = {
    restaurant_id: restaurant.id,
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    email: parsed.data.email,
    job_title: parsed.data.jobTitle,
    hourly_cents: parsed.data.hourlyCents,
    active: parsed.data.active,
    updated_at: new Date().toISOString(),
  };

  const { error } = parsed.data.id
    ? await supabase
        .from("employees")
        .update(rivi)
        .eq("id", parsed.data.id)
        .eq("restaurant_id", restaurant.id)
    : await supabase.from("employees").insert(rivi);

  if (error) return { error: t.tyo.saveFailed };

  revalidatePath("/admin/tyontekijat");
  revalidatePath("/admin");

  return { notice: parsed.data.id ? t.tyo.saved : t.tyo.added };
}

/**
 * Työntekijän poistaminen käytöstä.
 *
 * Rivi jää, koska tehdyt tunnit jäävät. Poisto tuhoaisi myös ne, ja
 * kuukauden palkkakulu muuttuisi jälkikäteen ilman että kukaan tietää
 * miksi.
 */
export async function setEmployeeActive(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext("/admin/tyontekijat");

  if (!can(role, "employees.manage")) {
    return { error: t.toiminnot.ownerOnlyBody };
  }

  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "1";
  if (id === "") return { error: t.tyo.saveFailed };

  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("restaurant_id", restaurant.id);

  if (error) return { error: t.tyo.saveFailed };

  revalidatePath("/admin/tyontekijat");
  revalidatePath("/admin");

  return { notice: active ? t.tyo.activated : t.tyo.deactivated };
}

// ---------------------------------------------------------------------------
// Leimaus
// ---------------------------------------------------------------------------

/**
 * Vuoron aloitus ja lopetus.
 *
 * Yritys tulee istunnosta eikä lomakkeesta, ja kannan funktio
 * tarkistaa jäsenyyden vielä itse. Näin osoitetta tai kenttää
 * muokkaamalla ei voi leimata toisen yrityksen tai toisen ihmisen
 * vuoroa.
 */
export async function startShift(): Promise<AdminState> {
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext("/tyoaika");

  if (!can(role, "timeclock.use")) {
    return { error: t.tyo.noTimeclock };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("clock_in", {
    p_restaurant: restaurant.id,
  });

  if (error) {
    return {
      error: error.code === "23505" ? t.tyo.alreadyOpen : t.tyo.clockFailed,
    };
  }

  revalidatePath("/tyoaika");
  revalidatePath("/admin");
  revalidatePath("/admin/tyontekijat");

  return { notice: t.tyo.started };
}

export async function endShift(): Promise<AdminState> {
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext("/tyoaika");

  if (!can(role, "timeclock.use")) {
    return { error: t.tyo.noTimeclock };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("clock_out", {
    p_restaurant: restaurant.id,
  });

  if (error) {
    return {
      error: error.code === "P0002" ? t.tyo.noOpenShift : t.tyo.clockFailed,
    };
  }

  revalidatePath("/tyoaika");
  revalidatePath("/admin");
  revalidatePath("/admin/tyontekijat");

  return { notice: t.tyo.ended };
}

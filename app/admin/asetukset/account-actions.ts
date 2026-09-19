"use server";

/**
 * Oman tunnuksen muutokset: nimi ja salasana.
 *
 * Nämä asuivat aiemmin työntekijäsovelluksessa, ja hallinnan asetukset
 * lainasivat ne sieltä. Työntekijäsovellus poistui, mutta nimi ja
 * salasana ovat yhä jokaisen käyttäjän omia asioita — omistajan,
 * esihenkilön ja kirjanpitäjän.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminText, type AdminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { requireContext } from "@/lib/restoflow/session";
import { createClient } from "@/utils/supabase/server";
import type { AdminState } from "../actions";

const nameSchema = (t: AdminText) =>
  z.object({
    fullName: z.string().trim().min(1, t.asetus.nameMissing).max(120),
  });

/**
 * Oman nimen muutos.
 *
 * Nimi elää kahdessa paikassa: auth-tunnuksen metadatassa ja
 * profiles-taulussa, josta sovellus lukee sen. Molemmat päivitetään,
 * muuten nimi vaihtuisi vain toisessa ja näkymät erkanisivat.
 */
export async function updateProfile(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const t = adminText(await resolveLocale());

  const parsed = nameSchema(t).safeParse({
    fullName: formData.get("fullName"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { user } = await requireContext("/admin/asetukset");
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName })
    .eq("id", user.id);

  /*
   * Kannan virhettä ei näytetä sellaisenaan.
   *
   * Siinä voi olla taulun ja sarakkeen nimiä, eikä käyttäjä voi niille
   * mitään. Hänelle kerrotaan mitä tehdä.
   */
  if (error) return { error: t.asetus.nameSaveFailed };

  await supabase.auth.updateUser({ data: { full_name: parsed.data.fullName } });

  revalidatePath("/admin", "layout");

  return { notice: t.asetus.nameSaved };
}

const passwordSchema = (t: AdminText) =>
  z
    .object({
      password: z.string().min(8, t.asetus.passwordMin),
      confirm: z.string(),
    })
    .refine((data) => data.password === data.confirm, {
      message: t.asetus.passwordsDiffer,
      path: ["confirm"],
    });

/**
 * Salasanan vaihto kirjautuneena.
 *
 * Supabase vaatii voimassa olevan istunnon, joten vanhaa salasanaa ei
 * kysytä erikseen. Jos istunto on vanhentunut, vaihto ei onnistu — ja
 * juuri niin sen kuuluukin mennä.
 */
export async function changePassword(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const t = adminText(await resolveLocale());

  const parsed = passwordSchema(t).safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await requireContext("/admin/asetukset");
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      error: error.message.includes("same as the old")
        ? t.asetus.samePassword
        : t.asetus.passwordChangeFailed,
    };
  }

  return { notice: t.asetus.passwordChanged };
}

"use server";

/**
 * Autentikoinnin server actionit.
 *
 * Kaikki tunnistautuminen tapahtuu palvelimella. Salasana ei päädy
 * asiakaspuolen tilaan eikä lokiin, ja virheilmoitukset eivät paljasta
 * onko tunnus olemassa.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { ACTIVE_RESTAURANT_COOKIE } from "@/lib/restoflow/session";
import { resolveLocale } from "@/lib/i18n/resolve";
import { authText, fill, type AuthText } from "@/lib/i18n/auth-text";

export interface FormState {
  error?: string;
  notice?: string;
}

/*
 * Skeemat ovat tehtaita, eivät vakioita.
 *
 * Validointiviesti on käyttöliittymätekstiä siinä missä otsikkokin,
 * eikä kieltä tiedetä vielä moduulia ladattaessa. Skeema rakennetaan
 * siis pyynnön aikana, kun kieli on ratkaistu.
 */
const credentials = (t: AuthText) =>
  z.object({
    email: z.string().trim().toLowerCase().email(t.virheet.checkEmail),
    password: z.string().min(8, t.virheet.passwordMin),
  });

const signUpSchema = (t: AuthText) =>
  credentials(t).extend({
    fullName: z.string().trim().min(1, t.virheet.nameMissing).max(120),
  });

/** Vain saman sivuston sisäinen polku kelpaa uudelleenohjaukseen. */
function safeNext(value: FormDataEntryValue | null, fallback: string): string {
  const path = String(value ?? "");
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

export async function signIn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = authText(await resolveLocale());

  const parsed = credentials(t).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  // Ei kerrota kumpi oli väärin — se paljastaisi onko tunnus olemassa.
  if (error) return { error: t.virheet.badCredentials };

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next"), "/admin"));
}

export async function signUp(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = authText(await resolveLocale());

  const parsed = signUpSchema(t).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });

  if (error) return { error: translateSignUpError(error.message, t) };

  // Kutsulinkistä tullut ohjataan suoraan liittymisvälilehdelle, jottei
  // hän perusta vahingossa omaa ravintolaa.
  const next =
    formData.get("tila") === "liity" ? "/aloitus?tila=liity" : "/aloitus";

  // Sähköpostivahvistuksen ollessa päällä istuntoa ei synny heti.
  if (!data.session) {
    return { notice: t.virheet.confirmSent };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_RESTAURANT_COOKIE);

  revalidatePath("/", "layout");
  redirect("/kirjaudu");
}


/*
 * Supabasen viesti on aina englanniksi ja tarkoitettu kehittäjälle.
 * Tunnistetaan tapaus ja kerrotaan se käyttäjän kielellä; tuntematon
 * syy kulkee läpi sellaisenaan, koska väärä arvaus olisi pahempi kuin
 * vieraskielinen tosiasia.
 */
function translateSignUpError(message: string, t: AuthText): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered")) {
    return t.virheet.alreadyRegistered;
  }
  if (m.includes("password")) {
    return t.virheet.passwordWeak;
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return t.virheet.rateLimit;
  }
  return fill(t.virheet.signUpFailed, { syy: message });
}

// ---------------------------------------------------------------------------
// Salasanan palautus
// ---------------------------------------------------------------------------

const emailOnly = (t: AuthText) =>
  z.object({
    email: z.string().trim().toLowerCase().email(t.virheet.checkEmail),
  });

/**
 * Lähettää palautuslinkin.
 *
 * Vastaus on sama riippumatta siitä onko tunnusta olemassa. Ero
 * paljastaisi kenellä on tili — se on tieto jota ulkopuolisen ei kuulu
 * saada kokeilemalla.
 */
export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = authText(await resolveLocale());

  const parsed = emailOnly(t).safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteUrl()}/auth/callback?seuraava=/uusi-salasana`,
  });

  return { notice: t.virheet.resetSent };
}

const newPasswordSchema = (t: AuthText) =>
  z
    .object({
      password: z.string().min(8, t.virheet.passwordMin),
      confirm: z.string(),
    })
    .refine((data) => data.password === data.confirm, {
      message: t.virheet.passwordsDiffer,
      path: ["confirm"],
    });

/**
 * Asettaa uuden salasanan.
 *
 * Toimii vain istunnolla jonka palautuslinkki loi. Ilman istuntoa
 * kutsuja ei ole todistanut pääsyään sähköpostiin.
 */
export async function setNewPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = authText(await resolveLocale());

  const parsed = newPasswordSchema(t).safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: t.virheet.resetExpired };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      error: error.message.includes("same as the old")
        ? t.virheet.samePassword
        : t.virheet.changeFailed,
    };
  }

  revalidatePath("/", "layout");
  redirect("/admin");
}

/**
 * Sovelluksen julkinen osoite palautuslinkkiä varten.
 *
 * Ympäristömuuttuja ensin, sitten pyynnön oma origin: kehityksessä
 * localhost ja tuotannossa oikea domain ilman erillistä asetusta.
 */
async function siteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    return configured.endsWith("/") ? configured.slice(0, -1) : configured;
  }

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";

  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

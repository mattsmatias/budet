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

export interface FormState {
  error?: string;
  notice?: string;
}

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Tarkista sähköpostiosoite."),
  password: z.string().min(8, "Salasanassa on oltava vähintään 8 merkkiä."),
});

const signUpSchema = credentials.extend({
  fullName: z.string().trim().min(1, "Nimi puuttuu.").max(120),
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
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  // Ei kerrota kumpi oli väärin — se paljastaisi onko tunnus olemassa.
  if (error) return { error: "Sähköposti tai salasana ei täsmää." };

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next"), "/admin"));
}

export async function signUp(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
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

  if (error) return { error: translateSignUpError(error.message) };

  // Sähköpostivahvistuksen ollessa päällä istuntoa ei synny heti.
  if (!data.session) {
    return {
      notice:
        "Lähetimme vahvistuslinkin sähköpostiisi. Avaa se ja palaa tänne kirjautumaan.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/aloitus");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_RESTAURANT_COOKIE);

  revalidatePath("/", "layout");
  redirect("/kirjaudu");
}

/** Vaihtaa aktiivisen ravintolan. Valinta validoidaan jäsenyyksiä vasten. */
export async function switchRestaurant(formData: FormData): Promise<void> {
  const id = String(formData.get("restaurantId") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("my_restaurants")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  // Ilman jäsenyyttä valintaa ei tallenneta — eväste ei anna pääsyä.
  if (!data) return;

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_RESTAURANT_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
}

function translateSignUpError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "Tällä sähköpostilla on jo tunnus. Kirjaudu sisään.";
  }
  if (m.includes("password")) {
    return "Salasana ei täytä vaatimuksia. Käytä vähintään 8 merkkiä.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Liian monta yritystä. Odota hetki ja yritä uudelleen.";
  }
  return `Rekisteröityminen epäonnistui: ${message}`;
}

// ---------------------------------------------------------------------------
// Salasanan palautus
// ---------------------------------------------------------------------------

const emailOnly = z.object({
  email: z.string().trim().toLowerCase().email("Tarkista sähköpostiosoite."),
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
  const parsed = emailOnly.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteUrl()}/auth/callback?seuraava=/uusi-salasana`,
  });

  return {
    notice:
      "Jos osoitteella on tili, lähetimme sinne palautuslinkin. " +
      "Linkki on voimassa tunnin.",
  };
}

const newPasswordSchema = z
  .object({
    password: z.string().min(8, "Salasanassa on oltava vähintään 8 merkkiä."),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Salasanat eivät täsmää.",
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
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "Palautuslinkki on vanhentunut tai jo käytetty. Pyydä uusi linkki.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      error: error.message.includes("same as the old")
        ? "Uusi salasana ei voi olla sama kuin vanha."
        : "Salasanan vaihto ei onnistunut. Yritä uudelleen.",
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

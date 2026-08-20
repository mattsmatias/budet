"use server";

/**
 * Autentikoinnin server actionit.
 *
 * Kaikki tunnistautuminen tapahtuu palvelimella. Salasana ei koskaan päädy
 * asiakaspuolen tilaan eikä lokiin. Virheilmoitukset ovat ihmisluettavia
 * eivätkä paljasta onko tunnus olemassa (§35, §73).
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { ACTIVE_ORG_COOKIE } from "@/lib/auth";
import { cookies } from "next/headers";

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

export async function signIn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Ei kerrota kumpi oli väärin — se paljastaisi onko tunnus olemassa.
    return { error: "Sähköposti tai salasana ei täsmää." };
  }

  const next = String(formData.get("next") ?? "/dashboard");
  revalidatePath("/", "layout");
  redirect(next.startsWith("/") ? next : "/dashboard");
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

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, locale: "fi" },
    },
  });

  if (error) {
    return { error: kaannaVirhe(error.message) };
  }

  // Jos sähköpostivahvistus on päällä, istuntoa ei synny heti.
  if (!data.session) {
    return {
      notice:
        "Lähetimme vahvistuslinkin sähköpostiisi. Avaa se ja palaa tänne kirjautumaan.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/onboarding");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_ORG_COOKIE);

  revalidatePath("/", "layout");
  redirect("/login");
}

/** Vaihtaa aktiivisen organisaation. Valinta validoidaan jäsenyyksiä vasten. */
export async function switchOrganization(formData: FormData): Promise<void> {
  const orgId = String(formData.get("orgId") ?? "");
  if (!orgId) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("my_organizations")
    .select("id")
    .eq("id", orgId)
    .maybeSingle();

  // Eväste ei anna pääsyä: jos jäsenyyttä ei ole, valintaa ei tallenneta.
  if (!data) return;

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
}

function kaannaVirhe(message: string): string {
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
  return "Rekisteröityminen ei onnistunut. Yritä uudelleen hetken kuluttua.";
}

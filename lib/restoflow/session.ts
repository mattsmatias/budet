/**
 * Istunto ja ravintolakonteksti.
 *
 * Yksi paikka jossa vastataan kysymyksiin "kuka on kirjautunut", "minkä
 * ravintolan puolesta hän toimii" ja "millä roolilla". Sivut eivät kysele
 * näitä itse, jotta pääsysääntö ei ehdi haarautua eri paikoissa eri
 * suuntiin.
 */

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, isConfigured } from "@/utils/supabase/server";
import type { Role, StaffPosition } from "./types";

export const ACTIVE_RESTAURANT_COOKIE = "rf_restaurant";

export interface SessionUser {
  id: string;
  email: string | null;
  fullName: string | null;
}

export interface RestaurantMembership {
  id: string;
  name: string;
  /** Julkisen osoitteen tunnus, esim. "cafe-monami". */
  slug: string;
  timezone: string;
  currency: string;
  role: Role;
  position: StaffPosition | null;
  hourlyRateCents: number | null;
}

export const getUser = cache(async (): Promise<SessionUser | null> => {
  if (!isConfigured()) return null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    return {
      id: user.id,
      email: user.email ?? null,
      fullName: profile?.full_name ?? null,
    };
  } catch {
    return null;
  }
});

/** Ravintolat joihin käyttäjä kuuluu. Tyhjä = perustus kesken. */
export const getMemberships = cache(async (): Promise<RestaurantMembership[]> => {
  if (!isConfigured()) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("my_restaurants")
      .select("id, name, slug, timezone, currency, role, position, hourly_rate_cents")
      .order("name");

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      timezone: row.timezone as string,
      currency: row.currency as string,
      role: row.role as Role,
      position: (row.position as StaffPosition | null) ?? null,
      hourlyRateCents: (row.hourly_rate_cents as number | null) ?? null,
    }));
  } catch {
    return [];
  }
});

/**
 * Aktiivinen ravintola.
 *
 * Valinta säilyy evästeessä, mutta se validoidaan aina jäsenyyksiä vasten —
 * eväste ei siis voi antaa pääsyä mihinkään.
 */
export const getActiveRestaurant = cache(
  async (): Promise<RestaurantMembership | null> => {
    const memberships = await getMemberships();
    if (memberships.length === 0) return null;

    const cookieStore = await cookies();
    const preferred = cookieStore.get(ACTIVE_RESTAURANT_COOKIE)?.value;

    return memberships.find((m) => m.id === preferred) ?? memberships[0];
  },
);

export interface Context {
  user: SessionUser;
  restaurant: RestaurantMembership;
  role: Role;
}

/**
 * Konteksti suojatuille sivuille.
 *
 * Ohjaa kirjautumiseen jos istuntoa ei ole ja perustukseen jos ravintolaa
 * ei ole. Sivun ei tarvitse käsitellä kumpaakaan tapausta erikseen.
 */
export async function requireContext(returnTo = "/admin"): Promise<Context> {
  const user = await getUser();
  if (!user) redirect(`/kirjaudu?seuraava=${encodeURIComponent(returnTo)}`);

  const restaurant = await getActiveRestaurant();
  if (!restaurant) redirect("/aloitus");

  return { user, restaurant, role: restaurant.role };
}

/** Käyttäjä ilman ravintolapakkoa — perustussivua varten. */
export async function requireUser(returnTo = "/admin"): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect(`/kirjaudu?seuraava=${encodeURIComponent(returnTo)}`);
  return user;
}

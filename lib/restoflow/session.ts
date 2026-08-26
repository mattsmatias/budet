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
import { verifiedUser } from "@/utils/supabase/claims";
import { isLunchTheme, type LunchTheme } from "./lunch-themes";
import type { Role, StaffPosition } from "./types";

export const ACTIVE_RESTAURANT_COOKIE = "rf_restaurant";

export interface SessionUser {
  id: string;
  email: string | null;
  fullName: string | null;
  /**
   * Järjestelmätason ylläpitäjä.
   *
   * ERI ASIA KUIN RAVINTOLAN ROOLI.
   *
   * Ravintolan roolit (owner, manager, employee, accountant) kertovat
   * mitä käyttäjä saa tehdä yhdessä ravintolassa. Tämä lippu on
   * profiilissa eikä jäsenyydessä, koska se ei koske yhtä ravintolaa
   * vaan koko järjestelmää. Omistajuus ei anna sitä eikä se anna
   * omistajuutta.
   *
   * Tämä on vain käyttöliittymää varten. Pääsyn ratkaisee kanta:
   * jokainen sa_-funktio tarkistaa oikeuden itse, joten väärä arvo
   * täällä ei avaa mitään.
   */
  isSuperAdmin: boolean;
}

export interface RestaurantMembership {
  id: string;
  name: string;
  /** Julkisen osoitteen tunnus, esim. "cafe-monami". */
  slug: string;
  /** Julkisen lounassivun teema. */
  lunchTheme: LunchTheme;
  /** Kuinka monta minuuttia ennen vuoroa saa leimata sisään. */
  clockInEarlyMinutes: number;
  /** Saako työntekijä ottaa avoimen vuoron itselleen? */
  openShiftClaiming: boolean;
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

    // Paikallinen varmistus verkkokyselyn sijaan — ks. claims.ts.
    const user = await verifiedUser(supabase);
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, is_super_admin")
      .eq("id", user.id)
      .maybeSingle();

    return {
      id: user.id,
      email: user.email,
      fullName: profile?.full_name ?? null,
      isSuperAdmin: profile?.is_super_admin === true,
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
      .select("id, name, slug, lunch_theme, timezone, currency, role, position, hourly_rate_cents, clock_in_early_minutes, open_shift_claiming")
      .order("name");

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      lunchTheme: isLunchTheme(row.lunch_theme) ? row.lunch_theme : "light",
      clockInEarlyMinutes: (row.clock_in_early_minutes as number | null) ?? 30,
      openShiftClaiming: (row.open_shift_claiming as boolean | null) ?? true,
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
  /*
   * Rinnakkain: jäsenyyskysely ei tarvitse käyttäjän tunnusta vaan
   * evästeen, jonka RLS lukee itse. Peräkkäin ajettuna sivu odotti
   * kaksi verkkokierrosta yhden sijaan.
   */
  const [user, restaurant] = await Promise.all([getUser(), getActiveRestaurant()]);

  if (!user) redirect(`/kirjaudu?seuraava=${encodeURIComponent(returnTo)}`);
  if (!restaurant) redirect("/aloitus");

  return { user, restaurant, role: restaurant.role };
}

/** Käyttäjä ilman ravintolapakkoa — perustussivua varten. */
export async function requireUser(returnTo = "/admin"): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect(`/kirjaudu?seuraava=${encodeURIComponent(returnTo)}`);
  return user;
}

// ---------------------------------------------------------------------------
// Järjestelmän ylläpitäjä
// ---------------------------------------------------------------------------

/**
 * Konteksti Developer Consolen sivuille.
 *
 * PIILOTTAMINEN EI OLE PÄÄSYNHALLINTAA.
 *
 * Tämä tarkistus ohjaa pois sivulta, mutta se ei ole se mikä suojaa
 * tietoja. Suojan tekee kanta: konsolin jokainen kysely kulkee
 * sa_-funktion läpi, ja ne tarkistavat oikeuden itse. Jos tämä
 * tarkistus poistettaisiin kokonaan, sivu latautuisi tyhjänä ja
 * jokainen kutsu kaatuisi virheeseen — ei vuotaisi riviäkään.
 *
 * Ohjaus menee etusivulle eikä kirjautumiseen, jos käyttäjä on
 * kirjautunut mutta ilman oikeutta: kirjautumissivu vihjaisi että
 * toisilla tunnuksilla pääsisi, ja konsolin olemassaoloa ei ole
 * syytä kertoa.
 */
export async function requireSuperAdmin(returnTo = "/kehittaja"): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect(`/kirjaudu?seuraava=${encodeURIComponent(returnTo)}`);
  if (!user.isSuperAdmin) redirect("/admin");
  return user;
}

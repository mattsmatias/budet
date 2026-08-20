/**
 * Istunto ja organisaatiokonteksti.
 *
 * Yksi paikka jossa vastataan kysymyksiin "kuka on kirjautunut" ja "minkä
 * organisaation puolesta hän toimii". Sivut eivät kysele näitä itse, jotta
 * pääsysääntö ei ehdi haarautua eri paikoissa eri suuntiin.
 */

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/utils/supabase/server";
import type { Role } from "./navigation";

export const ACTIVE_ORG_COOKIE = "verra_org";

export interface SessionUser {
  id: string;
  email: string | null;
  fullName: string | null;
  locale: string;
  isSuperAdmin: boolean;
}

export interface Membership {
  id: string;
  name: string;
  kind: "company" | "accounting_firm";
  country: string;
  role: Role;
  planId: string | null;
  subscriptionState: string | null;
  isDemo: boolean;
}

/**
 * Kirjautunut käyttäjä, tai null. cache() varmistaa että yksi pyyntö
 * kysyy istunnon kerran vaikka useampi komponentti tarvitsisi sen.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, locale, is_super_admin")
      .eq("id", user.id)
      .maybeSingle();

    return {
      id: user.id,
      email: user.email ?? null,
      fullName: profile?.full_name ?? null,
      locale: profile?.locale ?? "fi",
      isSuperAdmin: profile?.is_super_admin ?? false,
    };
  } catch {
    // Skeema puuttuu tai yhteys ei vastaa. Sovellus jatkaa demo-tilassa
    // eikä kaadu — käyttäjälle näytetään selkeä ilmoitus.
    return null;
  }
});

/** Organisaatiot joihin käyttäjä kuuluu. Tyhjä = onboarding kesken. */
export const getMemberships = cache(async (): Promise<Membership[]> => {
  if (!isSupabaseConfigured()) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("my_organizations")
      .select("id, name, kind, country, role, plan_id, subscription_state, is_demo")
      .order("name");

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      kind: row.kind as Membership["kind"],
      country: row.country as string,
      role: row.role as Role,
      planId: (row.plan_id as string | null) ?? null,
      subscriptionState: (row.subscription_state as string | null) ?? null,
      isDemo: Boolean(row.is_demo),
    }));
  } catch {
    return [];
  }
});

/**
 * Aktiivinen organisaatio. Valinta säilyy evästeessä, mutta se validoidaan
 * aina jäsenyyksiä vasten — eväste ei siis voi antaa pääsyä mihinkään.
 */
export const getActiveOrg = cache(async (): Promise<Membership | null> => {
  const memberships = await getMemberships();
  if (memberships.length === 0) return null;

  const cookieStore = await cookies();
  const preferred = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  return memberships.find((m) => m.id === preferred) ?? memberships[0];
});

/** Ohjaa kirjautumiseen jos istuntoa ei ole. */
export async function requireUser(returnTo = "/dashboard"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?seuraava=${encodeURIComponent(returnTo)}`);
  return user;
}

/** Ohjaa onboardingiin jos organisaatiota ei ole. */
export async function requireOrg(returnTo = "/dashboard"): Promise<{
  user: SessionUser;
  org: Membership;
}> {
  const user = await requireUser(returnTo);
  const org = await getActiveOrg();
  if (!org) redirect("/onboarding");
  return { user, org };
}

/**
 * Sovelluksen tila. Sivut käyttävät tätä päättääkseen näyttävätkö oikeaa
 * dataa, demo-aineistoa vai asennusohjeen.
 */
export type AppMode =
  | { kind: "live"; user: SessionUser; org: Membership }
  | { kind: "no-org"; user: SessionUser }
  | { kind: "demo"; reason: "not_configured" | "not_signed_in" };

export async function getAppMode(): Promise<AppMode> {
  if (!isSupabaseConfigured()) {
    return { kind: "demo", reason: "not_configured" };
  }

  const user = await getSessionUser();
  if (!user) return { kind: "demo", reason: "not_signed_in" };

  const org = await getActiveOrg();
  if (!org) return { kind: "no-org", user };

  return { kind: "live", user, org };
}

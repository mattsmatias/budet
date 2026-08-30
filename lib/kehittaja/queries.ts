/**
 * Developer Consolen kyselyt.
 *
 * KAIKKI KULKEE sa_-FUNKTION LÄPI.
 *
 * Konsoli ei lue tauluja suoraan. Syy on se ettei ravintoloiden
 * eristystä tarvitse purkaa: jos ylläpitäjälle avattaisiin
 * rivikäytännöt jokaiseen tauluun, sama oikeus olisi voimassa myös
 * silloin kun hän käyttää tavallista Katea — ja yksi unohtunut
 * ravintolarajaus näyttäisi väärän ravintolan luvut.
 *
 * Nyt tenanttien RLS on täsmälleen ennallaan. Konsolin funktiot ovat
 * security definer ja tarkistavat oikeuden itse, joten pääsy on
 * yhdessä paikassa eikä levinneenä seitsemäänkymmeneen taulukkoon.
 */

import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import type {
  AuditRow,
  Flag,
  Overview,
  RestaurantDetail,
  RestaurantRow,
  UserRow,
} from "./types";

/**
 * Kutsuu sa_-funktion ja palauttaa jsonb:n.
 *
 * Virhe ei kaada sivua vaan palauttaa varasisällön. Kannan hylkäys on
 * odotettavissa oleva tulos: se tarkoittaa ettei kutsujalla ole
 * oikeutta, ja silloin sivu näyttää tyhjän eikä vuoda mitään.
 */
async function rpc<T>(
  name: string,
  args: Record<string, unknown>,
  fallback: T,
): Promise<T> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(name, args);
    if (error || data === null || data === undefined) return fallback;
    return data as T;
  } catch {
    return fallback;
  }
}

const TYHJA_OVERVIEW: Overview = {
  restaurants: {
    total: 0,
    active: 0,
    trial: 0,
    suspended: 0,
    cancelled: 0,
    archived: 0,
    test: 0,
    newToday: 0,
  },
  users: {
    total: 0,
    owners: 0,
    managers: 0,
    employees: 0,
    accountants: 0,
    inactive: 0,
  },
  today: { newUsers: 0, activeUsers: 0 },
  trialsEndingSoon: 0,
  generatedAt: new Date().toISOString(),
};

export const fetchOverview = cache(async (): Promise<Overview> =>
  rpc("sa_overview", {}, TYHJA_OVERVIEW),
);

export const fetchRestaurants = cache(async (): Promise<RestaurantRow[]> => {
  const rows = await rpc<Record<string, unknown>[]>("sa_restaurants", {}, []);
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    slug: r.slug as string,
    status: r.status as RestaurantRow["status"],
    plan: r.plan as RestaurantRow["plan"],
    businessId: (r.business_id as string | null) ?? null,
    city: (r.city as string | null) ?? null,
    timezone: r.timezone as string,
    currency: r.currency as string,
    isTestAccount: r.is_test_account === true,
    trialEndsOn: (r.trial_ends_on as string | null) ?? null,
    createdAt: r.created_at as string,
    userCount: Number(r.user_count ?? 0),
    ownerName: (r.owner_name as string | null) ?? null,
    ownerEmail: (r.owner_email as string | null) ?? null,
    lastSignInAt: (r.last_sign_in_at as string | null) ?? null,
  }));
});

export const fetchRestaurant = cache(
  async (id: string): Promise<RestaurantDetail | null> => {
    const raw = await rpc<Record<string, unknown> | null>(
      "sa_restaurant",
      { p_id: id },
      null,
    );
    if (!raw) return null;

    const r = raw.restaurant as Record<string, unknown> | null;
    if (!r) return null;

    const usage = (raw.usage ?? {}) as Record<string, unknown>;

    return {
      restaurant: {
        id: r.id as string,
        name: r.name as string,
        slug: r.slug as string,
        status: r.status as RestaurantDetail["restaurant"]["status"],
        plan: r.plan as RestaurantDetail["restaurant"]["plan"],
        legalName: (r.legal_name as string | null) ?? null,
        businessId: (r.business_id as string | null) ?? null,
        address: (r.address as string | null) ?? null,
        postalCode: (r.postal_code as string | null) ?? null,
        city: (r.city as string | null) ?? null,
        phone: (r.phone as string | null) ?? null,
        email: (r.email as string | null) ?? null,
        website: (r.website as string | null) ?? null,
        industry: (r.industry as string | null) ?? null,
        timezone: r.timezone as string,
        currency: r.currency as string,
        isTestAccount: r.is_test_account === true,
        trialEndsOn: (r.trial_ends_on as string | null) ?? null,
        statusNote: (r.status_note as string | null) ?? null,
        statusChangedAt: (r.status_changed_at as string | null) ?? null,
        createdAt: r.created_at as string,
      },
      users: (raw.users as RestaurantDetail["users"]) ?? [],
      invitations: (raw.invitations as RestaurantDetail["invitations"]) ?? [],
      usage: {
        receipts: Number(usage.receipts ?? 0),
        shifts: Number(usage.shifts ?? 0),
        tasks: Number(usage.tasks ?? 0),
        lunchMenus: Number(usage.lunchMenus ?? 0),
        salesDays: Number(usage.salesDays ?? 0),
        aiChats: Number(usage.aiChats ?? 0),
        activeUsers: Number(usage.activeUsers ?? 0),
        lastSignInAt: (usage.lastSignInAt as string | null) ?? null,
      },
      flags: (raw.flags as RestaurantDetail["flags"]) ?? [],
    };
  },
);

export const fetchUsers = cache(async (): Promise<UserRow[]> => {
  const rows = await rpc<Record<string, unknown>[]>("sa_users", {}, []);
  return rows.map((r) => ({
    membershipId: r.membership_id as string,
    userId: r.user_id as string,
    name: (r.name as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    role: r.role as string,
    active: r.active === true,
    restaurantId: r.restaurant_id as string,
    restaurantName: r.restaurant_name as string,
    isTestAccount: r.is_test_account === true,
    lastSignInAt: (r.last_sign_in_at as string | null) ?? null,
    isSuperAdmin: r.is_super_admin === true,
    createdAt: r.created_at as string,
  }));
});

export const fetchAudit = cache(async (limit = 100): Promise<AuditRow[]> => {
  const rows = await rpc<Record<string, unknown>[]>(
    "sa_audit",
    { p_limit: limit },
    [],
  );
  return rows.map((r) => ({
    id: r.id as string,
    actorEmail: (r.actor_email as string | null) ?? null,
    action: r.action as string,
    targetType: (r.target_type as string | null) ?? null,
    targetId: (r.target_id as string | null) ?? null,
    targetName: (r.target_name as string | null) ?? null,
    summary: r.summary as string,
    critical: r.critical === true,
    createdAt: r.created_at as string,
  }));
});

export const fetchFlags = cache(async (): Promise<Flag[]> =>
  rpc<Flag[]>("sa_flags", {}, []),
);

// ---------------------------------------------------------------------------
// Meta-integraation diagnostiikka
// ---------------------------------------------------------------------------

export interface MetaDiagnostics {
  pageId: string;
  pageName: string;
  instagramId: string | null;
  instagramUsername: string | null;
  status: string;
  statusDetail: string | null;
  scopes: string[];
  hasToken: boolean;
  tokenExpiresAt: string | null;
  connectedAt: string;
  lastOk: string | null;
  lastFailed: string | null;
  lastError: string | null;
  publications: number;
}

/**
 * Meta-yhteyden tila tukea varten.
 *
 * Tokenia ei ole mukana. Kysymykseen "miksi julkaisu ei toimi" vastaa
 * tieto siitä onko tokeni tallessa ja mikä oli viimeisin virhe — ei
 * tokeni itse, jolla ylläpitäjä voisi julkaista asiakkaan sivulle.
 */
export const fetchMetaDiagnostics = cache(
  async (restaurantId: string): Promise<MetaDiagnostics | null> => {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("sa_meta_diagnostics", {
      p_restaurant: restaurantId,
    });

    if (error || !data) return null;
    return data as unknown as MetaDiagnostics;
  },
);

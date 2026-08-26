/**
 * Developer Consolen tyypit.
 *
 * Erillinen tiedosto ravintolan tyypeistä, koska nämä kuvaavat
 * järjestelmätasoa: asiakkuuksia, paketteja ja lippuja. Ravintolan oma
 * Budet ei tunne näitä käsitteitä eikä sen kuulukaan.
 */

/** Asiakkuuden tila. Päätös, ei datasta johdettu arvo. */
export type RestaurantStatus =
  | "trial"
  | "active"
  | "suspended"
  | "cancelled"
  | "archived";

export type RestaurantPlan = "free" | "pro" | "business" | "enterprise";

export const STATUS_LABELS: Record<RestaurantStatus, string> = {
  trial: "Kokeilu",
  active: "Aktiivinen",
  suspended: "Keskeytetty",
  cancelled: "Päättynyt",
  archived: "Arkistoitu",
};

export const PLAN_LABELS: Record<RestaurantPlan, string> = {
  free: "Free",
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
};

/**
 * Tilan sävy.
 *
 * Punainen vain siitä mikä on oikeasti poikki. Keskeytetty on
 * ylläpitäjän oma päätös eikä hälytys, joten se on keltainen —
 * punainen varataan sille mikä vaatii toimenpiteen.
 */
export function statusTone(status: RestaurantStatus): "ok" | "warn" | "risk" | "muted" {
  switch (status) {
    case "active":
      return "ok";
    case "trial":
      return "warn";
    case "suspended":
      return "warn";
    case "cancelled":
      return "risk";
    case "archived":
      return "muted";
  }
}

export interface Overview {
  restaurants: {
    total: number;
    active: number;
    trial: number;
    suspended: number;
    cancelled: number;
    archived: number;
    test: number;
    newToday: number;
  };
  users: {
    total: number;
    owners: number;
    managers: number;
    employees: number;
    accountants: number;
    inactive: number;
  };
  today: { newUsers: number; activeUsers: number };
  trialsEndingSoon: number;
  generatedAt: string;
}

export interface RestaurantRow {
  id: string;
  name: string;
  slug: string;
  status: RestaurantStatus;
  plan: RestaurantPlan;
  businessId: string | null;
  city: string | null;
  timezone: string;
  currency: string;
  isTestAccount: boolean;
  trialEndsOn: string | null;
  createdAt: string;
  userCount: number;
  ownerName: string | null;
  ownerEmail: string | null;
  lastSignInAt: string | null;
}

export interface RestaurantDetail {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    status: RestaurantStatus;
    plan: RestaurantPlan;
    legalName: string | null;
    businessId: string | null;
    address: string | null;
    postalCode: string | null;
    city: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    industry: string | null;
    timezone: string;
    currency: string;
    isTestAccount: boolean;
    trialEndsOn: string | null;
    statusNote: string | null;
    statusChangedAt: string | null;
    createdAt: string;
  };
  users: DetailUser[];
  invitations: Invitation[];
  usage: {
    receipts: number;
    shifts: number;
    tasks: number;
    lunchMenus: number;
    salesDays: number;
    aiChats: number;
    activeUsers: number;
    lastSignInAt: string | null;
  };
  flags: { key: string; label: string; global: boolean; override: boolean | null }[];
}

export interface DetailUser {
  /** Jäsenyyden tunniste. Rooli ja aktiivisuus ovat jäsenyyden ominaisuuksia, eivät käyttäjän. */
  membershipId: string;
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  position: string | null;
  active: boolean;
  isSuperAdmin: boolean;
  lastSignInAt: string | null;
  createdAt: string;
}

export interface Invitation {
  id: string;
  role: string;
  label: string | null;
  /** Koodin neljä viimeistä merkkiä. Koko koodi on vain tiivisteenä. */
  hint: string;
  createdAt: string;
}

export interface UserRow {
  membershipId: string;
  userId: string;
  name: string | null;
  email: string | null;
  role: string;
  active: boolean;
  restaurantId: string;
  restaurantName: string;
  isTestAccount: boolean;
  lastSignInAt: string | null;
  isSuperAdmin: boolean;
  createdAt: string;
}

export interface AuditRow {
  id: string;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetName: string | null;
  summary: string;
  critical: boolean;
  createdAt: string;
}

export interface Flag {
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  overrides: { restaurantId: string; restaurantName: string; enabled: boolean }[];
}

/**
 * Asiakkuuden terveys.
 *
 * EI AUTOMAATTINEN ONGELMA VAAN SIGNAALI.
 *
 * Kolme tasoa lasketaan viimeisimmästä kirjautumisesta. Raja on
 * karkea eikä yritä olla tarkka: kolme viikkoa ilman kirjautumista
 * on syy katsoa, ei todiste mistään. Kesälomalla oleva ravintoloitsija
 * on täysin tyytyväinen asiakas.
 */
export type Health = "healthy" | "attention" | "risk";

export function healthOf(
  lastSignInAt: string | null,
  status: RestaurantStatus,
  now: Date,
): { level: Health; reason: string } {
  if (status === "suspended" || status === "cancelled") {
    return { level: "risk", reason: STATUS_LABELS[status] };
  }
  if (status === "archived") {
    return { level: "healthy", reason: "Arkistoitu" };
  }
  if (!lastSignInAt) {
    return { level: "attention", reason: "Ei yhtään kirjautumista" };
  }

  const days = Math.floor(
    (now.getTime() - new Date(lastSignInAt).getTime()) / 86_400_000,
  );

  if (days >= 30) {
    return { level: "risk", reason: `Ei kirjautumista ${days} päivään` };
  }
  if (days >= 14) {
    return { level: "attention", reason: `Ei kirjautumista ${days} päivään` };
  }
  return { level: "healthy", reason: days === 0 ? "Kirjautui tänään" : `Kirjautui ${days} pv sitten` };
}

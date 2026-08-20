/**
 * Suunnitelmien rajat ja oikeudet (§30, §61).
 *
 * Rajat luetaan tietokannasta, ei kovakoodata. Tämä moduuli sisältää vain
 * päättelylogiikan; arvot tulevat plan_entitlements-taulusta.
 *
 * Selaimen tarkistus on käyttöliittymän apu. Sitova tarkistus tehdään
 * palvelimella ennen jokaista rajoitettua toimintoa.
 */

export interface Entitlements {
  planId: string;
  planName: string;
  /** null = rajaton. */
  limits: Record<string, number | null>;
  features: Record<string, boolean>;
}

export interface UsageSnapshot {
  /** Kulutus mittarikohtaisesti kuluvalla laskutuskaudella. */
  used: Record<string, number>;
  periodStart: string;
  periodEnd: string;
}

export type LimitVerdict =
  | { allowed: true; remaining: number | null; warn: boolean }
  | { allowed: false; remaining: 0; reason: string };

/**
 * Onko toiminto sallittu käyttörajan puitteissa?
 *
 * @param metric esim. 'documents' — vastaava raja on 'documents_per_month'
 */
export function checkLimit(
  entitlements: Entitlements,
  usage: UsageSnapshot,
  metric: string,
  requested = 1,
): LimitVerdict {
  const limit = entitlements.limits[`${metric}_per_month`];

  if (limit === null || limit === undefined) {
    return { allowed: true, remaining: null, warn: false };
  }

  const used = usage.used[metric] ?? 0;
  const remaining = Math.max(0, limit - used);

  if (used + requested > limit) {
    return {
      allowed: false,
      remaining: 0,
      reason:
        `Suunnitelman ${entitlements.planName} raja ${limit} on käytetty ` +
        `(${used}/${limit}). Päivitä suunnitelmaa jatkaaksesi.`,
    };
  }

  // Pehmeä varoitus kun 80 % on käytetty (§60).
  return { allowed: true, remaining, warn: used / limit >= 0.8 };
}

/** Onko ominaisuus käytössä tässä suunnitelmassa? */
export function hasFeature(entitlements: Entitlements, feature: string): boolean {
  return entitlements.features[feature] === true;
}

/**
 * Heittää jos ominaisuus ei ole käytössä. Käytetään palvelinpuolen
 * reiteissä, jotta rajoitusta ei voi kiertää selaimesta.
 */
export function requireFeature(entitlements: Entitlements, feature: string): void {
  if (!hasFeature(entitlements, feature)) {
    throw new EntitlementError(
      `Ominaisuus "${feature}" ei sisälly suunnitelmaan ${entitlements.planName}.`,
    );
  }
}

export class EntitlementError extends Error {
  readonly code = "entitlement_denied";
  constructor(message: string) {
    super(message);
    this.name = "EntitlementError";
  }
}

/** Rakentaa Entitlements-olion plan_entitlements-riveistä. */
export function buildEntitlements(
  planId: string,
  planName: string,
  rows: { key: string; limit_value: number | null; bool_value: boolean | null }[],
): Entitlements {
  const limits: Record<string, number | null> = {};
  const features: Record<string, boolean> = {};

  for (const row of rows) {
    if (row.bool_value !== null) features[row.key] = row.bool_value;
    else limits[row.key] = row.limit_value;
  }

  return { planId, planName, limits, features };
}

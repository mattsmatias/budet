
import { requireContext } from "@/lib/restoflow/session";
import { fetchLunchWeek, fetchRestaurantData } from "@/lib/restoflow/queries";
import { monthIn, nowIso, todayIn } from "@/lib/restoflow/clock-context";
import type { RestaurantData } from "@/lib/restoflow/queries";
import type { LunchWeek } from "@/lib/restoflow/lunch";
import type { Role } from "@/lib/restoflow/types";

/**
 * Matin ajokonteksti.
 *
 * Ravintola ja rooli tulevat istunnosta, EIVÄT mallilta eivätkä
 * selaimelta. Tämä on tärkein yksittäinen rivi koko moduulissa: jos
 * ravintolatunniste tulisi pyynnön mukana, malli tai muokattu pyyntö
 * voisi osoittaa toiseen ravintolaan.
 *
 * Data haetaan käyttäjän omalla istunnolla, joten RLS rajaa sen
 * täsmälleen samalla tavalla kuin käyttöliittymässä. Matti ei voi
 * nähdä mitään mitä käyttäjä ei näkisi itse.
 */
export interface MattiContext {
  restaurantId: string;
  restaurantName: string;
  role: Role;
  userName: string;
  /** Kuluva kuukausi "2026-08" ravintolan aikavyöhykkeellä. */
  month: string;
  /** Kuluva päivä "2026-08-23". */
  today: string;
  /** Nykyhetki ISO-muodossa. Kesken oleva vuoro tarvitsee sen. */
  now: string;
  /** Ravintolan aikavyöhyke. Päivä luetaan aina siinä ajassa. */
  timezone: string;
  /** Missä käyttäjä on sovelluksessa. Vihje, ei valtuutus. */
  currentPage: string | null;
  data: RestaurantData;
  /** Lounasviikko haetaan erikseen: sitä ei tarvita joka kysymykseen. */
  lunchWeek: (weekStart: string) => Promise<LunchWeek | null>;
}

export async function mattiContext(
  currentPage: string | null,
): Promise<MattiContext> {
  const ctx = await requireContext("/admin");

  const data = await fetchRestaurantData(ctx.restaurant.id);

  const weekCache = new Map<string, Promise<LunchWeek | null>>();

  return {
    restaurantId: ctx.restaurant.id,
    restaurantName: ctx.restaurant.name,
    role: ctx.role,
    userName: ctx.user.fullName ?? ctx.user.email ?? "Käyttäjä",
    month: monthIn(ctx.restaurant.timezone),
    today: todayIn(ctx.restaurant.timezone),
    now: nowIso(),
    timezone: ctx.restaurant.timezone,
    currentPage,
    data,
    lunchWeek(weekStart) {
      const existing = weekCache.get(weekStart);
      if (existing) return existing;

      const promise = fetchLunchWeek(ctx.restaurant.id, weekStart);
      weekCache.set(weekStart, promise);
      return promise;
    },
  };
}

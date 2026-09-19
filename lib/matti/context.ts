import { requireContext } from "@/lib/restoflow/session";
import { fetchRestaurantData } from "@/lib/restoflow/queries";
import { monthIn, nowIso, todayIn } from "@/lib/restoflow/local-time";
import type { RestaurantData } from "@/lib/restoflow/queries";
import type { Role } from "@/lib/restoflow/types";
import type { AppLocale } from "@/lib/i18n/app-locales";
import { resolveLocale } from "@/lib/i18n/resolve";

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
  /** Nykyhetki ISO-muodossa. */
  now: string;
  /** Ravintolan aikavyöhyke. Päivä luetaan aina siinä ajassa. */
  timezone: string;
  /** Missä käyttäjä on sovelluksessa. Vihje, ei valtuutus. */
  currentPage: string | null;
  /**
   * Käyttäjän sovelluskieli.
   *
   * Oletus vastauksen kielelle, ei pakko: jos käyttäjä kirjoittaa
   * muulla kielellä, Matti vastaa sillä. Ks. prompt.ts.
   */
  locale: AppLocale;
  data: RestaurantData;
}

export async function mattiContext(
  currentPage: string | null,
): Promise<MattiContext> {
  const ctx = await requireContext("/admin");

  const data = await fetchRestaurantData(ctx.restaurant.id);

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
    // Kieli ratkaistaan samalla ketjulla kuin muualla sovelluksessa.
    locale: await resolveLocale(),
    data,
  };
}

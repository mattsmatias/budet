/**
 * Sivukonteksti hallintanäkymille.
 *
 * Yksi kutsu antaa istunnon, ravintolan, nykyhetken ravintolan
 * aikavyöhykkeellä ja aineiston. Ilman tätä jokainen sivu toistaisi saman
 * viiden rivin alustuksen, ja yksikin unohtunut aikavyöhykemuunnos
 * laskisi kuukauden väärin.
 */

import { redirect } from "next/navigation";
import { monthIn, todayIn } from "./local-time";
import { can, capabilityForPath, landingFor } from "./permissions";
import { fetchRestaurantData, type RestaurantData } from "./queries";
import { requireContext, type Context } from "./session";

export interface AdminContext extends Context, RestaurantData {
  /** Kuluva kuukausi "2026-08" ravintolan aikavyöhykkeellä. */
  month: string;
  /** Kuluva päivä "2026-08-20" ravintolan aikavyöhykkeellä. */
  today: string;
  /** Nykyhetki ISO-aikaleimana. */
  now: string;
}

export async function adminContext(returnTo: string): Promise<AdminContext> {
  const ctx = await requireContext(returnTo);

  // Rooliportti. Navigaation piilottama linkki ei ole pääsynhallintaa:
  // osoitteen voi kirjoittaa itse. Vaatimus luetaan samasta taulukosta
  // josta valikkokin, joten ne eivät voi erota toisistaan.
  const required = capabilityForPath(returnTo);
  if (required !== null && !can(ctx.role, required)) {
    redirect(landingFor(ctx.role));
  }
  const data = await fetchRestaurantData(ctx.restaurant.id);

  return {
    ...ctx,
    ...data,
    month: monthIn(ctx.restaurant.timezone),
    today: todayIn(ctx.restaurant.timezone),
    now: new Date().toISOString(),
  };
}

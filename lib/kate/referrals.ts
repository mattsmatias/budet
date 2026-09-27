/**
 * Työntekijän omat ilmoitukset.
 *
 * VAIN OMAT.
 *
 * my_referrals rajaa rivit kutsujan omiin ilmoituksiin kannassa, ei
 * täällä. Toisen työntekijän liidit eivät kuulu tähän näkymään, eikä
 * rajaus saa olla sellaisessa paikassa jonka voi ohittaa osoitetta
 * muokkaamalla.
 */

import { cache } from "react";
import { createClient } from "@/utils/supabase/server";

export interface Referral {
  id: string;
  /** Yrityksen nimi sellaisena kuin se ilmoitettiin. */
  restaurant: string;
  name: string;
  email: string;
  createdAt: string;
  /** Milloin Kate otti yhteydenoton työn alle. Null = vielä avoin. */
  handledAt: string | null;
}

export const fetchMyReferrals = cache(async (): Promise<Referral[]> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("my_referrals");
    if (error || !Array.isArray(data)) return [];
    return data as Referral[];
  } catch {
    return [];
  }
});

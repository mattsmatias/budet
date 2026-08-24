"use server";

/**
 * Kutsukoodin tarkistus ennen tunnuksen luontia.
 *
 * Koodi tarkistetaan kannassa ja säilytetään evästeessä tunnuksen
 * luonnin yli. Ilman evästettä koodi pitäisi kuljettaa osoitteessa,
 * jolloin se päätyisi selaushistoriaan ja palvelinlokeihin.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getUser } from "@/lib/restoflow/session";
import {
  INVITE_COOKIE,
  INVITE_TTL_SECONDS,
  type InvitePreview,
  type InviteState,
} from "./invite";

/** Lukee tallennetun koodin. Palauttaa myös kutsun tiedot jos se on yhä voimassa. */
export async function readInvite(): Promise<{ code: string; preview: InvitePreview } | null> {
  const store = await cookies();
  const code = store.get(INVITE_COOKIE)?.value;
  if (!code) return null;

  const preview = await lookup(code);
  return preview ? { code, preview } : null;
}

async function lookup(code: string): Promise<InvitePreview | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_invitation", { p_code: code });

  if (error || !Array.isArray(data) || data.length === 0) return null;

  const row = data[0] as {
    restaurant_name: string;
    role: string;
    position: string | null;
  };

  return {
    restaurantName: row.restaurant_name,
    role: row.role,
    position: row.position,
  };
}

/**
 * Tarkistaa koodin ja vie eteenpäin.
 *
 * Kirjautunut käyttäjä ohjataan suoraan liittymiseen. Kirjautumaton
 * tunnuksen luontiin, jossa hän näkee mihin on liittymässä ennen kuin
 * antaa sähköpostinsa.
 */
export async function checkInvite(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (code.length < 4) return { error: "Syötä kutsukoodi." };

  const preview = await lookup(code);
  if (!preview) {
    /*
     * Sama viesti kaikista syistä.
     *
     * "Koodia ei ole" ja "koodi on käytetty" erottelisivat olemassa
     * olevat koodit olemattomista, mikä auttaisi arvaamaan niitä.
     */
    return {
      error: "Koodi ei kelpaa. Tarkista se esihenkilöltäsi — koodi voi olla myös jo käytetty tai vanhentunut.",
    };
  }

  const store = await cookies();
  store.set(INVITE_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: INVITE_TTL_SECONDS,
  });

  const user = await getUser();
  redirect(user ? "/aloitus" : "/rekisteroidy?tila=liity");
}

/** Poistaa koodin, kun se on käytetty tai käyttäjä perääntyy. */
export async function clearInvite(): Promise<void> {
  const store = await cookies();
  store.delete(INVITE_COOKIE);
}

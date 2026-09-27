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
import { getUser, homeForUser } from "@/lib/restoflow/session";
import { resolveLocale } from "@/lib/i18n/resolve";
import { authText } from "@/lib/i18n/auth-text";
import {
  acceptRpc,
  INVITE_COOKIE,
  INVITE_TTL_SECONDS,
  type InvitePreview,
  type InviteState,
} from "./invite";

/** Lukee tallennetun koodin. Palauttaa myös kutsun tiedot jos se on yhä voimassa. */
export async function readInvite(): Promise<{
  code: string;
  preview: InvitePreview;
} | null> {
  const store = await cookies();
  const code = store.get(INVITE_COOKIE)?.value;
  if (!code) return null;

  const preview = await lookup(code);
  return preview ? { code, preview } : null;
}

/**
 * Mihin koodi kelpaa.
 *
 * YRITYS ENSIN, KATEN OMA TIIMI SEN JÄLKEEN.
 *
 * Kutsut ovat eri tauluissa, joten koodi on tarkistettava molemmista.
 * Yritysten kutsut ovat niitä joita on paljon, joten ne kysytään
 * ensin; Katen omat koodit ovat harvinaisia ja jäävät toiseksi
 * kyselyksi vain silloin kun ensimmäinen ei löydä mitään.
 *
 * Kutsu ei voi olla molempia: koodit ovat satunnaisia kahdeksan
 * merkin jonoja, joten sama koodi kahdessa taulussa tarkoittaisi
 * yhteentörmäystä jota ei käytännössä tule.
 */
async function lookup(code: string): Promise<InvitePreview | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("preview_invitation", {
    p_code: code,
  });

  if (!error && Array.isArray(data) && data.length > 0) {
    const row = data[0] as { restaurant_name: string; role: string };
    return {
      kind: "restaurant",
      restaurantName: row.restaurant_name,
      role: row.role,
    };
  }

  const { data: kate, error: kateError } = await supabase.rpc(
    "preview_kate_invitation",
    { p_code: code },
  );

  if (!kateError && Array.isArray(kate) && kate.length > 0) {
    /*
     * Nimi on "Kate", ei kutsuun kirjoitettu nimilappu.
     *
     * Lappu on ylläpitäjän oma muistiinpano siitä kenelle koodi
     * annettiin. Sen näyttäminen kutsutulle olisi outoa: hän näkee
     * oman nimensä paikassa jossa kerrotaan mihin hän on liittymässä.
     */
    return { kind: "kate", restaurantName: "Kate", role: null };
  }

  return null;
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
  const t = authText(await resolveLocale());

  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (code.length < 4) return { error: t.virheet.enterCode };

  const preview = await lookup(code);
  if (!preview) {
    /*
     * Sama viesti kaikista syistä.
     *
     * "Koodia ei ole" ja "koodi on käytetty" erottelisivat olemassa
     * olevat koodit olemattomista, mikä auttaisi arvaamaan niitä.
     */
    return { error: t.virheet.badCode };
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
  if (!user) redirect("/rekisteroidy?tila=liity");

  /* Kirjautunut liitetään heti: aloitussivu ei saa muuttaa evästettä. */
  const supabase = await createClient();
  const { error } = await supabase.rpc(acceptRpc(preview.kind), {
    p_code: code,
  });
  await clearInvite();
  redirect(error ? "/aloitus?tila=liity" : await homeForUser());
}

/** Poistaa koodin, kun se on käytetty tai käyttäjä perääntyy. */
export async function clearInvite(): Promise<void> {
  const store = await cookies();
  store.delete(INVITE_COOKIE);
}

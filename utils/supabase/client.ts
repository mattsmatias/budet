import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase-asiakas selaimelle.
 *
 * Käytetään vain siihen mitä palvelimella ei voi tehdä: tiedoston lataus
 * suoraan tallennukseen ilman että se kulkee palvelimen muistin läpi.
 * Kaikki kirjoitus tietokantaan menee server actionien kautta.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

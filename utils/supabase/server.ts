import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase-asiakas palvelinkomponenteille ja server actioneille.
 *
 * Lukee evästeet itse, joten kutsupaikan ei tarvitse välittää cookieStorea.
 * Käyttää julkaistavaa avainta ja noudattaa siten RLS-politiikkoja — tämä
 * on tarkoituksellista, ei puute. Palvelinpuolen tehtävät jotka tarvitsevat
 * RLS:n ohituksen käyttävät createServiceClient()-funktiota.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component ei saa kirjoittaa evästeitä. Istunnon
            // päivitys hoituu proxy.ts:ssä, joten tämän voi ohittaa.
          }
        },
      },
    },
  );
}

/**
 * Onko Supabase konfiguroitu? Sovellus toimii demo-tilassa ilmankin,
 * joten puuttuva konfiguraatio ei saa kaataa sivua.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Ympäristömuuttuja ${name} puuttuu. Kopioi .env.example tiedostoksi .env.local.`,
    );
  }
  return value;
}

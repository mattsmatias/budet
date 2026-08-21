import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase-asiakas palvelinkomponenteille ja server actioneille.
 *
 * Käyttää julkaistavaa avainta ja noudattaa siten RLS-politiikkoja. Tämä on
 * tarkoituksellista: sovelluskoodi ei saa ohittaa tietokannan rajoja edes
 * vahingossa.
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
            // Server Component ei saa kirjoittaa evästeitä. Istunnon päivitys
            // hoituu proxy.ts:ssä, joten tämän voi ohittaa.
          }
        },
      },
    },
  );
}

/** Onko Supabase konfiguroitu tähän ympäristöön? */
export function isConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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

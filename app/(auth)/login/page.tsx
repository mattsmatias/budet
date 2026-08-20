import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/utils/supabase/server";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Kirjaudu" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.seuraava === "string" ? params.seuraava : "/dashboard";

  if (await getSessionUser()) redirect(next);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Kirjaudu sisään</h1>
      <p className="mt-2 text-sm text-navy-300">
        Ei vielä tunnusta?{" "}
        <Link href="/signup" className="text-gold-400 underline underline-offset-4">
          Luo tunnus
        </Link>
      </p>

      {isSupabaseConfigured() ? (
        <LoginForm next={next} />
      ) : (
        <NotConfigured />
      )}

      <p className="mt-8 text-center text-sm text-navy-400">
        <Link href="/dashboard" className="underline underline-offset-4 hover:text-navy-200">
          Katso demo ilman kirjautumista
        </Link>
      </p>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="mt-6 rounded-lg border border-gold-400/40 bg-gold-400/5 p-4 text-sm">
      <p className="font-medium text-gold-300">Kirjautumista ei ole vielä otettu käyttöön</p>
      <p className="mt-2 text-navy-200">
        Supabasen ympäristömuuttujat puuttuvat. Kopioi <code>.env.example</code>{" "}
        tiedostoksi <code>.env.local</code> ja täytä arvot, tai lisää ne
        julkaisuympäristön asetuksiin.
      </p>
    </div>
  );
}

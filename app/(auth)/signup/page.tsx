import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/utils/supabase/server";
import { SignUpForm } from "./form";

export const metadata: Metadata = { title: "Luo tunnus" };

export default async function SignUpPage() {
  if (await getSessionUser()) redirect("/dashboard");

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Luo tunnus</h1>
      <p className="mt-2 text-sm text-navy-300">
        14 päivän kokeilu, ei luottokorttia. Onko sinulla jo tunnus?{" "}
        <Link href="/login" className="text-gold-400 underline underline-offset-4">
          Kirjaudu
        </Link>
      </p>

      {isSupabaseConfigured() ? (
        <SignUpForm />
      ) : (
        <div className="mt-6 rounded-lg border border-gold-400/40 bg-gold-400/5 p-4 text-sm">
          <p className="font-medium text-gold-300">
            Rekisteröitymistä ei ole vielä otettu käyttöön
          </p>
          <p className="mt-2 text-navy-200">
            Supabasen ympäristömuuttujat puuttuvat tästä ympäristöstä.
          </p>
        </div>
      )}
    </div>
  );
}

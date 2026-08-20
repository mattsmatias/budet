/**
 * Sähköpostivahvistuksen ja magic linkin paluuosoite.
 *
 * Supabase ohjaa tänne koodin kanssa; vaihdamme sen istunnoksi ja ohjaamme
 * eteenpäin. Uudelleenohjaus sallitaan vain saman sivuston sisälle, jotta
 * linkkiä ei voi käyttää käyttäjän ohjaamiseen ulkopuolelle.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("seuraava") ?? "/dashboard";

  // Vain suhteellinen polku kelpaa — ei protokollaa, ei toista isäntää.
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//")
    ? rawNext
    : "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?virhe=puuttuva_koodi`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?virhe=vahvistus_epaonnistui`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}

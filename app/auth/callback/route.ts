import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * Sähköpostilinkkien paluureitti.
 *
 * Sama reitti palvelee sekä tilin vahvistusta että salasanan palautusta:
 * molemmissa Supabase ohjaa tänne kertakäyttöisellä koodilla, joka
 * vaihdetaan istunnoksi. Ilman tätä reittiä linkin klikkaus päätyisi
 * etusivulle ilman istuntoa, eikä käyttäjä ymmärtäisi miksi.
 *
 * Koodi vaihdetaan palvelimella. Selaimessa se näkyisi osoiterivillä ja
 * jäisi selaushistoriaan.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  // Vain saman sivuston polku kelpaa: avoin uudelleenohjaus veisi
  // vahvistetun käyttäjän vieraaseen osoitteeseen.
  const requested = searchParams.get("seuraava") ?? "/admin";
  const next =
    requested.startsWith("/") && !requested.startsWith("//")
      ? requested
      : "/admin";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as
        "signup" | "recovery" | "email_change" | "invite" | "magiclink",
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(
    `${origin}/kirjaudu?virhe=${encodeURIComponent(
      "Linkki on vanhentunut tai jo käytetty. Pyydä uusi.",
    )}`,
  );
}

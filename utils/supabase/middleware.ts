import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Reitit jotka vaativat kirjautumisen. */
const PROTECTED = ["/app", "/admin", "/aloitus"];

/** Reitit joille kirjautunutta ei kannata näyttää. */
const AUTH_ONLY = ["/kirjaudu", "/rekisteroidy"];

/**
 * Istunnon päivitys ja reittisuojaus.
 *
 * Kaksi asiaa samassa paikassa, koska molemmat tarvitsevat saman
 * evästeiden luku- ja kirjoituskierroksen. Erillisinä istunto pitäisi
 * lukea kahdesti joka pyynnöllä.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Ilman konfiguraatiota sovellus toimii mutta kirjautuminen ei — anna
  // sivujen kertoa se itse sen sijaan että pyyntö kaatuisi tähän.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Tämä kutsu on se joka oikeasti päivittää istunnon. Ilman sitä client
  // rakennetaan mutta evästeitä ei koskaan kirjoiteta takaisin.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const target = request.nextUrl.clone();
    target.pathname = "/kirjaudu";
    target.search = `?seuraava=${encodeURIComponent(path)}`;
    return NextResponse.redirect(target);
  }

  if (user && AUTH_ONLY.includes(path)) {
    const target = request.nextUrl.clone();
    target.pathname = "/admin";
    target.search = "";
    return NextResponse.redirect(target);
  }

  return response;
}

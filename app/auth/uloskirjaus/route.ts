import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * Poistetun tai lukitun tunnuksen uloskirjaus.
 *
 * Kun omistaja poistaa käyttäjän, tämän selaimessa voi olla vielä
 * voimassa oleva pääsytoken. Sivu ei voi kirjata häntä ulos, koska sivun
 * piirto ei saa muuttaa evästeitä; reitinkäsittelijä saa. Aloitussivu
 * ohjaa tänne, täällä evästeet tyhjennetään ja käyttäjä viedään
 * kirjautumissivulle, jossa hänelle kerrotaan miksi.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });

  return NextResponse.redirect(new URL("/kirjaudu?poistettu=1", request.url));
}

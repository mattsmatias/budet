import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { verifiedUser } from "./claims";

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

  /*
   * Evästeet jotka Supabase haluaa kirjoittaa tällä pyynnöllä.
   *
   * Ne on pidettävä erillään vastauksesta, koska vastaus voi vielä
   * vaihtua uudelleenohjaukseksi. Ilman tätä listaa ne katoaisivat
   * juuri silloin kun niillä on eniten merkitystä — ks. redirectTo.
   */
  const pending: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          pending.push({ name, value, options });
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  /*
   * Tämä kutsu on se joka oikeasti päivittää istunnon. Ilman sitä client
   * rakennetaan mutta evästeitä ei koskaan kirjoiteta takaisin.
   *
   * Allekirjoitus varmennetaan paikallisesti julkisella avaimella eikä
   * kysymällä Supabaselta. Kysyminen maksoi verkkokierroksen jokaisella
   * pyynnöllä — myös julkisilla sivuilla, joilla tulosta ei käytetä
   * mihinkään. Ks. claims.ts.
   */
  const user = await verifiedUser(supabase);

  const path = request.nextUrl.pathname;

  /**
   * Uudelleenohjaus joka ei hukkaa istuntoa.
   *
   * Tämä on koko tiedoston tärkein kohta. `getUser` on juuri voinut
   * kiertää pääsytokenin, jolloin Supabase antaa uudet evästeet ja
   * mitätöi vanhat palvelimen päässä. Tuore `NextResponse.redirect`
   * ei kanna niitä mukanaan, joten selaimelle jäisi käteen eväste
   * joka on jo kuollut.
   *
   * Siitä ei toivu itsestään: seuraava pyyntö lähettää saman kuolleen
   * evästeen, kierrätys epäonnistuu, ohjataan taas — ja sivu jää
   * lataamaan loputtomiin. Sama koskee uloskirjaavaa tapausta, jossa
   * Supabase tyhjentää evästeet: ilman näitä otsikoita selain ei saa
   * koskaan tietää että istunto on mennyt.
   */
  const redirectTo = (pathname: string, search = "") => {
    const target = request.nextUrl.clone();
    target.pathname = pathname;
    target.search = search;

    const redirect = NextResponse.redirect(target);
    pending.forEach(({ name, value, options }) =>
      redirect.cookies.set(name, value, options),
    );

    return redirect;
  };

  if (!user && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    return redirectTo("/kirjaudu", `?seuraava=${encodeURIComponent(path)}`);
  }

  if (user && AUTH_ONLY.includes(path)) {
    return redirectTo("/admin");
  }

  return response;
}

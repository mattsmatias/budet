import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Istunnon varmistus ilman verkkopyyntöä.
 *
 * `auth.getUser()` kysyy käyttäjän Supabasen palvelimelta joka kerta.
 * Se on turvallinen mutta maksaa yhden verkkokierroksen, ja niitä tulee
 * kaksi jokaista sivulatausta kohti: yksi väliohjelmistossa ja yksi
 * sivun renderöinnissä. Mitattuna se oli noin 300 ms admin-sivun
 * seitsemästäsadasta.
 *
 * Projekti allekirjoittaa tunnukset ES256-avaimella, joten allekirjoitus
 * voidaan varmentaa paikallisesti julkisella avaimella. Se on Supabasen
 * oma suositus epäsymmetrisille avaimille eikä heikennä turvallisuutta:
 * väärennettyä tunnusta ei voi tehdä ilman yksityistä avainta.
 *
 * Luottamus ei siis perustu evästeen sisältöön vaan allekirjoitukseen.
 */

/*
 * Tyyppi luetaan metodin allekirjoituksesta eikä kirjoiteta käsin.
 * Käsin kirjoitettu kopio ajautuisi erilleen kirjaston päivittyessä.
 */
type ClaimsOptions = NonNullable<
  Parameters<SupabaseClient["auth"]["getClaims"]>[1]
>;

/** Julkinen avainjoukko. Yksi kappale per palvelinprosessi. */
type Jwks = NonNullable<ClaimsOptions["jwks"]>;

let cached: Jwks | null = null;
let cachedAt = 0;

/**
 * Kymmenen minuuttia.
 *
 * Avaimet vaihtuvat harvoin. Jos ne vaihtuvat kesken välimuistin, kirjasto
 * ei löydä tunnuksen `kid`:iä syötetystä joukosta ja hakee tuoreen itse —
 * vanhentunut välimuisti korjaa siis itsensä eikä lukitse ketään ulos.
 */
const TTL_MS = 10 * 60 * 1000;

async function signingKeys(): Promise<Jwks | undefined> {
  const now = Date.now();
  if (cached && now - cachedAt < TTL_MS) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return undefined;

  try {
    const response = await fetch(`${url}/auth/v1/.well-known/jwks.json`);
    if (!response.ok) return undefined;

    const body = (await response.json()) as Jwks;
    if (!Array.isArray(body?.keys) || body.keys.length === 0) return undefined;


    cached = body;
    cachedAt = now;
    return cached;
  } catch {
    // Verkkovirhe ei saa kaataa pyyntöä. Ilman avaimia kirjasto putoaa
    // takaisin verkkovarmistukseen, joka on hitaampi mutta toimii.
    return undefined;
  }
}

export interface VerifiedUser {
  id: string;
  email: string | null;
}

/**
 * Kirjautunut käyttäjä, tai null.
 *
 * Uusii istunnon tarvittaessa aivan kuten `getUser()`: kirjasto lukee
 * istunnon evästeistä ja pyytää uuden pääsytokenin jos vanha on
 * mennyt umpeen. Uudet evästeet kirjoitetaan clientin `setAll`-kutsun
 * kautta samalla tavalla kuin ennenkin.
 */
export async function verifiedUser(
  supabase: SupabaseClient,
): Promise<VerifiedUser | null> {
  const jwks = await signingKeys();

  const { data, error } = await supabase.auth.getClaims(undefined,
    jwks ? { jwks } : undefined,
  );

  if (error || !data?.claims) return null;

  const claims = data.claims as { sub?: unknown; email?: unknown };
  if (typeof claims.sub !== "string" || claims.sub === "") return null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
}

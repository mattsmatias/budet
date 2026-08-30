/**
 * Meta-kirjautumisen väliaikaiset tilat.
 *
 * OAuth-kierros kulkee kolmen pyynnön yli: aloitus, paluu Metalta ja
 * mahdollinen sivun valinta. Näiden välissä on kaksi asiaa joita ei
 * voi laittaa osoitteeseen eikä selaimen muistiin.
 *
 * ---------------------------------------------------------------------
 * STATE ON CSRF-SUOJA, EI TUNNISTE
 * ---------------------------------------------------------------------
 *
 * Ilman sitä kuka tahansa voisi houkutella kirjautuneen
 * ravintoloitsijan avaamaan callback-osoitteen omalla koodillaan, ja
 * Kate yhdistäisi hyökkääjän Facebook-sivun ravintolan tiliin.
 *
 * Arvo arvotaan aloituksessa, tallennetaan httpOnly-evästeeseen ja
 * verrataan paluussa vakioaikaisesti. Eväste on ainoa paikka jossa se
 * on: osoitteessa oleva state ilman evästettä ei todista mitään.
 *
 * ---------------------------------------------------------------------
 * KÄYTTÄJÄTOKENI EI JÄÄ MIHINKÄÄN
 * ---------------------------------------------------------------------
 *
 * Jos käyttäjällä on monta Facebook-sivua, hän valitsee yhden. Sen
 * välissä pitkäikäinen käyttäjätokeni on tallessa httpOnly-evästeessä
 * salattuna, kymmenen minuuttia. Kantaan se ei mene: kantaan
 * tallennetaan vain valitun sivun tokeni.
 */

import { cookies } from "next/headers";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { decryptToken, encryptToken } from "./meta-crypto";

const STATE_EVASTE = "kate_meta_state";
const TOKEN_EVASTE = "kate_meta_pending";
const RAVINTOLA_EVASTE = "kate_meta_restaurant";

/* Kierros kestää minuutteja. Kymmenen on väljä ja silti lyhyt. */
const ELINAIKA = 10 * 60;

const ASETUKSET = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  /*
   * lax eikä strict: paluu Metalta on ylätason GET-siirtymä toiselta
   * sivustolta, ja strict estäisi evästeen juuri silloin kun sitä
   * tarvitaan. lax sallii sen muttei ristiinpyyntöjä.
   */
  sameSite: "lax" as const,
  path: "/",
  maxAge: ELINAIKA,
};

export async function startState(restaurantId: string): Promise<string> {
  const state = randomBytes(32).toString("hex");
  const jar = await cookies();

  jar.set(STATE_EVASTE, state, ASETUKSET);

  /*
   * Ravintola talteen aloitushetkeltä.
   *
   * Käyttäjä voi vaihtaa aktiivista ravintolaa toisessa välilehdessä
   * kesken kierroksen. Ilman tätä yhteys tallentuisi väärälle
   * ravintolalle — ja se olisi juuri se virhe jota ei huomaa.
   */
  jar.set(RAVINTOLA_EVASTE, restaurantId, ASETUKSET);

  return state;
}

export interface StateResult {
  ok: boolean;
  restaurantId: string | null;
}

/** Vertaa paluun statea evästeeseen vakioaikaisesti. */
export async function checkState(given: string | null): Promise<StateResult> {
  const jar = await cookies();
  const odotettu = jar.get(STATE_EVASTE)?.value ?? null;
  const restaurantId = jar.get(RAVINTOLA_EVASTE)?.value ?? null;

  if (!given || !odotettu || given.length !== odotettu.length) {
    return { ok: false, restaurantId: null };
  }

  const sama = timingSafeEqual(Buffer.from(given), Buffer.from(odotettu));
  return { ok: sama, restaurantId: sama ? restaurantId : null };
}

/** Käyttäjätokeni odottamaan sivun valintaa. Salattuna, httpOnly. */
export async function holdUserToken(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(TOKEN_EVASTE, encryptToken(token), ASETUKSET);
}

export async function takeUserToken(): Promise<string | null> {
  const jar = await cookies();
  const salattu = jar.get(TOKEN_EVASTE)?.value;
  if (!salattu) return null;

  try {
    return decryptToken(salattu);
  } catch {
    /* Muokattu tai vanhentunut eväste on sama kuin ei evästettä. */
    return null;
  }
}

/**
 * Kaikki väliaikainen pois.
 *
 * Kutsutaan onnistumisessa ja epäonnistumisessa. Jäänyt käyttäjätokeni
 * evästeessä olisi kymmenen minuutin ikkuna jota ei tarvita.
 */
export async function clearOauthCookies(): Promise<void> {
  const jar = await cookies();
  for (const nimi of [STATE_EVASTE, TOKEN_EVASTE, RAVINTOLA_EVASTE]) {
    jar.set(nimi, "", { ...ASETUKSET, maxAge: 0 });
  }
}

/**
 * Paluuosoite.
 *
 * Metan sovellusasetuksiin kirjattu osoite ja tämä pitää olla merkilleen
 * sama, muuten Meta hylkää kierroksen. Ympäristömuuttuja voittaa,
 * jotta tuotannon osoite ei riipu pyynnön otsakkeista.
 */
export function redirectUri(origin: string): string {
  return process.env.META_REDIRECT_URI ?? `${origin}/api/meta/callback`;
}

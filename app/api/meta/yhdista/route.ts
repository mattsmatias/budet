/**
 * Meta-kirjautumisen aloitus.
 *
 * Ohjaa käyttäjän Facebookin lupanäkymään. Ainoa asia joka tässä
 * tehdään ennen ohjausta on CSRF-suojan arpominen ja aktiivisen
 * ravintolan tallennus — molemmat httpOnly-evästeisiin.
 *
 * Reitti on GET, koska se on selaimen siirtymä eikä toimintokutsu.
 * Se ei muuta mitään pysyvää: väärin päätynyt kutsu johtaa
 * kirjautumisnäkymään josta voi peruuttaa.
 */

import { NextResponse } from "next/server";
import { can } from "@/lib/restoflow/permissions";
import { requireContext } from "@/lib/restoflow/session";
import { siteOrigin } from "@/lib/restoflow/site-origin";
import { authorizeUrl, metaConfigured } from "@/lib/restoflow/meta-api";
import { tokenKeyReady } from "@/lib/restoflow/meta-crypto";
import { redirectUri, startState } from "@/lib/restoflow/meta-oauth";

const ASETUKSET = "/admin/asetukset/some";

export async function GET() {
  const { restaurant, role } = await requireContext(ASETUKSET);

  if (!can(role, "settings.edit")) {
    return NextResponse.redirect(
      new URL(`${ASETUKSET}?virhe=oikeus`, await siteOrigin()),
    );
  }

  /*
   * Puuttuva asetus ei ole käyttäjän vika eikä virhe jota hän voi
   * korjata. Siitä kerrotaan asetusnäkymässä, ei Metan päässä.
   */
  if (!metaConfigured() || !tokenKeyReady()) {
    return NextResponse.redirect(
      new URL(`${ASETUKSET}?virhe=asetus`, await siteOrigin()),
    );
  }

  const origin = await siteOrigin();
  const state = await startState(restaurant.id);

  return NextResponse.redirect(authorizeUrl(state, redirectUri(origin)));
}

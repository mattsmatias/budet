/**
 * Julkaisukuvan esikatselu.
 *
 * Sama kuva jonka Meta saa, samalla koodilla. Erillinen
 * esikatselupiirto olisi toinen toteutus samasta asiasta, ja ne
 * eroaisivat juuri siinä kohdassa jota ei katsota.
 *
 * Kuvaa ei tallenneta: esikatselu on katsomista varten, ja
 * tallennettu esikatselu jäisi bucketiin joka kerta kun käyttäjä
 * avaa julkaisunäkymän.
 */

import { NextResponse } from "next/server";
import { resolveLocale } from "@/lib/i18n/resolve";
import { can } from "@/lib/restoflow/permissions";
import { requireContext } from "@/lib/restoflow/session";
import { fetchLunchWeek } from "@/lib/restoflow/queries";
import { isLunchTheme } from "@/lib/restoflow/lunch-themes";
import { renderLunchImage, type ImageTarget } from "@/lib/restoflow/meta-image";
import { ISO_DATE } from "@/lib/restoflow/dates";

export async function GET(request: Request) {
  const { restaurant, role } = await requireContext("/admin/lounas");
  if (!can(role, "lunch.manage")) {
    return new NextResponse(null, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const viikko = params.get("viikko") ?? "";
  const kanava = params.get("kanava");

  if (!ISO_DATE.test(viikko)) return new NextResponse(null, { status: 400 });
  if (kanava !== "instagram" && kanava !== "facebook") {
    return new NextResponse(null, { status: 400 });
  }

  const week = await fetchLunchWeek(restaurant.id, viikko);
  if (!week) return new NextResponse(null, { status: 404 });

  const locale = await resolveLocale();
  const theme = isLunchTheme(restaurant.lunchTheme)
    ? restaurant.lunchTheme
    : "light";

  const jpeg = await renderLunchImage({
    week,
    restaurantName: restaurant.name,
    theme,
    locale,
    target: kanava as ImageTarget,
  });

  return new NextResponse(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      /*
       * Ei välimuistia. Lounaslista muuttuu, ja välimuistista tarjoiltu
       * esikatselu näyttäisi eilisen listan.
       */
      "Cache-Control": "no-store",
    },
  });
}

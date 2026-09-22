import { NextResponse } from "next/server";
import { getActiveRestaurant } from "@/lib/restoflow/session";
import { createClient } from "@/utils/supabase/server";

/**
 * Yrityksen profiilikuva.
 *
 * Kuva on yksityisessä säiliössä, joten se ei ole suora osoite vaan
 * kulkee tämän reitin kautta. Näin kuori voi piirtää tunnuksen joka
 * sivulla ilman että jokainen sivunpiirto hakee uuden allekirjoituksen
 * — selain hakee kuvan kerran ja pitää sen välimuistissa.
 *
 * PYYTÄJÄ RATKAISEE YRITYKSEN.
 *
 * Reitti ei ota yritystä parametrina. Se lukee sen istunnosta, joten
 * osoitetta muokkaamalla ei pääse toisen yrityksen kuvaan. Sama
 * sääntö kuin muuallakin: clientilta tulevaan tunnisteeseen ei luoteta.
 */
export async function GET() {
  const restaurant = await getActiveRestaurant();
  if (!restaurant) return new NextResponse(null, { status: 401 });

  const polku = restaurant.logoPath;
  if (!polku) return new NextResponse(null, { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("logos").download(polku);

  if (error || !data) return new NextResponse(null, { status: 404 });

  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      "Content-Type": data.type || "image/png",
      /*
       * Yksityinen välimuisti tunniksi.
       *
       * Kuva on yhden yrityksen omaa aineistoa, joten välityspalvelin
       * ei saa säilöä sitä. Osoitteessa on versiotunniste, joten uusi
       * kuva näkyy heti eikä vanhaa tarvitse odottaa pois.
       */
      "Cache-Control": "private, max-age=3600",
    },
  });
}

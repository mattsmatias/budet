/**
 * Tiedoston avaaminen Katen omasta osoitteesta.
 *
 * Ennen tätä tiedoston avaaminen vei suoraan storagen allekirjoitettuun
 * osoitteeseen. Osoiterivillä luki silloin Supabase-projektin tunnus,
 * bucketin nimi, ravintolan tunniste ja allekirjoitus — ja se osoite oli
 * tunnin ajan toimiva linkki yksityiseen asiakirjaan kenelle tahansa
 * jolle se päätyi. Riittää että käyttäjä kopioi osoiterivin.
 *
 * Nyt osoite on /api/tiedostot/<tunnus>. Se ei paljasta mitään
 * infrastruktuurista, eikä sen jakaminen anna kenellekään mitään: reitti
 * vaatii kirjautumisen ja jäsenyyden, ja jokainen avaus tarkistetaan
 * uudelleen.
 *
 * ---------------------------------------------------------------------
 * MIKSI VÄLITYS EIKÄ UUDELLEENOHJAUS
 * ---------------------------------------------------------------------
 *
 * Uudelleenohjaus allekirjoitettuun osoitteeseen olisi halvempi, mutta
 * selain päätyisi sinne — ja osoiterivillä lukisi lopulta täsmälleen se
 * osoite jota tässä yritetään piilottaa.
 *
 * Tavut virtaavat läpi, ei muistiin: kahdenkymmenenviiden megatavun
 * tiedosto ei saa kasvattaa palvelinfunktion muistinkäyttöä
 * kahdellakymmenelläviidellä megatavulla.
 */

import { NextResponse, type NextRequest } from "next/server";
import { can } from "@/lib/restoflow/permissions";
import { requireContext } from "@/lib/restoflow/session";
import { createClient } from "@/utils/supabase/server";

/* Iso PDF hitaalla yhteydellä. */
export const maxDuration = 60;

/*
 * Allekirjoitus elää vain sen hetken kun palvelin hakee tavut.
 *
 * Osoite ei päädy selaimeen, joten sen ei tarvitse kestää kuin yhden
 * sisäisen haun. Minuutti on väljä siihen ja lyhyt kaikkeen muuhun.
 */
const SIGN_SECONDS = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  /*
   * Kirjautuminen ja jäsenyys ensin.
   *
   * requireContext ohjaa kirjautumiseen jos istuntoa ei ole. Reitti on
   * siis suljettu samalla tavalla kuin sivutkin, eikä tunnisteen
   * arvaaminen anna mitään.
   */
  const { role } = await requireContext("/admin/tiedostot");
  if (!can(role, "files.view")) {
    return new NextResponse(null, { status: 403 });
  }

  const supabase = await createClient();

  /*
   * Rivi haetaan rivitason käytäntöjen läpi.
   *
   * Toisen ravintolan tunniste ei palauta riviä lainkaan, joten
   * erillistä ravintolatarkistusta ei tarvita. Polku luetaan kannasta
   * eikä oteta vastaan pyynnöstä — muuten tämä olisi tapa
   * allekirjoittaa mikä tahansa polku.
   */
  const { data: row } = await supabase
    .from("files")
    .select("file_name, storage_path, file_type")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  const file = row as
    | { file_name: string; storage_path: string; file_type: string }
    | null;

  if (!file) return new NextResponse(null, { status: 404 });

  const { data: signed, error } = await supabase.storage
    .from("files")
    .createSignedUrl(file.storage_path, SIGN_SECONDS);

  if (error || !signed) return new NextResponse(null, { status: 404 });

  const upstream = await fetch(signed.signedUrl);
  if (!upstream.ok || !upstream.body) {
    return new NextResponse(null, { status: 502 });
  }

  /*
   * Merkinta avauksesta.
   *
   * "Viimeksi kaytetyt" vastaa siihen mita ravintoloitsija oikeasti
   * muistaa: han ei muista missa kansiossa vuokrasopimus on, mutta
   * muistaa katsoneensa sita.
   *
   * Merkinnan epaonnistuminen ei saa estaa tiedoston avaamista --
   * kayttaja pyysi tiedostoa, ei merkintaa.
   */
  await supabase.rpc("mark_file_opened", { p_file: id });

  const download = request.nextUrl.searchParams.get("lataa") === "1";

  const headers = new Headers({
    "Content-Type": file.file_type || "application/octet-stream",
    "Content-Disposition": disposition(file.file_name, download),

    /*
     * Ei välimuistiin missään.
     *
     * Väliin jäävä välimuisti tarjoilisi tiedoston uudelleen ilman
     * tarkistusta, ja "private" ei riitä kun tarkistus on koko juju.
     */
    "Cache-Control": "no-store, private",
  });

  const length = upstream.headers.get("content-length");
  if (length) headers.set("Content-Length", length);

  return new NextResponse(upstream.body, { headers });
}

/**
 * Tiedostonimi otsakkeeseen.
 *
 * Kaksi muotoa: ascii-varmistus vanhoille selaimille ja UTF-8-koodattu
 * oikea nimi muille. Ilman jälkimmäistä "Vuokrasopimus 2026.pdf"
 * latautuisi nimellä "Vuokrasopimus 2026.pdf" — mutta ääkkösellinen
 * nimi rikkoisi otsakkeen kokonaan.
 *
 * Lainausmerkit ja rivinvaihdot pois: nimi tulee käyttäjältä, ja
 * otsakkeeseen päästessään ne katkaisisivat sen.
 */
function disposition(name: string, download: boolean): string {
  const clean = name.replace(/[\r\n"\\]/g, "").trim() || "tiedosto";
  const ascii = clean.replace(/[^\x20-\x7E]/g, "_");
  const type = download ? "attachment" : "inline";

  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}`;
}

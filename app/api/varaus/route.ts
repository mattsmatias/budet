/**
 * Varauswidgetin rajapinta.
 *
 * Yksi reitti, neljä toimintoa. Neljä erillistä tiedostoa olisi
 * siistimpi hakemistorakenne mutta huonompi turvallisuuden kannalta:
 * tämä on koko se pinta jonka kuka tahansa internetissä voi kutsua, ja
 * sen on mahduttava luettavaksi kerralla. Hajautettuna joku niistä jää
 * lukematta.
 *
 * ---------------------------------------------------------------------
 * MITÄ TÄMÄ REITTI EI OLE
 * ---------------------------------------------------------------------
 *
 * Tämä ei ole turvatarkistus. Reitti on tunnukseton ja CORS on auki
 * kaikille — sen on oltava, koska widget ajetaan ravintoloiden omilla
 * verkkosivuilla joiden osoitteita ei tiedetä etukäteen. CORS estää
 * selainta lukemasta vastausta väärältä sivulta; se ei estä ketään
 * kutsumasta tätä curlilla.
 *
 * Siksi mikään tässä tiedostossa ei ole se joka päättää mitä saa
 * tehdä. Tämä muuntaa HTTP:n funktiokutsuksi ja tarkistaa muodon.
 * Säännöt — onko ravintola olemassa, ottaako se varauksia, onko aika
 * vapaa, mahtuuko seurue — ovat kannan funktioissa, jotka pitävät
 * riippumatta siitä mitä tänne lähetetään.
 *
 * Erityisesti: ravintola tunnistetaan slugista, jonka kannan funktio
 * hakee itse. Selaimen lähettämää tunnistetta ei oteta vastaan
 * missään muodossa.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { ISO_DATE } from "@/lib/restoflow/dates";
import {
  cancelPublicReservation,
  createPublicReservation,
  loadPublicSlots,
  loadReservationConfig,
} from "@/lib/restoflow/public-reservations";

/*
 * Kutsutaan aina tuoreena.
 *
 * Vapaat ajat vanhenevat sekunneissa: walk-in salissa vie ajan samalla
 * hetkellä. Välimuistista tarjoiltu lista näyttäisi vapaata aikaa jota
 * ei ole, ja asiakas saisi virheen vasta lähetettyään lomakkeen.
 */
export const dynamic = "force-dynamic";

const CORS: Record<string, string> = {
  /*
   * Kaikki sallittu, tunnuksia ei lähetetä.
   *
   * Widget on ravintolan omalla sivulla, ja niitä osoitteita ei
   * luetteloida mihinkään. Allow-Credentials on tarkoituksella pois:
   * ilman sitä selain ei lähetä evästeitä, joten avoin origin ei
   * vuodata kenenkään istuntoa.
   */
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

function ok(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: CORS });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS });
}

/*
 * Slug on rajattu kapeaksi.
 *
 * Kannan funktio hakisi sillä joka tapauksessa vain olemassa olevan
 * ravintolan, mutta pitkä tai omituinen merkkijono ei ole varaus vaan
 * kokeilu — se pysäytetään ennen kantaa.
 */
const Slug = z.string().min(1).max(80).regex(/^[a-z0-9-]+$/);

const Paiva = z.string().regex(ISO_DATE);
const Kello = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);

/*
 * Seurueen koon yläraja on tässä väljä.
 *
 * Ravintolan oikea raja on asetuksissa ja kanta tarkistaa sen. Tämä
 * estää vain sen ettei kolmen numeron kenttään syötetä miljoonaa.
 */
const Seurue = z.coerce.number().int().min(1).max(200);

const LuoSchema = z.object({
  restaurant: Slug,
  date: Paiva,
  time: Kello,
  partySize: Seurue,
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(1).max(40),
  email: z.string().trim().max(160).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

const PeruSchema = z.object({
  /* Tunnus on kaksi uuid:ta heksana. Muun mittainen ei ole tunnus. */
  token: z.string().regex(/^[0-9a-f]{64}$/),
});

// ---------------------------------------------------------------------------
// GET: asetukset ja vapaat ajat
// ---------------------------------------------------------------------------

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const toiminto = url.searchParams.get("toiminto");

  const slug = Slug.safeParse(url.searchParams.get("r") ?? "");
  if (!slug.success) return ok({ error: "restaurant" }, 400);

  if (toiminto === "asetukset") {
    const config = await loadReservationConfig(slug.data);

    /*
     * Tuntematon ravintola ja varaukset pois päältä näyttävät samalta.
     *
     * Erilainen vastaus kertoisi kysyjälle mitkä slugit ovat olemassa.
     * Widget näyttää molemmissa saman: varauksia ei oteta verkossa.
     */
    if (!config || !config.enabled) {
      return ok({ enabled: false });
    }

    return ok(config);
  }

  if (toiminto === "ajat") {
    const date = Paiva.safeParse(url.searchParams.get("pvm") ?? "");
    const party = Seurue.safeParse(url.searchParams.get("hlo") ?? "");

    if (!date.success || !party.success) return ok({ slots: [] }, 400);

    return ok({ slots: await loadPublicSlots(slug.data, date.data, party.data) });
  }

  return ok({ error: "unknown_action" }, 400);
}

// ---------------------------------------------------------------------------
// POST: varauksen luonti ja peruutus
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const toiminto = url.searchParams.get("toiminto");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ok({ ok: false, error: "body" }, 400);
  }

  if (toiminto === "peru") {
    const parsed = PeruSchema.safeParse(body);
    if (!parsed.success) return ok({ ok: false, error: "not_found" }, 400);

    return ok(await cancelPublicReservation(parsed.data.token));
  }

  if (toiminto === "luo") {
    const parsed = LuoSchema.safeParse(body);
    if (!parsed.success) {
      /*
       * Ensimmäinen virheellinen kenttä nimeltä, ei koko Zod-raporttia.
       *
       * Widget osaa korostaa kentän tällä nimellä. Koko raportti
       * kertoisi kysyjälle skeeman rakenteen eikä auttaisi asiakasta.
       */
      const kentta = parsed.error.issues[0]?.path[0];
      return ok(
        { ok: false, error: typeof kentta === "string" ? kentta : "body" },
        400,
      );
    }

    const result = await createPublicReservation({
      slug: parsed.data.restaurant,
      date: parsed.data.date,
      time: parsed.data.time,
      partySize: parsed.data.partySize,
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email ?? null,
      note: parsed.data.note ?? null,
    });

    return ok(result, result.ok ? 200 : 409);
  }

  return ok({ ok: false, error: "unknown_action" }, 400);
}

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

import { createHash } from "node:crypto";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { ISO_DATE } from "@/lib/restoflow/dates";
import { emailConfigured, looksLikeEmail, sendEmail } from "@/lib/restoflow/email";
import {
  confirmationEmail,
  toEmailLocale,
} from "@/lib/restoflow/reservation-email";
import { siteOrigin } from "@/lib/restoflow/site-origin";
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

  /*
   * Allergiat omana kenttänään.
   *
   * Keittiö lukee tämän erikseen. Vanha widget-versio ei lähetä sitä
   * lainkaan, ja se on kelvollinen pyyntö: kenttä on valinnainen,
   * jolloin ravintolan sivulla oleva vanha upotus toimii yhä.
   */
  allergies: z.string().trim().max(200).optional().nullable(),

  /*
   * Kieli vahvistusviestiä varten.
   *
   * Widget tietää millä kielellä asiakas asioi; palvelin ei. Ilman
   * tätä vahvistus lähtisi suomeksi asiakkaalle joka varasi
   * englanniksi. Tuntematon arvo palautuu suomeen, joten vanha
   * widget-versio toimii yhä.
   */
  locale: z.string().trim().max(10).optional().nullable(),
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
      allergies: parsed.data.allergies ?? null,
    });

    if (result.ok && result.cancelToken) {
      await lahetaVahvistus(parsed.data, result);
    }

    return ok(result, result.ok ? 200 : 409);
  }

  return ok({ ok: false, error: "unknown_action" }, 400);
}

// ---------------------------------------------------------------------------
// Vahvistusviesti
// ---------------------------------------------------------------------------

/**
 * Vahvistus asiakkaan sähköpostiin.
 *
 * Tämän ainoa tärkeä tehtävä on toimittaa peruutuslinkki paikkaan
 * josta se löytyy myöhemmin. Kannassa on vain tunnuksen tiiviste,
 * joten vahvistusruudulla näytetty linkki katosi lopullisesti
 * välilehden mukana — asiakkaan ainoa keino perua oli soittaa.
 *
 * ---------------------------------------------------------------------
 * VARAUS ON JO TEHTY
 * ---------------------------------------------------------------------
 *
 * Kutsutaan vasta kun kanta on vahvistanut varauksen. Mikään tässä ei
 * saa muuttaa lopputulosta: jos posti ei lähde, varaus on silti
 * voimassa ja asiakas näkee linkin ruudulla kuten ennenkin.
 *
 * after() ajaa lähetyksen vastauksen jälkeen, joten asiakas ei odota
 * postipalvelinta. Osoite luetaan silti ennen sitä: pyynnön otsakkeet
 * ovat luettavissa vain pyynnön aikana.
 */
async function lahetaVahvistus(
  input: z.infer<typeof LuoSchema>,
  result: Awaited<ReturnType<typeof createPublicReservation>>,
): Promise<void> {
  const osoite = (input.email ?? "").trim();

  /* Ilman osoitetta tai asetuksia ei ole mitään tehtävää. */
  if (!osoite || !looksLikeEmail(osoite) || !emailConfigured()) return;

  const token = result.cancelToken;
  if (!token) return;

  const viesti = confirmationEmail({
    locale: toEmailLocale(input.locale),
    restaurantName: result.restaurantName ?? "",
    date: result.date ?? input.date,
    time: result.time ?? input.time,
    partySize: result.partySize ?? input.partySize,
    tables: result.tables ?? [],
    guestName: input.name,
    reference: result.reference ?? null,
    cancelHours: result.cancelCutoffHours ?? 0,
    cancelUrl: `${await siteOrigin()}/varaus/${token}`,
  });

  /*
   * Idempotenssiavain on tunnuksen tiiviste, ei tunnus.
   *
   * Postipalvelu näkee linkin viestin sisällössä joka tapauksessa,
   * mutta avain päätyy myös sen lokeihin ja hallintanäkymään. Tiiviste
   * erottaa lähetykset toisistaan yhtä hyvin paljastamatta tunnusta
   * paikassa jossa sitä ei tarvita.
   */
  const avain = createHash("sha256").update(token).digest("hex").slice(0, 32);

  after(async () => {
    const lahetys = await sendEmail({
      to: osoite,

      /* Asiakas näkee postilaatikossaan ravintolan nimen, ei Katea. */
      fromName: result.restaurantName ?? undefined,

      subject: viesti.subject,
      text: viesti.text,
      html: viesti.html,
      idempotencyKey: `varaus-${avain}`,
    });

    /*
     * Epäonnistuminen lokiin, ei asiakkaalle.
     *
     * Asiakas on jo saanut vastauksen ja hänen varauksensa on
     * voimassa. Yleisin syy on 403: verkkotunnusta ei ole varmistettu
     * postipalvelussa, ja se on ravintolan ylläpitäjän korjattava.
     */
    if (!lahetys.ok) {
      console.error("[varaus] vahvistusviesti ei lahtenyt:", lahetys.reason);
    }
  });
}

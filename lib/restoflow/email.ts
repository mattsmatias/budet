/**
 * Sähköpostin lähetys.
 *
 * Yksi ohut kerros yhden palveluntarjoajan päälle. Tarkoitus ei ole
 * olla vaihdettava abstraktio — se olisi keksitty tarve yhdelle
 * käyttäjälle — vaan pitää API-avain ja virheiden käsittely yhdessä
 * paikassa, jotta kutsuja ei joudu miettimään kumpaakaan.
 *
 * ---------------------------------------------------------------------
 * AVAIN EI POISTU PALVELIMELTA
 * ---------------------------------------------------------------------
 *
 * RESEND_API_KEY luetaan tässä eikä missään muualla, eikä sillä ole
 * NEXT_PUBLIC_-etuliitettä — Next ei siis voi niputtaa sitä selaimeen
 * edes vahingossa. Avainta ei myöskään kirjoiteta lokiin: virheistä
 * kerrotaan vain HTTP-tila ja palvelun oma viesti.
 *
 * ---------------------------------------------------------------------
 * LÄHETYS EI SAA KAATAA SITÄ MIKÄ ONNISTUI
 * ---------------------------------------------------------------------
 *
 * Tämä ei heitä koskaan. Kutsuja on toiminto joka on jo onnistunut —
 * varaus on kannassa — ja postin epäonnistuminen ei saa muuttaa sitä
 * epäonnistuneeksi. Tulos palautetaan arvona, jotta kutsuja voi
 * kirjata sen ja jatkaa.
 *
 * Aikakatkaisu on samasta syystä: jumittunut yhteys ei saa pitää
 * pyyntöä auki loputtomiin.
 */

const ENDPOINT = "https://api.resend.com/emails";

/*
 * Kahdeksan sekuntia.
 *
 * Lähetys tapahtuu vastauksen lähettämisen jälkeen, joten asiakas ei
 * odota tätä. Katkaisu on olemassa siltä varalta ettei palvelinfunktio
 * jää elämään maksullisena minuuteiksi vastaamattoman yhteyden takia.
 */
const TIMEOUT_MS = 8000;

export interface EmailMessage {
  to: string;

  /**
   * Näkyvä lähettäjän nimi.
   *
   * Asiakas näkee postilaatikossaan ravintolan nimen, ei ohjelmiston.
   * Osoite on kaikilla ravintoloilla sama — se kuuluu palveluun ja
   * sen verkkotunnus on varmistettu kerran — mutta nimen on oltava
   * sen ravintolan, jonka pöydän asiakas varasi.
   */
  fromName?: string;

  subject: string;
  text: string;
  html: string;
  /**
   * Estää saman viestin lähtemisen kahdesti.
   *
   * Resend muistaa avaimen vuorokauden. Uudelleenyritys samalla
   * avaimella palauttaa alkuperäisen lähetyksen eikä lähetä uutta.
   */
  idempotencyKey?: string;
}

export type EmailResult =
  | { ok: true; id: string }
  | { ok: false; reason: string };

/**
 * Kelpaako osoite lähetykseen.
 *
 * Tarkoituksella löysä. Sähköpostiosoitteen täsmällinen kielioppi on
 * paljon sallivampi kuin kukaan olettaa, ja tiukka säännöllinen
 * lauseke hylkää oikeita osoitteita. Tämä torjuu vain sen mitä on
 * tarkoituskin: tyhjän kentän ja selvästi väärän arvon.
 *
 * Lopullisen tuomion antaa vastaanottava palvelin.
 */
export function looksLikeEmail(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > 254) return false;
  if (/\s/.test(trimmed)) return false;

  const at = trimmed.indexOf("@");
  if (at < 1 || at !== trimmed.lastIndexOf("@")) return false;

  const domain = trimmed.slice(at + 1);
  return domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".");
}

/**
 * Lähettäjän osoite asetuksesta.
 *
 * Hyväksyy sekä pelkän osoitteen että vanhan "Nimi <osoite>" -muodon.
 * Jälkimmäisen nimi jätetään huomiotta: nimi tulee nykyään
 * ravintolasta, eikä asetukseen jäänyt vanha nimi saa näkyä toisen
 * ravintolan viestissä.
 */
function senderAddress(): string | null {
  const raw = process.env.RESERVATION_EMAIL_FROM?.trim();
  if (!raw) return null;

  const kulmissa = raw.match(/<([^>]+)>/);
  const osoite = (kulmissa ? kulmissa[1] : raw).trim();

  return looksLikeEmail(osoite) ? osoite : null;
}

/**
 * Lähettäjä otsakkeeseen kelpaavassa muodossa.
 *
 * ---------------------------------------------------------------------
 * MIKSI NIMI PUHDISTETAAN
 * ---------------------------------------------------------------------
 *
 * Nimi päätyy sellaisenaan From-otsakkeeseen. Rivinvaihto nimessä
 * lopettaisi otsakkeen ja aloittaisi uuden — se on tapa lisätä omia
 * otsakkeita, esimerkiksi Bcc, viestiin joka lähtee palvelun
 * varmistetusta verkkotunnuksesta.
 *
 * Nimen asettaa ravintolan omistaja eikä satunnainen vieras, joten
 * tämä ei ole ensisijainen hyökkäyspinta. Se on silti käyttäjän
 * kirjoittamaa tekstiä protokollan otsakkeessa, ja se riittää syyksi.
 *
 * Lainausmerkit ympärille aina: ne tekevät pilkusta ja pisteestä
 * vaarattomia ilman että nimeä tarvitsee muuten rajoittaa.
 */
export function formatSender(address: string, name?: string): string {
  const puhdas = (name ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/["\\<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    /* Otsakkeen rivi ei saa venyä kohtuuttomaksi. */
    .slice(0, 78);

  return puhdas ? `"${puhdas}" <${address}>` : address;
}

/**
 * Onko lähetys käytettävissä.
 *
 * Kutsujan on voitava kysyä tämä ennen työn tekemistä: ilman
 * asetuksia viestin kokoaminen on turhaa työtä, ja käyttöliittymä voi
 * kertoa rehellisesti ettei vahvistusta lähde.
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && senderAddress());
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  const address = senderAddress();

  if (!key || !address) return { ok: false, reason: "not_configured" };
  if (!looksLikeEmail(message.to)) return { ok: false, reason: "bad_address" };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  if (message.idempotencyKey) {
    headers["Idempotency-Key"] = message.idempotencyKey.slice(0, 256);
  }

  let response: Response;

  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: formatSender(address, message.fromName),
        to: message.to.trim(),
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const timeout = error instanceof Error && error.name === "TimeoutError";
    return { ok: false, reason: timeout ? "timeout" : "network" };
  }

  if (!response.ok) {
    /*
     * Palvelun oma viesti mukaan, koska se kertoo syyn.
     *
     * Yleisin virhe käyttöönotossa on 403: verkkotunnusta ei ole
     * varmistettu. Pelkkä tilakoodi lähettäisi etsimään väärästä
     * paikasta. Viesti katkaistaan, ettei vieras vastaus täytä lokia.
     */
    const detail = await response.text().catch(() => "");
    const reason = `http_${response.status}`;
    return {
      ok: false,
      reason: detail ? `${reason}: ${detail.slice(0, 300)}` : reason,
    };
  }

  const data = (await response.json().catch(() => null)) as {
    id?: string;
  } | null;

  return data?.id ? { ok: true, id: data.id } : { ok: false, reason: "no_id" };
}

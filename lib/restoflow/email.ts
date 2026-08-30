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

/** Lähettäjä muodossa jonka palvelu hyväksyy, tai null jos puuttuu. */
function sender(): string | null {
  const from = process.env.RESERVATION_EMAIL_FROM?.trim();
  return from ? from : null;
}

/**
 * Onko lähetys käytettävissä.
 *
 * Kutsujan on voitava kysyä tämä ennen työn tekemistä: ilman
 * asetuksia viestin kokoaminen on turhaa työtä, ja käyttöliittymä voi
 * kertoa rehellisesti ettei vahvistusta lähde.
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && sender());
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = sender();

  if (!key || !from) return { ok: false, reason: "not_configured" };
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
        from,
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

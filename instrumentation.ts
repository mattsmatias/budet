/**
 * Palvelinvirheiden kirjaus.
 *
 * JOS KUKAAN EI NÄE VIRHETTÄ, SITÄ EI OLE KORJATTU.
 *
 * Tähän asti 500-virhe näkyi vain Vercelin lokeissa, joita kukaan ei
 * lue ilman syytä. Asiakas joko soittaa tai on soittamatta. Nyt
 * jokainen palvelinvirhe kirjautuu kantaan ja näkyy konsolissa.
 *
 * SUORA KUTSU ILMAN EVÄSTEITÄ.
 *
 * Virheenkäsittelijä ei ole pyynnön kontekstissa, joten tavallista
 * palvelinklienttiä ei voi käyttää — se lukee evästeet. Tässä
 * kutsutaan rajapintaa suoraan julkisella avaimella, ja kirjaava
 * funktio on kannassa rajattu: se katkaisee kentät ja lopettaa
 * kirjaamisen jos virheitä tulee yli kahdensadan tunnissa.
 *
 * KIRJAUS EI SAA KAATAA MITÄÄN.
 *
 * Jos kirjaaminen epäonnistuu, virhe niellään. Vaihtoehto olisi
 * virhe virheenkäsittelijässä, ja se peittäisi alkuperäisen.
 */

export async function onRequestError(
  error: unknown,
  request: { path?: string },
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;

  const virhe = error as { message?: string; digest?: string; stack?: string };

  try {
    await fetch(`${url}/rest/v1/rpc/log_app_error`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: key,
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        p_path: request?.path ?? null,
        p_message: virhe?.message ?? String(error),
        p_digest: virhe?.digest ?? null,
        p_stack: virhe?.stack ?? null,
      }),
    });
  } catch {
    /* Kirjaus ei saa kaataa pyyntöä eikä peittää alkuperäistä virhettä. */
  }
}

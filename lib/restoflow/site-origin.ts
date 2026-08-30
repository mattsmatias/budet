import { headers } from "next/headers";

/**
 * Sivuston julkinen osoite.
 *
 * Tarvitaan aina kun palvelin muodostaa osoitteen jonka joku muu avaa:
 * QR-koodi, jaettava linkki, upotuskoodi. Selain tietää oman osoitteensa,
 * palvelin ei — pyynnön otsakkeet ovat ainoa lähde, ja välityspalvelimen
 * takana ne ovat x-forwarded-otsakkeissa.
 *
 * NEXT_PUBLIC_SITE_URL voittaa, koska upotuskoodi voi päätyä toisen
 * ravintolan sivulle ja jäädä sinne vuosiksi. Sen on osoitettava
 * lopulliseen osoitteeseen eikä siihen jolla se sattui syntymään.
 */
export async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const list = await headers();

  const host =
    list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const protocol =
    list.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}

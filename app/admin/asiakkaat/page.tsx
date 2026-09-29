import { permanentRedirect } from "next/navigation";

/**
 * Vanha osoite uuteen paikkaan.
 *
 * Asiakasrekisteri muutti laskujen välilehdeksi, mutta osoite on
 * ehtinyt jäädä kirjanmerkkeihin ja vanhoihin linkkeihin. Pysyvä
 * ohjaus kertoo myös selaimelle ja hakukoneelle että siirto on
 * lopullinen — tilapäinen jättäisi vanhan osoitteen elämään.
 *
 * Tiedosto on ohjaus eikä sivu: pääsytarkistusta ei tarvita, koska
 * kohde tekee sen itse eikä täällä lueta mitään.
 */
export default function CustomersMoved() {
  permanentRedirect("/admin/laskut/asiakkaat");
}

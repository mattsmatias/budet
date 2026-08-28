"use client";

import { useEffect } from "react";
import { LOCALE_TAGS, type Locale } from "@/lib/i18n/locales";

/**
 * Sivun kieli html-elementille.
 *
 * JUURILAYOUT EI TIEDÄ KIELTÄ.
 *
 * <html> on juurilayoutissa, ja se on kaikille reiteille sama. Se
 * ilmoitti siis kaikki sivut suomeksi — myös turkinkielisen, jonka
 * ruudunlukija olisi äännellyt suomen säännöillä.
 *
 * Attribuutti asetetaan siksi selaimessa. Ruudunlukija lukee elävää
 * DOMia, joten se saa oikean kielen; hakukone saa saman tiedon
 * hreflang-tageista, jotka ovat palvelimen renderöimässä HTML:ssä.
 *
 * Tämä on kiertotie eikä ihanteellinen: palvelimen lähettämässä
 * HTML:ssä lukee yhä fi. Oikea korjaus olisi siirtää <html> reitin
 * mukaan, ja se tarkoittaisi erillistä layoutia jokaiselle kielelle —
 * kymmenen tiedostoa lisää yhden attribuutin takia.
 */
export function HtmlLang({ locale }: { locale: Locale }) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.lang;
    root.lang = LOCALE_TAGS[locale];

    // Palautus, jottei kieli jää päälle jos käyttäjä siirtyy
    // sovellukseen ilman koko sivun latausta.
    return () => {
      root.lang = previous;
    };
  }, [locale]);

  return null;
}

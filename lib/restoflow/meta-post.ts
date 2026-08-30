/**
 * Lounaslistasta julkaisuteksti.
 *
 * ---------------------------------------------------------------------
 * HINTA ON VIIKOSSA, EI RUOASSA
 * ---------------------------------------------------------------------
 *
 * Määrittelyn esimerkki näytti hinnan jokaisen ruoan perässä
 * ("Kana curry – 12,90 €"). Katessa sellaista hintaa ei ole: lounas on
 * kokonaisuus jonka hintaan päivän ruoat sisältyvät, ja lunch_prices
 * on viikkokohtainen. Ruokakohtaisen hinnan keksiminen tarkoittaisi
 * väärän hinnan julkaisemista asiakkaalle.
 *
 * Hinta on siis kerran, listan lopussa, sellaisena kuin se on
 * lounassivullakin.
 *
 * ---------------------------------------------------------------------
 * EI MARKKINOINTIPUHETTA
 * ---------------------------------------------------------------------
 *
 * Teksti on lista ja osoite. Ei "Tervetuloa nauttimaan herkullisesta
 * lounaastamme" — ravintoloitsija kirjoittaa sellaisen itse jos
 * haluaa, ja teksti on muokattavissa ennen julkaisua.
 */

import type { AppLocale } from "@/lib/i18n/app-locales";
import { formatMoney } from "@/lib/money";
import type { DietType, LunchWeek } from "./lunch";
import { formatDayShortIn, weekdayLongIn } from "@/lib/i18n/labels";

/**
 * Instagramin kuvatekstin yläraja.
 *
 * Facebookilla rajaa ei käytännössä tule vastaan. Instagram katkaisee
 * 2200 merkin jälkeen, ja katkaistu lounaslista päättyy kesken
 * torstain — siksi tämä tarkistetaan ennen julkaisua eikä sen
 * jälkeen.
 */
export const IG_CAPTION_MAX = 2200;

export interface PostInput {
  week: LunchWeek;
  restaurantName: string;
  diets: DietType[];
  locale: AppLocale;
  currency?: string;
}

/**
 * Julkaisun oletusteksti.
 *
 * Tyhjät päivät jätetään pois. Päivä ilman ruokaa näyttäisi
 * julkaisussa siltä että ravintola on kiinni, ja lounaslista tehdään
 * usein vain arkipäiville.
 */
export function buildLunchPost({
  week,
  restaurantName,
  diets,
  locale,
  currency = "EUR",
}: PostInput): string {
  const lyhenne = new Map(diets.map((d) => [d.id, d.shortLabel]));

  const osat: string[] = ["🍽️ VIIKON LOUNAS"];

  for (const day of week.days) {
    if (day.items.length === 0) continue;

    const otsikko = `${weekdayLongIn(day.date, locale)} ${formatDayShortIn(day.date, locale)}`;
    const rivit = day.items.map((item) => {
      /*
       * Ruokavaliomerkinnät nimen perään sulkeisiin.
       *
       * Ne ovat se tieto jonka takia asiakas kysyy puhelimessa, ja
       * ne mahtuvat kolmeen merkkiin ruokaa kohti.
       */
      const merkit = item.diets
        .map((id) => lyhenne.get(id))
        .filter((s): s is string => Boolean(s));

      return `• ${item.name}${merkit.length > 0 ? ` (${merkit.join(", ")})` : ""}`;
    });

    osat.push(`${otsikko}\n${rivit.join("\n")}`);
  }

  /* Ei yhtään ruokaa: teksti olisi pelkkä otsikko ja osoite. */
  if (osat.length === 1) return "";

  const hinta = week.prices[0];
  if (hinta) {
    const sisaltyy = [
      week.includesDessert ? "jälkiruoka" : null,
      week.includesCoffee ? "kahvi" : null,
    ].filter((s): s is string => s !== null);

    osat.push(
      `${hinta.name} ${formatMoney(hinta.cents, currency, locale)}` +
        (sisaltyy.length > 0
          ? `\nHintaan sisältyy ${sisaltyy.join(" ja ")}.`
          : ""),
    );
  }

  osat.push(`📍 ${restaurantName}`);

  return osat.join("\n\n");
}

/**
 * Onko teksti liian pitkä Instagramiin.
 *
 * Palautetaan luku eikä totuusarvo: käyttäjälle kerrotaan montako
 * merkkiä on liikaa, jotta hän tietää paljonko lyhentää.
 */
export function igOverflow(caption: string): number {
  return Math.max(0, caption.length - IG_CAPTION_MAX);
}

/**
 * Onko tämä viikko jo julkaistu.
 *
 * Vahingossa tapahtuva kaksoisjulkaisu on tavallinen: sivu ladataan
 * uudelleen, painiketta painetaan toisen kerran, ja seuraajat saavat
 * saman listan kahdesti. Tarkistus on julkaisuhistoriassa eikä
 * muistissa, joten se pitää myös toisella laitteella.
 */
export function alreadyPublished(
  publications: { menuId: string | null; facebookStatus: string; instagramStatus: string }[],
  menuId: string,
): boolean {
  return publications.some(
    (p) =>
      p.menuId === menuId &&
      (p.facebookStatus === "ok" || p.instagramStatus === "ok"),
  );
}

import type { AppLocale } from "@/lib/i18n/app-locales";

/**
 * Mitä Kateen tuli viimeksi.
 *
 * TÄMÄ NÄKYY KIRJAUTUMISSIVULLA.
 *
 * Kirjautumissivun kuvapaneeli oli koristetta: kaksi keksittyä lukua
 * joita sama ihminen katsoi joka työvuoron alussa. Yksi tosi lause
 * siitä mitä juuri julkaistiin antaa paluukäyttäjälle syyn vilkaista
 * kerran — ja kun mitään ei ole julkaistu, mikään ei liiku.
 *
 * KOLME SÄÄNTÖÄ.
 *
 * 1. Lauseen pitää olla tosi. Tämä luetaan lupauksena, ei mainoksena.
 * 2. Yksi asia kerrallaan ja yksi lause. Jos julkaisussa oli kolme
 *    asiaa, valitse se joka muuttaa asiakkaan päivää.
 * 3. Ei euromääriä eikä lukuja. Talousohjelmassa numero ruudulla
 *    näyttää asiakkaan omalta luvulta, vaikka se olisi esimerkki.
 *
 * MUUTETAAN JULKAISUN YHTEYDESSÄ, EI SEN VÄLILLÄ.
 *
 * Teksti ei vaihdu sivulatauksittain eikä päivittäin. Se vaihtuu kun
 * me vaihdamme sen, ja siksi se on yhdessä tiedostossa kaikilla
 * kielillä vierekkäin: käännökset eivät ehdi erota toisistaan kun ne
 * päivitetään samalla kertaa.
 *
 * Edellinen: 23.9.2026 — työajan leimaus ja arvioitu
 * työnantajakustannus.
 */

/** Päivä jolloin teksti viimeksi vaihdettiin. Vain meille, ei näytetä. */
export const NEWS_UPDATED = "2026-09-27";

export const NEWS_LABEL: Record<AppLocale, string> = {
  fi: "Uutta Katessa",
  en: "New in Kate",
  sv: "Nytt i Kate",
  da: "Nyt i Kate",
  tr: "Kate'te yeni",
  et: "Uut Kates",
  ar: "جديد في Kate",
};

export const NEWS_BODY: Record<AppLocale, string> = {
  fi: "Työajan lisät lasketaan nyt yritykselle määritetyn työehtosopimuksen mukaan.",
  en: "Working time supplements are now calculated from the collective agreement set for your company.",
  sv: "Arbetstidstilläggen beräknas nu enligt det kollektivavtal som valts för företaget.",
  da: "Arbejdstidstillæg beregnes nu efter den overenskomst, der er valgt for virksomheden.",
  tr: "Çalışma saati ekleri artık şirketiniz için tanımlanan toplu sözleşmeye göre hesaplanıyor.",
  et: "Tööajalisasid arvutatakse nüüd ettevõttele määratud kollektiivlepingu järgi.",
  ar: "تُحتسب بدلات ساعات العمل الآن وفق الاتفاقية الجماعية المحددة لشركتك.",
};

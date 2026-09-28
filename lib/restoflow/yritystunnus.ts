/**
 * Y-tunnus ja IBAN: muoto ja tarkistusnumero.
 *
 * MIKSI TARKISTUSNUMERO LASKETAAN.
 *
 * Y-tunnuksessa ja IBANissa on tarkistusnumero juuri siksi, että
 * näppäilyvirhe löytyisi heti eikä vasta kun lasku palaa perille
 * menemättömänä. Pelkkä muototarkistus hyväksyisi 1234567-8:n, joka
 * näyttää Y-tunnukselta muttei ole kenenkään.
 *
 * Tarkistus on sovelluksessa eikä vain kannassa, koska kannan
 * poikkeuksesta ei saa ihmiselle luettavaa lausetta — kanta tarkistaa
 * silti muodon, jottei ohi pääse kirjoittamalla suoraan.
 */

/** Y-tunnuksen painot vasemmalta oikealle. */
const PAINOT = [7, 9, 10, 5, 8, 4, 2];

/**
 * Onko Y-tunnus kelvollinen.
 *
 * Muoto 1234567-8 ja oikea tarkistusnumero. Jakojäännös 1 ei ole
 * käytössä lainkaan: siitä ei synny kelvollista tarkistusnumeroa, ja
 * sellaiset tunnukset on jätetty jakamatta.
 */
export function onKelvollinenYTunnus(arvo: string): boolean {
  const teksti = arvo.trim();
  if (!/^\d{7}-\d$/.test(teksti)) return false;

  const numerot = teksti.slice(0, 7).split("").map(Number);
  const annettu = Number(teksti.slice(8));

  const summa = numerot.reduce((yht, n, i) => yht + n * PAINOT[i], 0);
  const jaannos = summa % 11;

  if (jaannos === 1) return false;

  const tarkiste = jaannos === 0 ? 0 : 11 - jaannos;
  return tarkiste === annettu;
}

/**
 * Y-tunnus samaan muotoon riippumatta siitä miten se kirjoitettiin.
 *
 * YTJ palauttaa sen viivalla, ihmiset kirjoittavat välillä ilman.
 * Null tarkoittaa ettei syötteestä saa Y-tunnusta.
 */
export function siistiYTunnus(arvo: string): string | null {
  const vain = arvo.replace(/[\s-]/g, "");
  if (!/^\d{8}$/.test(vain)) return null;

  const muoto = `${vain.slice(0, 7)}-${vain.slice(7)}`;
  return onKelvollinenYTunnus(muoto) ? muoto : null;
}

/**
 * ALV-numero Y-tunnuksesta.
 *
 * Suomessa se on FI ja Y-tunnus ilman viivaa. Laskussa on oltava
 * ALV-numero silloin kun myynti on arvonlisäverollista, eikä sitä
 * kysytä erikseen: se on johdettavissa, ja kysytty kenttä olisi kenttä
 * jonka voi täyttää väärin.
 */
export function alvNumero(yTunnus: string): string | null {
  const siisti = siistiYTunnus(yTunnus);
  return siisti === null ? null : `FI${siisti.replace("-", "")}`;
}

/**
 * IBANin tarkistus (mod 97).
 *
 * Neljä ensimmäistä merkkiä siirretään loppuun, kirjaimet muutetaan
 * numeroiksi (A=10 … Z=35), ja koko luvun on oltava jaollinen 97:llä
 * yhden jäännöksellä. Suomalaisen IBANin pituus on 18.
 */
export function onKelvollinenIban(arvo: string): boolean {
  const iban = arvo.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  if (iban.startsWith("FI") && iban.length !== 18) return false;

  const siirretty = iban.slice(4) + iban.slice(0, 4);
  const numeroina = siirretty.replace(/[A-Z]/g, (kirjain) =>
    String(kirjain.charCodeAt(0) - 55),
  );

  /*
   * Jakojäännös palasina.
   *
   * IBAN on pidempi kuin mihin luku riittää tarkkuudeltaan, joten
   * jakojäännös lasketaan yhdeksän numeron paloissa. Kokonaisena
   * luvuksi muutettuna tulos olisi pyöristetty ja tarkistus
   * näennäinen.
   */
  let jaannos = 0;
  for (const merkki of numeroina) {
    jaannos = (jaannos * 10 + Number(merkki)) % 97;
  }

  return jaannos === 1;
}

/** IBAN neljän merkin ryhmissä, kuten se luetaan ääneen ja tarkistetaan. */
export function muotoileIban(arvo: string): string {
  const iban = arvo.replace(/\s/g, "").toUpperCase();
  return iban.replace(/(.{4})/g, "$1 ").trim();
}

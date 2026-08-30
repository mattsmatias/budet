/**
 * Meta-tokenien salaus.
 *
 * Facebookin sivutokeni ei vanhene. Se on siis avain ravintolan
 * Facebook-sivuun niin kauan kuin se on olemassa, ja vuotanut
 * tietokantavarmuuskopio riittäisi julkaisemaan sinne vuosien ajan.
 *
 * Siksi tokeni salataan ennen kuin se koskee kantaa. Avain on
 * ympäristömuuttujassa eikä kannassa: kanta ja avain vuotavat eri
 * tavoin, ja kumpikaan yksinään ei riitä.
 *
 * AES-256-GCM eikä CBC: GCM todentaa myös sisällön eheyden. Muokattu
 * salateksti hylätään sen sijaan että purkautuisi roskaksi jota
 * yritettäisiin lähettää Metalle.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITMI = "aes-256-gcm";
const IV_PITUUS = 12;
const TAG_PITUUS = 16;

/**
 * Avain ympäristöstä.
 *
 * Luetaan kutsuttaessa eikä moduulia ladattaessa. Moduulitasolla
 * luettuna puuttuva avain kaataisi koko sovelluksen käynnistyksen —
 * myös niiltä sivuilta joilla Metaa ei käytetä lainkaan.
 */
function avain(): Buffer {
  const raw = process.env.META_TOKEN_KEY;

  if (!raw) {
    throw new Error(
      "META_TOKEN_KEY puuttuu. Luo avain: openssl rand -base64 32",
    );
  }

  const key = Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new Error(
      `META_TOKEN_KEY on ${key.length} tavua, pitää olla 32 (base64-koodattuna).`,
    );
  }

  return key;
}

/** Onko salaus käytettävissä. Näkymä voi kertoa puuttuvasta avaimesta. */
export function tokenKeyReady(): boolean {
  try {
    avain();
    return true;
  } catch {
    return false;
  }
}

/**
 * Salaa tokenin.
 *
 * Tulos on base64(iv | tag | salateksti). Alkuvektori on satunnainen
 * joka kerta, joten sama tokeni ei tuota samaa salatekstiä kahdesti —
 * muuten kannasta näkisi mitkä ravintolat jakavat tokenin.
 */
export function encryptToken(plain: string): string {
  const iv = randomBytes(IV_PITUUS);
  const cipher = createCipheriv(ALGORITMI, avain(), iv);

  const salattu = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);

  return Buffer.concat([iv, cipher.getAuthTag(), salattu]).toString("base64");
}

/**
 * Purkaa tokenin.
 *
 * Heittää jos salateksti on muokattu tai avain on väärä. Kutsupaikan
 * on käsiteltävä se: purkamaton tokeni tarkoittaa ettei julkaista, ei
 * että julkaistaan tyhjällä tokenilla.
 */
export function decryptToken(stored: string): string {
  const raw = Buffer.from(stored, "base64");

  if (raw.length <= IV_PITUUS + TAG_PITUUS) {
    throw new Error("Salattu tokeni on liian lyhyt ollakseen kelvollinen.");
  }

  const iv = raw.subarray(0, IV_PITUUS);
  const tag = raw.subarray(IV_PITUUS, IV_PITUUS + TAG_PITUUS);
  const salattu = raw.subarray(IV_PITUUS + TAG_PITUUS);

  const decipher = createDecipheriv(ALGORITMI, avain(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(salattu), decipher.final()]).toString(
    "utf8",
  );
}

/**
 * Tokenin loppu näytettäväksi.
 *
 * Kehittäjänäkymässä pitää voida todeta että tokeni on tallessa ja
 * että se on se oikea — mutta koko tokenia ei näytetä missään, ei
 * edes ylläpidolle. Neljä viimeistä merkkiä riittää tunnistamiseen.
 */
export function tokenHint(plain: string): string {
  return plain.length <= 4 ? "••••" : `••••${plain.slice(-4)}`;
}

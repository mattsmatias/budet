/**
 * Miten asiakas tavoittaa Katen.
 *
 * YKSI OSOITE, EI KOLMEA.
 *
 * Kokeilupalkki, asetukset ja tulevat tukitekstit osoittavat samaan
 * paikkaan. Jos osoite kirjoitettaisiin jokaiseen erikseen, ne ehtisivät
 * erota toisistaan ennen kuin kukaan huomaa — ja väärä tukiosoite on
 * pahempi kuin puuttuva, koska asiakas luulee lähettäneensä viestin.
 *
 * MIKSI LOMAKE EIKÄ SÄHKÖPOSTI.
 *
 * Etusivun yhteydenottolomake kirjoittaa suoraan contact_requests-
 * tauluun ja viesti näkyy Developer Consolen Yhteydenotot-sivulla.
 * Se on siis kanava joka oikeasti toimii tänään. Sähköpostiosoitetta
 * ei ole tässä siksi, ettei koodiin keksitä osoitetta jota kukaan ei
 * lue.
 *
 * Kun tukiosoite on olemassa, se lisätään tähän ja käyttöliittymä
 * näyttää sen lomakkeen rinnalla.
 */

/** Yhteydenottolomake etusivulla. Toimii kirjautumatta. */
export const CONTACT_URL = "https://kateapp.fi/#yhteys";

/** Tukiosoite kun sellainen on. Null = näytetään vain lomake. */
export const SUPPORT_EMAIL: string | null = null;

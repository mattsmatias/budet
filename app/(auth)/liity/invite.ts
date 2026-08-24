/**
 * Kutsun jaetut vakiot ja tyypit.
 *
 * Erillään actions.ts:stä, koska "use server" -tiedosto saa viedä vain
 * async-funktioita. Vakio ja tyypit ovat samaa asiaa mutta eivät
 * toimintoja, joten ne asuvat tässä.
 */

/** Eväste jossa tarkistettu kutsukoodi kulkee tunnuksen luonnin yli. */
export const INVITE_COOKIE = "rf_invite";

/** Puoli tuntia. Riittää tunnuksen luontiin, ei jää roikkumaan. */
export const INVITE_TTL_SECONDS = 30 * 60;

export interface InviteState {
  error?: string;
}

export interface InvitePreview {
  restaurantName: string;
  role: string;
  position: string | null;
}

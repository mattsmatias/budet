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

/**
 * Kahdenlaisia kutsuja.
 *
 * "restaurant" liittää asiakasyritykseen, "kate" Katen omaan tiimiin.
 * Molemmat kulkevat samaa reittiä — koodi, esikatselu, tunnus — koska
 * vaiheet ovat samat ja toinen reitti tarkoittaisi toista paikkaa
 * jossa tunnuksen luonti voi mennä pieleen.
 *
 * Kutsun laji ratkaisee vain kaksi asiaa: minkä funktion koodi
 * lunastaa ja mihin käyttäjä laskeutuu.
 */
export type InviteKind = "restaurant" | "kate";

export interface InvitePreview {
  kind: InviteKind;
  /** Yrityksen nimi. Katen omassa kutsussa "Kate". */
  restaurantName: string;
  /** Rooli yrityksessä, tai null kun kutsu ei ole yritykseen. */
  role: string | null;
}

/** Kutsun lunastava funktio. Yksi paikka jossa laji muuttuu kutsuksi. */
export function acceptRpc(kind: InviteKind): string {
  return kind === "kate" ? "accept_kate_invitation" : "accept_invitation";
}

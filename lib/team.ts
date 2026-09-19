/**
 * Katen tiimi.
 *
 * Nimi ja kuva ovat tässä, rooli ja esittely sanakirjassa
 * (lib/i18n/dictionary.ts, about.founderRole ja about.founderBio),
 * koska ne käännetään kuudelle kielelle. Nimeä ei käännetä.
 *
 * KUVA
 *
 * Kansioon /public/team/, kuvasuhde 4:5 (esimerkiksi 720 × 900).
 * Sivu rajaa kuvan object-fitillä, mutta samasta suhteesta lähtevä
 * rajaus ei leikkaa kasvoja.
 */

export interface TeamMember {
  /** Nimi sellaisena kuin se halutaan näkyvän. */
  name: string;
  /** Polku /public-kansiosta. */
  image: string;
}

export const FOUNDER: TeamMember = {
  name: "Oktay Hun",
  image: "/team/oktay-hun.jpg",
};

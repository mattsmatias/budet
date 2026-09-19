/**
 * Katen tiimi.
 *
 * Nimi ja kuva ovat tässä, rooli ja esittely sanakirjassa
 * (lib/i18n/dictionary.ts, about.<avain>Role, <avain>Bio ja
 * <avain>Label), koska ne käännetään kuudelle kielelle. Nimeä ei
 * käännetä.
 *
 * KUVA
 *
 * Kansioon /public/team/, kuvasuhde 4:5 (esimerkiksi 720 × 900).
 * Sivu rajaa kuvan object-fitillä, mutta samasta suhteesta lähtevä
 * rajaus ei leikkaa kasvoja.
 *
 * Eliaksen kuva on väliaikainen kuvitus (SVG), kunnes oikea kuva on
 * valmis. Vaihda polku, kun valokuva on kansiossa.
 */

export interface TeamMember {
  /** Sanakirjan avaimen alku: "founder" → about.founderRole jne. */
  key: "founder" | "finance";
  /** Nimi sellaisena kuin se halutaan näkyvän. */
  name: string;
  /** Polku /public-kansiosta. */
  image: string;
}

export const TEAM: TeamMember[] = [
  { key: "founder", name: "Oktay Hun", image: "/team/oktay-hun.jpg" },
  {
    key: "finance",
    name: "Elias Vilokkinen",
    image: "/team/elias-vilokkinen.svg",
  },
];

import { Esittely } from "./diat";

export const metadata = { title: "Tuote-esittely" };

/**
 * Tuote-esittely asiakastapaamiseen.
 *
 * KONSOLIN TAKANA, EI JULKISENA SIVUNA.
 *
 * Esittely on myyntityökalu meille eikä markkinointisivu asiakkaalle:
 * se avataan tapaamisessa omalta koneelta. Siksi se on konsolissa,
 * jonne pääsee vain Katen hallinta — julkinen osoite vaatisi oman
 * ylläpitonsa ja vanhentuisi hiljaa.
 *
 * Sisältö on samaa kieltä kuin etusivu ja sovellus, jotta asiakas
 * tunnistaa saman tuotteen esittelystä, verkkosivulta ja
 * ensimmäisestä kirjautumisesta.
 */
export default function EsittelyPage() {
  return (
    <div className="rf-enter space-y-5">
      <div>
        <h1 className="text-[22px] font-bold tracking-[-0.02em]">
          Tuote-esittely
        </h1>
        <p
          className="mt-1 text-[13px] leading-relaxed"
          style={{ color: "var(--rf-text-2)" }}
        >
          Katen esittely asiakastapaamiseen. Avaa koko näyttöön ja selaa
          nuolinäppäimillä.
        </p>
      </div>

      <Esittely />
    </div>
  );
}

import { Esittely } from "@/components/kate/esittely";

export const metadata = { title: "Tuote-esittely" };

/**
 * Esittely Katen työntekijälle.
 *
 * SAMA ESITTELY KUIN KONSOLISSA.
 *
 * Komponentti on yksi ja sama molemmissa paikoissa. Kopio olisi
 * vanhentunut ensimmäisen muutoksen kohdalla, ja myyntitapaamisessa
 * olisi näytetty vanhaa tuotetta.
 *
 * Ero on vain kuoressa: konsolissa esittely on yksi sivu muiden
 * joukossa, tässä se on koko tunnuksen sisältö.
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
          nuolinäppäimillä tai pyyhkäisemällä.
        </p>
      </div>

      <Esittely />
    </div>
  );
}

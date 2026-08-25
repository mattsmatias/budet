"use client";

import { RfIcon } from "@/components/restoflow/icons";

/**
 * Tulostus selaimen omalla toiminnolla.
 *
 * Ei omaa PDF-kirjastoa: se tarkoittaisi toisen asettelumoottorin
 * ylläpitoa huonommalla lopputuloksella. Selain osaa jo tehdä tästä
 * sivusta paperia tai PDF:n, ja tulostusnäkymä kertoo mitä paperille
 * tulee ennen kuin sitä tulee.
 *
 * Painike on olemassa siksi ettei sitä tarvitse arvata: moni ei
 * ajattele painavansa Ctrl+P kesken työvuorolistan.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
      style={{
        background: "var(--rf-inset)",
        color: "var(--rf-text)",
        border: "1px solid var(--rf-line-strong)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <RfIcon name="download" size={15} />
      Tulosta lista
    </button>
  );
}

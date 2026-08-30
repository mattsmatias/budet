"use client";

import { RfIcon } from "@/components/restoflow/icons";
import type { AdminText } from "@/lib/i18n/admin-text";

/**
 * Avaa selaimen tulostusikkunan.
 *
 * Sieltä valitaan "Tallenna PDF:nä". Emme piirrä PDF:ää itse: selain
 * osaa sivutuksen, marginaalit ja fontit paremmin kuin mikään kirjasto
 * jonka voisimme lisätä.
 */
export function PrintButton({ t }: { t: AdminText }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rf-press flex items-center gap-2 px-4 py-2.5 text-[14px] font-semibold"
      style={{
        background: "var(--rf-accent)",
        color: "var(--rf-on-accent)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <RfIcon name="download" size={16} />
      {t.viimeiset.printOrSavePdf}
    </button>
  );
}

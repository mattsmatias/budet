import { cache } from "react";
import { createClient } from "@/utils/supabase/server";

/**
 * Myyjän omat tiedot laskulle.
 *
 * Luetaan suoraan restaurants-taulusta eikä istunnon näkymästä: näitä
 * tarvitaan vain asetusosiossa ja laskua tehdessä, eikä niitä kannata
 * kantaa mukana jokaisella sivunlatauksella. Rivikäytäntö rajaa luvun
 * omiin yrityksiin.
 */

export interface InvoicingSettings {
  businessId: string | null;
  iban: string | null;
  termsDays: number;
  invoiceNote: string | null;
}

/** Oletus kun mitään ei ole vielä asetettu tai kysely ei onnistu. */
export const TYHJA_LASKUTUS: InvoicingSettings = {
  businessId: null,
  iban: null,
  termsDays: 14,
  invoiceNote: null,
};

export const fetchInvoicingSettings = cache(
  async (restaurantId: string): Promise<InvoicingSettings> => {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("restaurants")
        .select("business_id, iban, invoice_terms_days, invoice_note")
        .eq("id", restaurantId)
        .maybeSingle();

      if (error || !data) return TYHJA_LASKUTUS;

      const teksti = (arvo: unknown) =>
        typeof arvo === "string" && arvo.trim() !== "" ? arvo : null;

      return {
        businessId: teksti(data.business_id),
        iban: teksti(data.iban),
        termsDays:
          typeof data.invoice_terms_days === "number"
            ? data.invoice_terms_days
            : 14,
        invoiceNote: teksti(data.invoice_note),
      };
    } catch {
      return TYHJA_LASKUTUS;
    }
  },
);

/**
 * Voiko yritys lähettää laskun.
 *
 * Y-tunnus ja tilinumero ovat lain vaatimia laskulla (ALV-laki 209 e §).
 * Ilman niitä laskun voi luonnostella muttei lähettää — ja se on
 * parempi kertoa ennen kuin lasku on kirjoitettu valmiiksi.
 */
export function voikoLaskuttaa(asetukset: InvoicingSettings): boolean {
  return asetukset.businessId !== null && asetukset.iban !== null;
}

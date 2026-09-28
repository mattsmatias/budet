import { cache } from "react";
import { createClient } from "@/utils/supabase/server";

/**
 * Laskutuksen vastaanottajarekisteri.
 *
 * Rekisteri on yrityksen oma lista, ei kopio YTJ:stä. YTJ auttaa
 * täyttämään tiedot kerran; sen jälkeen asiakas on täällä ja löytyy
 * nimellä ilman että rekisteriä kysytään uudelleen.
 *
 * Poistaminen on arkistointi eikä poisto: asiakkaaseen voi liittyä
 * laskuja, ja lasku ilman vastaanottajaa olisi tosite ilman osapuolta.
 */

export interface Customer {
  id: string;
  name: string;
  businessId: string | null;
  careOf: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  email: string | null;
  note: string | null;
}

function lue(row: Record<string, unknown>): Customer {
  const teksti = (arvo: unknown) =>
    typeof arvo === "string" && arvo.trim() !== "" ? arvo : null;

  return {
    id: row.id as string,
    name: (row.name as string) ?? "",
    businessId: teksti(row.business_id),
    careOf: teksti(row.care_of),
    street: teksti(row.street),
    postalCode: teksti(row.postal_code),
    city: teksti(row.city),
    country: (row.country as string) ?? "FI",
    email: teksti(row.email),
    note: teksti(row.note),
  };
}

const KENTAT =
  "id, name, business_id, care_of, street, postal_code, city, country, email, note";

export const fetchCustomers = cache(
  async (restaurantId: string): Promise<Customer[]> => {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("customers")
        .select(KENTAT)
        .eq("restaurant_id", restaurantId)
        .is("archived_at", null)
        .order("name");

      if (error || !data) return [];
      return data.map(lue);
    } catch {
      return [];
    }
  },
);

/**
 * Omien asiakkaiden haku samalla sanalla kuin YTJ:stä.
 *
 * Nimi tai Y-tunnus, isot ja pienet kirjaimet samanarvoisina. Rajaus
 * tehdään kannassa eikä selaimessa: rekisteri voi kasvaa, eikä koko
 * listaa kannata lähettää jokaisen kirjaimen jälkeen.
 */
export async function searchCustomers(
  restaurantId: string,
  hakusana: string,
): Promise<Customer[]> {
  const sana = hakusana.trim();
  if (sana === "") return [];

  try {
    const supabase = await createClient();

    /* Prosenttimerkki ja alaviiva ovat ilike-jokereita: ne siivotaan. */
    const turvallinen = sana.replace(/[%_]/g, "");

    const { data, error } = await supabase
      .from("customers")
      .select(KENTAT)
      .eq("restaurant_id", restaurantId)
      .is("archived_at", null)
      .or(`name.ilike.%${turvallinen}%,business_id.ilike.%${turvallinen}%`)
      .order("name")
      .limit(10);

    if (error || !data) return [];
    return data.map(lue);
  } catch {
    return [];
  }
}

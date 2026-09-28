"use server";

import { revalidatePath } from "next/cache";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { requireContext } from "@/lib/restoflow/session";
import { createClient } from "@/utils/supabase/server";
import { can } from "@/lib/restoflow/permissions";
import {
  onKelvollinenIban,
  onKelvollinenYTunnus,
  siistiYTunnus,
} from "@/lib/restoflow/yritystunnus";
import type { AdminState } from "../actions";

/**
 * Myyjän omat tiedot laskulle.
 *
 * OMA LOMAKKEENSA, OMA KUTSUNSA.
 *
 * Sama peruste kuin muillakin osioilla: jokainen lähettää vain omat
 * kenttänsä, ja kanta tulkitsee nullin "älä koske" -merkiksi. Näin
 * nimen tallentaminen ei kirjoita tilinumeroa eikä päinvastoin.
 *
 * TARKISTUSNUMERO TÄSSÄ, MUOTO KANNASSA.
 *
 * Kanta tarkistaa että Y-tunnus on seitsemän numeroa ja viiva ja
 * numero, mutta se ei laske tarkistusnumeroa. Se lasketaan tässä,
 * koska virheestä pitää saada ihmiselle luettava lause — ja koska
 * väärä tilinumero ohjaa asiakkaan maksun väärälle tilille, mikä on
 * kalliimpi virhe kuin useimmat.
 */
export async function updateInvoicing(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext("/admin/asetukset");

  if (!can(role, "settings.edit")) {
    return { error: t.toiminnot.ownerOnlyBody };
  }

  const teksti = (nimi: string) => String(formData.get(nimi) ?? "").trim();

  /* Tyhjä tarkoittaa "poista arvo", ei "älä koske" — kenttä oli näkyvissä. */
  const tunnusSyote = teksti("businessId");
  let businessId = "";

  if (tunnusSyote !== "") {
    const siisti = siistiYTunnus(tunnusSyote);
    if (siisti === null || !onKelvollinenYTunnus(siisti)) {
      return { error: t.laskutus.badBusinessId };
    }
    businessId = siisti;
  }

  const ibanSyote = teksti("iban").replace(/\s/g, "").toUpperCase();
  if (ibanSyote !== "" && !onKelvollinenIban(ibanSyote)) {
    return { error: t.laskutus.badIban };
  }

  const paivat = Number(teksti("terms"));
  const terms =
    Number.isInteger(paivat) && paivat >= 0 && paivat <= 365 ? paivat : 14;

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_restaurant", {
    p_restaurant: restaurant.id,
    p_business_id: businessId,
    p_iban: ibanSyote,
    p_invoice_terms_days: terms,
    p_invoice_note: teksti("invoiceNote").slice(0, 500),
  });

  if (error) return { error: t.laskutus.failed };

  revalidatePath("/admin", "layout");

  return { notice: t.laskutus.saved };
}

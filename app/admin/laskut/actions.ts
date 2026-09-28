"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { requireContext } from "@/lib/restoflow/session";
import { createClient } from "@/utils/supabase/server";
import { can } from "@/lib/restoflow/permissions";
import {
  fetchInvoicingSettings,
  voikoLaskuttaa,
} from "@/lib/restoflow/invoicing";
import { parseAmountToCents } from "@/lib/money";
import type { AdminState } from "../actions";

/**
 * Laskun luonti.
 *
 * SUMMIA EI LÄHETETÄ KANTAAN.
 *
 * Teko lähettää vain rivit — kuvaus, määrä, hinta ja verokanta — ja
 * kanta laskee niistä summat. Jos summat tulisivat täältä, ne
 * tulisivat lopulta lomakkeelta, ja lasku voisi näyttää eri
 * loppusummaa kuin sen rivit kertovat.
 *
 * VASTAANOTTAJA KOPIOIDAAN, EI LINKITETÄ.
 *
 * Rekisteristä valittu asiakas luetaan palvelimella ja sen tiedot
 * kirjoitetaan laskulle sellaisina kuin ne nyt ovat. Lomakkeelta tulee
 * vain tunnus; nimeä ja osoitetta ei oteta sieltä, koska silloin
 * laskun voisi lähettää kenen tahansa nimissä.
 */
export async function createInvoice(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext("/admin/laskut");

  if (!can(role, "receipts.edit")) {
    return { error: t.toiminnot.ownerOnlyBody };
  }

  /*
   * Myyjän tiedot ensin.
   *
   * Y-tunnus ja tilinumero ovat lain vaatimia laskulla. Ilman niitä
   * syntyisi lasku jota ei voi lähettää — ja se selviäisi vasta kun
   * rivit on kirjoitettu.
   */
  const asetukset = await fetchInvoicingSettings(restaurant.id);
  if (!voikoLaskuttaa(asetukset)) {
    return { error: t.laskut.needSettings };
  }

  const teksti = (nimi: string) => String(formData.get(nimi) ?? "").trim();

  const supabase = await createClient();

  /* Vastaanottaja rekisteristä, palvelimella luettuna. */
  const customerId = teksti("customerId");
  if (customerId === "") return { error: t.laskut.needRecipient };

  const { data: asiakas } = await supabase
    .from("customers")
    .select(
      "id, name, business_id, care_of, street, postal_code, city, country, email",
    )
    .eq("id", customerId)
    .eq("restaurant_id", restaurant.id)
    .maybeSingle();

  if (!asiakas) return { error: t.laskut.needRecipient };

  /*
   * Rivit lomakkeelta.
   *
   * Kentät ovat rinnakkaisia taulukoita, joten pituuden on täsmättävä.
   * Tyhjä kuvaus pudottaa rivin: lomakkeella on aina yksi tyhjä rivi
   * valmiina, eikä sen pidä päätyä laskulle.
   */
  const kuvaukset = formData.getAll("rowDescription").map(String);
  const maarat = formData.getAll("rowQuantity").map(String);
  const hinnat = formData.getAll("rowUnitPrice").map(String);
  const kannat = formData.getAll("rowVatCode").map(String);
  const yksikot = formData.getAll("rowUnit").map(String);

  const rivit: {
    description: string;
    quantity: number;
    unit: string | null;
    unit_price_cents: number;
    vat_code_id: string;
  }[] = [];

  for (let i = 0; i < kuvaukset.length; i += 1) {
    const kuvaus = (kuvaukset[i] ?? "").trim();
    if (kuvaus === "") continue;

    const maara = Number((maarat[i] ?? "1").replace(",", "."));
    const hinta = parseAmountToCents(hinnat[i] ?? "");
    const kanta = (kannat[i] ?? "").trim();

    if (!Number.isFinite(maara) || maara === 0) continue;
    if (hinta === null) continue;
    if (kanta === "") continue;

    rivit.push({
      description: kuvaus.slice(0, 200),
      quantity: maara,
      unit: (yksikot[i] ?? "").trim() || null,
      unit_price_cents: hinta,
      vat_code_id: kanta,
    });
  }

  if (rivit.length === 0) return { error: t.laskut.needRows };

  const invoiceDate = teksti("invoiceDate");
  const dueDate = teksti("dueDate");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate) || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return { error: t.laskut.failed };
  }

  const { data: id, error } = await supabase.rpc("create_invoice", {
    p_restaurant: restaurant.id,
    p_customer: asiakas.id,
    p_recipient: {
      name: asiakas.name,
      business_id: asiakas.business_id,
      care_of: asiakas.care_of,
      street: asiakas.street,
      postal_code: asiakas.postal_code,
      city: asiakas.city,
      country: asiakas.country,
      email: asiakas.email,
    },
    p_invoice_date: invoiceDate,
    p_due_date: dueDate,
    p_note: teksti("note").slice(0, 1000),
    p_rows: rivit,
  });

  if (error || typeof id !== "string") {
    /*
     * Kannan oma viesti nakyviin, ei pelkkaa "ei onnistunut".
     *
     * create_invoice nostaa omat virheensa luettavina lauseina
     * ("Laskulla on oltava vahintaan yksi rivi"), ja niiden
     * korvaaminen yleislauseella piilotti syyn seka kayttajalta etta
     * minulta. Loki kertoo loput palvelimella.
     */
    console.error("create_invoice epaonnistui", error?.code, error?.message);
    return { error: kantavirhe(error, t.laskut.failed) };
  }

  revalidatePath("/admin/laskut");
  redirect(`/admin/laskut/${id}`);
}


/**
 * Kannan oma viesti lapi, muu yleislauseena.
 *
 * create_invoice nostaa omat virheensa valmiiksi luettavina lauseina,
 * ja ne kertovat enemman kuin "ei onnistunut": rivi puuttuu, erapaiva
 * on ennen laskun paivaa, verokantaa ei tunneta. Postgresin omat
 * viestit (sarakkeet, tyypit, rajoitteet) eivat kuulu kayttajalle,
 * joten lapi paastetaan vain se mita itse nostettiin.
 *
 * Tunnistus on merkkijonosta, koska plpgsql:n raise ei kanna omaa
 * koodia ilman erillista errcodea - ja koodien keksiminen naille
 * olisi sanasto jota kukaan ei yllapida.
 */
function kantavirhe(
  error: { code?: string; message?: string } | null,
  oletus: string,
): string {
  const viesti = error?.message ?? "";

  const omat = [
    "Laskulla on oltava",
    "Vastaanottajan nimi puuttuu",
    "Erapaiva ei voi olla",
    "Tuntematon tai kannaton verokanta",
    "Ei oikeutta laskuttaa",
  ];

  return omat.some((alku) => viesti.includes(alku)) ? viesti : oletus;
}

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
import { LOCALE_INFO } from "@/lib/i18n/app-locales";
import { fill } from "@/lib/i18n/auth-text";
import { fetchInvoice } from "@/lib/restoflow/invoices";
import { invoiceFileName, renderInvoicePdf } from "@/lib/restoflow/invoice-pdf";
import { sendInvoiceEmail } from "@/lib/restoflow/invoice-email";
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

/**
 * Laskun lähetys sähköpostilla.
 *
 * LÄHETYS ON TILAN VAIHTO, EI VAIN VIESTI.
 *
 * Kun lasku lähtee, se lakkaa olemasta luonnos: siitä tulee tosite,
 * jonka summaa ja vastaanottajaa ei enää saa muuttaa. Kanta valvoo
 * sen, ja siksi tila merkitään vasta kun viesti on oikeasti mennyt
 * läpi — epäonnistunut lähetys jättää laskun luonnokseksi, jotta sen
 * voi korjata ja yrittää uudelleen.
 *
 * PDF TEHDÄÄN TÄSSÄ EIKÄ TALLENNETA.
 *
 * Lasku on kannassa, ja sama tiedosto syntyy siitä aina samanlaisena.
 * Tallennettu PDF olisi toinen totuus samasta laskusta ja vanhentuisi
 * hiljaa, jos myyjän tiedot muuttuvat.
 */
export async function sendInvoice(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const locale = await resolveLocale();
  const t = adminText(locale);
  const { restaurant, role } = await requireContext("/admin/laskut");

  if (!can(role, "receipts.edit")) {
    return { error: t.toiminnot.ownerOnlyBody };
  }

  const id = String(formData.get("id") ?? "");
  if (id === "") return { error: t.laskut.sendFailed };

  const [lasku, myyja] = await Promise.all([
    fetchInvoice(id, restaurant.id),
    fetchInvoicingSettings(restaurant.id),
  ]);

  if (!lasku) return { error: t.laskut.sendFailed };
  if (lasku.status !== "draft") return { error: t.laskut.alreadySent };
  if (!lasku.recipientEmail) return { error: t.laskut.sendNoEmail };
  if (!voikoLaskuttaa(myyja)) return { error: t.laskut.needSettings };

  const pdf = await renderInvoicePdf({
    lasku,
    myyja,
    myyjanNimi: restaurant.name,
    t,
    tag: LOCALE_INFO[locale].tag,
  });

  const tulos = await sendInvoiceEmail({
    lasku,
    myyja,
    myyjanNimi: restaurant.name,
    vastausOsoite: myyja.email,
    pdf,
    tiedostonimi: invoiceFileName(lasku),
    t,
    tag: LOCALE_INFO[locale].tag,
  });

  if (!tulos.ok) {
    console.error("laskun lahetys epaonnistui", tulos.syy, tulos.viesti);

    if (tulos.syy === "no-key") return { error: t.laskut.sendNoKey };
    if (tulos.syy === "no-recipient") return { error: t.laskut.sendNoEmail };
    return { error: t.laskut.sendFailed };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", lasku.id)
    .eq("restaurant_id", restaurant.id);

  /*
   * Viesti on mennyt, mutta tila jäi vaihtumatta.
   *
   * Tätä ei saa esittää epäonnistumisena: lasku on asiakkaalla.
   * Kerrotaan lähetys tapahtuneeksi, ja tila korjautuu kun sivu
   * seuraavan kerran ladataan tai lähetystä yritetään uudelleen —
   * jolloin kanta estää kaksoislähetyksen tilan perusteella.
   */
  if (error) console.error("laskun tilan paivitys epaonnistui", error.message);

  revalidatePath("/admin/laskut");
  revalidatePath(`/admin/laskut/${lasku.id}`);

  return {
    notice: fill(t.laskut.sentTo, { osoite: lasku.recipientEmail }),
  };
}

/**
 * Laskun merkitseminen maksetuksi.
 *
 * PÄIVÄ ON SYÖTE, EI NYT-HETKI.
 *
 * Tiliote kertoo milloin raha tuli, ja se voi olla eri kuin se hetki
 * jona joku ehtii merkitä sen. Väärä päivä siirtäisi suorituksen
 * väärälle kuukaudelle, ja kuukausi on kirjanpidossa se yksikkö joka
 * suljetaan.
 *
 * Kirjaus syntyy kannan liipaisimesta: maksu purkaa myyntisaamisen
 * (pankki debet, myyntisaamiset kredit) omana tositteenaan, koska
 * lasku ja sen maksu ovat eri tapahtumia.
 */
export async function markInvoicePaid(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const t = adminText(await resolveLocale());
  /*
   * Yritysta ei tarvita: mark_invoice_paid tarkistaa is_managerin ja
   * laskun omistajuuden itse, eika tassa haluta toista tarkistusta
   * joka voi vanhentua erikseen.
   */
  const { role } = await requireContext("/admin/laskut");

  if (!can(role, "receipts.edit")) {
    return { error: t.toiminnot.ownerOnlyBody };
  }

  const id = String(formData.get("id") ?? "");
  const paiva = String(formData.get("paidOn") ?? "").trim();

  if (id === "") return { error: t.laskut.failed };

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_invoice_paid", {
    p_invoice: id,
    p_date: /^\d{4}-\d{2}-\d{2}$/.test(paiva) ? paiva : null,
  });

  if (error) {
    console.error("maksumerkinta epaonnistui", error.code, error.message);
    return { error: kantavirhe(error, t.laskut.failed) };
  }

  revalidatePath("/admin/laskut");
  revalidatePath(`/admin/laskut/${id}`);
  revalidatePath("/admin/kirjanpito");

  return { notice: t.laskut.markedPaid };
}

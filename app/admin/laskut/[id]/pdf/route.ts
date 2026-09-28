import { adminContext } from "@/lib/restoflow/page-context";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { LOCALE_INFO } from "@/lib/i18n/app-locales";
import { fetchInvoice } from "@/lib/restoflow/invoices";
import { fetchInvoicingSettings } from "@/lib/restoflow/invoicing";
import { invoiceFileName, renderInvoicePdf } from "@/lib/restoflow/invoice-pdf";

/**
 * Lasku PDF:nä ladattavaksi.
 *
 * Sama tiedosto joka lähtee sähköpostin liitteenä. Erillinen reitti,
 * koska laskun haluaa toisinaan itselleen ennen lähettämistä — ja
 * koska sen näkeminen on ainoa tapa varmistua siitä miltä asiakkaalle
 * lähtevä paperi näyttää.
 *
 * Reitti kulkee adminContextin läpi, joten kirjautumaton ja väärän
 * yrityksen käyttäjä eivät saa tiedostoa. Laskun tunnus osoitteessa ei
 * riitä pääsyksi.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/admin/laskut/[id]/pdf">,
) {
  const { id } = await params;
  const { restaurant } = await adminContext("/admin/laskut");

  const locale = await resolveLocale();
  const t = adminText(locale);

  const [lasku, myyja] = await Promise.all([
    fetchInvoice(id, restaurant.id),
    fetchInvoicingSettings(restaurant.id),
  ]);

  if (!lasku) {
    return new Response("Not found", { status: 404 });
  }

  const pdf = await renderInvoicePdf({
    lasku,
    myyja,
    myyjanNimi: restaurant.name,
    t,
    tag: LOCALE_INFO[locale].tag,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      /*
       * inline eikä attachment: selain näyttää laskun heti. Lataus
       * onnistuu silti katselimen omasta painikkeesta, ja katsominen
       * on tässä se yleisempi tarve.
       */
      "Content-Disposition": `inline; filename="${invoiceFileName(lasku)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

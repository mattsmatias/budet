import { redirect } from "next/navigation";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { adminContext } from "@/lib/restoflow/page-context";
import { fetchCustomers } from "@/lib/restoflow/customers";
import { fetchVatCodes } from "@/lib/restoflow/invoices";
import {
  fetchInvoicingSettings,
  voikoLaskuttaa,
} from "@/lib/restoflow/invoicing";
import { erapaiva } from "@/lib/restoflow/invoice-math";
import { todayIn } from "@/lib/restoflow/local-time";
import { Card } from "@/components/restoflow/ui";
import { InvoiceForm } from "./form";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.laskut.newOne };
}

/**
 * Uusi lasku.
 *
 * YKSI ESTE, EI KAHTA.
 *
 * Ilman Y-tunnusta ja tilinumeroa syntyisi lasku jota ei voi lähettää,
 * ja se on parempi kertoa tyhjän lomakkeen sijaan.
 *
 * Tyhjä asiakasrekisteri oli ennen toinen este, ja sivu ohjasi
 * silloin rekisteriin. Se ei ole enää este: vastaanottaja lisätään
 * lomakkeelta, eikä ensimmäistä laskua varten tarvitse käydä
 * etukäteen toisaalla.
 */
export default async function NewInvoicePage() {
  const { restaurant } = await adminContext("/admin/laskut");

  const locale = await resolveLocale();
  const t = adminText(locale);

  const [asetukset, asiakkaat, kannat] = await Promise.all([
    fetchInvoicingSettings(restaurant.id),
    fetchCustomers(restaurant.id),
    fetchVatCodes(),
  ]);

  if (!voikoLaskuttaa(asetukset)) redirect("/admin/laskut");

  const tanaan = todayIn(restaurant.timezone);

  return (
    <div className="rf-enter space-y-5">
      <header>
        <h1 className="text-[21px] font-bold tracking-[-0.02em]">
          {t.laskut.newOne}
        </h1>
      </header>

      <Card>
        <InvoiceForm
          t={t}
          asiakkaat={asiakkaat}
          kannat={kannat}
          laskunPaiva={tanaan}
          erapaiva={erapaiva(tanaan, asetukset.termsDays)}
        />
      </Card>
    </div>
  );
}

import Link from "next/link";
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
import { Card, EmptyState } from "@/components/restoflow/ui";
import { InvoiceForm } from "./form";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.laskut.newOne };
}

/**
 * Uusi lasku.
 *
 * KAKSI ESTETTÄ TARKISTETAAN ENNEN LOMAKETTA.
 *
 * Ilman Y-tunnusta ja tilinumeroa syntyisi lasku jota ei voi lähettää.
 * Ilman yhtäkään asiakasta ei ole ketään laskutettavaa. Kumpikin on
 * parempi kertoa tyhjän lomakkeen sijaan — ja molempiin on suora
 * linkki sinne missä puute korjataan.
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

      {asiakkaat.length === 0 ? (
        <Card>
          <EmptyState
            title={t.asiakkaat.empty}
            description={t.asiakkaat.emptyHint}
          />
          <Link
            href="/admin/asiakkaat"
            className="rf-press mt-3 inline-flex text-[13px] font-semibold"
            style={{ color: "var(--rf-accent)" }}
          >
            {t.asiakkaat.title} →
          </Link>
        </Card>
      ) : (
        <Card>
          <InvoiceForm
            t={t}
            asiakkaat={asiakkaat}
            kannat={kannat}
            laskunPaiva={tanaan}
            erapaiva={erapaiva(tanaan, asetukset.termsDays)}
          />
        </Card>
      )}
    </div>
  );
}

import Link from "next/link";
import { resolveLocale } from "@/lib/i18n/resolve";
import { adminText } from "@/lib/i18n/admin-text";
import { labels } from "@/lib/i18n/labels";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/restoflow/session";
import {
  fetchExpenseCategories,
  fetchSuppliers,
} from "@/lib/restoflow/queries";
import { canAddReceipts } from "@/lib/restoflow/permissions";
import { isRealExtractor } from "@/lib/restoflow/receipt-ai";
import { RfIcon } from "@/components/restoflow/icons";
import { CaptureFlow } from "./capture";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.kuva.newReceipt };
}

/**
 * Kuitin lisäys.
 *
 * Hallintanäkymässä, ei työntekijän puolella: kuitti on ravintolan
 * kirjanpitoaineistoa, ja kulukirjauksen synnyttäminen kuuluu sille joka
 * myös vastaa sen oikeellisuudesta.
 */
export default async function NewReceiptPage() {
  const locale = await resolveLocale();
  const t = adminText(locale);
  const nimet = labels(locale);
  const { restaurant, role } = await requireContext("/admin/kuitit/uusi");

  if (!canAddReceipts(role)) redirect("/admin/kuitit");

  // Toimittajien korjaushistoria ohjaa kategoriaehdotusta.
  const [suppliers, categories] = await Promise.all([
    fetchSuppliers(restaurant.id),
    fetchExpenseCategories(restaurant.id),
  ]);

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <header className="flex items-center gap-2">
        <Link
          href="/admin/kuitit"
          aria-label={t.kuva.back}
          className="rf-press -ml-1.5 p-1.5"
          style={{ color: "var(--rf-text-2)" }}
        >
          <RfIcon name="back" size={22} />
        </Link>
      </header>

      <CaptureFlow
        nimet={nimet}
        t={t}
        restaurantId={restaurant.id}
        suppliers={suppliers}
        categories={categories}
        extractionEnabled={isRealExtractor()}
      />
    </div>
  );
}

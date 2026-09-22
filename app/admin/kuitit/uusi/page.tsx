import { withBusiness } from "@/lib/restoflow/business";
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
import { CATEGORY_ORDER } from "@/lib/restoflow/types";
import { todayIn } from "@/lib/restoflow/local-time";
import type { ExpenseCategory } from "@/lib/restoflow/types";

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
export default async function NewReceiptPage({
  searchParams,
}: PageProps<"/admin/kuitit/uusi">) {
  const locale = await resolveLocale();
  const t = adminText(locale);
  const { restaurant, role } = await requireContext("/admin/kuitit/uusi");
  const params = await searchParams;
  const nimet = withBusiness(labels(locale), restaurant.businessType);

  /*
   * Luokka osoitteesta.
   *
   * Yleiskuvan palkkakortti neuvoo kirjaamaan palkat Henkilöstö-luokkaan,
   * joten sen linkki avaa lomakkeen luokka valmiiksi valittuna.
   * Tuntematon arvo jätetään huomiotta eikä se päädy lomakkeelle.
   */
  const luokka: ExpenseCategory | "" =
    typeof params.luokka === "string" &&
    (CATEGORY_ORDER as string[]).includes(params.luokka)
      ? (params.luokka as ExpenseCategory)
      : "";

  if (!canAddReceipts(role)) redirect("/admin/kuitit");

  // Toimittajien korjaushistoria ohjaa kategoriaehdotusta.
  const [suppliers, categories] = await Promise.all([
    fetchSuppliers(restaurant.id),
    fetchExpenseCategories(restaurant.id),
  ]);

  return (
    <div className="mx-auto max-w-lg space-y-5">
      {/* Puhelimessa paluu on yläpalkissa. */}
      <header className="hidden items-center gap-2 md:flex">
        <Link
          href="/admin/kuitit"
          aria-label={t.kuva.back}
          className="rf-press -ms-1.5 p-1.5"
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
        /*
         * Luokka osoitteesta.
         *
         * Yleiskuvan palkkakortti neuvoo kirjaamaan palkat Henkilöstö-
         * luokkaan, joten linkki vie lomakkeeseen jossa luokka on jo
         * valittuna. Tuntematon arvo jätetään huomiotta.
         */
        defaultCategory={luokka}
        today={todayIn(restaurant.timezone)}
      />
    </div>
  );
}

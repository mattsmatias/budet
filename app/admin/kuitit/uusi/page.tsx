import Link from "next/link";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/restoflow/session";
import { fetchExpenseCategories, fetchSuppliers } from "@/lib/restoflow/queries";
import { canAddReceipts } from "@/lib/restoflow/permissions";
import { RfIcon } from "@/components/restoflow/icons";
import { CaptureFlow } from "./capture";

export const metadata = { title: "Uusi kuitti" };

/**
 * Kuitin lisäys.
 *
 * Hallintanäkymässä, ei työntekijän puolella: kuitti on ravintolan
 * kirjanpitoaineistoa, ja kulukirjauksen synnyttäminen kuuluu sille joka
 * myös vastaa sen oikeellisuudesta.
 */
export default async function NewReceiptPage() {
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
          aria-label="Takaisin"
          className="rf-press -ml-1.5 p-1.5"
          style={{ color: "var(--rf-text-2)" }}
        >
          <RfIcon name="back" size={22} />
        </Link>
        <h1 className="text-[22px] font-semibold tracking-tight md:text-[26px]">
          Uusi kuitti
        </h1>
      </header>

      <CaptureFlow
        restaurantId={restaurant.id}
        suppliers={suppliers}
        categories={categories}
      />
    </div>
  );
}

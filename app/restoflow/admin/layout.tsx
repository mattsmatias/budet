import { RECEIPTS } from "@/lib/restoflow/data";
import { needsReview } from "@/lib/restoflow/expenses";
import { Sidebar } from "./sidebar";

/**
 * Managerin työpöytäkuori.
 *
 * Sivupalkki kaventuu ikoneiksi kapealla näytöllä mutta ei katoa: hallinta
 * on työpöytänäkymä, ja piilotettu navigaatio tekisi siitä hitaamman.
 */
export default function AdminLayout({ children }: LayoutProps<"/restoflow/admin">) {
  const badgeCount = needsReview(RECEIPTS).length;

  return (
    <div className="flex min-h-screen">
      <Sidebar badgeCount={badgeCount} />
      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-6xl px-6 py-7">{children}</main>
      </div>
    </div>
  );
}

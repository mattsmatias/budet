import Link from "next/link";
import { requireContext } from "@/lib/restoflow/session";
import { RfIcon } from "@/components/restoflow/icons";
import { CaptureFlow } from "./capture";

export const metadata = { title: "Uusi kuitti" };

export default async function NewReceiptPage() {
  const { restaurant } = await requireContext("/app/kuitit/uusi");

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-2 pt-2">
        <Link
          href="/app/kuitit"
          aria-label="Takaisin"
          className="rf-press -ml-1.5 p-1.5"
          style={{ color: "var(--rf-text-2)" }}
        >
          <RfIcon name="back" size={22} />
        </Link>
        <h1 className="text-[22px] font-semibold tracking-tight">Uusi kuitti</h1>
      </header>

      <CaptureFlow restaurantId={restaurant.id} />
    </div>
  );
}

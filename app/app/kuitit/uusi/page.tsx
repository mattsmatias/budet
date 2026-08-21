import Link from "next/link";
import { Icon, ICONS } from "@/components/restoflow/ui";
import { CaptureFlow } from "./capture";

export const metadata = { title: "Uusi kuitti" };

export default function NewReceiptPage() {
  return (
    <div className="space-y-5">
      <header className="flex items-center gap-2 pt-2">
        <Link
          href="/app/kuitit"
          aria-label="Takaisin"
          className="rf-press -ml-1.5 p-1.5"
          style={{ color: "var(--rf-text-2)" }}
        >
          <Icon path={ICONS.back} size={22} />
        </Link>
        <h1 className="text-[22px] font-semibold tracking-tight">Uusi kuitti</h1>
      </header>

      <CaptureFlow />
    </div>
  );
}

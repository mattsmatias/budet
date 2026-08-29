import Link from "next/link";
import { RfIcon } from "@/components/restoflow/icons";
import { Wizard } from "./wizard";

export const metadata = { title: "Luo ravintola" };

export default function DevNewRestaurantPage() {
  return (
    <div className="rf-enter mx-auto max-w-2xl space-y-4">
      <header>
        <Link
          href="/kehittaja/ravintolat"
          className="rf-press -ml-1.5 inline-flex items-center gap-1.5 p-1.5 text-[13px] font-medium"
          style={{ color: "var(--rf-text-2)" }}
        >
          <RfIcon name="back" size={16} />
          Ravintolat
        </Link>

        <h1 className="mt-1 text-[22px] font-bold tracking-[-0.02em]">
          Luo ravintola
        </h1>
      </header>

      <Wizard />
    </div>
  );
}

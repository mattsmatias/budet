import Link from "next/link";
import type { AdminText } from "@/lib/i18n/admin-text";

/**
 * Palkkakauden valinta.
 *
 * Linkkejä eikä painikkeita: valinta on osoitteessa, joten kauden voi
 * jakaa ja selaimen paluunappi toimii. Ei selainkoodia lainkaan.
 */
export function PeriodPicker({
  t,
  month,
  current,
  options,
}: {
  t: AdminText;
  month: string;
  current: string;
  options: { key: string; label: string }[];
}) {
  return (
    <div
      role="group"
      aria-label={t.viimeiset.payPeriod}
      className="inline-flex items-center gap-0.5 p-1"
      style={{
        background: "var(--rf-inset)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {options.map((option) => {
        const active = option.key === current;

        return (
          <Link
            key={option.key}
            href={`/admin/palkat?kuukausi=${month}&kausi=${option.key}`}
            aria-current={active ? "true" : undefined}
            className="rf-press px-3 py-1.5 text-[13px] font-medium whitespace-nowrap"
            style={{
              background: active ? "var(--rf-card)" : "transparent",
              color: active ? "var(--rf-text)" : "var(--rf-text-2)",
              borderRadius: "calc(var(--rf-r-control) - 3px)",
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            }}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { RfIcon } from "@/components/restoflow/icons";

const MONTH_NAMES = [
  "Tammikuu", "Helmikuu", "Maaliskuu", "Huhtikuu", "Toukokuu", "Kesäkuu",
  "Heinäkuu", "Elokuu", "Syyskuu", "Lokakuu", "Marraskuu", "Joulukuu",
];

/**
 * Kuukauden valinta.
 *
 * Natiivi select eikä oma valikko: puhelimessa se avaa järjestelmän oman
 * valitsimen, joka on nopeampi ja saavutettavampi kuin mikään itse
 * piirretty. Ulkoasu on silti sovelluksen oma.
 *
 * useTransition pitää vanhan sisällön näkyvissä siirtymän ajan, jottei
 * näkymä välähdä tyhjäksi kuukautta vaihdettaessa.
 */
export function MonthPicker({
  value,
  months,
}: {
  value: string;
  months: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function select(month: string) {
    const next = new URLSearchParams(params.toString());
    next.set("kuukausi", month);

    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`);
    });
  }

  return (
    <div
      className="relative inline-flex items-center"
      style={{ opacity: pending ? 0.6 : 1, transition: "opacity 160ms ease" }}
    >
      <label htmlFor="rf-month-picker" className="sr-only">
        Valitse kuukausi
      </label>

      <select
        id="rf-month-picker"
        value={value}
        onChange={(event) => select(event.target.value)}
        className="rf-press cursor-pointer appearance-none py-2 pl-3.5 pr-9 text-[14px] font-medium outline-none"
        style={{
          background: "var(--rf-card)",
          color: "var(--rf-text)",
          borderRadius: "var(--rf-r-control)",
          border: "1px solid var(--rf-line)",
        }}
      >
        {months.map((month) => (
          <option key={month} value={month}>
            {formatMonth(month)}
          </option>
        ))}
      </select>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-3"
        style={{ color: "var(--rf-text-3)", transform: "rotate(90deg)" }}
      >
        <RfIcon name="chevron" size={14} />
      </span>
    </div>
  );
}

function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${year}`;
}

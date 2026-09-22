"use client";

import { useState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import type { PosMapping, SalesGroup } from "@/lib/restoflow/sales-vat";
import { ReportCapture } from "./capture";
import { SalesForm } from "./form";

/**
 * Puuttuvat myyntipäivät.
 *
 * KAKSI TIETÄ SAMAAN PÄIVÄÄN.
 *
 * Päivä voi puuttua kahdesta syystä: raporttia ei ehditty kuvata, tai
 * sitä ei ole enää tallessa. Siksi rivin takaa löytyy molemmat —
 * päiväraportin kuvaus ja käsin kirjaus. Kuvaus on ensin, koska se tuo
 * myös ALV:n, kuittien määrän ja myyntiryhmät; käsin kirjataan yksi
 * luku silloin kun muuta ei ole.
 *
 * Avattuna on yksi päivä kerrallaan. Kamera ja poiminta ovat raskaita
 * osia, eikä kolmenkymmenen päivän listaa kannata rakentaa valmiiksi
 * siltä varalta että joku niistä avataan.
 */
export function MissingDays({
  t,
  days,
  groups,
  mappings,
}: {
  t: AdminText;
  /** Päivä ja sen valmiiksi muotoiltu nimi: muotoilu on palvelimella. */
  days: { date: string; label: string }[];
  groups: SalesGroup[];
  mappings: PosMapping[];
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <ul className="mt-3 space-y-1.5">
      {days.map(({ date, label }) => {
        const isOpen = open === date;

        return (
          <li
            key={date}
            className="px-3.5 py-2.5"
            style={{
              background: "var(--rf-inset)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : date)}
              aria-expanded={isOpen}
              className="rf-press flex w-full items-center justify-between gap-3 text-start text-[14px] font-medium"
            >
              <span>{label}</span>
              <span
                className="text-[13px] font-semibold"
                style={{ color: "var(--rf-accent)" }}
              >
                {isOpen ? t.loput.cancel : t.myynti.recordDay}
              </span>
            </button>

            {isOpen ? (
              <div className="mt-3 space-y-3">
                {/* Kuvaus ensin: raportissa on enemmän kuin yksi luku. */}
                <ReportCapture
                  t={t}
                  today={date}
                  groups={groups}
                  mappings={mappings}
                />

                <div
                  className="flex items-center gap-2 pt-1 text-[12.5px]"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  <span className="h-px flex-1" style={{ background: "var(--rf-line)" }} />
                  <span>{t.myynti.orByHand}</span>
                  <span className="h-px flex-1" style={{ background: "var(--rf-line)" }} />
                </div>

                <SalesForm
                  t={t}
                  defaultDate={date}
                  defaultNet=""
                  defaultTarget=""
                  compact
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

"use client";

/**
 * Ravintolan omat työnantajamaksut.
 *
 * Kansallinen keskiarvo ei ole kenenkään todellinen maksu.
 * Työnantajan TyEL-maksu riippuu vakuutusyhtiöstä ja
 * asiakashyvityksistä, tapaturmavakuutus toimialan riskiluokasta.
 * Ravintola tietää ne, Kate ei.
 *
 * ---------------------------------------------------------------------
 * TYHJÄ KENTTÄ EI OLE NOLLA
 * ---------------------------------------------------------------------
 *
 * Tapaturmavakuutus jonka prosenttia ei ole syötetty jätetään
 * laskelmalta kokonaan pois. Nollarivi väittäisi ettei sitä makseta,
 * ja se on eri asia kuin "emme tiedä paljonko".
 */

import { useActionState, useState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import { Button } from "@/components/restoflow/ui";
import { RfIcon } from "@/components/restoflow/icons";
import { savePayrollSettings, type TaxState } from "../tyontekijat/tax-actions";

const TYHJA: TaxState = {};

const KENTTA = "mt-1 h-[38px] w-full px-2.5 text-[14px] outline-none";

const KENTTA_TYYLI = {
  background: "var(--rf-card)",
  border: "1px solid var(--rf-line)",
  borderRadius: "var(--rf-r-field)",
  color: "var(--rf-text)",
} as const;

export function EmployerRates({
  t,
  pensionRate,
  accidentRate,
  groupLifeRate,
}: {
  t: AdminText;
  pensionRate: number | null;
  accidentRate: number | null;
  groupLifeRate: number | null;
}) {
  const [state, action, pending] = useActionState(savePayrollSettings, TYHJA);

  /*
   * Auki kun mitään ei ole vielä syötetty.
   *
   * Silloin kustannus on keskiarvon varassa, ja juuri se on syy
   * avata tämä osio. Täytettynä se on tila jonka näkee ilman että
   * sitä muokkaa.
   */
  const [open, setOpen] = useState(pensionRate === null);

  return (
    <div
      className="mt-4 pt-3"
      style={{ borderTop: "1px solid var(--rf-line)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="rf-press flex items-center gap-2 text-[13px] font-semibold"
        style={{ color: "var(--rf-accent)" }}
      >
        <RfIcon name={open ? "close" : "plus"} size={14} />
        {t.verotus.ownRates}
      </button>

      {open ? (
        <form action={action} className="mt-3 space-y-3">
          <p className="text-[12.5px]" style={{ color: "var(--rf-text-2)" }}>
            {t.verotus.ownRatesHelp}
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-[13px] font-semibold">
                {`${t.verotus.employerPension} %`}
              </span>
              <input
                name="pension"
                inputMode="decimal"
                defaultValue={pensionRate === null ? "" : String(pensionRate)}
                placeholder="17,10"
                className={KENTTA}
                style={KENTTA_TYYLI}
              />
            </label>

            <label className="block">
              <span className="text-[13px] font-semibold">
                {`${t.verotus.employerAccident} %`}
              </span>
              <input
                name="accident"
                inputMode="decimal"
                defaultValue={accidentRate === null ? "" : String(accidentRate)}
                className={KENTTA}
                style={KENTTA_TYYLI}
              />
            </label>

            <label className="block">
              <span className="text-[13px] font-semibold">
                {`${t.verotus.employerGroupLife} %`}
              </span>
              <input
                name="groupLife"
                inputMode="decimal"
                defaultValue={
                  groupLifeRate === null ? "" : String(groupLifeRate)
                }
                className={KENTTA}
                style={KENTTA_TYYLI}
              />
            </label>
          </div>

          {state.error ? (
            <p
              className="text-[13px]"
              style={{ color: "var(--rf-red-text)" }}
              role="alert"
            >
              {state.error}
            </p>
          ) : null}

          {state.notice ? (
            <p
              className="text-[13px]"
              style={{ color: "var(--rf-green-text)" }}
              role="status"
            >
              {state.notice}
            </p>
          ) : null}

          <Button tone="ghost" size="sm" type="submit" disabled={pending}>
            {t.verotus.save}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

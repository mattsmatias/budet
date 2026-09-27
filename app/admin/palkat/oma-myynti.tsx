"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { AdminText } from "@/lib/i18n/admin-text";
import { formatMoney } from "@/lib/money";
import type { AdminState } from "../actions";
import { saveEmployeeSales } from "./actions";

/**
 * Provisiopalkkaisen oma myynti kuukaudessa.
 *
 * KENTTÄ ON SIINÄ MISSÄ LUKUA TARVITAAN.
 *
 * Myynti voisi olla asetuksissa, mutta se on kuukausiluku eikä
 * asetus: se vaihtuu joka kuukausi ja se kirjoitetaan silloin kun
 * palkkakulua katsotaan. Siksi se on tässä, työntekijän rivillä,
 * samassa näkymässä jossa sen vaikutus näkyy.
 *
 * TYHJÄ KENTTÄ ON NOLLA, EI VIRHE.
 *
 * Kesken kuukauden lukua ei vielä ole. Silloin provisio on nolla ja
 * se sanotaan ääneen — arvaus olisi pahempi kuin tyhjä.
 */
const initial: AdminState = {};

function Tallenna({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press shrink-0 px-3 text-[12.5px] font-bold"
      style={{
        height: 36,
        background: "var(--rf-inset)",
        border: "1px solid var(--rf-line-strong)",
        borderRadius: "var(--rf-r-control)",
        opacity: pending ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  );
}

export function OwnSales({
  t,
  employeeId,
  month,
  netCents,
  commissionCents,
}: {
  t: AdminText;
  employeeId: string;
  /** Kuukausi muodossa 2026-09. */
  month: string;
  /** Kirjattu myynti ilman alv, tai null kun riviä ei ole. */
  netCents: number | null;
  /** Mitä provisiota tästä kertyi. */
  commissionCents: number;
}) {
  const [state, action] = useActionState(saveEmployeeSales, initial);

  /*
   * Luvut sivulla päivittyvät vasta kun ne haetaan uudelleen.
   *
   * Palvelintoiminto mitätöi polun, mutta tämä sivu on dynaaminen
   * eikä mitätöinti yksin tuo uutta laskentaa näkyviin: tallennuksen
   * jälkeen kustannus jäi vanhaksi kunnes sivu ladattiin käsin.
   * Tallennus ilman näkyvää vaikutusta on pahin mahdollinen palaute —
   * käyttäjä luulee ettei se mennyt perille ja tallentaa uudelleen.
   *
   * Vertailu on kohteen identiteetillä eikä tekstillä: kuittaus on
   * joka kerta sama lause, mutta tila on joka kerta uusi olio.
   */
  const router = useRouter();
  const edellinen = useRef<AdminState>(initial);

  useEffect(() => {
    if (state === edellinen.current) return;
    edellinen.current = state;
    if (state.notice) router.refresh();
  }, [state, router]);

  return (
    <form
      action={action}
      className="mt-2 w-full border-t pt-2.5"
      style={{ borderColor: "var(--rf-line)" }}
    >
      <input type="hidden" name="employee" value={employeeId} />
      <input type="hidden" name="month" value={month} />

      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[9rem] flex-1">
          <span
            className="block text-[12px] font-semibold"
            style={{ color: "var(--rf-text-2)" }}
          >
            {t.tyo.ownSales}
          </span>
          <input
            name="sales"
            inputMode="decimal"
            defaultValue={
              netCents === null || netCents === 0
                ? ""
                : (netCents / 100).toFixed(2).replace(".", ",")
            }
            placeholder="0,00"
            className="mt-1 w-full px-2.5 text-[13px]"
            style={{
              height: 36,
              background: "var(--rf-card)",
              border: "1px solid var(--rf-line-strong)",
              borderRadius: "var(--rf-r-control)",
              color: "var(--rf-text)",
            }}
          />
        </label>

        <Tallenna label={t.loput.save} />
      </div>

      <p
        className="mt-1.5 text-[12px] leading-relaxed"
        style={{
          color: state.error ? "var(--rf-red-text)" : "var(--rf-text-3)",
        }}
      >
        {state.error ??
          state.notice ??
          (netCents === null || netCents === 0
            ? t.tyo.ownSalesMissing
            : `${t.tyo.ownSalesHint} ${t.palkkaAs.commission} ${formatMoney(
                commissionCents,
              )}.`)}
      </p>
    </form>
  );
}

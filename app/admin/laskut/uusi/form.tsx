"use client";

import { useActionState, useId, useState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import type { Customer } from "@/lib/restoflow/customers";
import type { VatCode } from "@/lib/restoflow/invoices";
import { laskunSummat } from "@/lib/restoflow/invoice-math";
import { formatMoney, formatRate, parseAmountToCents } from "@/lib/money";
import type { AdminState } from "../../actions";
import { createInvoice } from "../actions";
import { CONTROL, CONTROL_STYLE, Field } from "../../asetukset/form-parts";

const initial: AdminState = {};

interface Rivi {
  avain: number;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  vatCodeId: string;
}

/**
 * Laskun luonti.
 *
 * SUMMA LASKETAAN NÄYTÖLLE MUTTA EI LÄHETETÄ.
 *
 * Kirjoittaja näkee loppusumman heti, koska muuten hän laskisi sen
 * päässään ja huomaisi virheen vasta laskun lähdettyä. Lähetyksessä
 * kulkevat silti vain rivit: kanta laskee summat uudelleen, ja se on
 * ainoa lähde. Näin näytön luku ei voi olla eri kuin tallennettu.
 *
 * Sama laskenta molemmissa — kannoittain eikä riveittäin — joten
 * esikatselu näyttää sen mikä tallentuu.
 */
export function InvoiceForm({
  t,
  asiakkaat,
  kannat,
  laskunPaiva,
  erapaiva,
}: {
  t: AdminText;
  asiakkaat: Customer[];
  kannat: VatCode[];
  laskunPaiva: string;
  erapaiva: string;
}) {
  const [state, action, pending] = useActionState(createInvoice, initial);
  const id = useId();

  const oletusKanta = kannat[0]?.id ?? "";
  const [rivit, setRivit] = useState<Rivi[]>([
    {
      avain: 1,
      description: "",
      quantity: "1",
      unit: "",
      unitPrice: "",
      vatCodeId: oletusKanta,
    },
  ]);

  const muuta = (avain: number, kentta: keyof Rivi, arvo: string) =>
    setRivit((vanhat) =>
      vanhat.map((r) => (r.avain === avain ? { ...r, [kentta]: arvo } : r)),
    );

  const lisaa = () =>
    setRivit((vanhat) => [
      ...vanhat,
      {
        avain: Math.max(0, ...vanhat.map((r) => r.avain)) + 1,
        description: "",
        quantity: "1",
        unit: "",
        unitPrice: "",
        vatCodeId: oletusKanta,
      },
    ]);

  const poista = (avain: number) =>
    setRivit((vanhat) =>
      vanhat.length === 1 ? vanhat : vanhat.filter((r) => r.avain !== avain),
    );

  /* Esikatselu: samat säännöt kuin kannassa, tyhjät rivit ohi. */
  const summat = laskunSummat(
    rivit
      .filter((r) => r.description.trim() !== "")
      .map((r) => ({
        quantity: Number(r.quantity.replace(",", ".")) || 0,
        unitPriceCents: parseAmountToCents(r.unitPrice) ?? 0,
        vatRate: kannat.find((k) => k.id === r.vatCodeId)?.rate ?? 0,
      })),
  );

  return (
    <form action={action} className="space-y-5">
      <Field label={t.laskut.recipient} htmlFor={`${id}-customer`}>
        <select
          id={`${id}-customer`}
          name="customerId"
          required
          defaultValue=""
          className={CONTROL}
          style={CONTROL_STYLE}
        >
          <option value="" disabled>
            {t.laskut.chooseRecipient}
          </option>
          {asiakkaat.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.businessId ? ` — ${a.businessId}` : ""}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t.laskut.invoiceDate} htmlFor={`${id}-date`}>
          <input
            id={`${id}-date`}
            name="invoiceDate"
            type="date"
            required
            defaultValue={laskunPaiva}
            className={CONTROL}
            style={CONTROL_STYLE}
          />
        </Field>

        <Field label={t.laskut.dueDate} htmlFor={`${id}-due`}>
          <input
            id={`${id}-due`}
            name="dueDate"
            type="date"
            required
            defaultValue={erapaiva}
            className={CONTROL}
            style={CONTROL_STYLE}
          />
        </Field>
      </div>

      <section>
        <h2 className="text-[13px] font-semibold">{t.laskut.rows}</h2>

        <div className="mt-2 space-y-3">
          {rivit.map((rivi) => {
            const kanta = kannat.find((k) => k.id === rivi.vatCodeId);
            const netto =
              (Number(rivi.quantity.replace(",", ".")) || 0) *
              (parseAmountToCents(rivi.unitPrice) ?? 0);

            return (
              <div
                key={rivi.avain}
                className="rounded-[var(--rf-r-stat)] p-3"
                style={{ background: "var(--rf-inset)" }}
              >
                <input
                  name="rowDescription"
                  value={rivi.description}
                  onChange={(e) =>
                    muuta(rivi.avain, "description", e.target.value)
                  }
                  placeholder={t.laskut.description}
                  aria-label={t.laskut.description}
                  maxLength={200}
                  className={CONTROL}
                  style={{ ...CONTROL_STYLE, background: "var(--rf-card)" }}
                />

                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <input
                    name="rowQuantity"
                    value={rivi.quantity}
                    onChange={(e) =>
                      muuta(rivi.avain, "quantity", e.target.value)
                    }
                    inputMode="decimal"
                    placeholder={t.laskut.quantity}
                    aria-label={t.laskut.quantity}
                    className={`${CONTROL} rf-tabular`}
                    style={{ ...CONTROL_STYLE, background: "var(--rf-card)" }}
                  />

                  <input
                    name="rowUnit"
                    value={rivi.unit}
                    onChange={(e) => muuta(rivi.avain, "unit", e.target.value)}
                    placeholder={t.laskut.unit}
                    aria-label={t.laskut.unit}
                    maxLength={20}
                    className={CONTROL}
                    style={{ ...CONTROL_STYLE, background: "var(--rf-card)" }}
                  />

                  <input
                    name="rowUnitPrice"
                    value={rivi.unitPrice}
                    onChange={(e) =>
                      muuta(rivi.avain, "unitPrice", e.target.value)
                    }
                    inputMode="decimal"
                    placeholder={t.laskut.unitPrice}
                    aria-label={t.laskut.unitPrice}
                    className={`${CONTROL} rf-tabular`}
                    style={{ ...CONTROL_STYLE, background: "var(--rf-card)" }}
                  />

                  <select
                    name="rowVatCode"
                    value={rivi.vatCodeId}
                    onChange={(e) =>
                      muuta(rivi.avain, "vatCodeId", e.target.value)
                    }
                    aria-label={t.laskut.vat}
                    className={CONTROL}
                    style={{ ...CONTROL_STYLE, background: "var(--rf-card)" }}
                  >
                    {/*
                      Nimi prosentin perassa, koska pelkka prosentti ei
                      riita: nollaverokanta ja EU:n ulkopuolinen vienti
                      ovat molemmat 0 %, ja kaksi samannakoista
                      vaihtoehtoa on valinta jota ei voi tehda oikein.
                    */}
                    {kannat.map((k) => (
                      <option key={k.id} value={k.id}>
                        {formatRate(k.rate)} · {k.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3">
                  <span
                    className="rf-tabular text-[12.5px]"
                    style={{ color: "var(--rf-text-2)" }}
                  >
                    {t.laskut.rowNet} {formatMoney(Math.round(netto))}
                    {kanta ? ` · ${t.laskut.vat} ${formatRate(kanta.rate)}` : ""}
                  </span>

                  {rivit.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => poista(rivi.avain)}
                      className="rf-press text-[12.5px] font-semibold"
                      style={{ color: "var(--rf-red-text)" }}
                    >
                      {t.laskut.removeRow}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={lisaa}
          className="rf-press rf-touch mt-3 w-full text-[13px] font-bold"
          style={{
            borderRadius: 980,
            background: "var(--rf-inset)",
            color: "var(--rf-accent)",
          }}
        >
          {t.laskut.addRow}
        </button>
      </section>

      {/* Erittely kannoittain, kuten se laskullakin on. */}
      <section
        className="rounded-[var(--rf-r-stat)] p-3.5"
        style={{ background: "var(--rf-inset)" }}
      >
        {summat.kannat.map((k) => (
          <div
            key={k.vatRate}
            className="flex justify-between text-[12.5px]"
            style={{ color: "var(--rf-text-2)" }}
          >
            <span>
              {t.laskut.vat} {formatRate(k.vatRate)}
            </span>
            <span className="rf-tabular">
              {formatMoney(k.netCents)} + {formatMoney(k.vatCents)}
            </span>
          </div>
        ))}

        <div className="mt-2 flex justify-between border-t pt-2 text-[15px] font-bold"
             style={{ borderColor: "var(--rf-line)" }}>
          <span>{t.laskut.total}</span>
          <span className="rf-tabular">{formatMoney(summat.totalCents)}</span>
        </div>
      </section>

      <Field
        label={t.laskut.note}
        hint={t.laskut.noteHint}
        htmlFor={`${id}-note`}
      >
        <textarea
          id={`${id}-note`}
          name="note"
          rows={2}
          maxLength={1000}
          className={CONTROL}
          style={{ ...CONTROL_STYLE, height: "auto", paddingTop: 10 }}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rf-press rf-touch px-5 text-[13px] font-bold disabled:opacity-60"
          style={{
            borderRadius: 980,
            background: "var(--rf-accent)",
            color: "var(--rf-on-accent)",
          }}
        >
          {t.laskut.create}
        </button>

        {state.error ? (
          <span className="text-[12.5px]" style={{ color: "var(--rf-red-text)" }}>
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}

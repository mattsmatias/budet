"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Card, Pill } from "@/components/restoflow/ui";
import { RfIcon } from "@/components/restoflow/icons";
import type { TesAgreement, TesRuleType } from "@/lib/restoflow/tes";
import type { DevState } from "../actions";
import { saveTes, saveTesRule } from "./actions";

const initial: DevState = {};

const TOIMIALAT = [
  { id: "restaurant", label: "Ravintola" },
  { id: "cafe", label: "Kahvila" },
  { id: "barber", label: "Parturi / kampaamo" },
] as const;

/**
 * Lisien lajit.
 *
 * Nimi on ehdotus jota voi muuttaa; laji on se minkä laskenta tuntee.
 * Kellonaikaväli koskee vain vuorokaudenaikaan sidottuja lisiä —
 * lauantai ja sunnuntai määräytyvät viikonpäivästä.
 */
const LAJIT: {
  id: TesRuleType;
  label: string;
  aika: boolean;
  yksikko: "eur_per_hour" | "percent";
}[] = [
  { id: "evening", label: "Iltalisä", aika: true, yksikko: "eur_per_hour" },
  { id: "night", label: "Yölisä", aika: true, yksikko: "eur_per_hour" },
  {
    id: "saturday",
    label: "Lauantailisä",
    aika: false,
    yksikko: "eur_per_hour",
  },
  { id: "sunday", label: "Sunnuntaikorotus", aika: false, yksikko: "percent" },
  /* Aatto alkaa kesken paivan, joten kellonaika kuuluu saantoon. */
  { id: "eve", label: "Aattokorotus", aika: true, yksikko: "percent" },
];

/** Viikonpäivät ISO-numeroina: 1 = maanantai … 7 = sunnuntai. */
const VIIKONPAIVAT = [
  { id: 1, label: "ma" },
  { id: 2, label: "ti" },
  { id: 3, label: "ke" },
  { id: 4, label: "to" },
  { id: 5, label: "pe" },
  { id: 6, label: "la" },
  { id: 7, label: "su" },
];

const KENTTA =
  "w-full px-3 py-2 text-[15px] outline-none focus-visible:ring-2";

const KENTTA_TYYLI: React.CSSProperties = {
  background: "var(--rf-inset)",
  borderRadius: "var(--rf-r-control)",
};

/**
 * Säännön rajaukset luettavana tekstinä.
 *
 * Pelkkä euromäärä kertoo puolet: 4,00 €/h maanantaista perjantaihin
 * on eri sääntö kuin 4,00 €/h joka päivä. Rajaus näkyy siksi samassa
 * rivissä eikä vasta muokkauslomakkeella.
 */
function rajausTeksti(rule: TesAgreement["rules"][number]): string {
  const osat: string[] = [];

  if (rule.weekdays && rule.weekdays.length > 0) {
    osat.push(
      rule.weekdays
        .map((p) => VIIKONPAIVAT.find((v) => v.id === p)?.label ?? String(p))
        .join(", "),
    );
  }

  if (rule.notOnHolidays) osat.push("ei pyhinä");
  if (rule.baseOnly) osat.push("vain peruspalkasta");

  return osat.length === 0 ? "" : ` · ${osat.join(" · ")}`;
}

export function TesList({ agreements }: { agreements: TesAgreement[] }) {
  const [open, setOpen] = useState<string | null>(null);

  /* Perheittäin: versiot kuuluvat yhteen ja luetaan yhtenä ryhmänä. */
  const perheet = new Map<string, TesAgreement[]>();
  for (const tes of agreements) {
    perheet.set(tes.slug, [...(perheet.get(tes.slug) ?? []), tes]);
  }

  return (
    <div className="space-y-4">
      {open === "uusi" ? (
        <Card>
          <TesForm onClose={() => setOpen(null)} />
        </Card>
      ) : (
        <button
          type="button"
          onClick={() => setOpen("uusi")}
          className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
          style={{
            background: "var(--rf-accent)",
            color: "var(--rf-on-accent)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <RfIcon name="plus" size={17} />
          Lisää TES-pohja
        </button>
      )}

      {[...perheet.entries()].map(([slug, versiot]) => (
        <Card key={slug}>
          <p className="text-[15px] font-semibold">{versiot[0].name}</p>
          <p className="text-[12.5px]" style={{ color: "var(--rf-text-3)" }}>
            {slug} ·{" "}
            {versiot[0].industries
              .map(
                (ala) =>
                  TOIMIALAT.find((x) => x.id === ala)?.label ?? ala,
              )
              .join(", ")}
          </p>

          <ul className="mt-3 space-y-3">
            {versiot.map((tes) => (
              <li
                key={tes.id}
                className="border-t pt-3 first:border-0 first:pt-0"
                style={{ borderColor: "var(--rf-line)" }}
              >
                {open === tes.id ? (
                  <TesForm tes={tes} onClose={() => setOpen(null)} />
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rf-tabular text-[13.5px] font-semibold">
                        {tes.validFrom} – {tes.validUntil ?? "toistaiseksi"}
                      </span>
                      <Pill tone={tes.isActive ? "ok" : "neutral"}>
                        {tes.isActive ? "Aktiivinen" : "Ei käytössä"}
                      </Pill>
                    </div>

                    <ul
                      className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      {tes.rules.length === 0 ? (
                        <li>Ei lisiä</li>
                      ) : (
                        tes.rules.map((rule) => (
                          <li key={rule.id}>
                            {rule.name}{" "}
                            <span className="rf-tabular font-semibold">
                              {rule.unit === "eur_per_hour"
                                ? `${rule.value.toFixed(2).replace(".", ",")} €/h`
                                : `${rule.value} %`}
                            </span>
                            {rule.startTime
                              ? ` (${rule.startTime.slice(0, 5)}–${(
                                  rule.endTime ?? ""
                                ).slice(0, 5)})`
                              : ""}
                            {/* Rajaukset näkyviin: ne ovat osa sääntöä. */}
                            {rajausTeksti(rule)}
                          </li>
                        ))
                      )}
                    </ul>

                    {tes.note ? (
                      <p
                        className="text-[12px] leading-relaxed"
                        style={{ color: "var(--rf-amber-text)" }}
                      >
                        {tes.note}
                      </p>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => setOpen(tes.id)}
                      className="rf-press text-[12.5px] font-semibold underline-offset-4 hover:underline"
                    >
                      Muokkaa
                    </button>

                    <RuleForms tes={tes} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function TesForm({
  tes,
  onClose,
}: {
  tes?: TesAgreement;
  onClose: () => void;
}) {
  const [state, action] = useActionState(saveTes, initial);

  return (
    <form action={action} className="space-y-3">
      {tes ? <input type="hidden" name="id" value={tes.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Kentta
          label="Tunnus"
          name="slug"
          defaultValue={tes?.slug ?? ""}
          placeholder="marava"
          hint="Sama kaikilla saman sopimuksen versioilla."
        />
        <Kentta
          label="Nimi"
          name="name"
          defaultValue={tes?.name ?? ""}
          placeholder="Matkailu-, ravintola- ja vapaa-ajan palveluiden TES"
        />
      </div>

      <label className="block">
        <span className="block text-[12.5px] font-semibold">
          Huomautus
          <span className="ms-1 font-normal" style={{ color: "var(--rf-text-3)" }}>
            mitä sopimuksesta puuttuu
          </span>
        </span>
        <textarea
          name="note"
          defaultValue={tes?.note ?? ""}
          rows={2}
          placeholder="Esimerkiksi: aattoiltalisää ei ole syötetty, koska…"
          className={`${KENTTA} mt-1`}
          style={KENTTA_TYYLI}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <fieldset className="block">
          <legend className="block text-[12.5px] font-semibold">
            Toimialat
          </legend>

          {/*
            Monivalinta, koska soveltamisala on lista.

            Sama matkailu- ja ravintola-alan sopimus koskee seka
            ravintoloita etta kahviloita. Yksi valinta pakottaisi
            tekemaan kahvilalle kopion samasta sopimuksesta.
          */}
          <div className="mt-1.5 space-y-1.5">
            {TOIMIALAT.map((x) => (
              <label
                key={x.id}
                className="flex items-center gap-2 text-[13px]"
              >
                <input
                  type="checkbox"
                  name="industries"
                  value={x.id}
                  defaultChecked={
                    tes
                      ? tes.industries.includes(x.id)
                      : x.id === "restaurant"
                  }
                  className="h-4 w-4"
                />
                {x.label}
              </label>
            ))}
          </div>
        </fieldset>

        <Kentta
          label="Voimassa alkaen"
          name="validFrom"
          defaultValue={tes?.validFrom ?? ""}
          placeholder="2025-04-01"
        />
        <Kentta
          label="Voimassa päättyen"
          name="validUntil"
          defaultValue={tes?.validUntil ?? ""}
          placeholder="2028-03-31"
          hint="Tyhjä = toistaiseksi."
        />
      </div>

      <label className="flex items-center gap-2.5 text-[13px] font-semibold">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={tes?.isActive ?? true}
          className="h-4 w-4"
        />
        Aktiivinen
      </label>

      <Rivi state={state} onClose={onClose} />
    </form>
  );
}

/** Lisät omina pieninä lomakkeinaan: yksi laji kerrallaan. */
function RuleForms({ tes }: { tes: TesAgreement }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rf-press ms-4 text-[12.5px] font-semibold underline-offset-4 hover:underline"
      >
        Lisät
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-3">
      {LAJIT.map((laji) => {
        const rule = tes.rules.find((r) => r.ruleType === laji.id);
        return (
          <RuleForm key={laji.id} tesId={tes.id} laji={laji} rule={rule} />
        );
      })}

      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rf-press text-[12.5px] font-semibold underline-offset-4 hover:underline"
        style={{ color: "var(--rf-text-2)" }}
      >
        Sulje
      </button>
    </div>
  );
}

function RuleForm({
  tesId,
  laji,
  rule,
}: {
  tesId: string;
  laji: (typeof LAJIT)[number];
  rule: TesAgreement["rules"][number] | undefined;
}) {
  const [state, action] = useActionState(saveTesRule, initial);

  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-2 p-2.5"
      style={{
        background: "var(--rf-inset)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <input type="hidden" name="tesId" value={tesId} />
      <input type="hidden" name="ruleType" value={laji.id} />
      <input type="hidden" name="name" value={rule?.name ?? laji.label} />

      <span className="w-full text-[12.5px] font-semibold">{laji.label}</span>

      <input
        name="value"
        defaultValue={
          rule ? String(rule.value).replace(".", ",") : ""
        }
        placeholder="0"
        inputMode="decimal"
        aria-label={`${laji.label} arvo`}
        className="w-20 px-2 py-1.5 text-[14px] outline-none"
        style={{ background: "var(--rf-surface)", borderRadius: 8 }}
      />

      <select
        name="unit"
        defaultValue={rule?.unit ?? laji.yksikko}
        aria-label={`${laji.label} yksikkö`}
        className="px-2 py-1.5 text-[14px] outline-none"
        style={{ background: "var(--rf-surface)", borderRadius: 8 }}
      >
        <option value="eur_per_hour">€/h</option>
        <option value="percent">%</option>
      </select>

      {laji.aika ? (
        <>
          <input
            name="startTime"
            defaultValue={rule?.startTime?.slice(0, 5) ?? ""}
            placeholder="18:00"
            aria-label={`${laji.label} alkaa`}
            className="w-20 px-2 py-1.5 text-[14px] outline-none"
            style={{ background: "var(--rf-surface)", borderRadius: 8 }}
          />
          <input
            name="endTime"
            defaultValue={rule?.endTime?.slice(0, 5) ?? ""}
            placeholder="23:00"
            aria-label={`${laji.label} päättyy`}
            className="w-20 px-2 py-1.5 text-[14px] outline-none"
            style={{ background: "var(--rf-surface)", borderRadius: 8 }}
          />
        </>
      ) : null}

      {/*
        Rajaukset: mitkä päivät ja mistä korotus lasketaan.

        Nämä ovat sopimuksen tekstiä siinä missä euromääräkin. Kaupan
        iltalisää ei makseta arkilauantaina ja yölisää ei pyhänä;
        ilman rajausta Kate maksaisi molemmat joka päivä.
      */}
      <fieldset className="w-full">
        <legend className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          Päivät (tyhjä = kaikki)
        </legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {VIIKONPAIVAT.map((paiva) => (
            <label
              key={paiva.id}
              className="flex items-center gap-1 text-[12px]"
            >
              <input
                type="checkbox"
                name="weekdays"
                value={paiva.id}
                defaultChecked={rule?.weekdays?.includes(paiva.id) ?? false}
                className="h-3.5 w-3.5"
              />
              {paiva.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-1.5 text-[12px]">
        <input
          type="checkbox"
          name="notOnHolidays"
          defaultChecked={rule?.notOnHolidays ?? false}
          className="h-3.5 w-3.5"
        />
        Ei sunnuntaina eikä pyhänä
      </label>

      {laji.id === "sunday" || laji.id === "eve" ? (
        <label className="flex items-center gap-1.5 text-[12px]">
          <input
            type="checkbox"
            name="baseOnly"
            defaultChecked={rule?.baseOnly ?? false}
            className="h-3.5 w-3.5"
          />
          Korotus vain peruspalkasta
        </label>
      ) : null}

      <Tallenna />

      {state.error ? (
        <span
          role="alert"
          className="w-full text-[12px] font-semibold"
          style={{ color: "var(--rf-red-text)" }}
        >
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

function Kentta({
  label,
  name,
  defaultValue,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[12.5px] font-semibold">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={`${KENTTA} mt-1`}
        style={KENTTA_TYYLI}
      />
      {hint ? (
        <span
          className="mt-1 block text-[11.5px]"
          style={{ color: "var(--rf-text-3)" }}
        >
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function Rivi({
  state,
  onClose,
}: {
  state: DevState;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-1">
      <Tallenna />
      <button
        type="button"
        onClick={onClose}
        className="rf-press text-[12.5px] font-semibold underline-offset-4 hover:underline"
        style={{ color: "var(--rf-text-2)" }}
      >
        Peruuta
      </button>
      {state.error ? (
        <span
          role="alert"
          className="text-[12px] font-semibold"
          style={{ color: "var(--rf-red-text)" }}
        >
          {state.error}
        </span>
      ) : null}
      {state.notice ? (
        <span
          className="text-[12px] font-semibold"
          style={{ color: "var(--rf-green-text)" }}
        >
          {state.notice}
        </span>
      ) : null}
    </div>
  );
}

function Tallenna() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press px-3 py-1.5 text-[12.5px] font-bold disabled:opacity-50"
      style={{
        background: "var(--rf-accent)",
        color: "var(--rf-on-accent)",
        borderRadius: 8,
      }}
    >
      {pending ? "Tallennetaan…" : "Tallenna"}
    </button>
  );
}

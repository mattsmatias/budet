"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  receiptExtractor,
  reviewReasonsFor,
  uncertainFields,
  type ExtractionResult,
} from "@/lib/restoflow/receipt-ai";
import {
  CATEGORY_LABELS,
  PAYMENT_LABELS,
  REVIEW_REASON_LABELS,
  type ExpenseCategory,
  type PaymentMethod,
} from "@/lib/restoflow/types";
import { formatMoney } from "@/lib/money";
import { Card, Icon, ICONS, Pill } from "@/components/restoflow/ui";

type Phase = "choose" | "analyzing" | "review" | "saved";

/**
 * Kuitin lisäys.
 *
 * Poiminta EI koskaan tallenna suoraan. Käyttäjä näkee tunnistetut tiedot,
 * epävarmat kentät on merkitty, ja jokainen kenttä on muokattavissa ennen
 * tallennusta. Tämä on koko ominaisuuden ydin: kone ehdottaa, ihminen
 * vahvistaa.
 */
export function CaptureFlow() {
  const [phase, setPhase] = useState<Phase>("choose");
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [fileName, setFileName] = useState<string>("");

  // Muokattavat arvot. Alustetaan poiminnasta, mutta käyttäjä on viimeinen sana.
  const [supplier, setSupplier] = useState("");
  const [date, setDate] = useState("");
  const [totalEuros, setTotalEuros] = useState("");
  const [vatEuros, setVatEuros] = useState("");
  const [category, setCategory] = useState<ExpenseCategory | "">("");
  const [payment, setPayment] = useState<PaymentMethod>("unknown");
  const [note, setNote] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    const name = file?.name ?? "kuitti.jpg";
    setFileName(name);
    setPhase("analyzing");

    // Analyysin kesto on tarkoituksellinen: poiminta on demossa
    // välitön, mutta ilman näkyvää vaihetta käyttäjä ei ymmärrä mitä
    // tapahtui eikä ehdi lukea että tiedot pitää tarkistaa.
    const [extraction] = await Promise.all([
      receiptExtractor.extract({
        fileName: name,
        mimeType: file?.type ?? "image/jpeg",
        sizeBytes: file?.size ?? 0,
      }),
      new Promise((resolve) => setTimeout(resolve, 2200)),
    ]);

    setResult(extraction);
    setSupplier(extraction.supplier.value ?? "");
    setDate(extraction.date.value ?? new Date().toISOString().slice(0, 10));
    setTotalEuros(
      extraction.totalCents.value === null
        ? ""
        : (extraction.totalCents.value / 100).toFixed(2).replace(".", ","),
    );
    setVatEuros(
      extraction.vatCents.value === null
        ? ""
        : (extraction.vatCents.value / 100).toFixed(2).replace(".", ","),
    );
    setCategory(extraction.category.value ?? "");
    setPayment(extraction.paymentMethod.value ?? "unknown");
    setPhase("review");
  }

  if (phase === "choose") {
    return (
      <div className="rf-enter space-y-3">
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="rf-press flex w-full flex-col items-center gap-3 py-10"
          style={{
            background: "var(--rf-blue)",
            color: "#fff",
            borderRadius: "var(--rf-r-card)",
            boxShadow: "0 4px 20px rgba(0,113,227,0.28)",
          }}
        >
          <Icon path={ICONS.camera} size={38} />
          <span className="text-[17px] font-semibold">Kuvaa kuitti</span>
        </button>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rf-press flex w-full items-center gap-3 px-5 py-4"
          style={{
            background: "var(--rf-card)",
            borderRadius: "var(--rf-r-control)",
            boxShadow: "var(--rf-shadow-sm)",
          }}
        >
          <span style={{ color: "var(--rf-text-2)" }}>
            <Icon path={ICONS.image} size={22} />
          </span>
          <span className="text-[15px] font-medium">Valitse kuva</span>
        </button>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rf-press flex w-full items-center gap-3 px-5 py-4"
          style={{
            background: "var(--rf-card)",
            borderRadius: "var(--rf-r-control)",
            boxShadow: "var(--rf-shadow-sm)",
          }}
        >
          <span style={{ color: "var(--rf-text-2)" }}>
            <Icon path={ICONS.file} size={22} />
          </span>
          <span className="text-[15px] font-medium">Lataa tiedosto</span>
        </button>

        <p
          className="px-1 pt-2 text-[12px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          Demossa poiminta on paikallinen jäljitelmä, ei oikea tekoäly.
          Tiedostonimi ratkaisee tuloksen — kokeile nimeä joka sisältää{" "}
          <strong>metro</strong>, <strong>kespro</strong>, <strong>wolt</strong>{" "}
          tai <strong>juoma</strong>. Muut nimet tuottavat tarkoituksella
          epävarman tuloksen.
        </p>
      </div>
    );
  }

  if (phase === "analyzing") {
    return <Analyzing fileName={fileName} />;
  }

  if (phase === "saved") {
    return <Saved />;
  }

  if (!result) return null;

  const uncertain = new Set(uncertainFields(result));
  const reasons = reviewReasonsFor(result);

  return (
    <div className="rf-enter space-y-4">
      <div
        className="flex items-start gap-2.5 px-4 py-3 text-[13px] leading-relaxed"
        style={{
          background: reasons.length > 0 ? "var(--rf-amber-bg)" : "var(--rf-green-bg)",
          color: reasons.length > 0 ? "var(--rf-amber-text)" : "var(--rf-green-text)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <span aria-hidden="true" className="mt-0.5 shrink-0">
          <Icon path={reasons.length > 0 ? ICONS.alert : ICONS.check} size={16} />
        </span>
        <p>
          {reasons.length > 0
            ? "Osa tiedoista jäi epävarmaksi. Tarkista korostetut kentät ennen tallennusta."
            : "Kaikki kentät tunnistettiin. Tarkista silti että ne täsmäävät kuittiin."}
        </p>
      </div>

      <Card>
        <Field
          label="Toimittaja"
          value={supplier}
          onChange={setSupplier}
          uncertain={uncertain.has("supplier")}
          hint={result.supplier.hint}
        />
        <Field
          label="Päivämäärä"
          value={date}
          onChange={setDate}
          type="date"
          uncertain={uncertain.has("date")}
          hint={result.date.hint}
        />
        <Field
          label="Yhteensä"
          value={totalEuros}
          onChange={setTotalEuros}
          suffix="€"
          inputMode="decimal"
          uncertain={uncertain.has("totalCents")}
          hint={result.totalCents.hint}
        />
        <Field
          label="ALV"
          value={vatEuros}
          onChange={setVatEuros}
          suffix="€"
          inputMode="decimal"
          uncertain={uncertain.has("vatCents")}
          hint={result.vatCents.hint}
        />

        <SelectField
          label="Kategoria"
          value={category}
          onChange={(v) => setCategory(v as ExpenseCategory)}
          uncertain={uncertain.has("category")}
          hint={result.category.hint}
          options={[
            ["", "Valitse…"],
            ...Object.entries(CATEGORY_LABELS),
          ]}
        />
        <SelectField
          label="Maksutapa"
          value={payment}
          onChange={(v) => setPayment(v as PaymentMethod)}
          options={Object.entries(PAYMENT_LABELS)}
        />
        <Field label="Muistiinpano" value={note} onChange={setNote} last />
      </Card>

      {result.items.length > 0 ? (
        <Card>
          <p className="mb-3 text-[13px] font-semibold">
            Tunnistetut rivit ({result.items.length})
          </p>
          <ul className="space-y-2">
            {result.items.map((line, i) => (
              <li key={i} className="flex justify-between gap-4 text-[14px]">
                <span style={{ color: "var(--rf-text-2)" }}>{line.description}</span>
                <span className="rf-tabular shrink-0">{formatMoney(line.totalCents)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {reasons.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-1">
          {reasons.map((r) => (
            <Pill key={r} tone="warn" dot>
              {REVIEW_REASON_LABELS[r]}
            </Pill>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setPhase("saved")}
        disabled={!supplier || !totalEuros || !category}
        className="rf-press w-full py-3.5 text-[16px] font-semibold disabled:opacity-40"
        style={{
          background: "var(--rf-text)",
          color: "#fff",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        Tallenna kuitti
      </button>

      {!supplier || !totalEuros || !category ? (
        <p className="px-1 text-center text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          Toimittaja, summa ja kategoria vaaditaan.
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Analyzing({ fileName }: { fileName: string }) {
  return (
    <div className="rf-enter flex flex-col items-center justify-center py-20">
      <div
        className="rf-breathe flex h-20 w-20 items-center justify-center"
        style={{
          background: "var(--rf-blue-bg)",
          color: "var(--rf-blue)",
          borderRadius: "24px",
        }}
      >
        <Icon path={ICONS.receipt} size={34} />
      </div>

      <p className="mt-6 text-[17px] font-semibold">Analysoidaan kuittia…</p>
      <p className="mt-1 max-w-[16rem] text-center text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {fileName}
      </p>

      <div
        className="rf-sweep relative mt-6 h-1 w-40 overflow-hidden"
        style={{ background: "var(--rf-inset)", borderRadius: 999 }}
        role="progressbar"
        aria-label="Kuittia analysoidaan"
      />

      <ul className="mt-8 space-y-2 text-[13px]" style={{ color: "var(--rf-text-3)" }}>
        <li>Luetaan toimittaja ja päivämäärä</li>
        <li>Etsitään loppusumma ja ALV</li>
        <li>Päätellään kategoria</li>
      </ul>
    </div>
  );
}

function Saved() {
  return (
    <div className="rf-enter flex flex-col items-center justify-center py-20">
      <div
        className="flex h-20 w-20 items-center justify-center"
        style={{ background: "var(--rf-green-bg)", borderRadius: "50%" }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            className="rf-draw"
            d="m5 13 4 4L19 7"
            stroke="var(--rf-green-text)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <p className="mt-6 text-[17px] font-semibold">Kuitti tallennettu</p>
      <p
        className="mt-2 max-w-[18rem] text-center text-[13px] leading-relaxed"
        style={{ color: "var(--rf-text-2)" }}
      >
        Tässä demossa kuittia ei tallenneta pysyvästi — tietokantayhteys ei ole
        vielä kytketty. Oikeassa sovelluksessa se näkyisi nyt listassa ja
        managerin kulunäkymässä.
      </p>

      <Link
        href="/app/kuitit"
        className="rf-press mt-7 px-5 py-3 text-[15px] font-semibold"
        style={{
          background: "var(--rf-inset)",
          color: "var(--rf-text)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        Takaisin kuitteihin
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Field({
  label,
  value,
  onChange,
  type = "text",
  suffix,
  inputMode,
  uncertain,
  hint,
  last,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  suffix?: string;
  inputMode?: "decimal" | "text";
  uncertain?: boolean;
  hint?: string;
  last?: boolean;
}) {
  const id = `f-${label}`;
  return (
    <div
      className={last ? "py-3" : "border-b py-3"}
      style={{ borderColor: "var(--rf-line)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {label}
        </label>
        {uncertain ? <Pill tone="warn">tarkista</Pill> : null}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-[17px] font-medium outline-none"
          style={{ color: "var(--rf-text)" }}
        />
        {suffix ? <span className="text-[17px] font-medium">{suffix}</span> : null}
      </div>
      {hint ? (
        <p className="mt-1 text-[12px]" style={{ color: "var(--rf-amber-text)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  uncertain,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  uncertain?: boolean;
  hint?: string;
}) {
  const id = `s-${label}`;
  return (
    <div className="border-b py-3" style={{ borderColor: "var(--rf-line)" }}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {label}
        </label>
        {uncertain ? <Pill tone="warn">tarkista</Pill> : null}
      </div>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent text-[17px] font-medium outline-none"
        style={{ color: "var(--rf-text)" }}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      {hint ? (
        <p className="mt-1 text-[12px]" style={{ color: "var(--rf-amber-text)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}


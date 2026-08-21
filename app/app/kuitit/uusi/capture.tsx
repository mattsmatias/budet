"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { saveReceipt, type ActionState } from "../../actions";
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
import { CategoryIcon, RfIcon } from "@/components/restoflow/icons";
import { Card, Pill } from "@/components/restoflow/ui";

type Phase = "choose" | "analyzing" | "review" | "saved";

const initial: ActionState = {};

/**
 * Kuitin lisäys.
 *
 * Poiminta ei koskaan tallenna suoraan. Käyttäjä näkee tunnistetut tiedot,
 * epävarmat kentät on merkitty, ja jokainen kenttä on muokattavissa ennen
 * tallennusta. Kone ehdottaa, ihminen vahvistaa.
 *
 * Kuva ladataan selaimesta suoraan tallennukseen: server actionin kautta se
 * kulkisi turhaan palvelimen muistin läpi, ja isot kuvat kaatuisivat
 * pyyntökokorajaan.
 */
export function CaptureFlow({ restaurantId }: { restaurantId: string }) {
  const [phase, setPhase] = useState<Phase>("choose");
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [state, action] = useActionState(saveReceipt, initial);

  const [supplier, setSupplier] = useState("");
  const [date, setDate] = useState("");
  const [totalEuros, setTotalEuros] = useState("");
  const [vatEuros, setVatEuros] = useState("");
  const [category, setCategory] = useState<ExpenseCategory | "">("");
  const [payment, setPayment] = useState<PaymentMethod>("unknown");
  const [note, setNote] = useState("");

  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;

    setFileName(file.name);
    setUploadError(null);
    setPhase("analyzing");

    // Tiiviste ennen latausta: sama tiedosto tunnistetaan silloinkin kun
    // se on nimetty uudelleen.
    const hash = await sha256(file);
    setFileHash(hash);

    const [extraction] = await Promise.all([
      receiptExtractor.extract({
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
        sizeBytes: file.size,
        hash,
      }),
      uploadImage(file, restaurantId, hash)
        .then(setImagePath)
        .catch((e: Error) => setUploadError(e.message)),
      // Näkyvä vaihe: ilman sitä käyttäjä ei ymmärrä mitä tapahtui eikä
      // ehdi lukea että tiedot pitää tarkistaa.
      new Promise((resolve) => setTimeout(resolve, 1600)),
    ]);

    setResult(extraction);
    setSupplier(extraction.supplier.value ?? "");
    setDate(extraction.date.value ?? new Date().toISOString().slice(0, 10));
    setTotalEuros(toEuros(extraction.totalCents.value));
    setVatEuros(toEuros(extraction.vatCents.value));
    setCategory(extraction.category.value ?? "");
    setPayment(extraction.paymentMethod.value ?? "unknown");
    setPhase("review");
  }

  if (state.notice && phase !== "saved") setPhase("saved");

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
          ref={fileRef}
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
          <RfIcon name="camera" size={38} />
          <span className="text-[17px] font-semibold">Kuvaa kuitti</span>
        </button>

        <ChooseButton icon="image" label="Valitse kuva" onClick={() => fileRef.current?.click()} />
        <ChooseButton icon="file" label="Lataa tiedosto" onClick={() => fileRef.current?.click()} />

        <p className="px-1 pt-2 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
          Poiminta on tässä versiossa paikallinen jäljitelmä, ei oikea
          tekoäly — tiedostonimi ratkaisee tuloksen. Kuva tallentuu oikeasti,
          ja kaikki kentät ovat muokattavissa ennen tallennusta.
        </p>
      </div>
    );
  }

  if (phase === "analyzing") return <Analyzing fileName={fileName} />;
  if (phase === "saved") return <Saved receiptId={state.receiptId} />;
  if (!result) return null;

  const uncertain = new Set(uncertainFields(result));
  const reasons = reviewReasonsFor(result);
  const ready = supplier.trim() !== "" && totalEuros.trim() !== "" && category !== "";

  return (
    <form action={action} className="rf-enter space-y-4">
      <input type="hidden" name="imagePath" value={imagePath ?? ""} />
      <input type="hidden" name="imageQuality" value={result.imageQuality} />
      <input type="hidden" name="fileHash" value={fileHash ?? ""} />
      <input type="hidden" name="items" value={JSON.stringify(result.items)} />

      <div
        className="flex items-start gap-2.5 px-4 py-3 text-[13px] leading-relaxed"
        style={{
          background: reasons.length > 0 ? "var(--rf-amber-bg)" : "var(--rf-green-bg)",
          color: reasons.length > 0 ? "var(--rf-amber-text)" : "var(--rf-green-text)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <span aria-hidden="true" className="mt-0.5 shrink-0">
          <RfIcon name={reasons.length > 0 ? "alert" : "check"} size={16} />
        </span>
        <p>
          {reasons.length > 0
            ? "Osa tiedoista jäi epävarmaksi. Tarkista korostetut kentät ennen tallennusta."
            : "Kaikki kentät tunnistettiin. Tarkista silti että ne täsmäävät kuittiin."}
        </p>
      </div>

      {uploadError ? (
        <p
          className="px-4 py-3 text-[13px] leading-relaxed"
          style={{
            background: "var(--rf-amber-bg)",
            color: "var(--rf-amber-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          Kuvan tallennus ei onnistunut ({uploadError}). Kuitin tiedot voi silti
          tallentaa — kuva puuttuu.
        </p>
      ) : null}

      <Card>
        <TextField
          label="Toimittaja"
          name="supplier"
          value={supplier}
          onChange={setSupplier}
          uncertain={uncertain.has("supplier")}
          hint={result.supplier.hint}
        />
        <TextField
          label="Päivämäärä"
          name="date"
          type="date"
          value={date}
          onChange={setDate}
          uncertain={uncertain.has("date")}
          hint={result.date.hint}
        />
        <TextField
          label="Yhteensä"
          name="total"
          value={totalEuros}
          onChange={setTotalEuros}
          suffix="€"
          inputMode="decimal"
          uncertain={uncertain.has("totalCents")}
          hint={result.totalCents.hint}
        />
        <TextField
          label="ALV"
          name="vat"
          value={vatEuros}
          onChange={setVatEuros}
          suffix="€"
          inputMode="decimal"
          uncertain={uncertain.has("vatCents")}
          hint={result.vatCents.hint}
        />

        <SelectField
          label="Kategoria"
          name="category"
          value={category}
          onChange={(v) => setCategory(v as ExpenseCategory)}
          uncertain={uncertain.has("category")}
          hint={result.category.hint}
          options={[["", "Valitse…"], ...Object.entries(CATEGORY_LABELS)]}
        />
        <SelectField
          label="Maksutapa"
          name="payment"
          value={payment}
          onChange={(v) => setPayment(v as PaymentMethod)}
          uncertain={uncertain.has("paymentMethod")}
          options={Object.entries(PAYMENT_LABELS)}
        />
        <TextField label="Muistiinpano" name="note" value={note} onChange={setNote} last />
      </Card>

      {result.items.length > 0 ? (
        <Card>
          <p className="mb-3 text-[13px] font-semibold">
            Tunnistetut rivit ({result.items.length})
          </p>
          <ul className="space-y-2.5">
            {result.items.map((item, i) => (
              <li key={i} className="flex items-start justify-between gap-3 text-[14px]">
                <span className="flex min-w-0 items-start gap-2">
                  <span className="mt-0.5 shrink-0" style={{ color: "var(--rf-text-3)" }}>
                    <CategoryIcon category={item.category} size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block">{item.description}</span>
                    <span className="block text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                      {CATEGORY_LABELS[item.category]}
                    </span>
                  </span>
                </span>
                <span className="rf-tabular shrink-0">{formatMoney(item.totalCents)}</span>
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

      {state.error ? (
        <p
          role="alert"
          className="px-4 py-3 text-[13px] leading-relaxed"
          style={{
            background: "var(--rf-red-bg)",
            color: "var(--rf-red-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {state.error}
        </p>
      ) : null}

      <SaveButton disabled={!ready} />

      {!ready ? (
        <p className="px-1 text-center text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          Toimittaja, summa ja kategoria vaaditaan.
        </p>
      ) : null}
    </form>
  );
}

// ---------------------------------------------------------------------------

/**
 * Lataa kuvan tallennukseen.
 *
 * Polku alkaa ravintolan tunnisteella, koska tallennuksen politiikka lukee
 * pääsyn juuri siitä. Tiedostonimenä tiiviste: sama kuva ei vie tilaa
 * kahdesti eikä nimestä voi päätellä sisältöä.
 */
async function uploadImage(
  file: File,
  restaurantId: string,
  hash: string,
): Promise<string> {
  const supabase = createClient();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${restaurantId}/${hash}.${extension}`;

  const { error } = await supabase.storage
    .from("receipts")
    .upload(path, file, { upsert: true, contentType: file.type || undefined });

  if (error) throw new Error(error.message);
  return path;
}

async function sha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toEuros(cents: number | null): string {
  return cents === null ? "" : (cents / 100).toFixed(2).replace(".", ",");
}

// ---------------------------------------------------------------------------

function ChooseButton({
  icon,
  label,
  onClick,
}: {
  icon: "image" | "file";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rf-press flex w-full items-center gap-3 px-5 py-4"
      style={{
        background: "var(--rf-card)",
        borderRadius: "var(--rf-r-control)",
        boxShadow: "var(--rf-shadow-sm)",
      }}
    >
      <span style={{ color: "var(--rf-text-2)" }}>
        <RfIcon name={icon} size={22} />
      </span>
      <span className="text-[15px] font-medium">{label}</span>
    </button>
  );
}

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
        <RfIcon name="receipt" size={34} />
      </div>

      <p className="mt-6 text-[17px] font-semibold">Analysoidaan kuittia…</p>
      <p className="mt-1 max-w-[16rem] break-all text-center text-[13px]" style={{ color: "var(--rf-text-2)" }}>
        {fileName}
      </p>

      <div
        className="rf-sweep relative mt-6 h-1 w-40 overflow-hidden"
        style={{ background: "var(--rf-inset)", borderRadius: 999 }}
        role="progressbar"
        aria-label="Kuittia analysoidaan"
      />

      <ul className="mt-8 space-y-2 text-center text-[13px]" style={{ color: "var(--rf-text-3)" }}>
        <li>Tallennetaan kuva</li>
        <li>Luetaan toimittaja ja päivämäärä</li>
        <li>Etsitään loppusumma ja ALV</li>
      </ul>
    </div>
  );
}

function Saved({ receiptId }: { receiptId?: string }) {
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
        Se näkyy nyt kuittilistassa ja managerin kulunäkymässä.
      </p>

      <div className="mt-7 flex gap-2.5">
        {receiptId ? (
          <Link
            href={`/app/kuitit/${receiptId}`}
            className="rf-press px-5 py-3 text-[15px] font-semibold"
            style={{
              background: "var(--rf-text)",
              color: "#fff",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            Avaa kuitti
          </Link>
        ) : null}
        <Link
          href="/app/kuitit"
          className="rf-press px-5 py-3 text-[15px] font-semibold"
          style={{
            background: "var(--rf-inset)",
            color: "var(--rf-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          Kaikki kuitit
        </Link>
      </div>
    </div>
  );
}

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rf-press w-full py-3.5 text-[16px] font-semibold disabled:opacity-40"
      style={{
        background: "var(--rf-text)",
        color: "#fff",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {pending ? "Tallennetaan…" : "Tallenna kuitti"}
    </button>
  );
}

function TextField({
  label,
  name,
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
  name: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  suffix?: string;
  inputMode?: "decimal" | "text";
  uncertain?: boolean;
  hint?: string;
  last?: boolean;
}) {
  const id = `f-${name}`;

  return (
    <div className={last ? "py-3" : "border-b py-3"} style={{ borderColor: "var(--rf-line)" }}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {label}
        </label>
        {uncertain ? <Pill tone="warn">tarkista</Pill> : null}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <input
          id={id}
          name={name}
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-[17px] font-medium outline-none"
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
  name,
  value,
  onChange,
  options,
  uncertain,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  uncertain?: boolean;
  hint?: string;
}) {
  const id = `s-${name}`;

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
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent text-[17px] font-medium outline-none"
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

"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { RfIcon } from "@/components/restoflow/icons";
import { formatMoney } from "@/lib/money";
import {
  salesExtractor,
  SalesExtractionError,
  type SalesExtraction,
} from "@/lib/restoflow/sales-ai";
import { averageCheckCents, reconcile } from "@/lib/restoflow/sales-report";
import { saveDailySales, type SalesState } from "./actions";

/**
 * Päiväraportin kuvaus.
 *
 * Kuitti kuvataan ja poimitaan; päiväraportti on sama paperi samasta
 * tulostimesta ja se on kirjattu käsin. Sama kulku molemmille:
 * kuvaa → tarkista → tallenna.
 *
 * KONE EHDOTTAA, IHMINEN VAHVISTAA.
 *
 * Poiminta ei tallenna mitään. Luvut menevät lomakkeeseen jossa ne
 * näkyvät ja jossa niitä voi muuttaa, ja epävarmaksi merkitty kenttä
 * kertoo siitä. Väärin luettu myyntiluku on pahempi kuin puuttuva:
 * puuttuvan huomaa, väärä jää kirjanpitoon.
 */

type Phase =
  | { at: "idle" }
  | { at: "reading" }
  | { at: "review"; result: SalesExtraction; fileName: string }
  | { at: "failed"; message: string; retryable: boolean };

const initial: SalesState = {};

export function ReportCapture({ today }: { today: string }) {
  const [phase, setPhase] = useState<Phase>({ at: "idle" });
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  async function read(file: File | undefined) {
    if (!file) return;

    setPhase({ at: "reading" });

    try {
      const result = await salesExtractor.extract({ fileName: file.name, file });
      setPhase({ at: "review", result, fileName: file.name });
    } catch (error) {
      setPhase({
        at: "failed",
        message:
          error instanceof SalesExtractionError
            ? error.message
            : "Raportin luku epäonnistui.",
        retryable: error instanceof SalesExtractionError ? error.retryable : true,
      });
    }
  }

  if (phase.at === "review") {
    return (
      <ReviewForm
        result={phase.result}
        today={today}
        onDiscard={() => setPhase({ at: "idle" })}
      />
    );
  }

  return (
    <div>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => void read(event.target.files?.[0])}
      />
      <input
        ref={picker}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        onChange={(event) => void read(event.target.files?.[0])}
      />

      {phase.at === "reading" ? (
        <div
          className="flex items-center gap-3 px-4 py-4"
          style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
        >
          <span className="rf-breathe shrink-0" style={{ color: "var(--rf-accent)" }}>
            <RfIcon name="sparkle" size={18} />
          </span>
          <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            Luetaan päiväraporttia…
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => camera.current?.click()}
            className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
            style={{
              background: "var(--rf-accent)",
              color: "var(--rf-on-accent)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            <RfIcon name="camera" size={16} />
            Kuvaa päiväraportti
          </button>

          <button
            type="button"
            onClick={() => picker.current?.click()}
            className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
            style={{
              background: "var(--rf-inset)",
              color: "var(--rf-text)",
              border: "1px solid var(--rf-line-strong)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            <RfIcon name="file" size={16} />
            Valitse tiedosto
          </button>
        </div>
      )}

      {phase.at === "failed" ? (
        <p
          role="alert"
          className="mt-3 px-3.5 py-2.5 text-[12.5px] leading-relaxed"
          style={{
            background: "var(--rf-amber-bg)",
            color: "var(--rf-amber-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {phase.message}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Poimitut luvut tarkistettavaksi.
 *
 * Lomake eikä yhteenveto: jokainen kenttä on muokattavissa siinä
 * paikassa jossa se näkyy. Erillinen "muokkaa"-tila lisäisi askeleen
 * juuri siihen kohtaan jossa käyttäjä on jo huomannut virheen.
 */
function ReviewForm({
  result,
  today,
  onDiscard,
}: {
  result: SalesExtraction;
  today: string;
  onDiscard: () => void;
}) {
  const [state, action] = useActionState(saveDailySales, initial);

  const amounts = reconcile({
    grossCents: result.grossCents.value,
    vatCents: result.vatCents.value,
    netCents: result.netCents.value,
  });

  const average = averageCheckCents(amounts.grossCents, result.transactions.value);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="source" value="report" />

      {result.imageQuality === "poor" ? (
        <Banner tone="warn">
          Kuva on epäselvä. Tarkista jokainen luku raportista ennen tallennusta.
        </Banner>
      ) : null}

      {amounts.mismatch ? <Banner tone="warn">{amounts.mismatch}</Banner> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Myyntipäivä"
          name="date"
          type="date"
          defaultValue={result.date.value ?? today}
          uncertain={result.date.value === null}
          hint={result.date.value === null ? "Ei löytynyt raportista" : undefined}
          required
        />

        <Field
          label="Kuitteja"
          name="transactions"
          inputMode="numeric"
          defaultValue={result.transactions.value?.toString() ?? ""}
          uncertain={result.transactions.confidence === "low"}
          hint={
            average !== null ? `Keskiostos ${formatMoney(average)}` : "Vapaaehtoinen"
          }
        />

        <Field
          label="Verollinen myynti"
          name="gross"
          inputMode="decimal"
          defaultValue={euros(amounts.grossCents)}
          uncertain={result.grossCents.confidence === "low"}
          hint={amounts.derived.includes("grossCents") ? "Laskettu: veroton + ALV" : undefined}
        />

        <Field
          label="ALV yhteensä"
          name="vat"
          inputMode="decimal"
          defaultValue={euros(amounts.vatCents)}
          uncertain={result.vatCents.confidence === "low"}
          hint={amounts.derived.includes("vatCents") ? "Laskettu: verollinen − veroton" : undefined}
        />

        <Field
          label="Veroton myynti"
          name="net"
          inputMode="decimal"
          defaultValue={euros(amounts.netCents)}
          uncertain={result.netCents.confidence === "low"}
          hint={
            amounts.derived.includes("netCents")
              ? "Laskettu: verollinen − ALV"
              : "Tästä lasketaan työvoiman osuus"
          }
          required
        />

        <Field
          label="Tavoite"
          name="target"
          inputMode="decimal"
          defaultValue=""
          hint="Vapaaehtoinen. Tyhjänä verrataan saman viikonpäivän historiaan."
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-[12.5px] font-semibold" style={{ color: "var(--rf-red-text)" }}>
          {state.error}
        </p>
      ) : null}

      {state.notice ? (
        <p role="status" className="text-[12.5px] font-semibold" style={{ color: "var(--rf-green-text)" }}>
          {state.notice}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Submit />

        <button
          type="button"
          onClick={onDiscard}
          className="rf-press px-3 py-2 text-[13px] font-semibold"
          style={{ color: "var(--rf-text-2)" }}
        >
          Hylkää ja kuvaa uudelleen
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

/** Sentit lomakkeen euromuotoon. Tyhjä pysyy tyhjänä. */
function euros(cents: number | null): string {
  return cents === null ? "" : (cents / 100).toFixed(2).replace(".", ",");
}

function Field({
  label,
  name,
  hint,
  uncertain,
  ...rest
}: {
  label: string;
  name: string;
  hint?: string;
  /** Epävarmaksi poimittu kenttä saa merkinnän, ei pelkkää väriä. */
  uncertain?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `rf-sales-${name}`;

  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 text-[13px] font-semibold">
        {label}
        {uncertain ? (
          <span
            className="px-1.5 py-px text-[10.5px] font-bold"
            style={{
              background: "var(--rf-amber-bg)",
              color: "var(--rf-amber-text)",
              borderRadius: 999,
            }}
          >
            Tarkista
          </span>
        ) : null}
      </label>

      <input
        id={id}
        name={name}
        autoComplete="off"
        className="rf-tabular mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
        style={{
          background: "var(--rf-inset)",
          border: `1px solid ${uncertain ? "var(--rf-amber)" : "var(--rf-line)"}`,
          borderRadius: "var(--rf-r-control)",
        }}
        {...rest}
      />

      {hint ? (
        <p className="mt-1 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Banner({ tone, children }: { tone: "warn"; children: React.ReactNode }) {
  return (
    <p
      className="flex items-start gap-2.5 px-3.5 py-2.5 text-[12.5px] leading-relaxed"
      style={{
        background: tone === "warn" ? "var(--rf-amber-bg)" : "var(--rf-inset)",
        color: tone === "warn" ? "var(--rf-amber-text)" : "var(--rf-text-2)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <span className="mt-px shrink-0">
        <RfIcon name="alert" size={15} />
      </span>
      {children}
    </p>
  );
}

function Submit() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press inline-flex items-center justify-center gap-2 whitespace-nowrap px-[15px] py-[9px] text-[13px] font-bold disabled:opacity-50"
      style={{
        background: "var(--rf-accent)",
        color: "var(--rf-on-accent)",
        borderRadius: "var(--rf-r-control)",
        minHeight: 36,
      }}
    >
      {pending ? "Tallennetaan…" : "Tallenna päivän myynti"}
    </button>
  );
}

"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { suggestedCategory } from "@/lib/restoflow/suppliers";
import { saveReceipt, type AdminState } from "../../actions";
import {
  emptyResult,
  receiptExtractor,
  reviewReasonsFor,
  uncertainFields,
  type ExtractionResult,
} from "@/lib/restoflow/receipt-ai";
import {
  type CustomCategory,
  CATEGORY_LABELS,
  PAYMENT_LABELS,
  REVIEW_REASON_LABELS,
  type ExpenseCategory,
  type PaymentMethod,
  type Supplier,
} from "@/lib/restoflow/types";
import { formatMoney } from "@/lib/money";
import { CategoryIcon, RfIcon } from "@/components/restoflow/icons";
import { Card, Pill } from "@/components/restoflow/ui";

type Phase = "choose" | "analyzing" | "review" | "saved";

const initial: AdminState = {};

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
export function CaptureFlow({
  restaurantId,
  suppliers,
  categories,
  extractionEnabled,
}: {
  restaurantId: string;
  suppliers: Supplier[];
  categories: CustomCategory[];
  /** Onko oikea poimintapalvelu kytketty? Ratkaisee koko kulun sävyn. */
  extractionEnabled: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("choose");
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Paikallinen esikatselu. Näytetään heti kuvauksen jälkeen, jotta
  // käyttäjä näkee mitä otti — ja tarkistusvaiheessa, jotta lukuja voi
  // verrata paperiin ilman että kuittia tarvitsee pitää kädessä.
  const [preview, setPreview] = useState<string | null>(null);

  // Yhteenveto ensin, kentät pyynnöstä. Kymmenen kenttää putkeen on
  // lomake; kolme lukua ja "Muokkaa" on tarkistus.
  const [editing, setEditing] = useState(false);
  const [zoomed, setZoomed] = useState(false);

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
    setExtractionError(null);

    if (file.type !== "application/pdf") {
      setPreview(URL.createObjectURL(file));
    }
    setPhase("analyzing");

    // Tiiviste ennen latausta: sama tiedosto tunnistetaan silloinkin kun
    // se on nimetty uudelleen.
    const hash = await sha256(file);
    setFileHash(hash);

    // Ilman oikeaa poimintaa ei esitetä analyysiä. Pyörivä kehä ja sen
    // jälkeen "ei tunnistettu" joka kentässä antaa ymmärtää että kuvaa
    // yritettiin lukea ja se epäonnistui — käyttäjä kuvaa kuitin
    // uudelleen turhaan. Rehellisempää on avata tyhjä lomake heti.
    if (!extractionEnabled) {
      uploadImage(file, restaurantId, hash)
        .then(setImagePath)
        .catch((e: Error) => setUploadError(e.message));

      setResult(emptyResult());
      setDate(new Date().toISOString().slice(0, 10));
      setPhase("review");
      return;
    }

    // Lataus käynnistyy heti eikä odota poimintaa: kuva on arvokas
    // silloinkin kun luku epäonnistuu.
    const upload = uploadImage(file, restaurantId, hash)
      .then(setImagePath)
      .catch((e: Error) => setUploadError(e.message));

    let extraction: ExtractionResult;

    try {
      extraction = await receiptExtractor.extract({
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
        sizeBytes: file.size,
        hash,
        file,
      });
    } catch (error) {
      // Luku epäonnistui. Lomake avataan silti, mutta syy kerrotaan —
      // muuten käyttäjä luulee ettei kuitissa ollut mitään luettavaa ja
      // kuvaa sen turhaan uudelleen.
      await upload;

      setExtractionError(
        error instanceof Error ? error.message : "Kuvan luku epäonnistui.",
      );
      setResult(emptyResult());
      setDate(new Date().toISOString().slice(0, 10));
      setPhase("review");
      return;
    }

    await upload;

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
          <span className="text-[17px] font-semibold">
            {extractionEnabled ? "Kuvaa kuitti" : "Kuvaa ja täytä tiedot"}
          </span>
        </button>

        <ChooseButton icon="image" label="Valitse kuva" onClick={() => fileRef.current?.click()} />
        <ChooseButton icon="file" label="Lataa tiedosto" onClick={() => fileRef.current?.click()} />

        <p className="px-1 pt-2 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
          {extractionEnabled
            ? "Kone ehdottaa, ihminen vahvistaa: kaikki kentät ovat muokattavissa ennen tallennusta ja epävarmat on merkitty."
            : "Kuvan luku ei ole käytössä tässä ympäristössä. Kuva tallentuu, mutta tiedot täytetään käsin — sovellus ei arvaa niitä puolestasi."}
        </p>
      </div>
    );
  }

  if (phase === "analyzing") return <Analyzing fileName={fileName} preview={preview} />;
  if (phase === "saved") return <Saved receiptId={state.receiptId} />;
  if (!result) return null;

  // Kun poimintaa ei ole, mikään kenttä ei ole "epävarma" — se on vain
  // täyttämättä. Punainen korostus tyhjässä lomakkeessa on hälytys
  // asiasta joka ei ole vielä tapahtunut.
  const uncertain = extractionEnabled && extractionError === null
    ? new Set(uncertainFields(result))
    : new Set<string>();

  // Opittu korjaus: kun sama kategoriamuutos on tehty samalle
  // toimittajalle toistuvasti, ehdotetaan sitä. Ehdotus näytetään, ei
  // sovelleta automaattisesti — käyttäjän on nähtävä mitä muuttui.
  const matchedSupplier = suppliers.find(
    (candidate) =>
      candidate.name.trim().toLowerCase() === supplier.trim().toLowerCase(),
  );
  const suggestion =
    matchedSupplier && category !== ""
      ? suggestedCategory(matchedSupplier, category)
      : null;
  const reasons =
    extractionEnabled && extractionError === null ? reviewReasonsFor(result) : [];
  const ready = supplier.trim() !== "" && totalEuros.trim() !== "" && category !== "";

  // Puuttuva pakollinen tieto avaa kentät heti: muuten tallennus on
  // estetty eikä käyttäjä näe mistä se johtuu.
  const showFields = editing || !ready;

  return (
    <form action={action} className="rf-enter space-y-4">
      <input type="hidden" name="imagePath" value={imagePath ?? ""} />
      <input type="hidden" name="imageQuality" value={result.imageQuality} />
      <input type="hidden" name="fileHash" value={fileHash ?? ""} />
      <input type="hidden" name="items" value={JSON.stringify(result.items)} />

      <div
        className="flex items-start gap-2.5 px-4 py-3 text-[13px] leading-relaxed"
        style={{
          background: !extractionEnabled
            ? "var(--rf-blue-bg)"
            : reasons.length > 0
              ? "var(--rf-amber-bg)"
              : "var(--rf-green-bg)",
          color: !extractionEnabled
            ? "var(--rf-blue-text)"
            : reasons.length > 0
              ? "var(--rf-amber-text)"
              : "var(--rf-green-text)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <span aria-hidden="true" className="mt-0.5 shrink-0">
          <RfIcon
            name={
              !extractionEnabled ? "info" : reasons.length > 0 ? "alert" : "check"
            }
            size={16}
          />
        </span>
        <p>
          {extractionError
            ? "Täytä tiedot kuitista itse."
            : !extractionEnabled
            ? "Kuvan luku ei ole käytössä, joten täytä tiedot kuitista itse. Kuva tallentuu ja näkyy kuitin sivulla."
            : reasons.length > 0
              ? "Osa tiedoista jäi epävarmaksi. Tarkista korostetut kentät ennen tallennusta."
              : "Kaikki kentät tunnistettiin. Tarkista silti että ne täsmäävät kuittiin."}
        </p>
      </div>

      {extractionError ? (
        <p
          role="alert"
          className="px-4 py-3 text-[13px] leading-relaxed"
          style={{
            background: "var(--rf-amber-bg)",
            color: "var(--rf-amber-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {extractionError} Kuva on tallennettu, joten voit täyttää tiedot
          käsin tai poistaa kuitin ja yrittää uudelleen.
        </p>
      ) : null}

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

      {/* Yhteenveto: kolme lukua jotka ratkaisevat, ei kymmentä kenttää. */}
      <Card>
        <div className="flex items-start gap-3.5">
          {preview ? (
            <button
              type="button"
              onClick={() => setZoomed(true)}
              className="rf-press shrink-0 overflow-hidden"
              style={{ borderRadius: "var(--rf-r-control)" }}
              aria-label="Suurenna kuitin kuva"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Kuitti"
                className="h-20 w-16 object-cover"
                style={{ background: "var(--rf-inset)" }}
              />
            </button>
          ) : null}

          <div className="min-w-0 flex-1">
            <p className="rf-tabular text-[26px] font-semibold leading-none">
              {totalEuros.trim() === "" ? "— €" : `${totalEuros} €`}
            </p>

            <p className="mt-2 truncate text-[15px] font-medium">
              {supplier.trim() === "" ? "Toimittaja puuttuu" : supplier}
            </p>

            <p className="rf-tabular mt-0.5 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
              {date ? formatDate(date) : "Päivämäärä puuttuu"}
              {category === "" ? "" : ` · ${CATEGORY_LABELS[category]}`}
            </p>

            <p className="mt-1 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
              {vatEuros.trim() === ""
                ? "ALV ei näy kuitissa"
                : `ALV ${vatEuros} €`}
            </p>
          </div>
        </div>

        {uncertain.size > 0 ? (
          <p
            className="mt-3.5 flex items-start gap-2 px-3 py-2.5 text-[12px] leading-relaxed"
            style={{
              background: "var(--rf-amber-bg)",
              color: "var(--rf-amber-text)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            <span aria-hidden="true" className="mt-0.5 shrink-0">
              <RfIcon name="alert" size={14} />
            </span>
            Poiminta ei ole varma kaikista kentistä. Avaa tiedot ja
            tarkista korostetut.
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setEditing((open) => !open)}
          aria-expanded={showFields}
          className="rf-press mt-3.5 flex w-full items-center justify-center gap-2 py-2.5 text-[14px] font-semibold"
          style={{
            background: "var(--rf-inset)",
            color: "var(--rf-text)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          {showFields ? "Piilota tiedot" : "Muokkaa tietoja"}
          <span
            aria-hidden="true"
            style={{
              display: "block",
              transform: showFields ? "rotate(-90deg)" : "rotate(90deg)",
              transition: "transform 160ms ease",
            }}
          >
            <RfIcon name="chevron" size={14} />
          </span>
        </button>
      </Card>

      {zoomed && preview ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Kuitin kuva"
          onClick={() => setZoomed(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.82)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Kuitti" className="max-h-full max-w-full object-contain" />
        </div>
      ) : null}

      {/* Kentät ovat aina DOM:ssa: piilotettu kenttä ei lähtisi lomakkeen
          mukana, ja tallennus menettäisi juuri ne tiedot jotka poiminta
          luki oikein. Piilotus on visuaalinen, ei rakenteellinen. */}
      <div hidden={!showFields}>
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

        {categories.length > 0 ? (
          <div>
            <label htmlFor="rf-custom-category" className="block text-[13px] font-medium">
              Oma kategoria
            </label>
            <select
              id="rf-custom-category"
              name="categoryId"
              defaultValue=""
              className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
              style={{ background: "var(--rf-inset)", borderRadius: "var(--rf-r-control)" }}
            >
              <option value="">Ei omaa kategoriaa</option>
              {categories
                .filter((c) => c.active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--rf-text-3)" }}>
              Tarkennus raportteja varten. ALV ja budjetti tulevat yllä
              valitusta perusluokasta.
            </p>
          </div>
        ) : null}

        {suggestion ? (
          <div
            className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5"
            style={{
              background: "var(--rf-blue-bg)",
              color: "var(--rf-blue-text)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            <p className="text-[13px] leading-relaxed">
              Ehdotus: <strong>{CATEGORY_LABELS[suggestion.category]}</strong>.{" "}
              {suggestion.reason}
            </p>
            <button
              type="button"
              onClick={() => setCategory(suggestion.category)}
              className="rf-press px-3 py-1.5 text-[13px] font-semibold"
              style={{
                background: "var(--rf-card)",
                color: "var(--rf-blue-text)",
                borderRadius: "var(--rf-r-control)",
              }}
            >
              Käytä
            </button>
          </div>
        ) : null}
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
      </div>

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

const STEPS = [
  "Tallennetaan kuva",
  "Luetaan toimittaja ja päivämäärä",
  "Etsitään loppusumma ja ALV",
  "Tarkistetaan verotiedot",
];

/**
 * Analyysivaihe.
 *
 * Vaiheet etenevät ajastimella eivätkä seuraa todellista edistymistä:
 * rajapinta ei kerro missä kohtaa se on. Ne on silti tarkoituksella
 * tässä — käyttäjä näkee mitä ollaan tekemässä eikä pelkkää kehää, ja
 * kuvan näkeminen kertoo että oikea kuitti lähti matkaan.
 */
function Analyzing({
  fileName,
  preview,
}: {
  fileName: string;
  preview: string | null;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Viimeiseen vaiheeseen jäädään odottamaan, ei kierretä ympäri:
    // täyttyvä palkki joka alkaa alusta näyttäisi jumittumiselta.
    const timer = setInterval(() => {
      setStep((current) => Math.min(current + 1, STEPS.length - 1));
    }, 1400);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="rf-enter flex flex-col items-center py-10">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Kuvattu kuitti"
          className="max-h-52 w-auto"
          style={{
            borderRadius: "var(--rf-r-control)",
            boxShadow: "var(--rf-shadow)",
          }}
        />
      ) : (
        <div
          className="rf-breathe flex h-20 w-20 items-center justify-center"
          style={{
            background: "var(--rf-blue-bg)",
            color: "var(--rf-blue)",
            borderRadius: "24px",
          }}
        >
          <RfIcon name="file" size={34} />
        </div>
      )}

      <p className="mt-6 text-[17px] font-semibold">Luetaan kuittia…</p>
      <p
        className="mt-1 max-w-[16rem] break-all text-center text-[13px]"
        style={{ color: "var(--rf-text-2)" }}
      >
        {fileName}
      </p>

      <ul className="mt-7 w-full max-w-[18rem] space-y-2.5">
        {STEPS.map((label, index) => {
          const done = index < step;
          const active = index === step;

          return (
            <li key={label} className="flex items-center gap-2.5 text-[13px]">
              <span
                aria-hidden="true"
                className={active ? "rf-breathe" : ""}
                style={{
                  color: done
                    ? "var(--rf-green-text)"
                    : active
                      ? "var(--rf-blue)"
                      : "var(--rf-text-3)",
                }}
              >
                <RfIcon name={done ? "check" : "clock"} size={15} />
              </span>
              <span
                style={{
                  color: done || active ? "var(--rf-text)" : "var(--rf-text-3)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {label}
              </span>
            </li>
          );
        })}
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
        Se näkyy nyt kuittilistassa ja kulunäkymässä.
      </p>

      <div className="mt-7 flex gap-2.5">
        {receiptId ? (
          <Link
            href={`/admin/kuitit?korosta=${receiptId}`}
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
          href="/admin/kuitit"
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

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

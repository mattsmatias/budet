"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Labels } from "@/lib/i18n/labels";
import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
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
  EXPECTED_VAT_RATES,
  type ExpenseCategory,
  type PaymentMethod,
  type Supplier,
} from "@/lib/restoflow/types";
import {
  formatRate,
  inferVatRate,
  rateMatchesCategory,
} from "@/lib/restoflow/vat";
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
  nimet,
  t,
  restaurantId,
  suppliers,
  categories,
  extractionEnabled,
}: {
  nimet: Labels;
  t: AdminText;
  restaurantId: string;
  suppliers: Supplier[];
  categories: CustomCategory[];
  /** Onko oikea poimintapalvelu kytketty? Ratkaisee koko kulun sävyn. */
  extractionEnabled: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("choose");
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileHash, setFileHash] = useState<string | null>(null);
  /**
   * Kuitin sivut tallennuspolkuineen, kuvausjärjestyksessä.
   *
   * Ensimmäinen sivu on myös imagePath: se on peili jota listanäkymät
   * lukevat. Sivujen määrää ei rajata — kuitissa on niin monta sivua
   * kuin siinä on.
   */
  const [pages, setPages] = useState<{ path: string; hash: string }[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Paikallinen esikatselu. Näytetään heti kuvauksen jälkeen, jotta
  // käyttäjä näkee mitä otti — ja tarkistusvaiheessa, jotta lukuja voi
  // verrata paperiin ilman että kuittia tarvitsee pitää kädessä.
  const [previews, setPreviews] = useState<string[]>([]);

  // Yhteenvedon pikkukuva on aina ensimmäinen sivu. PDF:stä ei synny
  // esikatselua, jolloin tämä on tyhjä merkkijono — sama kuin ennenkin.
  const preview = previews[0] ?? null;

  // Yhteenveto ensin, kentät pyynnöstä. Kymmenen kenttää putkeen on
  // lomake; kolme lukua ja "Muokkaa" on tarkistus.
  const [editing, setEditing] = useState(false);
  // Suurennettuna näkyvän sivun numero, tai null kun mitään ei ole
  // suurennettuna. Monisivuisessa kuitissa pitää tietää mikä sivu.
  const [zoomed, setZoomed] = useState<number | null>(null);

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
  const addRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);

  async function handleFile(selected: FileList | File[] | null | undefined) {
    const chosen = [...(selected ?? [])];
    if (chosen.length === 0) return;

    const [file, ...rest] = chosen;

    setFileName(
      chosen.length === 1
        ? file.name
        : `${file.name} + ${rest.length} ${rest.length === 1 ? "sivu" : "sivua"}`,
    );
    setUploadError(null);
    setExtractionError(null);

    setPreviews(chosen.map(previewUrl));
    setPhase("analyzing");

    // Tiiviste ennen latausta: sama tiedosto tunnistetaan silloinkin kun
    // se on nimetty uudelleen. Kuitin tiiviste on ensimmäisen sivun,
    // koska kaksoiskappaleiden tunnistus vertaa sitä.
    const hash = await sha256(file);
    setFileHash(hash);

    /*
     * Sivut ladataan rinnakkain ja järjestys säilytetään.
     *
     * Promise.all palauttaa tulokset syötteen järjestyksessä riippumatta
     * siitä missä järjestyksessä lataukset valmistuvat — sivujärjestys
     * on osa kuitin sisältöä eikä saa riippua verkon nopeudesta.
     */
    const uploadPages = Promise.all(
      chosen.map(async (page) => {
        const pageHash = page === file ? hash : await sha256(page);
        return {
          path: await uploadImage(page, restaurantId, pageHash),
          hash: pageHash,
        };
      }),
    )
      .then((saved) => {
        setPages(saved);
        return saved;
      })
      .catch((e: Error) => {
        setUploadError(e.message);
        return [] as { path: string; hash: string }[];
      });

    // Ilman oikeaa poimintaa ei esitetä analyysiä. Pyörivä kehä ja sen
    // jälkeen "ei tunnistettu" joka kentässä antaa ymmärtää että kuvaa
    // yritettiin lukea ja se epäonnistui — käyttäjä kuvaa kuitin
    // uudelleen turhaan. Rehellisempää on avata tyhjä lomake heti.
    if (!extractionEnabled) {
      void uploadPages;

      setResult(emptyResult());
      setDate(new Date().toISOString().slice(0, 10));
      setPhase("review");
      return;
    }

    // Lataus käynnistyy heti eikä odota poimintaa: kuva on arvokas
    // silloinkin kun luku epäonnistuu.
    const upload = uploadPages;

    let extraction: ExtractionResult;

    try {
      extraction = await receiptExtractor.extract({
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
        sizeBytes: file.size,
        hash,
        file,
        extraPages: rest,
      });
    } catch (error) {
      // Luku epäonnistui. Lomake avataan silti, mutta syy kerrotaan —
      // muuten käyttäjä luulee ettei kuitissa ollut mitään luettavaa ja
      // kuvaa sen turhaan uudelleen.
      await upload;

      setExtractionError(
        error instanceof Error ? error.message : t.kuva.readFailed,
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

  /**
   * Lisää sivuja kuittiin joka on jo kuvattu.
   *
   * Kolmisivuinen kuitti tulee harvoin kerralla oikein: yksi sivu jää
   * pöydälle, toinen menee epätarkaksi. Lisääminen ei aloita alusta
   * eikä lue lukuja uudelleen — poimitut luvut ovat käyttäjän
   * tarkistamia, eikä niitä saa vaihtaa hänen selkänsä takana.
   */
  async function appendPages(selected: FileList | null) {
    const chosen = [...(selected ?? [])];
    if (chosen.length === 0) return;

    setAdding(true);
    setUploadError(null);

    try {
      const saved = await Promise.all(
        chosen.map(async (page) => {
          const pageHash = await sha256(page);
          return {
            path: await uploadImage(page, restaurantId, pageHash),
            hash: pageHash,
          };
        }),
      );

      setPages((current) => [...current, ...saved]);
      setPreviews((current) => [...current, ...chosen.map(previewUrl)]);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : t.kuva.pageSaveFailed,
      );
    } finally {
      setAdding(false);
    }
  }

  /**
   * Poistaa sivun ennen tallennusta.
   *
   * Vain listalta: tiedosto jää tallennustilaan. Poisto tallennustilasta
   * veisi mukanaan myös sivun jonka toinen kuitti jakaa saman tiivisteen
   * kautta, ja se olisi peruuttamatonta.
   */
  function removePage(index: number) {
    setPages((current) => current.filter((_, i) => i !== index));
    setPreviews((current) => current.filter((_, i) => i !== index));
    setZoomed(null);
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
          multiple
          className="sr-only"
          onChange={(e) => handleFile(e.target.files)}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="sr-only"
          onChange={(e) => handleFile(e.target.files)}
        />

        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          /*
           * Päätoiminnon väri on korostusväri, ei sininen.
           *
           * Tämä oli ainoa sininen painike koko hallinnassa, ja se
           * jäi tänne kun korostusväri vaihdettiin. Sininen on tässä
           * järjestelmässä tiedon väri — punainen on se jota
           * painetaan.
           */
          className="rf-press flex w-full flex-col items-center gap-3 py-10"
          style={{
            background: "var(--rf-accent)",
            color: "var(--rf-on-accent)",
            borderRadius: "var(--rf-r-card)",
            boxShadow: "var(--rf-shadow-lg)",
          }}
        >
          <RfIcon name="camera" size={38} />
          <span className="text-[17px] font-semibold">
            {extractionEnabled ? t.kuva.shootReceipt : t.kuva.shootAndFill}
          </span>
        </button>

        <ChooseButton
          icon="image"
          label={t.kuva.chooseImages}
          onClick={() => fileRef.current?.click()}
        />
        <ChooseButton
          icon="file"
          label={t.kuva.uploadFile}
          onClick={() => fileRef.current?.click()}
        />

        <p
          className="px-1 pt-2 text-[12px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          {extractionEnabled ? t.kuva.machineSuggests : t.kuva.noExtractor}
        </p>

        <p
          className="px-1 text-[12px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          {t.kuva.multiPage}
        </p>
      </div>
    );
  }

  if (phase === "analyzing")
    return <Analyzing t={t} fileName={fileName} preview={preview} />;
  if (phase === "saved") return <Saved t={t} receiptId={state.receiptId} />;
  if (!result) return null;

  // Kun poimintaa ei ole, mikään kenttä ei ole "epävarma" — se on vain
  // täyttämättä. Punainen korostus tyhjässä lomakkeessa on hälytys
  // asiasta joka ei ole vielä tapahtunut.
  const uncertain =
    extractionEnabled && extractionError === null
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
    extractionEnabled && extractionError === null
      ? reviewReasonsFor(result)
      : [];
  const ready =
    supplier.trim() !== "" && totalEuros.trim() !== "" && category !== "";

  // Puuttuva pakollinen tieto avaa kentät heti: muuten tallennus on
  // estetty eikä käyttäjä näe mistä se johtuu.
  const showFields = editing || !ready;

  return (
    <form action={action} className="rf-enter space-y-4">
      {/* Kuitin kuva on ensimmäinen sivu — ei oma tietonsa. */}
      <input type="hidden" name="imagePath" value={pages[0]?.path ?? ""} />
      {/*
        Sivut menevät omana kenttänään. Palvelin kirjoittaa ne
        set_receipt_pages-funktiolla, joka korvaa kuitin sivut
        kokonaan — osittainen päivitys jättäisi poistetun sivun
        roikkumaan.
      */}
      <input type="hidden" name="pages" value={JSON.stringify(pages)} />
      <input type="hidden" name="imageQuality" value={result.imageQuality} />
      <input type="hidden" name="fileHash" value={fileHash ?? ""} />
      <input type="hidden" name="items" value={JSON.stringify(result.items)} />
      {/* Kaupan tunnistukseen. Ei näytetä lomakkeella: käyttäjä ei
          korjaa Y-tunnusta, ja jos poiminta luki sen väärin, tarkiste
          on jo pudottanut sen pois. */}
      <input
        type="hidden"
        name="businessId"
        value={result.businessId.value ?? ""}
      />

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
              !extractionEnabled
                ? "info"
                : reasons.length > 0
                  ? "alert"
                  : "check"
            }
            size={16}
          />
        </span>
        <p>
          {extractionError
            ? t.kuva.fillYourself
            : !extractionEnabled
              ? t.kuva.noExtractorShort
              : reasons.length > 0
                ? t.kuva.someUncertain
                : t.kuva.allRecognised}
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
          {extractionError} Kuva on tallennettu, joten voit täyttää tiedot käsin
          tai poistaa kuitin ja yrittää uudelleen.
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
              onClick={() => setZoomed(0)}
              className="rf-press shrink-0 overflow-hidden"
              style={{ borderRadius: "var(--rf-r-control)" }}
              aria-label={t.kuva.zoomImage}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt={t.kuva.receipt}
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

            <p
              className="rf-tabular mt-0.5 text-[13px]"
              style={{ color: "var(--rf-text-2)" }}
            >
              {date ? formatDate(date) : t.kuva.dateMissing}
              {category === "" ? "" : ` · ${nimet.categories[category]}`}
            </p>

            <p
              className="mt-1 text-[13px]"
              style={{ color: "var(--rf-text-2)" }}
            >
              {vatEuros.trim() === ""
                ? t.kuva.vatMissing
                : fill(t.kuva.vatEuros, { maara: vatEuros })}
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
            {t.kuva.uncertainFields}
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
          {showFields ? t.kuva.hideDetails : t.kuva.editDetails}
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

      {/*
        Sivut näkyvät ennen tallennusta.

        Monisivuisen kuitin sudenkuoppa on että sivu jää kuvaamatta ja
        se huomataan vasta kirjanpidossa. Kun sivut näkyvät rivissä ja
        niissä lukee numero, puuttuva sivu näkyy ennen tallennusta.
      */}
      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[15px] font-medium">
            {previews.length <= 1
              ? t.kuva.receiptImage
              : fill(t.kuva.pagesCount, { n: String(previews.length) })}
          </p>

          {adding ? (
            <span className="text-[13px]" style={{ color: "var(--rf-text-3)" }}>
              {t.kuva.saving}
            </span>
          ) : null}
        </div>

        <div className="-mx-1 mt-3 flex gap-2.5 overflow-x-auto px-1 pb-1">
          {previews.map((url, index) => (
            <div key={`${url}-${index}`} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setZoomed(index)}
                disabled={url === ""}
                className="rf-press block h-24 w-[72px] overflow-hidden"
                style={{
                  borderRadius: "var(--rf-r-control)",
                  background: "var(--rf-inset)",
                }}
                aria-label={fill(t.kuva.zoomPage, { n: String(index + 1) })}
              >
                {url === "" ? (
                  /* PDF:stä ei synny esikatselua selaimessa. */
                  <span
                    className="flex h-full w-full items-center justify-center"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    <RfIcon name="file" size={22} />
                  </span>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={url}
                    alt={fill(t.kuva.pageN, { n: String(index + 1) })}
                    className="h-full w-full object-cover"
                  />
                )}
              </button>

              <span
                className="rf-tabular pointer-events-none absolute bottom-1 left-1 px-1.5 py-0.5 text-[11px] font-medium"
                style={{
                  background: "rgba(0,0,0,0.62)",
                  color: "#fff",
                  borderRadius: "var(--rf-r-chip, 6px)",
                }}
              >
                {index + 1}
              </span>

              <button
                type="button"
                onClick={() => removePage(index)}
                className="rf-press absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center"
                style={{
                  background: "var(--rf-surface)",
                  color: "var(--rf-text-2)",
                  borderRadius: "999px",
                  boxShadow: "var(--rf-shadow-sm, 0 1px 3px rgba(0,0,0,0.2))",
                }}
                aria-label={fill(t.kuva.removePage, { n: String(index + 1) })}
              >
                <RfIcon name="trash" size={13} />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => addRef.current?.click()}
            disabled={adding}
            className="rf-press flex h-24 w-[72px] shrink-0 flex-col items-center justify-center gap-1.5"
            style={{
              background: "var(--rf-inset)",
              color: "var(--rf-text-2)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            <RfIcon name="plus" size={18} />
            <span className="text-[11px] font-medium">{t.kuva.addPage}</span>
          </button>
        </div>

        <input
          ref={addRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="sr-only"
          onChange={(e) => {
            void appendPages(e.target.files);
            // Sama tiedosto pitää voida valita uudelleen, jos edellinen
            // yritys epäonnistui. Ilman tyhjennystä onChange ei laukea.
            e.target.value = "";
          }}
        />

        <p
          className="mt-2 text-[12px] leading-relaxed"
          style={{ color: "var(--rf-text-3)" }}
        >
          Sivuja voi olla niin monta kuin kuitissa on. Jälkikäteen lisätty sivu
          tallentuu kuittiin, mutta lukuja ei lueta uudelleen — tarkista summa
          itse.
        </p>
      </Card>

      {zoomed !== null && previews[zoomed] ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.kuva.receiptImage}
          onClick={() => setZoomed(null)}
          className="rf-z-modal fixed inset-0 flex flex-col items-center justify-center gap-3 p-4"
          style={{ background: "rgba(0,0,0,0.82)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previews[zoomed]}
            alt={fill(t.kuva.receiptPage, { n: String(zoomed + 1) })}
            className="max-h-full max-w-full object-contain"
          />

          {previews.length > 1 ? (
            <p className="rf-tabular text-[13px] text-white/80">
              {fill(t.kuva.pageOfPages, {
                sivu: String(zoomed + 1),
                kaikki: String(previews.length),
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Kentät ovat aina DOM:ssa: piilotettu kenttä ei lähtisi lomakkeen
          mukana, ja tallennus menettäisi juuri ne tiedot jotka poiminta
          luki oikein. Piilotus on visuaalinen, ei rakenteellinen. */}
      <div hidden={!showFields}>
        <Card>
          <TextField
            label={t.kuva.supplier}
            name="supplier"
            value={supplier}
            onChange={setSupplier}
            uncertain={uncertain.has("supplier")}
            hint={result.supplier.hint}
          />
          <TextField
            label={t.kuva.date}
            name="date"
            type="date"
            value={date}
            onChange={setDate}
            uncertain={uncertain.has("date")}
            hint={result.date.hint}
          />
          <TextField
            label={t.kuva.total}
            name="total"
            value={totalEuros}
            onChange={setTotalEuros}
            suffix="€"
            inputMode="decimal"
            uncertain={uncertain.has("totalCents")}
            hint={result.totalCents.hint}
          />
          <VatField
            t={t}
            totalEuros={totalEuros}
            value={vatEuros}
            onChange={setVatEuros}
            category={category}
            uncertain={uncertain.has("vatCents")}
            hint={result.vatCents.hint}
          />

          <SelectField
            label={t.kuva.category}
            name="category"
            value={category}
            onChange={(v) => setCategory(v as ExpenseCategory)}
            uncertain={uncertain.has("category")}
            hint={result.category.hint}
            options={[["", "Valitse…"], ...Object.entries(nimet.categories)]}
          />

          {categories.length > 0 ? (
            <div>
              <label
                htmlFor="rf-custom-category"
                className="block text-[13px] font-medium"
              >
                {t.kuva.ownCategory}
              </label>
              <select
                id="rf-custom-category"
                name="categoryId"
                defaultValue=""
                className="mt-1.5 w-full px-3.5 py-2.5 text-[16px] outline-none"
                style={{
                  background: "var(--rf-inset)",
                  borderRadius: "var(--rf-r-control)",
                }}
              >
                <option value="">{t.kuva.noOwnCategory}</option>
                {categories
                  .filter((c) => c.active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
              <p
                className="mt-1 text-[12px] leading-relaxed"
                style={{ color: "var(--rf-text-3)" }}
              >
                {t.kuva.ownCategoryHint}
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
                {t.kuva.suggestion}
                <strong>{nimet.categories[suggestion.category]}</strong>.{" "}
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
                {t.kuva.use}
              </button>
            </div>
          ) : null}
          <SelectField
            label={t.kuva.paymentMethod}
            name="payment"
            value={payment}
            onChange={(v) => setPayment(v as PaymentMethod)}
            uncertain={uncertain.has("paymentMethod")}
            options={Object.entries(nimet.payments)}
          />
          <TextField
            label={t.kuva.note}
            name="note"
            value={note}
            onChange={setNote}
            last
          />
        </Card>
      </div>

      {result.items.length > 0 ? (
        <Card>
          <p className="mb-3 text-[13px] font-semibold">
            Tunnistetut rivit ({result.items.length})
          </p>
          <ul className="space-y-2.5">
            {result.items.map((item, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-3 text-[14px]"
              >
                <span className="flex min-w-0 items-start gap-2">
                  <span
                    className="mt-0.5 shrink-0"
                    style={{ color: "var(--rf-text-3)" }}
                  >
                    <CategoryIcon category={item.category} size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block">{item.description}</span>
                    <span
                      className="block text-[12px]"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      {nimet.categories[item.category]}
                    </span>
                  </span>
                </span>
                <span className="rf-tabular shrink-0">
                  {formatMoney(item.totalCents)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {reasons.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-1">
          {reasons.map((r) => (
            <Pill key={r} tone="warn" dot>
              {nimet.reviewReasons[r]}
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

      <SaveButton t={t} disabled={!ready} />

      {!ready ? (
        <p
          className="px-1 text-center text-[12px]"
          style={{ color: "var(--rf-text-3)" }}
        >
          {t.kuva.requiredFields}
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

/**
 * Selaimen esikatselu tiedostosta.
 *
 * PDF:stä ei synny kuvaa ilman erillistä piirtoa, joten se saa tyhjän
 * merkkijonon: sivu on olemassa ja näkyy nauhassa, mutta ilman
 * esikatselua. Tyhjä on tässä tarkoitettu arvo, ei puuttuva.
 */
function previewUrl(file: File): string {
  return file.type === "application/pdf" ? "" : URL.createObjectURL(file);
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

const vaiheet = (t: AdminText) => [
  t.kuva.stepSaving,
  t.kuva.stepSupplier,
  t.kuva.stepTotal,
  t.kuva.stepVat,
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
  t,
  fileName,
  preview,
}: {
  t: AdminText;
  fileName: string;
  preview: string | null;
}) {
  const [step, setStep] = useState(0);
  const vaiheita = vaiheet(t).length;

  useEffect(() => {
    // Viimeiseen vaiheeseen jäädään odottamaan, ei kierretä ympäri:
    // täyttyvä palkki joka alkaa alusta näyttäisi jumittumiselta.
    const timer = setInterval(() => {
      setStep((current) => Math.min(current + 1, vaiheita - 1));
    }, 1400);

    return () => clearInterval(timer);
  }, [vaiheita]);

  return (
    <div className="rf-enter flex flex-col items-center py-10">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt={t.kuva.shotReceipt}
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

      <p className="mt-6 text-[17px] font-semibold">{t.kuva.reading}</p>
      <p
        className="mt-1 max-w-[16rem] break-all text-center text-[13px]"
        style={{ color: "var(--rf-text-2)" }}
      >
        {fileName}
      </p>

      <ul className="mt-7 w-full max-w-[18rem] space-y-2.5">
        {vaiheet(t).map((label, index) => {
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

function Saved({ t, receiptId }: { t: AdminText; receiptId?: string }) {
  return (
    <div className="rf-enter flex flex-col items-center justify-center py-20">
      <div
        className="flex h-20 w-20 items-center justify-center"
        style={{ background: "var(--rf-green-bg)", borderRadius: "50%" }}
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
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

      <p className="mt-6 text-[17px] font-semibold">{t.kuva.savedTitle}</p>
      <p
        className="mt-2 max-w-[18rem] text-center text-[13px] leading-relaxed"
        style={{ color: "var(--rf-text-2)" }}
      >
        {t.kuva.savedBody}
      </p>

      <div className="mt-7 flex gap-2.5">
        {receiptId ? (
          <Link
            href={`/admin/kuitit?korosta=${receiptId}`}
            className="rf-press px-5 py-3 text-[15px] font-semibold"
            style={{
              background: "var(--rf-accent)",
              color: "var(--rf-on-accent)",
              borderRadius: "var(--rf-r-control)",
            }}
          >
            {t.kuva.openReceipt}
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
          {t.kuva.allReceipts}
        </Link>
      </div>
    </div>
  );
}

function SaveButton({ t, disabled }: { t: AdminText; disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rf-press w-full py-3.5 text-[16px] font-semibold disabled:opacity-40"
      style={{
        background: "var(--rf-accent)",
        color: "var(--rf-on-accent)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      {pending ? t.kuva.saving : t.kuva.saveReceipt}
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
    <div
      className={last ? "py-3" : "border-b py-3"}
      style={{ borderColor: "var(--rf-line)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={id}
          className="text-[13px]"
          style={{ color: "var(--rf-text-2)" }}
        >
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
        {suffix ? (
          <span className="text-[17px] font-medium">{suffix}</span>
        ) : null}
      </div>
      {hint ? (
        <p
          className="mt-1 text-[12px]"
          style={{ color: "var(--rf-amber-text)" }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * ALV-kenttä.
 *
 * Kannassa on euromäärä, ei prosentti — se on se luku jonka kirjanpitäjä
 * vähentää, ja se lukee kuitissa sellaisenaan. Prosentti on silti se
 * muoto jossa ALV:tä ajatellaan, joten se on tässä kahdesti:
 *
 *   Painikkeet laskevat euromäärän kannasta silloin kun kuitissa lukee
 *   vain prosentti. Laskettu luku on arvio, joten se merkitään
 *   sellaiseksi — kuitissa oleva senttimäärä voi pyöristyä toisin.
 *
 *   Rivin alla kerrotaan mitä kantaa syötetty euromäärä vastaa. Se
 *   paljastaa näppäilyvirheen heti: 14,0 % ruokakuitissa on oikein,
 *   1,4 % ei.
 *
 * Euromäärää ei koskaan muuteta itsestään. Jos kuitissa lukee summa,
 * se voittaa lasketun — laskettu arvo on apu, ei totuus.
 */
function VatField({
  t,
  totalEuros,
  value,
  onChange,
  category,
  uncertain,
  hint,
}: {
  t: AdminText;
  totalEuros: string;
  value: string;
  onChange: (v: string) => void;
  category: ExpenseCategory | "";
  uncertain?: boolean;
  hint?: string;
}) {
  const [computed, setComputed] = useState(false);

  const totalCents = parseEurosLoose(totalEuros);
  const vatCents = parseEurosLoose(value);

  const inferred =
    totalCents !== null && vatCents !== null
      ? inferVatRate(totalCents, vatCents)
      : null;

  const expected = category === "" ? [] : EXPECTED_VAT_RATES[category];
  const mismatch =
    inferred !== null &&
    category !== "" &&
    !rateMatchesCategory(inferred, category);

  function applyRate(rate: number) {
    if (totalCents === null) return;
    // Bruttosummasta veron osuus: brutto × kanta / (1 + kanta).
    onChange(toEuros(Math.round((totalCents * rate) / (1 + rate))));
    setComputed(true);
  }

  return (
    <div className="border-b py-3" style={{ borderColor: "var(--rf-line)" }}>
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor="f-vat"
          className="text-[13px]"
          style={{ color: "var(--rf-text-2)" }}
        >
          ALV
        </label>
        {uncertain ? <Pill tone="warn">tarkista</Pill> : null}
      </div>

      <div className="mt-1 flex items-baseline gap-1.5">
        <input
          id="f-vat"
          name="vat"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setComputed(false);
          }}
          className="w-full bg-transparent text-[17px] font-medium outline-none"
        />
        <span className="text-[17px] font-medium">€</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {t.kuva.calcFromBase}
        </span>
        {RATE_CHOICES.map((rate) => (
          <button
            key={rate}
            type="button"
            onClick={() => applyRate(rate)}
            disabled={totalCents === null}
            className="rf-press px-2.5 py-1 text-[12px] font-medium disabled:opacity-40"
            style={{
              background: expected.includes(rate)
                ? "var(--rf-accent-bg)"
                : "var(--rf-inset)",
              color: expected.includes(rate)
                ? "var(--rf-accent-strong)"
                : "var(--rf-text-2)",
              borderRadius: 999,
            }}
          >
            {formatRate(rate)}
          </button>
        ))}
      </div>

      {totalCents === null ? (
        <p className="mt-1.5 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {t.kuva.fillTotalFirst}
        </p>
      ) : inferred !== null ? (
        <p
          className="mt-1.5 text-[12px]"
          style={{
            color: mismatch ? "var(--rf-amber-text)" : "var(--rf-text-3)",
          }}
        >
          {computed ? t.kuva.calculated + " " : ""}
          {fill(t.kuva.matchesRate, { kanta: formatRate(inferred) })}
          {mismatch
            ? fill(t.kuva.expectedRate, {
                kannat: expected.map(formatRate).join(t.kuva.orSep),
              })
            : ""}
          .
        </p>
      ) : null}

      {hint ? (
        <p
          className="mt-1 text-[12px]"
          style={{ color: "var(--rf-amber-text)" }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Samat kannat kuin odotustaulukossa, plus nolla. Yksi lähde, ei kopiota. */
const RATE_CHOICES: number[] = [
  0,
  ...Array.from(new Set(Object.values(EXPECTED_VAT_RATES).flat())),
].sort((a, b) => a - b);

/** "14,50" tai "14.50" → 1450. Sama sääntö kuin palvelimen parseEuros. */
function parseEurosLoose(value: string): number | null {
  const raw = value.trim().replace(",", ".").replace(/\s/g, "");
  if (raw === "") return null;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
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
        <label
          htmlFor={id}
          className="text-[13px]"
          style={{ color: "var(--rf-text-2)" }}
        >
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
        <p
          className="mt-1 text-[12px]"
          style={{ color: "var(--rf-amber-text)" }}
        >
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

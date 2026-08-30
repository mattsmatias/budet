"use client";

import { useRef, useState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { RfIcon } from "@/components/restoflow/icons";
import type { TaskDraft } from "@/lib/restoflow/invoice";

/**
 * Laskun luku kuvasta.
 *
 * Painike ja piilotettu tiedostokenttä. Puhelimessa capture avaa
 * kameran suoraan, työpöydällä tiedostovalitsimen — sama elementti
 * molemmissa, koska selain osaa valita oikean.
 *
 * ---------------------------------------------------------------------
 * POIMINTA EI OLE PAKOLLINEN POLKU
 * ---------------------------------------------------------------------
 *
 * Tehtävän voi aina kirjoittaa käsin. Jos poimintaa ei ole kytketty
 * (501), painike katoaa kokonaan eikä käyttäjälle näytetä virhettä:
 * ominaisuus jota ei ole ei ole vika. Jos luku epäonnistuu, kentät
 * jäävät ennalleen ja virhe kerrotaan — lomake ei tyhjene.
 */
export function InvoiceScan({
  t,
  onDraft,
}: {
  t: AdminText;
  onDraft: (draft: TaskDraft, laatu: "good" | "poor") => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  async function lue(files: FileList | null) {
    if (!files || files.length === 0) return;

    setBusy(true);
    setError(null);

    const body = new FormData();
    for (const file of files) body.append("pages", file);

    try {
      const response = await fetch("/api/tehtavat/poiminta", {
        method: "POST",
        body,
      });

      /*
       * 501 tarkoittaa ettei poimintaa ole kytketty. Se ei ole virhe
       * jonka käyttäjä voi korjata, joten painike vain katoaa.
       */
      if (response.status === 501) {
        setHidden(true);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? t.tiimi.scanFailed);
        return;
      }

      onDraft(data.draft as TaskDraft, data.imageQuality ?? "good");
    } catch {
      setError(t.tiimi.scanNetwork);
    } finally {
      setBusy(false);
      /*
       * Kenttä tyhjennetään, jotta saman tiedoston voi valita
       * uudelleen. Ilman tätä toinen yritys samalla kuvalla ei
       * laukaisisi change-tapahtumaa lainkaan.
       */
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="rf-press inline-flex items-center gap-2 px-3 py-2 text-[13px] font-semibold disabled:opacity-60"
        style={{
          background: "var(--rf-inset)",
          color: "var(--rf-text)",
          border: "1px solid var(--rf-line)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <RfIcon name="camera" size={15} />
        {busy ? t.tiimi.scanning : t.tiimi.scanInvoice}
      </button>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        /*
         * capture pyytää takakameraa puhelimessa. Työpöydällä selain
         * ohittaa sen ja näyttää tavallisen valitsimen.
         */
        capture="environment"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => lue(event.target.files)}
      />

      {error ? (
        <p
          role="alert"
          className="mt-2 text-[12.5px]"
          style={{ color: "var(--rf-red-text)" }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Mitä poiminnasta seurasi.
 *
 * Näytetään lomakkeen sisällä, koska se koskee juuri täytettyjä
 * kenttiä. Epävarmat kentät luetellaan nimeltä: "tarkista tiedot" on
 * neuvo jota ei voi noudattaa, "tarkista eräpäivä ja viite" on.
 */
export function ScanNotice({
  t,
  draft,
  quality,
}: {
  t: AdminText;
  draft: TaskDraft;
  quality: "good" | "poor";
}) {
  const nimet: Record<string, string> = {
    supplier: t.tiimi.scanFieldSupplier,
    dueDate: t.tiimi.scanFieldDueDate,
    totalCents: t.tiimi.scanFieldTotal,
    reference: t.tiimi.scanFieldReference,
    iban: t.tiimi.scanFieldIban,
  };

  const epavarmat = draft.uncertain
    .map((key) => nimet[key])
    .filter((name): name is string => Boolean(name));

  const huono = quality === "poor";

  return (
    <p
      role="status"
      className="text-[12.5px]"
      style={{
        color: epavarmat.length > 0 || huono
          ? "var(--rf-amber-text)"
          : "var(--rf-green-text)",
      }}
    >
      {epavarmat.length > 0
        ? fill(t.tiimi.scanCheckFields, { kentat: epavarmat.join(", ") })
        : huono
          ? t.tiimi.scanPoorImage
          : t.tiimi.scanDone}
    </p>
  );
}

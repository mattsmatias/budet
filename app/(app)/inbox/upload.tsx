"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { uploadDocument, type UploadState } from "./actions";

const initial: UploadState = {};

export function UploadDropzone({ enabled }: { enabled: boolean }) {
  const [state, formAction] = useActionState(uploadDocument, initial);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (!enabled) return;

    const dropped = event.dataTransfer.files?.[0];
    if (!dropped || !inputRef.current) return;

    // DataTransfer siirretään input-elementtiin, jotta lomake lähettää
    // saman tiedoston kuin mikä pudotettiin.
    const transfer = new DataTransfer();
    transfer.items.add(dropped);
    inputRef.current.files = transfer.files;
    setFileName(dropped.name);
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (enabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={[
          "rounded-lg border-2 border-dashed px-5 py-8 text-center transition",
          dragging ? "border-gold-400 bg-gold-100/40" : "border-line",
          enabled ? "" : "opacity-60",
        ].join(" ")}
      >
        <p className="text-sm font-medium">
          {enabled ? "Vedä kuitti tai lasku tähän" : "Kirjaudu lähettääksesi dokumentteja"}
        </p>
        <p className="mt-1 text-xs text-muted">PDF, JPG, PNG tai HEIC · enintään 20 Mt</p>

        <label
          className={[
            "mt-4 inline-block rounded-md px-4 py-2 text-sm font-semibold",
            enabled
              ? "cursor-pointer bg-gold-400 text-navy-900 hover:bg-gold-300"
              : "cursor-not-allowed bg-navy-100 text-muted",
          ].join(" ")}
        >
          Valitse tiedosto
          <input
            ref={inputRef}
            type="file"
            name="file"
            accept=".pdf,.jpg,.jpeg,.png,.heic,.heif"
            disabled={!enabled}
            className="sr-only"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              if (!picked) return;
              setFileName(picked.name);
              formRef.current?.requestSubmit();
            }}
          />
        </label>

        {fileName ? (
          <p className="mt-3 text-xs text-muted">{fileName}</p>
        ) : null}

        <Pending />
      </div>

      {state.error ? (
        <p role="alert" className="mt-3 rounded-md bg-risk-100 px-3 py-2 text-sm text-risk-600">
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" className="mt-3 rounded-md bg-ok-100 px-3 py-2 text-sm text-ok-600">
          {state.notice}
        </p>
      ) : null}
    </form>
  );
}

function Pending() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <p className="mt-3 text-sm text-muted" role="status">
      Luetaan dokumenttia ja ajetaan sääntömoottori…
    </p>
  );
}

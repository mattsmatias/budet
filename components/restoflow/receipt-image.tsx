"use client";

import { useState } from "react";
import { RfIcon } from "@/components/restoflow/icons";

/**
 * Kuitin kuva.
 *
 * Klikkaus suurentaa koko ruudulle: pienestä esikatselusta ei voi lukea
 * kuitin rivejä, ja juuri siihen kuvaa tarvitaan tarkistuksessa.
 *
 * Osoite on allekirjoitettu ja vanhenee tunnissa, joten sivu on
 * ladattava uudelleen jos se on ollut kauan auki. Se on parempi kuin
 * pysyvä linkki ravintolan kuittikuvaan.
 */
export function ReceiptImage({ url, alt }: { url: string; alt: string }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <p className="text-[13px]" style={{ color: "var(--rf-text-3)" }}>
        Kuvaa ei voitu ladata. Osoite on voinut vanhentua — lataa sivu
        uudelleen.
      </p>
    );
  }

  const isPdf = url.includes(".pdf");

  if (isPdf) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="rf-press flex items-center justify-center gap-2 py-3 text-[14px] font-semibold"
        style={{
          background: "var(--rf-inset)",
          color: "var(--rf-text)",
          borderRadius: "var(--rf-r-control)",
        }}
      >
        <RfIcon name="file" size={17} />
        Avaa PDF
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rf-press block w-full overflow-hidden"
        style={{ borderRadius: "var(--rf-r-control)", background: "var(--rf-inset)" }}
        aria-label="Suurenna kuitin kuva"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt}
          onError={() => setFailed(true)}
          className="block h-auto w-full"
          style={{ maxHeight: "22rem", objectFit: "contain" }}
        />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Kuitin kuva"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.82)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={alt}
            className="max-h-full max-w-full"
            style={{ objectFit: "contain" }}
          />

          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Sulje"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center"
            style={{ background: "rgba(255,255,255,0.16)", color: "#fff", borderRadius: "50%" }}
          >
            <span style={{ transform: "rotate(45deg)", display: "block" }}>
              <RfIcon name="plus" size={20} />
            </span>
          </button>
        </div>
      ) : null}
    </>
  );
}

"use client";

import { useState } from "react";
import { RfIcon } from "@/components/restoflow/icons";

/**
 * Kuitin sivut.
 *
 * Klikkaus suurentaa koko ruudulle: pienestä esikatselusta ei voi lukea
 * kuitin rivejä, ja juuri siihen kuvaa tarvitaan tarkistuksessa.
 *
 * MONISIVUINEN KUITTI ON YKSI KUITTI.
 *
 * Tukkulasku on usein kolme sivua, ja loppusumma on viimeisellä.
 * Sivut näkyvät siksi samassa kortissa numeroituna eikä erillisinä
 * liitteinä: jos sivu 3 ei näy, tarkistaja vertaa summaa sivuun jossa
 * sitä ei ole.
 *
 * Osoitteet on allekirjoitettu ja ne vanhenevat tunnissa, joten sivu on
 * ladattava uudelleen jos se on ollut kauan auki. Se on parempi kuin
 * pysyvä linkki ravintolan kuittikuvaan.
 */
export function ReceiptImage({ urls, alt }: { urls: string[]; alt: string }) {
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState<Set<number>>(new Set());

  if (urls.length === 0) return null;

  // Sivu voi jäädä alueen ulkopuolelle jos lista lyhenee päivityksessä.
  const index = Math.min(page, urls.length - 1);
  const url = urls[index];
  const isPdf = url.includes(".pdf");
  const label = urls.length > 1 ? `${alt}, sivu ${index + 1}` : alt;

  function step(delta: number) {
    setPage((current) => {
      const next = current + delta;
      // Kierrätys eikä pysähdys: sivujen selaaminen ympäri on
      // nopeampaa kuin peruuttaminen alkuun.
      return (next + urls.length) % urls.length;
    });
  }

  return (
    <>
      {failed.has(index) ? (
        <p className="text-[13px]" style={{ color: "var(--rf-text-3)" }}>
          Sivua ei voitu ladata. Osoite on voinut vanhentua — lataa sivu
          uudelleen.
        </p>
      ) : isPdf ? (
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
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rf-press block w-full overflow-hidden"
          style={{ borderRadius: "var(--rf-r-control)", background: "var(--rf-inset)" }}
          aria-label={`Suurenna ${label.toLowerCase()}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={label}
            onError={() => setFailed((current) => new Set(current).add(index))}
            className="block h-auto w-full"
            style={{ maxHeight: "22rem", objectFit: "contain" }}
          />
        </button>
      )}

      {urls.length > 1 ? (
        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {urls.map((pageUrl, i) => (
            <button
              key={pageUrl}
              type="button"
              onClick={() => setPage(i)}
              className="rf-press relative h-16 w-12 shrink-0 overflow-hidden"
              style={{
                borderRadius: "var(--rf-r-control)",
                background: "var(--rf-inset)",
                /* Valittu sivu erottuu reunuksella, ei vain kirkkaudella:
                   pelkkä läpinäkyvyysero katoaa vaalealla näytöllä. */
                outline: i === index ? "2px solid var(--rf-accent)" : "none",
                outlineOffset: "1px",
                opacity: i === index ? 1 : 0.6,
              }}
              aria-label={`Näytä sivu ${i + 1}`}
              aria-current={i === index}
            >
              {pageUrl.includes(".pdf") ? (
                <span
                  className="flex h-full w-full items-center justify-center"
                  style={{ color: "var(--rf-text-3)" }}
                >
                  <RfIcon name="file" size={16} />
                </span>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={pageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}

              <span
                className="rf-tabular pointer-events-none absolute bottom-0.5 left-0.5 px-1 text-[10px] font-medium"
                style={{
                  background: "rgba(0,0,0,0.62)",
                  color: "#fff",
                  borderRadius: "4px",
                }}
              >
                {i + 1}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          onClick={() => setOpen(false)}
          className="fixed inset-0 rf-z-modal flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.82)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={label}
            className="max-h-full max-w-full"
            style={{ objectFit: "contain" }}
          />

          {urls.length > 1 ? (
            <>
              {/* Selaus tapahtuu suurennettuna: juuri siinä sivuja
                  luetaan, eikä näkymää pidä sulkea sivun vaihtamiseksi. */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                aria-label="Edellinen sivu"
                className="absolute left-4 flex h-11 w-11 items-center justify-center"
                style={{ background: "rgba(255,255,255,0.16)", color: "#fff", borderRadius: "50%" }}
              >
                <RfIcon name="back" size={20} />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                aria-label="Seuraava sivu"
                className="absolute right-4 flex h-11 w-11 items-center justify-center"
                style={{ background: "rgba(255,255,255,0.16)", color: "#fff", borderRadius: "50%" }}
              >
                <RfIcon name="chevron" size={20} />
              </button>

              <p className="rf-tabular absolute bottom-6 text-[13px] text-white/80">
                Sivu {index + 1} / {urls.length}
              </p>
            </>
          ) : null}

          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Sulje"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center"
            style={{ background: "rgba(255,255,255,0.16)", color: "var(--rf-on-accent)", borderRadius: "50%" }}
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

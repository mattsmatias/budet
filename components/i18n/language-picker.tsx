"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  LOCALE_INFO,
  localesForMenu,
  type AppLocale,
} from "@/lib/i18n/app-locales";
import { chooseLocale } from "./actions";

/**
 * Kielivalitsin.
 *
 * YKSI VALITSIN KOKO SOVELLUKSEEN.
 *
 * Sama komponentti kirjautumisessa, työntekijän näkymässä,
 * hallinnassa ja asetuksissa. Kolme eri valitsinta tarkoittaisi kolme
 * paikkaa joissa uusi kieli pitää muistaa lisätä.
 *
 * KOLMEKYMMENTÄ KIELTÄ EI MAHDU LISTAAN.
 *
 * Valikossa on hakukenttä. Ilman sitä turkkia etsivä vierittää
 * kahdenkymmenen kielen ohi, ja kolmenkymmenen rivin lista on
 * puhelimessa kaksi ruudullista.
 */
export function LanguagePicker({
  current,
  align = "right",
}: {
  current: AppLocale;
  /** Kumpaan suuntaan valikko aukeaa. Kapeassa palkissa oikealle. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);

    // Kohdistus hakuun: kolmenkymmenen kielen listassa kirjoittaminen
    // on nopeampaa kuin vierittäminen.
    search.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const all = localesForMenu();
  const q = query.trim().toLowerCase();
  const shown = q === ""
    ? all
    : all.filter(
        (l) => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q),
      );

  function pick(code: AppLocale) {
    setOpen(false);
    setQuery("");

    /*
     * Tallennus ja uudelleenpiirto samassa siirtymässä.
     *
     * Kieli tallennetaan profiiliin ja evästeeseen palvelimella, ja
     * router.refresh() piirtää näkymän uudelleen uudella kielellä.
     * Koko sivun lataus toimisi myös, mutta se vilkuttaisi.
     */
    startTransition(async () => {
      await chooseLocale(code);
      router.refresh();
    });
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${LOCALE_INFO[current].name}`}
        disabled={pending}
        className="rf-press flex h-10 items-center gap-1.5 px-2.5 text-[14px] font-medium"
        style={{
          background: "var(--rf-card)",
          color: "var(--rf-text-2)",
          border: "1px solid var(--rf-line)",
          borderRadius: "var(--rf-r-control)",
          opacity: pending ? 0.6 : 1,
        }}
      >
        <Globe />
        <span className="hidden sm:inline">{LOCALE_INFO[current].name}</span>
        <span className="sm:hidden">{current.toUpperCase()}</span>
      </button>

      {open ? (
        <div
          className="absolute z-50 mt-2 w-60 overflow-hidden"
          style={{
            [align === "right" ? "right" : "left"]: 0,
            background: "var(--rf-card)",
            border: "1px solid var(--rf-line)",
            borderRadius: "var(--rf-r-control)",
            boxShadow: "var(--rf-shadow-lg)",
          }}
        >
          <div className="p-1.5 pb-0">
            <input
              ref={search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="…"
              aria-label={LOCALE_INFO[current].name}
              className="w-full px-3 py-2 text-[14px] outline-none"
              style={{
                background: "var(--rf-inset)",
                borderRadius: 9,
                color: "var(--rf-text)",
              }}
            />
          </div>

          <ul role="listbox" className="max-h-[18rem] overflow-y-auto p-1.5">
            {shown.map((l) => (
              <li key={l.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={l.code === current}
                  onClick={() => pick(l.code)}
                  /*
                   * Kielen nimi omalla kirjoitussuunnallaan.
                   *
                   * Ilman tätä "العربية" asettuisi vasempaan reunaan
                   * keskellä latinalaista listaa ja näyttäisi
                   * rikkinäiseltä.
                   */
                  dir={LOCALE_INFO[l.code].dir}
                  className="flex w-full items-center justify-between gap-2 rounded-[8px] px-3 py-2 text-left text-[14px]"
                  style={
                    l.code === current
                      ? {
                          background: "var(--rf-accent-bg)",
                          color: "var(--rf-accent-strong)",
                          fontWeight: 600,
                        }
                      : { color: "var(--rf-text)" }
                  }
                >
                  <span className="truncate">{l.name}</span>
                  {l.code === current ? <Tick /> : null}
                </button>
              </li>
            ))}

            {shown.length === 0 ? (
              <li
                className="px-3 py-3 text-[13px]"
                style={{ color: "var(--rf-text-3)" }}
              >
                —
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Globe() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 1.8c1.7 1.7 2.6 3.9 2.6 6.2S9.7 12.5 8 14.2C6.3 12.5 5.4 10.3 5.4 8S6.3 3.5 8 1.8ZM2 8h12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Tick() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="m3.5 8.5 3 3 6-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

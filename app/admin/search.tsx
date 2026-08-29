"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RfIcon, type IconName } from "@/components/restoflow/icons";
import { useDismiss } from "@/components/restoflow/use-dismiss";
import type { AdminText } from "@/lib/i18n/admin-text";

/**
 * Haku.
 *
 * HAKULAATIKKO ON LUPAUS.
 *
 * Yläpalkin hakukenttä lupaa että kirjoittamalla löytää. Tyhjä kenttä
 * joka ei tee mitään on huonompi kuin puuttuva kenttä: käyttäjä yrittää
 * sitä kerran, ei löydä, eikä yritä enää mitään muutakaan.
 *
 * Siksi tämä hakee oikeasti — sivut, toimittajat ja työntekijät. Ne
 * ovat jo muistissa hallintakuoren aineistossa, joten haku ei tee
 * yhtään kyselyä eikä hidasta mitään.
 *
 * Kuitit puuttuvat tarkoituksella. Ne vaatisivat oman kyselynsä joka
 * kirjoitetulla merkillä, ja kuittien etsimiseen on oma sivunsa jossa
 * on suodattimet. Puoliksi tehty kuittihaku veisi ihmiset pois siitä.
 */

export interface SearchItem {
  id: string;
  label: string;
  /** Toimittajan toimiala, työntekijän asema, sivun osasto. */
  detail: string;
  href: string;
  icon: IconName;
  group: string;
}

/** Montako osumaa näytetään. Pidempi lista ei ole enää hakutulos. */
const LIMIT = 8;

export function Search({ items, t }: { items: SearchItem[]; t: AdminText }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  /*
   * Sulkeminen nollaa haun.
   *
   * Tämä oli tehosteessa joka katsoi open-tilaa. Tehoste on
   * synkronointia ulkomaailman kanssa; hakukentän tyhjentäminen on
   * seuraus käyttäjän toiminnasta, ja se kuuluu siihen kohtaan jossa
   * toiminto tapahtuu.
   */
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  const container = useDismiss<HTMLDivElement>(open, close);

  /*
   * Näppäinvihje luetaan selaimesta vasta asiakkaalla, joten palvelimen
   * ja selaimen piirros eroavat yhden tekstisolmun verran. Se on
   * tarkoitus eikä virhe — sama ratkaisu kuin leimauskortin kellossa.
   */
  const [mac] = useState(() =>
    typeof navigator === "undefined"
      ? false
      : /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const results = useMemo(() => match(items, query), [items, query]);

  const go = (href: string) => {
    close();
    router.push(href);
  };

  return (
    <div ref={container} className="relative">
      {/*
        Painike näyttää kentältä, koska se on hakupalkin paikka.

        Pyöreä ikoni vei vähemmän tilaa mutta ei kertonut mistä
        haetaan. Leveä kenttä nimeää kohteet — kuitit, toimittajat,
        työntekijät — ja se on hakukentän ainoa tehtävä ennen kuin
        siihen kirjoitetaan mitään.
      */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Haku"
        title={mac ? "Haku (⌘K)" : "Haku (Ctrl K)"}
        className="rf-press hidden w-[340px] shrink items-center gap-[9px] px-[13px] py-2 text-left text-[14px] xl:flex"
        style={{
          background: "var(--rf-inset)",
          border: "1px solid var(--rf-line)",
          borderRadius: "var(--rf-r-control)",
          color: "var(--rf-text-3)",
        }}
      >
        <RfIcon name="search" size={16} />
        <span className="min-w-0 flex-1 truncate">
          {t.kuori.searchPlaceholder}
        </span>
        <kbd
          suppressHydrationWarning
          className="shrink-0 px-1.5 py-0.5 text-[11px] font-medium"
          style={{
            background: "var(--rf-card)",
            border: "1px solid var(--rf-line)",
            color: "var(--rf-text-3)",
            borderRadius: 6,
            fontFamily: "inherit",
          }}
        >
          {mac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>

      {/*
        Kapealla työpöydällä pelkkä ikoni.

        Kenttä on 340 px, ja se työnsi vasemman reunan otsikon
        nollaan asti — sivun nimi katosi kokonaan. Kenttä palaa heti
        kun tilaa on; siihen asti ikoni kertoo saman asian eikä vie
        muilta.
      */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Haku"
        title={mac ? "Haku (⌘K)" : "Haku (Ctrl K)"}
        className="rf-press flex h-10 w-10 shrink-0 items-center justify-center xl:hidden"
        style={{
          background: "var(--rf-inset)",
          color: "var(--rf-text-2)",
          borderRadius: "50%",
        }}
      >
        <RfIcon name="search" size={17} />
      </button>

      {open ? (
        <div
          className="rf-z-menu absolute right-0 top-[calc(100%+10px)] w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden"
          style={{
            background: "var(--rf-card)",
            border: "1px solid var(--rf-line)",
            borderRadius: "var(--rf-r-card)",
            boxShadow: "var(--rf-shadow-lg)",
          }}
        >
          <div
            className="flex items-center gap-2.5 px-4 py-3"
            style={{ borderBottom: "1px solid var(--rf-line)" }}
          >
            <span style={{ color: "var(--rf-text-3)" }}>
              <RfIcon name="search" size={16} />
            </span>
            <input
              ref={input}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") close();
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActive((i) => Math.min(i + 1, results.length - 1));
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                }
                if (event.key === "Enter" && results[active]) {
                  event.preventDefault();
                  go(results[active].href);
                }
              }}
              placeholder="Etsi…"
              aria-label="Haku"
              className="w-full bg-transparent text-[15px] outline-none"
            />
            <kbd
              suppressHydrationWarning
              className="shrink-0 px-1.5 py-0.5 text-[11px] font-medium"
              style={{
                background: "var(--rf-inset)",
                color: "var(--rf-text-3)",
                borderRadius: 6,
                fontFamily: "inherit",
              }}
            >
              {mac ? "⌘K" : "Ctrl K"}
            </kbd>
          </div>

          {results.length === 0 ? (
            <p
              className="px-4 py-5 text-[13px]"
              style={{ color: "var(--rf-text-3)" }}
            >
              {query.trim() === ""
                ? t.kuori.searchHint
                : `Ei osumaa haulle “${query.trim()}”.`}
            </p>
          ) : (
            <ul className="max-h-[min(60vh,380px)] overflow-y-auto py-1.5">
              {results.map((item, index) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={close}
                    onMouseEnter={() => setActive(index)}
                    className="flex items-center gap-3 px-4 py-2.5"
                    style={{
                      background:
                        index === active ? "var(--rf-inset)" : "transparent",
                    }}
                  >
                    <span
                      className="shrink-0"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      <RfIcon name={item.icon} size={16} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">
                        {item.label}
                      </span>
                      <span
                        className="block truncate text-[12px]"
                        style={{ color: "var(--rf-text-3)" }}
                      >
                        {item.detail}
                      </span>
                    </span>

                    <span
                      className="shrink-0 text-[11px] font-medium uppercase"
                      style={{
                        color: "var(--rf-text-3)",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {item.group}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Osumat.
 *
 * Alkuosuma ennen keskeltä osumaa: "Kes" tarkoittaa todennäköisemmin
 * Kesproa kuin "Ruokakeskus". Ilman tätä lajittelua oikea toimittaja
 * saattoi jäädä listan hännille aakkosjärjestyksen takia.
 *
 * Tyhjä haku näyttää sivut. Se on tyhjän tilan tehtävä: kertoa mitä
 * täällä voi tehdä, ei olla tyhjä.
 */
function match(items: SearchItem[], query: string): SearchItem[] {
  const needle = query.trim().toLowerCase();

  if (needle === "") {
    return items.filter((item) => item.group === "Sivu").slice(0, LIMIT);
  }

  return items
    .map((item) => ({ item, at: item.label.toLowerCase().indexOf(needle) }))
    .filter(
      ({ item, at }) => at >= 0 || item.detail.toLowerCase().includes(needle),
    )
    .sort((a, b) => {
      const rank = (at: number) => (at === 0 ? 0 : at > 0 ? 1 : 2);
      return (
        rank(a.at) - rank(b.at) ||
        a.item.label.localeCompare(b.item.label, "fi")
      );
    })
    .slice(0, LIMIT)
    .map(({ item }) => item);
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import type { SearchScope } from "@/lib/restoflow/reservation-queries";
import { RfIcon } from "@/components/restoflow/icons";

/**
 * Suodatus ja haku.
 *
 * Osoiterivi on tila. Kirjoitettu nimi ja valittu jakso ovat
 * hakuparametreja eivätkä komponentin muistia, jotta listan voi
 * linkittää ja paluunappi vie edelliseen hakuun eikä ulos sivulta.
 *
 * ---------------------------------------------------------------------
 * MIKSI HAKU ODOTTAA
 * ---------------------------------------------------------------------
 *
 * Jokainen näppäinpainallus on palvelinkysely, ja "Virtanen" olisi
 * kahdeksan kyselyä joista seitsemän on turhia. Kolmensadan
 * millisekunnin odotus on lyhyempi kuin kirjoittamisen tauko ja
 * pidempi kuin kahden kirjaimen väli.
 */
export function SearchForm({
  t,
  scope,
  date,
  query,
}: {
  t: AdminText;
  scope: SearchScope;
  date: string;
  query: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [teksti, setTeksti] = useState(query);
  const eka = useRef(true);

  useEffect(() => {
    /*
     * Ensimmäinen ajo ei hae uudelleen.
     *
     * Palvelin on jo hakenut sen mitä osoitteessa luki. Ilman tätä sivu
     * hakisi itsensä uudelleen heti auettuaan.
     */
    if (eka.current) {
      eka.current = false;
      return;
    }

    const ajastin = setTimeout(() => {
      const seuraava = new URLSearchParams(params.toString());

      if (teksti.trim()) seuraava.set("haku", teksti.trim());
      else seuraava.delete("haku");

      /* Uusi haku alkaa ensimmäiseltä sivulta. */
      seuraava.delete("sivu");

      router.replace(`/admin/varaukset/lista?${seuraava.toString()}`);
    }, 300);

    return () => clearTimeout(ajastin);
  }, [teksti, params, router]);

  function vaihda(next: Partial<{ nakyma: string; pvm: string }>): void {
    const seuraava = new URLSearchParams(params.toString());

    for (const [avain, arvo] of Object.entries(next)) {
      if (arvo) seuraava.set(avain, arvo);
    }

    seuraava.delete("sivu");
    router.replace(`/admin/varaukset/lista?${seuraava.toString()}`);
  }

  const jaksot: { id: SearchScope; label: string }[] = [
    { id: "upcoming", label: t.varausLista.scopeUpcoming },
    { id: "past", label: t.varausLista.scopePast },
    { id: "day", label: t.varausLista.scopeDay },
    { id: "all", label: t.varausLista.scopeAll },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {jaksot.map((jakso) => {
          const on = jakso.id === scope;

          return (
            <button
              key={jakso.id}
              type="button"
              aria-pressed={on}
              onClick={() => vaihda({ nakyma: jakso.id })}
              className="rf-press px-3.5 py-2 text-[13px] font-bold"
              style={{
                background: on ? "var(--rf-accent-bg)" : "var(--rf-card)",
                color: on ? "var(--rf-accent-strong)" : "var(--rf-text-2)",
                border: "1px solid var(--rf-line)",
                borderRadius: 999,
              }}
            >
              {jakso.label}
            </button>
          );
        })}

        {scope === "day" ? (
          <input
            type="date"
            value={date}
            aria-label={t.varaus.pickDay}
            onChange={(event) => vaihda({ pvm: event.target.value })}
            className="px-3 py-2 text-[13px] outline-none"
            style={{
              background: "var(--rf-inset)",
              borderRadius: "var(--rf-r-control)",
            }}
          />
        ) : null}
      </div>

      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
          style={{ color: "var(--rf-text-3)" }}
        >
          <RfIcon name="search" size={16} />
        </span>

        <input
          type="search"
          value={teksti}
          onChange={(event) => setTeksti(event.target.value)}
          placeholder={t.varausLista.searchPlaceholder}
          aria-label={t.varausLista.searchLabel}
          maxLength={80}
          className="w-full py-2.5 pr-3.5 pl-9 text-[16px] outline-none"
          style={{
            background: "var(--rf-inset)",
            borderRadius: "var(--rf-r-control)",
          }}
        />
      </div>
    </div>
  );
}

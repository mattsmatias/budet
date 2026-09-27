"use client";

import { useCallback, useState } from "react";
import { RfIcon } from "@/components/restoflow/icons";
import { useDismiss } from "@/components/restoflow/use-dismiss";
import { switchRestaurant } from "./actions";

/**
 * Yrityksen vaihtaja.
 *
 * NÄKYY VAIN JOS YRITYKSIÄ ON USEAMPI.
 *
 * Yhden yrityksen omistajalle valikko olisi kysymys johon on yksi
 * vastaus. Kahden toimipisteen omistajalle sen puuttuminen tarkoitti
 * ettei toiseen päässyt lainkaan: valinta oli evästeessä, jota
 * käyttöliittymä ei koskaan muuttanut.
 *
 * OMA VALIKKO, EI NATIIVIA SELECTIÄ.
 *
 * Tässä oli ensin natiivi select. Se on sama virhe joka tehtiin
 * kerran kuukausivalitsimessa: työpöydällä selain piirtää
 * vaihtoehdot omalla tyylillään, eikä sitä voi CSS:llä muuttaa —
 * harmaa järjestelmävalikko keskellä muuten yhtenäistä näkymää.
 * Toteutus on nyt sama listbox-kuvio kuin kuukaudella.
 *
 * KISKOSSA, EI YLÄPALKISSA.
 *
 * Tämä oli ensin yläpalkissa omana sirunaan sivun otsikon yllä.
 * Siinä se oli toinen paikka jossa luki yrityksen nimi: kiskon
 * tunnuslohkossa luki jo sama nimi Katen alla. Kaksi paikkaa samalle
 * tiedolle tarkoittaa että lukija joutuu päättelemään kumpi niistä
 * on se jota voi painaa. Nyt nimi on yhdessä paikassa ja se paikka
 * on se jota painetaan.
 *
 * TUNNUSRIVIN KOKOINEN, EI SÄÄTIMEN.
 *
 * Yrityksen nimi on kontekstia eikä päivittäin käytettävä säädin,
 * joten se pysyy saman kokoisena ja värisenä kuin rivi jolla se on.
 * Vain osoitin ja hiiren alla syttyvä tausta kertovat että sitä voi
 * painaa.
 *
 * EVÄSTE EI ANNA PÄÄSYÄ.
 *
 * Palvelin tarkistaa jäsenyyden ennen kuin eväste kirjoitetaan, ja
 * jokainen sivu tarkistaa sen uudelleen. Tämä valikko on siis
 * mukavuus, ei portti.
 */
/**
 * Kiskon alarivin mitat.
 *
 * Sama koko, paino ja kirjainväli kuin tunnuslohkon tekstillä oli
 * ennen kuin siitä tuli painike: lockup ei saa muuttua siitä että
 * sen alarivi on nyt painettava.
 */
const RIVI =
  "-ms-1.5 flex w-full min-w-0 items-center gap-1 rounded-[7px] px-1.5 py-[3px] text-[10.5px] font-bold uppercase";

const KIRJAINVALI = { letterSpacing: "0.07em" } as const;

export function CompanySwitcher({
  current,
  companies,
  label,
}: {
  /** Valitun yrityksen tunniste. */
  current: string;
  companies: { id: string; name: string }[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() =>
    Math.max(0, companies.findIndex((c) => c.id === current)),
  );

  const close = useCallback(() => setOpen(false), []);
  const container = useDismiss<HTMLSpanElement>(open, close);

  /*
   * Yhden yrityksen omistajalle pelkkä nimi.
   *
   * Sama rivi ja sama tyyli kuin painikkeessa, jotta tunnuslohko ei
   * hyppää kun toinen yritys joskus lisätään — vain osoitin ja
   * nuoli tulevat lisää.
   */
  if (companies.length < 2) {
    return (
      <span className={RIVI} style={{ ...KIRJAINVALI, color: "var(--rf-text-3)" }}>
        <span className="truncate">{companies[0]?.name ?? ""}</span>
      </span>
    );
  }

  const nykyinen =
    companies.find((c) => c.id === current)?.name ?? companies[0].name;

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter") {
        event.preventDefault();
        setActive(Math.max(0, companies.findIndex((c) => c.id === current)));
        setOpen(true);
      }
      return;
    }

    const last = companies.length - 1;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((n) => Math.min(n + 1, last));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((n) => Math.max(n - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        event.preventDefault();
        setActive(last);
        break;
      default:
        break;
    }
  }

  return (
    <span ref={container} className="block" onKeyDown={onKeyDown}>
      <button
        type="button"
        onClick={() => {
          setActive(Math.max(0, companies.findIndex((c) => c.id === current)));
          setOpen((n) => !n);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className={`rf-press ${RIVI}`}
        style={{
          ...KIRJAINVALI,
          color: open ? "var(--rf-text)" : "var(--rf-text-3)",
          background: open ? "var(--rf-inset)" : "transparent",
        }}
      >
        <span className="truncate">{nykyinen}</span>
        <span
          aria-hidden="true"
          className="shrink-0"
          style={{
            display: "block",
            transform: open ? "rotate(-90deg)" : "rotate(90deg)",
            transition: "transform 160ms ease",
          }}
        >
          <RfIcon name="chevron" size={12} />
        </span>
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={label}
          /*
            Valikko kiskon levyinen, ei painikkeen levyinen.

            Tässä oli kiinteä 240 pikseliä ja ankkuri painikkeessa,
            joka alkaa merkin jälkeen sisennettynä. Valikko alkoi siis
            liian oikealta ja jatkui 66 pikseliä kiskon ulkopuolelle
            sisällön päälle: se näytti irralliselta laatikolta joka
            leikkaa sekä navigaation että ensimmäisen kortin.

            Ankkuri on nyt tunnuslohko ja reunat samassa linjassa
            navigaation rivien kanssa, joten valikko on kiskon osa.
          */
          className="rf-enter absolute start-3 end-3 top-[calc(100%+2px)] z-40 max-h-[17rem] overflow-y-auto p-1.5"
          style={{
            background: "var(--rf-card)",
            border: "1px solid var(--rf-line)",
            borderRadius: "var(--rf-r-control)",
            boxShadow: "var(--rf-shadow-lg)",
          }}
        >
          {companies.map((company, index) => {
            const selected = company.id === current;
            const highlighted = index === active;

            return (
              <li key={company.id}>
                {/*
                  Oma lomake riviä kohti.

                  Painike kantaa arvon itse, joten piilokenttää ei
                  tarvita — ja ilman javascriptiä valinta on yhä
                  tavallinen lomakkeen lähetys.
                */}
                <form action={switchRestaurant}>
                  <button
                    type="submit"
                    name="restaurantId"
                    value={company.id}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActive(index)}
                    className="rf-press flex w-full items-center justify-between gap-3 rounded-[9px] px-3 py-2.5 text-start text-[14px]"
                    style={{
                      background: selected
                        ? "var(--rf-accent-bg)"
                        : highlighted
                          ? "var(--rf-inset)"
                          : "transparent",
                      color: selected
                        ? "var(--rf-accent-strong)"
                        : "var(--rf-text)",
                      fontWeight: selected ? 600 : 400,
                    }}
                  >
                    <span className="truncate">{company.name}</span>

                    {/* Valinta ei näy pelkkänä värinä. */}
                    {selected ? <RfIcon name="check" size={15} /> : null}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : null}
    </span>
  );
}

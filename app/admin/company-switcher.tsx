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
 * TUNNUSRIVIN KOKOINEN, EI SÄÄTIMEN.
 *
 * Yrityksen nimi on yläpalkissa kontekstia eikä päivittäin
 * käytettävä säädin, joten se pysyy saman kokoisena ja värisenä kuin
 * rivi jolla se on. Vain osoitin ja hiiren alla syttyvä tausta
 * kertovat että sitä voi painaa.
 *
 * EVÄSTE EI ANNA PÄÄSYÄ.
 *
 * Palvelin tarkistaa jäsenyyden ennen kuin eväste kirjoitetaan, ja
 * jokainen sivu tarkistaa sen uudelleen. Tämä valikko on siis
 * mukavuus, ei portti.
 */
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

  if (companies.length < 2) {
    return <>{companies[0]?.name ?? ""}</>;
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
    <span ref={container} className="relative inline-block" onKeyDown={onKeyDown}>
      <button
        type="button"
        onClick={() => {
          setActive(Math.max(0, companies.findIndex((c) => c.id === current)));
          setOpen((n) => !n);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className="rf-press -ms-1.5 inline-flex max-w-[14rem] items-center gap-1 rounded-[7px] px-1.5 py-0.5 text-[11.5px]"
        style={{
          color: open ? "var(--rf-text)" : "inherit",
          background: open ? "var(--rf-inset)" : "transparent",
        }}
      >
        <span className="truncate">{nykyinen}</span>
        <span
          aria-hidden="true"
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
          className="rf-enter absolute start-0 top-[calc(100%+6px)] z-40 max-h-[17rem] w-60 overflow-y-auto p-1.5"
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

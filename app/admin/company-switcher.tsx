"use client";

import { useRef } from "react";
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
 * VALIKKO EIKÄ OMA VALIKKORAKENNE.
 *
 * Tavallinen select avautuu puhelimessa järjestelmän omana
 * valitsimena ja toimii näppäimistöllä ilman että mitään tarvitsee
 * kirjoittaa itse. Valinta lähettää lomakkeen heti — erillinen
 * "Vaihda"-painike olisi toinen klikkaus samaan päätökseen.
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
  current: string;
  companies: { id: string; name: string }[];
  label: string;
}) {
  const form = useRef<HTMLFormElement>(null);

  if (companies.length < 2) return null;

  return (
    <form action={switchRestaurant} ref={form} className="inline">
      <select
        name="restaurantId"
        defaultValue={current}
        aria-label={label}
        onChange={() => form.current?.requestSubmit()}
        className="rf-press max-w-[12rem] truncate bg-transparent text-[11.5px] outline-none"
        style={{ color: "var(--rf-text-3)" }}
      >
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>

      {/* Ilman javascriptiä valinta tarvitsee oman painikkeensa. */}
      <noscript>
        <button type="submit" className="ms-1 text-[11.5px] underline">
          {label}
        </button>
      </noscript>
    </form>
  );
}

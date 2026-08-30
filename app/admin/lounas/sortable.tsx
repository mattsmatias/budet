"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { RfIcon } from "@/components/restoflow/icons";
import { reorderLunchItems } from "./actions";

/**
 * Päivän ruokien järjestäminen raahaamalla.
 *
 * ---------------------------------------------------------------------
 * MIKSI POINTER EVENTS EIKÄ SELAIMEN OMA VETO
 * ---------------------------------------------------------------------
 *
 * HTML5:n draggable ei toimi kosketusnäytöllä lainkaan. Lounaslista
 * kirjoitetaan keittiössä puhelimella, joten selaimen oma veto olisi
 * ominaisuus joka toimii vain siellä missä sitä ei käytetä.
 *
 * Pointer-tapahtumat kattavat hiiren, kosketuksen ja kynän samalla
 * koodilla, ja setPointerCapture pitää tapahtumat kahvassa vaikka
 * sormi liukuisi rivin ulkopuolelle.
 *
 * ---------------------------------------------------------------------
 * NÄPPÄIMISTÖ EI JÄÄNYT POIS
 * ---------------------------------------------------------------------
 *
 * Nuolinapit korvattiin kahvalla, mutta kahva on painike: siihen voi
 * siirtyä sarkaimella ja nuolinäppäimet siirtävät ruokaa askeleen.
 * Pelkkä raahaus sulkisi ulos jokaisen joka ei käytä hiirtä.
 *
 * ---------------------------------------------------------------------
 * JÄRJESTYS TALLENNETAAN VASTA IRROTETTAESSA
 * ---------------------------------------------------------------------
 *
 * Liikkeen aikana järjestys elää selaimessa. Jokainen ohitettu rivi
 * ei ole oma tallennuksensa: se olisi kymmenen kutsua yhdestä
 * siirrosta, ja niistä viimeinen voisi saapua ensimmäisenä.
 */
export function SortableItems({
  t,
  dayId,
  items,
  enabled,
}: {
  t: AdminText;
  dayId: string;
  items: { id: string; label: string; node: ReactNode }[];
  /** Alle kahdella ruoalla ei ole mitään järjestettävää. */
  enabled: boolean;
}) {
  const lista = useRef<HTMLUListElement>(null);
  const [, aloitaTallennus] = useTransition();

  /*
   * Palvelimen järjestys on totuus, paikallinen on sen kopio.
   *
   * Kun palvelin palauttaa uuden järjestyksen, tunnisteiden jono
   * muuttuu ja paikallinen tila nollataan sen mukaan. Tämä on
   * Reactin oma kuvio propsin muutokseen reagoimiseen — efekti
   * tekisi saman yhden ylimääräisen piirron jälkeen.
   */
  const tunnus = items.map((i) => i.id).join(",");
  const [edellinen, setEdellinen] = useState(tunnus);
  const [jarjestys, setJarjestys] = useState<string[]>(() =>
    items.map((i) => i.id),
  );

  if (tunnus !== edellinen) {
    setEdellinen(tunnus);
    setJarjestys(items.map((i) => i.id));
  }

  const [raahattava, setRaahattava] = useState<string | null>(null);

  const kartta = new Map(items.map((i) => [i.id, i]));
  const rivit = jarjestys
    .map((id) => kartta.get(id))
    .filter((i): i is (typeof items)[number] => i !== undefined);

  function siirra(from: number, to: number): string[] {
    const kopio = [...jarjestys];
    const [poimittu] = kopio.splice(from, 1);
    kopio.splice(to, 0, poimittu);
    return kopio;
  }

  function tallenna(uusi: string[]) {
    aloitaTallennus(() => {
      void reorderLunchItems(dayId, uusi);
    });
  }

  function liikkeella(event: React.PointerEvent) {
    if (!raahattava || !lista.current) return;

    const rows = Array.from(
      lista.current.querySelectorAll<HTMLElement>("[data-rivi]"),
    );

    const from = jarjestys.indexOf(raahattava);

    /*
     * Kohta luetaan riviltä jonka päällä sormi on.
     *
     * Vaihtoehto olisi laskea siirtymä pikseleinä, mutta rivit ovat
     * eri korkuisia: yhdellä on kuvaus ja ruokavaliomerkinnät,
     * toisella pelkkä nimi.
     */
    let to = from;
    rows.forEach((row, index) => {
      const r = row.getBoundingClientRect();
      if (event.clientY >= r.top && event.clientY <= r.bottom) to = index;
    });

    if (to !== from) setJarjestys(siirra(from, to));
  }

  function irrotettu() {
    if (!raahattava) return;
    setRaahattava(null);

    /* Tallennus vain jos järjestys oikeasti muuttui. */
    if (jarjestys.join(",") !== tunnus) tallenna(jarjestys);
  }

  function nappaimisto(event: React.KeyboardEvent, id: string) {
    const suunta =
      event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (suunta === 0) return;

    const from = jarjestys.indexOf(id);
    const to = from + suunta;
    if (to < 0 || to >= jarjestys.length) return;

    event.preventDefault();
    const uusi = siirra(from, to);
    setJarjestys(uusi);
    tallenna(uusi);
  }

  return (
    <ul ref={lista} className="mt-3 space-y-2.5">
      {rivit.map((item) => (
        <li
          key={item.id}
          data-rivi=""
          className="border-b pb-2 last:border-0 last:pb-0"
          style={{
            borderColor: "var(--rf-line)",
            /*
             * Raahattava nousee hieman esiin. Ei varjoa eikä
             * kallistusta: rivi siirtyy, se ei irtoa listasta.
             */
            background: raahattava === item.id ? "var(--rf-inset)" : undefined,
            borderRadius: raahattava === item.id ? 8 : undefined,
          }}
        >
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1">{item.node}</div>

            {enabled ? (
              <button
                type="button"
                /*
                 * Kahva on painike eikä div: se saa kohdistuksen
                 * sarkaimella, ja nuolinäppäimet toimivat siinä.
                 */
                aria-label={fill(t.lounas.dragHandle, { nimi: item.label })}
                className="rf-press rf-hit mt-0.5 flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-[7px]"
                style={{
                  color: "var(--rf-text-3)",
                  /* Ilman tätä selain vierittää sivua sormen mukana. */
                  touchAction: "none",
                }}
                onPointerDown={(event) => {
                  event.preventDefault();

                  /*
                   * Kaappaus try-lohkossa.
                   *
                   * setPointerCapture heittää NotFoundError-virheen jos
                   * osoitin ei ole enää aktiivinen — se ehtii irrota
                   * tapahtuman ja käsittelijän välissä. Ilman suojaa
                   * raahaus ei alkaisi lainkaan, vaikka ilman
                   * kaappausta se toimii rivin päällä normaalisti.
                   */
                  try {
                    event.currentTarget.setPointerCapture(event.pointerId);
                  } catch {
                    /* Ei kaappausta; liike toimii silti listan päällä. */
                  }

                  setRaahattava(item.id);
                }}
                onPointerMove={liikkeella}
                onPointerUp={irrotettu}
                onPointerCancel={irrotettu}
                onKeyDown={(event) => nappaimisto(event, item.id)}
              >
                <RfIcon name="drag" size={15} />
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Yksi pöytä kartalla.
 *
 * Sama merkki kahdessa paikassa: asetusten muokkaimessa ja illan
 * salinäkymässä. Kaksi toteutusta erkanisi ensimmäisen muutoksen
 * kohdalla, ja järjestelty kartta näyttäisi eriltä kuin se jota
 * järjesteltiin.
 *
 * ---------------------------------------------------------------------
 * MUOTO ENNEN VÄRIÄ, VÄRI ENNEN TEKSTIÄ
 * ---------------------------------------------------------------------
 *
 * Tarjoilija katsoo karttaa ohi mennessään, ei lue sitä. Muoto kertoo
 * mikä pöytä on kyseessä, väri kertoo onko se vapaa, ja vasta numero
 * varmistaa kumman niistä.
 *
 * Väri ei ole ainoa merkki tilasta. Varattu pöytä on täytetty, vapaa
 * on ääriviiva — ero näkyy myös silloin kun värit eivät erotu.
 */

import type { TableShape } from "@/lib/restoflow/floor-plan";
import { aspectFor } from "@/lib/restoflow/floor-plan";

export interface TableColors {
  bg: string;
  border: string;
  text: string;
  /** Katkoviiva: pöytä on olemassa muttei käytössä. */
  dashed?: boolean;
}

/**
 * Väri tulee kutsujalta, muoto komponentilta.
 *
 * Salinäkymässä väri tarkoittaa varaustilaa ja tiloja on kuusi;
 * muokkaimessa tilaa ei ole olemassa lainkaan. Jos värit olisivat
 * täällä, tämä komponentti tietäisi varausjärjestelmästä — eikä se
 * tiedä siitä mitään eikä tarvitse tietää.
 *
 * Jaettavaa on se mikä molemmissa on samaa: pöydän muoto, koko,
 * kierto ja nimen sijoittelu. Juuri se on se osa jonka erkaneminen
 * näkyisi käyttäjälle.
 */
export const PLAIN_COLORS: TableColors = {
  bg: "var(--rf-card)",
  border: "var(--rf-line-strong)",
  text: "var(--rf-text)",
};

export function TableMark({
  name,
  shape,
  rotation,
  widthPercent,
  colors,
  selected,
  dragging,
}: {
  name: string;
  shape: TableShape;
  rotation: number;
  /** Leveys prosentteina salin leveydestä. */
  widthPercent: number;
  colors: TableColors;
  selected?: boolean;
  dragging?: boolean;
}) {
  const sävy = colors;

  return (
    <span
      className="relative flex items-center justify-center"
      style={{
        /*
         * Leveys prosentteina, korkeus kuvasuhteesta.
         *
         * aspect-ratio pitää pyöreän pyöreänä riippumatta siitä
         * minkä kokoinen ruutu on. Korkeuden laskeminen käsin
         * vaatisi kartan pikselikoon, ja se on tiedossa vasta
         * piirtämisen jälkeen.
         */
        width: `${widthPercent}%`,
        aspectRatio: String(aspectFor(shape)),

        background: sävy.bg,
        border: `${selected ? 2 : 1.5}px ${sävy.dashed ? "dashed" : "solid"} ${
          selected ? "var(--rf-accent)" : sävy.border
        }`,
        color: sävy.text,

        borderRadius: shape === "round" ? "50%" : "var(--rf-r-control)",
        transform: `rotate(${rotation}deg)`,

        boxShadow: dragging
          ? "var(--rf-shadow-lg)"
          : selected
            ? "var(--rf-shadow)"
            : "none",

        /*
         * Raahattava pöytä nousee muiden päälle.
         *
         * Ilman tätä se katoaisi tiheässä salissa naapurin alle
         * juuri silloin kun sitä liikutetaan.
         */
        transition: dragging ? "none" : "box-shadow .14s, border-color .14s",
      }}
    >
      {/*
        Nimi ei käänny pöydän mukana eikä katkea pöydän kokoon.

        Pystyssä oleva pitkä pöytä on tavallinen seinän vierellä, ja
        kyljellään oleva numero olisi luettava pää kallellaan.

        Kahden hengen pöytä on kartalla noin neljäkymmentä pikseliä
        leveä, eikä "Pöytä 12" mahdu siihen. Katkaistu nimi tekee
        kahdesta pöydästä saman näköisen — juuri sen mitä nimi on
        estämässä. Siksi nimi saa ylittää pöydän reunan, ja sen taakse
        tulee pohja jotta se pysyy luettavana myös reunan päällä.
      */}
      <span
        className="pointer-events-none absolute whitespace-nowrap px-1 text-[11.5px] font-semibold"
        style={{
          transform: `rotate(${-rotation}deg)`,
          background: sävy.bg,
          borderRadius: "var(--rf-r-pill)",
          maxWidth: "220%",
        }}
      >
        {name}
      </span>
    </span>
  );
}

/**
 * Salin tausta.
 *
 * Hento ruudukko kertoo että kyseessä on tila eikä lista, ja auttaa
 * asettamaan pöydät suoriin riveihin. Se on tarkoituksella melkein
 * näkymätön: ruudukko jonka huomaa on ruudukko joka häiritsee.
 */
export const ROOM_BACKGROUND =
  "repeating-linear-gradient(0deg, var(--rf-line) 0 1px, transparent 1px 10%), " +
  "repeating-linear-gradient(90deg, var(--rf-line) 0 1px, transparent 1px 10%)";

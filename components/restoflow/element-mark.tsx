/**
 * Yksi kaluste kartalla.
 *
 * Seinä, baaritiski, keittiö ja vessa ovat ne kiintopisteet joiden
 * avulla ihminen lukee tilaa. Ilman niitä kaksitoista ympyrää näyttää
 * samalta joka ravintolassa, eikä tarjoilija tunnista omaa saliaan.
 *
 * ---------------------------------------------------------------------
 * KALUSTE EI KILPAILE PÖYDÄN KANSSA
 * ---------------------------------------------------------------------
 *
 * Kartalta luetaan pöytiä. Kalusteet ovat tausta jota vasten pöydät
 * sijaitsevat, ja siksi ne ovat harmaita, ohuita ja pöytien alla.
 * Värikäs baaritiski veisi huomion siltä minkä takia kartta on
 * olemassa.
 */

import type { ElementKind } from "@/lib/restoflow/floor-plan";

/**
 * Kalusteen ulkoasu lajin mukaan.
 *
 * Seinä on umpinainen viiva, ovi katkonainen aukko, muut laatikoita
 * omalla sävyllään. Ero on tarkoituksella pieni: nämä ovat taustaa.
 */
const STYLES: Record<
  ElementKind,
  { bg: string; border: string; dashed?: boolean; solid?: boolean }
> = {
  wall: {
    bg: "var(--rf-line-strong)",
    border: "var(--rf-line-strong)",
    solid: true,
  },
  bar: { bg: "var(--rf-card)", border: "var(--rf-text-3)" },
  kitchen: { bg: "var(--rf-inset)", border: "var(--rf-text-3)" },
  wc: { bg: "var(--rf-inset)", border: "var(--rf-text-3)" },
  /* Ovi ja sisäänkäynti ovat aukkoja, eivät esteitä. */
  door: { bg: "transparent", border: "var(--rf-text-3)", dashed: true },
  entrance: { bg: "transparent", border: "var(--rf-accent)", dashed: true },
  other: { bg: "var(--rf-inset)", border: "var(--rf-line-strong)" },
};

export function ElementMark({
  kind,
  label,
  rotation,
  selected,
}: {
  kind: ElementKind;
  label: string;
  rotation: number;
  selected?: boolean;
}) {
  const tyyli = STYLES[kind] ?? STYLES.other;

  return (
    <span
      className="flex h-full w-full items-center justify-center overflow-hidden"
      style={{
        background: tyyli.bg,
        border: tyyli.solid
          ? "none"
          : `${selected ? 2 : 1}px ${tyyli.dashed ? "dashed" : "solid"} ${
              selected ? "var(--rf-accent)" : tyyli.border
            }`,
        borderRadius: kind === "wall" ? "2px" : "var(--rf-r-control)",
        outline:
          selected && tyyli.solid ? "2px solid var(--rf-accent)" : "none",
        color: "var(--rf-text-3)",
      }}
    >
      {/*
        Nimi vain jos se on annettu ja mahtuu.

        Seinällä ei ole nimeä eikä tarvitse olla. Baarille "Baari" on
        turha jos se on ainoa baari — mutta "Kabinetti 2" ovelle on
        juuri se tieto jonka takia kartta luetaan.
      */}
      {label ? (
        <span
          className="truncate px-1 text-[10.5px] font-semibold uppercase"
          style={{
            letterSpacing: "0.04em",
            transform: `rotate(${-rotation}deg)`,
          }}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}

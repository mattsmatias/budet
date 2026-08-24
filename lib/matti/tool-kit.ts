import { z } from "zod";
import { ISO_DATE, ISO_MONTH } from "@/lib/restoflow/dates";
import type { can } from "@/lib/restoflow/permissions";
import type { MattiContext } from "./context";

/**
 * Työkalun perusrakenteet.
 *
 * Nämä tyypit ja `defineTool` olivat tools.ts:n kärjessä. Ne ovat nyt
 * omassa moduulissaan, jotta työkaluja voi kirjoittaa useaan
 * tiedostoon ilman että ne tuovat toisiaan kehää.
 *
 * KAKSI TASOA, EI KOLMEA.
 *
 * Lukevat työkalut suorittavat heti. Kirjoittavat työkalut EIVÄT
 * kirjoita — ne palauttavat esikatselun ja tallentavat ehdotuksen
 * odottamaan ihmisen hyväksyntää. Malli ei voi suorittaa muutosta
 * missään tilanteessa, ei edes yrittämällä.
 */

export type ToolLevel = "read" | "write";

export interface ToolResult {
  /** Mallille menevä tiivistelmä. Pidetään lyhyenä. */
  summary: string;
  /** Rakenteinen tulos mallille. Ei koko taulua. */
  data?: unknown;
  /** Kirjoittavan työkalun esikatselu käyttäjälle. */
  preview?: ActionPreview;
  /** Kortti käyttöliittymään. Katso ToolCard. */
  card?: ToolCard;
}

/**
 * Työkalun tuottama kortti.
 *
 * Luvut muotoillaan tässä, ei mallissa. Malli voi kirjoittaa "noin
 * 31 euroa" tai pyöristää väärin; kortin arvo tulee samasta
 * laskennasta kuin käyttöliittymän luvut.
 *
 * Kortti on myös se mikä korvaa pitkän luettelon vastauksessa. Kun
 * summa näkyy kortissa, Matin ei tarvitse toistaa sitä tekstissä.
 */
export interface ToolCard {
  title: string;
  value: string;
  /** Enintään kolme lisätietoa. Neljäs tekee kortista taulukon. */
  meta?: string[];
  /** Pienet palkit: kategoriat, budjetit, toimittajat. */
  bars?: { label: string; value: string; percent: number }[];
  href?: string;
  linkLabel?: string;
}

export interface ActionPreview {
  title: string;
  /** Rivit muodossa "Keskiviikko 26.8." → "15,50 € → 16,50 €". */
  changes: { label: string; from?: string; to: string }[];
  /** Varoitus jos toiminto on erityisen vaikutuksellinen. */
  warning?: string;
}

export type Capability = Parameters<typeof can>[1];

export interface ToolDefinition {
  name: string;
  description: string;
  level: ToolLevel;
  /** Oikeus jota työkalu vaatii. */
  requires: Capability;
  schema: z.ZodType;
  run: (ctx: MattiContext, input: unknown) => Promise<ToolResult>;
}

/**
 * Työkalun määrittely.
 *
 * Syötteen tyyppi johdetaan skeemasta. Ilman tätä apuria jokainen
 * työkalu kirjoittaisi tyypin käsin skeeman viereen, ja kaksi
 * totuutta samasta asiasta ajautuu ennen pitkää erilleen.
 */
export function defineTool<S extends z.ZodType>(def: {
  name: string;
  description: string;
  level: ToolLevel;
  requires: Capability;
  schema: S;
  run: (ctx: MattiContext, input: z.infer<S>) => Promise<ToolResult>;
}): ToolDefinition {
  return {
    ...def,
    run: (ctx, input) => def.run(ctx, input as z.infer<S>),
  };
}

/** Kuukausi muodossa 2026-08. */
export const monthSchema = z
  .string()
  .regex(ISO_MONTH, "Kuukausi muodossa VVVV-KK");

export const dateSchema = z
  .string()
  .regex(ISO_DATE, "Päivä muodossa VVVV-KK-PP");

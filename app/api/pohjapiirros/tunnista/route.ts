/**
 * Pöytien tunnistaminen salin pohjapiirroksesta.
 *
 * Kuvaa ei lähetetä selaimesta. Reitti hakee sen ravintolan omasta
 * yksityisestä tallennustilasta, koska silloin luettava kuva on varmasti
 * se joka kartalla on — eikä mikä tahansa jonka joku ehti lähettää
 * tähän osoitteeseen.
 *
 * ---------------------------------------------------------------------
 * RAVINTOLA TULEE ISTUNNOSTA
 * ---------------------------------------------------------------------
 *
 * Pyyntö ei sisällä ravintolan tunnistetta eikä sellaista luettaisi
 * vaikka sisältäisi. Aktiivinen ravintola luetaan istunnosta ja oikeus
 * tarkistetaan siitä.
 *
 * ---------------------------------------------------------------------
 * TUNNISTUS EI TALLENNA MITÄÄN
 * ---------------------------------------------------------------------
 *
 * Reitti palauttaa ehdotuksen. Käyttäjä hyväksyy sen erikseen, ja
 * tallennus kulkee kartan omaa tietä. Automaattinen sijoittelu olisi
 * kartta jota kukaan ei ole katsonut.
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { can } from "@/lib/restoflow/permissions";
import { requireContext } from "@/lib/restoflow/session";
import { createClient } from "@/utils/supabase/server";
import { DEFAULT_MODEL, isRealExtractor } from "@/lib/restoflow/receipt-ai";
import {
  detectionSchema,
  FLOOR_PLAN_PROMPT,
  type Detection,
} from "@/lib/restoflow/floor-plan-ai";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export const maxDuration = 60;

/** Mitä mediatyyppejä ämpäri sallii. */
const TYYPIT: Record<string, "image/jpeg" | "image/png" | "image/webp"> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function POST() {
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext(
    "/admin/varaukset/asetukset",
  );

  if (!can(role, "reservations.manage")) {
    return NextResponse.json({ error: t.pohjakuva.errRight }, { status: 403 });
  }

  if (!isRealExtractor()) {
    /* 501: selain piilottaa painikkeen eikä näytä virhettä. */
    return NextResponse.json({ error: t.pohjakuva.errOff }, { status: 501 });
  }

  const supabase = await createClient();

  const { data: rivi } = await supabase
    .from("floor_plan_images")
    .select("storage_path")
    .eq("restaurant_id", restaurant.id)
    .maybeSingle();

  const path = (rivi as { storage_path?: string } | null)?.storage_path;
  if (!path) {
    return NextResponse.json(
      { error: t.pohjakuva.errNoImage },
      { status: 400 },
    );
  }

  const { data: tiedosto, error: latausVirhe } = await supabase.storage
    .from("floorplans")
    .download(path);

  if (latausVirhe || !tiedosto) {
    return NextResponse.json(
      { error: t.pohjakuva.errNoImage },
      { status: 400 },
    );
  }

  const pate = path.split(".").pop()?.toLowerCase() ?? "";
  const media = TYYPIT[pate];
  if (!media) {
    return NextResponse.json({ error: t.pohjakuva.errType }, { status: 400 });
  }

  const base64 = Buffer.from(await tiedosto.arrayBuffer()).toString("base64");

  let parsed: Detection | null = null;

  try {
    const client = new Anthropic();

    const response = await client.messages.parse({
      model: process.env.RECEIPT_MODEL ?? DEFAULT_MODEL,
      max_tokens: 4000,
      system: FLOOR_PLAN_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: media, data: base64 },
            },
            {
              type: "text",
              text: "Merkitse tämän pohjapiirroksen pöydät ja rakenteet.",
            },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(detectionSchema) },
    });

    if (response.stop_reason !== "refusal") {
      parsed = (response.parsed_output as Detection | null) ?? null;
    }
  } catch {
    /*
     * Virheen sisältöä ei näytetä.
     *
     * Rajapinnan virheessä voi olla pyynnön tietoja, ja käyttäjä ei voi
     * niille mitään. Hänelle kerrotaan mitä tehdä, ei mikä hajosi.
     */
    return NextResponse.json({ error: t.pohjakuva.errDetect }, { status: 502 });
  }

  if (!parsed) {
    return NextResponse.json({ error: t.pohjakuva.errDetect }, { status: 502 });
  }

  if (!parsed.isFloorPlan) {
    return NextResponse.json(
      { error: t.pohjakuva.errNotPlan },
      { status: 422 },
    );
  }

  return NextResponse.json({
    tables: parsed.tables,
    fixtures: parsed.fixtures,
  });
}

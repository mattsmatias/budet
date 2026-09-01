/**
 * Verokortin lukeminen kuvasta tai PDF:stä.
 *
 * Työntekijä tuo verokortin puhelimen kuvana. Neljä lukua siitä
 * pitäisi päätyä Kateen, ja käsin naputeltuna yksikin väärä numero on
 * väärä palkka koko loppuvuodeksi.
 *
 * ---------------------------------------------------------------------
 * LUKEMINEN EI TALLENNA MITÄÄN
 * ---------------------------------------------------------------------
 *
 * Reitti palauttaa ehdotuksen. Se täyttää lomakkeen kentät, ja
 * käyttäjä hyväksyy tai muokkaa ne ennen tallennusta. Automaattinen
 * hyväksyntä olisi veroprosentti jota kukaan ei ole katsonut.
 *
 * ---------------------------------------------------------------------
 * OIKEUS TARKISTETAAN, VAIKKA MITÄÄN EI TALLENNETA
 * ---------------------------------------------------------------------
 *
 * Verokortti on arkaluonteinen dokumentti. Ilman tarkistusta kuka
 * tahansa kirjautunut voisi lähettää tänne kenen tahansa verokortin ja
 * saada sen sisällön luettuna takaisin.
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { can } from "@/lib/restoflow/permissions";
import { requireContext } from "@/lib/restoflow/session";
import { DEFAULT_MODEL, isRealExtractor } from "@/lib/restoflow/receipt-ai";
import {
  checkUploads,
  filesFrom,
  toContentBlocks,
} from "@/lib/restoflow/extract-upload";
import {
  proposalFrom,
  taxCardSchema,
  TAX_CARD_PROMPT,
  type TaxCardExtraction,
} from "@/lib/restoflow/tax-card-ai";

export const maxDuration = 60;

export async function POST(request: Request) {
  const t = adminText(await resolveLocale());
  const { role } = await requireContext("/admin/tyontekijat");

  if (!can(role, "payroll.manage")) {
    return NextResponse.json({ error: t.verotus.noRight }, { status: 403 });
  }

  if (!isRealExtractor()) {
    /* 501: selain piilottaa painikkeen eikä näytä virhettä. */
    return NextResponse.json({ error: t.tiimi.scanOff }, { status: 501 });
  }

  const form = await request.formData();
  const files = filesFrom(form, "file");

  const ongelma = checkUploads(files, {
    missing: t.tiimi.scanMissing,
    tooLarge: t.tiimi.scanTooLarge,
    tooLargeTotal: t.tiimi.scanTooLargeTotal,
    heic: t.tiimi.scanHeic,
    unsupported: t.tiimi.scanUnsupported,
  });

  if (ongelma) {
    return NextResponse.json(
      { error: ongelma.error },
      { status: ongelma.status },
    );
  }

  let parsed: TaxCardExtraction | null = null;

  try {
    const client = new Anthropic();

    const response = await client.messages.parse({
      model: process.env.RECEIPT_MODEL ?? DEFAULT_MODEL,
      max_tokens: 1500,
      system: TAX_CARD_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            ...(await toContentBlocks(files)),
            { type: "text", text: "Mitä tässä verokortissa lukee?" },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(taxCardSchema) },
    });

    if (response.stop_reason !== "refusal") {
      parsed = response.parsed_output as TaxCardExtraction | null;
    }
  } catch (error) {
    /*
     * Epäonnistuminen on hiljainen.
     *
     * Lukeminen on mukavuus, ei toiminto: kortin voi aina syöttää
     * käsin. Tekninen virhe lokiin, käyttäjälle tyhjä ehdotus.
     */
    console.error("verokortin luku epäonnistui", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return NextResponse.json({ proposal: proposalFrom(parsed) });
}

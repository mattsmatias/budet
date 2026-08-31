/**
 * Nimiehdotus ladattavalle tiedostolle.
 *
 * Skannerista tulee "scan_0042.pdf" ja puhelimesta "IMG_4821.jpg".
 * Kumpikaan ei löydy haulla puolen vuoden päästä, eikä kukaan nimeä
 * niitä uudelleen sillä hetkellä kun tiedosto on juuri saatu talteen.
 *
 * ---------------------------------------------------------------------
 * TÄMÄ EHDOTTAA, EI PÄÄTÄ
 * ---------------------------------------------------------------------
 *
 * Vastaus menee lomakkeen nimikenttään, jonka käyttäjä näkee ja voi
 * muuttaa ennen tallennusta. Malli voi lukea väärin, ja väärä nimi on
 * korjattavissa — automaattisesti tallennettu väärä nimi ei olisi,
 * koska kukaan ei huomaisi sitä.
 *
 * ---------------------------------------------------------------------
 * SAMA LUKIJA KUIN LASKUISSA
 * ---------------------------------------------------------------------
 *
 * invoice-ai.ts osaa jo poimia toimittajan ja päiväyksen. Oma kehote
 * tälle olisi toinen paikka jossa sama asia luetaan hieman eri tavalla,
 * ja ne kaksi ajautuisivat erilleen.
 *
 * Jos kuvassa ei ole laskua, ehdotusta ei tule. Se on oikea vastaus
 * eikä virhe: ruokalistasta tai pöydän kuvasta ei ole nimeä
 * johdettavissa.
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
import { INVOICE_PROMPT, invoiceSchema } from "@/lib/restoflow/invoice-ai";
import type { InvoiceExtraction } from "@/lib/restoflow/invoice";
import { suggestName } from "@/lib/restoflow/files";

export const maxDuration = 60;

export async function POST(request: Request) {
  const t = adminText(await resolveLocale());

  /*
   * Poiminta maksaa jokaisesta kutsusta, joten reitti on niille jotka
   * saavat kaappiin kirjoittaa. Sama linja kuin kuittien ja tehtävien
   * poiminnassa.
   */
  const { role } = await requireContext("/admin/tiedostot");
  if (!can(role, "files.manage")) {
    return NextResponse.json({ error: t.tiedosto.readOnly }, { status: 403 });
  }

  if (!isRealExtractor()) {
    /*
     * 501 on sovittu merkki selaimelle: piilota painike äläkä näytä
     * virhettä. Lataus toimii ilman ehdotusta.
     */
    return NextResponse.json({ error: t.tiimi.scanOff }, { status: 501 });
  }

  const form = await request.formData();
  const files = filesFrom(form, "file", "pages");
  const original = String(form.get("nimi") ?? "").trim();

  const ongelma = checkUploads(files, {
    missing: t.tiimi.scanMissing,
    tooLarge: t.tiimi.scanTooLarge,
    tooLargeTotal: t.tiimi.scanTooLargeTotal,
    heic: t.tiimi.scanHeic,
    unsupported: t.tiimi.scanUnsupported,
  });

  if (ongelma) {
    return NextResponse.json({ error: ongelma.error }, { status: ongelma.status });
  }

  try {
    const client = new Anthropic();

    const response = await client.messages.parse({
      model: process.env.RECEIPT_MODEL ?? DEFAULT_MODEL,
      max_tokens: 2000,
      system: INVOICE_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            ...(await toContentBlocks(files)),
            {
              type: "text",
              text:
                "Poimi tästä asiakirjasta lähettäjä ja päiväys. " +
                "Muita kenttiä ei tarvita tähän.",
            },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(invoiceSchema) },
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ suggestion: null });
    }

    const parsed = response.parsed_output as InvoiceExtraction | null;

    /*
     * Ei laskua, ei ehdotusta.
     *
     * Tyhjä vastaus eikä virhe: käyttäjä ei pyytänyt tunnistusta vaan
     * apua nimeämiseen, ja avun puuttuminen ei ole vika.
     */
    if (!parsed?.isInvoice) {
      return NextResponse.json({ suggestion: null });
    }

    return NextResponse.json({
      suggestion: suggestName(
        original,
        parsed.supplier?.value ?? null,
        parsed.invoiceDate?.value ?? null,
      ),
    });
  } catch (error) {
    /*
     * Epäonnistuminen on hiljainen.
     *
     * Nimiehdotus on mukavuus, ei toiminto. Virheilmoitus lataamisen
     * päälle olisi este asialle joka onnistuu ilman sitä.
     */
    console.error("nimiehdotus epäonnistui", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({ suggestion: null });
  }
}

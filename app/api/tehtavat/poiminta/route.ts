/**
 * Laskun luku kuvasta tehtäväksi.
 *
 * Ravintoloitsija saa laskun paperilla tai sähköpostissa ja haluaa
 * muistaa maksaa sen. Tehtävä syntyy siinä hetkessä kun lasku on
 * kädessä — ja juuri silloin eräpäivän, summan ja viitteen
 * naputteleminen on se työ joka jää tekemättä.
 *
 * ---------------------------------------------------------------------
 * TÄMÄ EI KIRJAA KULUA
 * ---------------------------------------------------------------------
 *
 * Lasku menee kuluksi kuittien kautta (/admin/kuitit), jossa on rivit,
 * ALV, kategoria ja kirjanpitovienti. Tämä tekee muistutuksen
 * maksamisesta eikä mitään muuta. Sama kuva kulkee molempien läpi jos
 * ravintoloitsija haluaa, mutta kumpikaan ei tee toisen työtä
 * puolittain.
 *
 * ---------------------------------------------------------------------
 * MITÄ TÄMÄ PALAUTTAA
 * ---------------------------------------------------------------------
 *
 * Arvon ja luottamuksen, ei pelkkää arvoa — sama sääntö kuin kuittien
 * poiminnassa. Viite ja IBAN tarkistetaan lisäksi tarkisteella
 * (lib/restoflow/invoice.ts): väärin luettu viitenumero ei näytä
 * väärältä, mutta maksu ei kohdistu ja lasku jää auki.
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { adminText } from "@/lib/i18n/admin-text";
import type { AdminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { explainAiError } from "@/lib/matti/errors";
import { can } from "@/lib/restoflow/permissions";
import { requireContext } from "@/lib/restoflow/session";
import { todayIn } from "@/lib/restoflow/clock-context";
import { DEFAULT_MODEL, isRealExtractor } from "@/lib/restoflow/receipt-ai";
import {
  checkUploads,
  filesFrom,
  toContentBlocks,
} from "@/lib/restoflow/extract-upload";
import { invoiceToTask, type InvoiceExtraction } from "@/lib/restoflow/invoice";
import { INVOICE_PROMPT, invoiceSchema } from "@/lib/restoflow/invoice-ai";

/** Iso kuva ja tarkka luku vievät aikaa. */
export const maxDuration = 60;

export async function POST(request: Request) {
  const locale = await resolveLocale();
  const t = adminText(locale);

  /*
   * Poiminta maksaa jokaisesta kutsusta, joten reitti ei ole auki
   * kaikille kirjautuneille vaan niille jotka saavat luoda tehtäviä.
   * Sama linja kuin kuittien poiminnassa.
   */
  const { role, restaurant } = await requireContext("/admin/tehtavat");
  if (!can(role, "tasks.manage")) {
    return NextResponse.json({ error: t.tiimi.scanNoAccess }, { status: 403 });
  }

  if (!isRealExtractor()) {
    /*
     * 501 on sovittu merkki selaimelle: piilota painike äläkä näytä
     * virhettä. Tehtävän luonnin on toimittava ilman poimintaa.
     */
    return NextResponse.json({ error: t.tiimi.scanOff }, { status: 501 });
  }

  const form = await request.formData();
  const files = filesFrom(form, "pages", "file");

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

  const client = new Anthropic();

  try {
    const response = await client.messages.parse({
      model: process.env.RECEIPT_MODEL ?? DEFAULT_MODEL,
      max_tokens: 4000,
      system: INVOICE_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            ...(await toContentBlocks(files)),
            {
              type: "text",
              text:
                files.length === 1
                  ? "Poimi tämän laskun tiedot."
                  : `Poimi tämän laskun tiedot. Lasku on ${files.length} sivua ` +
                    "ja ne ovat tässä järjestyksessä. Maksutiedot ovat " +
                    "tavallisesti viimeisellä sivulla.",
            },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(invoiceSchema) },
    });

    /*
     * Turvaluokittelija voi kieltäytyä. Se ei ole poikkeus vaan
     * normaali vastaus, joten se tarkistetaan ennen sisältöä.
     */
    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: t.tiimi.scanUnreadable }, { status: 422 });
    }

    const parsed = response.parsed_output as InvoiceExtraction | null;
    if (!parsed) {
      return NextResponse.json({ error: t.tiimi.scanNothing }, { status: 422 });
    }

    if (!parsed.isInvoice) {
      return NextResponse.json({ error: t.tiimi.scanNotInvoice }, { status: 422 });
    }

    /*
     * Tänään ravintolan ajassa, ei palvelimen.
     *
     * Eräpäivän järkevyys mitataan siitä päivästä jota ravintolassa
     * eletään. Palvelin voi olla toisella puolella maailmaa.
     */
    const today = todayIn(restaurant.timezone);

    return NextResponse.json({
      draft: invoiceToTask(parsed, today, locale),
      imageQuality: parsed.imageQuality,
    });
  } catch (error) {
    /*
     * Kerrotaan mitä tapahtui. Hiljainen paluu tyhjään lomakkeeseen
     * näyttäisi siltä ettei laskussa ollut mitään luettavaa.
     */
    const failure = explainAiError(error, t);

    console.error("laskun poiminta: mallikutsu epäonnistui", {
      reason: failure.reason,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: jatka(failure.message, failure.retryable, t), retryable: failure.retryable },
      { status: failure.status },
    );
  }
}

/** Virheen perään neuvo siitä mitä käyttäjä voi tehdä nyt. */
function jatka(message: string, retryable: boolean, t: AdminText): string {
  return `${message} ${retryable ? t.tiimi.scanOrByHand : t.tiimi.scanByHandMeanwhile}`;
}

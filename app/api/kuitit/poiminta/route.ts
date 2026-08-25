/**
 * Kuitin poiminta kuvasta.
 *
 * Palvelimella, koska API-avain ei voi olla selaimessa: NEXT_PUBLIC-
 * muuttuja päätyy sivun lähdekoodiin ja on siten julkinen.
 *
 * KESKEINEN SÄÄNTÖ säilyy: malli palauttaa arvon ja luottamuksen, ei
 * pelkkää arvoa. Rakenteinen ulostulo (output_config.format) takaa
 * muodon, ja arvot tarkistetaan vielä tässä — tuntematon kategoria tai
 * mahdoton summa pudotetaan tyhjäksi. Tyhjä kenttä on parempi kuin
 * keksitty: käyttäjä täyttää sen itse ja tietää tehneensä niin.
 */

import Anthropic from "@anthropic-ai/sdk";
import { ISO_DATE } from "@/lib/restoflow/dates";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireContext } from "@/lib/restoflow/session";
import { parseBusinessId } from "@/lib/restoflow/merchants";
import { explainAiError } from "@/lib/matti/errors";
import { canAddReceipts } from "@/lib/restoflow/permissions";
import {
  DEFAULT_MODEL,
  emptyResult,
  isRealExtractor,
  quantityOf,
  vatRateOf,
  type ExtractedItem,
  type ExtractionResult,
} from "@/lib/restoflow/receipt-ai";
import {
  CATEGORY_LABELS,
  PAYMENT_LABELS,
  type ExpenseCategory,
  type PaymentMethod,
} from "@/lib/restoflow/types";

/** Poiminta voi kestää: iso kuva ja tarkka luku vievät aikaa. */
export const maxDuration = 60;

const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Kaikkien sivujen yhteiskoko.
 *
 * Sivumäärää ei rajata — kuitissa on niin monta sivua kuin siinä on.
 * Pyyntö ei silti voi olla mielivaltaisen suuri, joten raja on
 * kokonaiskoossa ja siitä kerrotaan luettavalla lauseella.
 */
const MAX_TOTAL_BYTES = 28 * 1024 * 1024;

/**
 * Mallin näkemät kuvamuodot.
 *
 * HEIC ei ole listalla, koska rajapinta ei tue sitä — ja juuri sitä
 * iPhone tuottaa oletuksena. Selain muuntaa kuvan JPEG:ksi ennen
 * lähetystä, joten tänne ei pitäisi päätyä HEIC:iä; jos päätyy, siitä
 * kerrotaan suoraan eikä anneta mallin hylätä sitä puolestamme.
 */
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const PDF_TYPE = "application/pdf";

const CATEGORY_KEYS = Object.keys(CATEGORY_LABELS) as [string, ...string[]];
const PAYMENT_KEYS = Object.keys(PAYMENT_LABELS) as [string, ...string[]];

const confidence = z.enum(["high", "medium", "low"]);

/**
 * Poiminnan muoto.
 *
 * Rakenteinen ulostulo takaa että vastaus on tätä skeemaa — mallin ei
 * tarvitse muistaa palauttaa JSONia, eikä meidän tarvitse siivota
 * koodiaitoja tai varautua jäsennysvirheeseen.
 */
const extraction = z.object({
  supplier: z.object({ value: z.string().nullable(), confidence }),
  date: z.object({ value: z.string().nullable(), confidence }),
  totalCents: z.object({ value: z.number().int().nullable(), confidence }),
  vatCents: z.object({ value: z.number().int().nullable(), confidence }),
  category: z.object({ value: z.enum(CATEGORY_KEYS).nullable(), confidence }),
  paymentMethod: z.object({ value: z.enum(PAYMENT_KEYS).nullable(), confidence }),
  receiptNumber: z.object({ value: z.string().nullable(), confidence }),
  businessId: z.object({ value: z.string().nullable(), confidence }),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
      totalCents: z.number().int(),
      category: z.enum(CATEGORY_KEYS),
      vatRate: z.number().nullable(),
      productGroup: z.string().nullable(),
    }),
  ),
  imageQuality: z.enum(["good", "poor"]),
});

export async function POST(request: Request) {
  // Poiminta maksaa jokaisesta kutsusta, joten reitti ei ole auki
  // kenellekään kirjautuneelle vaan niille jotka saavat lisätä kuitteja.
  const { role } = await requireContext("/admin/kuitit/uusi");
  if (!canAddReceipts(role)) {
    return NextResponse.json({ error: "Ei oikeutta." }, { status: 403 });
  }

  if (!isRealExtractor()) {
    // 501 on sovittu merkki selaimelle: avaa käsintäyttö äläkä näytä
    // virhettä. Kuitin lisäyksen on toimittava ilman poimintaa.
    return NextResponse.json({ error: "Poimintaa ei ole kytketty." }, { status: 501 });
  }

  const form = await request.formData();

  /*
   * MONTA SIVUA, YKSI KUITTI.
   *
   * Tukkukuitti on usein kolme sivua, ja rivit jatkuvat sivulta
   * toiselle. Ne on luettava yhdessä: erikseen luettuina loppusumma
   * olisi vain viimeisellä sivulla eivätkä rivit summautuisi siihen.
   *
   * Vanha nimi "file" kelpaa yhä, jottei yksi vanha kutsu hajoa.
   */
  const files = [...form.getAll("pages"), ...form.getAll("file")].filter(
    (entry): entry is File => entry instanceof File,
  );

  if (files.length === 0) {
    return NextResponse.json({ error: "Tiedosto puuttuu." }, { status: 400 });
  }

  let total = 0;

  for (const file of files) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Yksi sivuista on liian suuri. Kuvaa se uudelleen." },
        { status: 413 },
      );
    }

    total += file.size;

    if (!IMAGE_TYPES.has(file.type) && file.type !== PDF_TYPE) {
      return NextResponse.json(
        {
          error:
            file.type === "image/heic" || file.type === "image/heif"
              ? "Kuvamuotoa HEIC ei voi lukea. Valitse puhelimen kamera-asetuksista Yhteensopivin (JPEG)."
              : "Tätä tiedostomuotoa ei voi lukea. Käytä JPEG-, PNG- tai PDF-tiedostoa.",
        },
        { status: 415 },
      );
    }
  }

  /*
   * Sivumäärää ei rajata, kokonaiskokoa rajataan.
   *
   * Raja on fysiikkaa eikä politiikkaa: rajapinnan pyyntö ei voi olla
   * mielivaltaisen suuri. Sanotaan se selvästi sen sijaan että pyyntö
   * epäonnistuisi tuntemattomaan virheeseen.
   */
  if (total > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      {
        error:
          `Sivut ovat yhteensä liian suuria (${Math.round(total / 1024 / 1024)} MB). ` +
          "Poista muutama sivu ja lisää ne omana kuittinaan, tai kuvaa ne pienemmällä tarkkuudella.",
      },
      { status: 413 },
    );
  }

  const sources = await Promise.all(
    files.map(async (file) => {
      const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

      return file.type === PDF_TYPE
        ? ({
            type: "document" as const,
            source: {
              type: "base64" as const,
              media_type: "application/pdf" as const,
              data: base64,
            },
          })
        : ({
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: base64,
            },
          });
    }),
  );

  const client = new Anthropic();

  try {
    const response = await client.messages.parse({
      model: process.env.RECEIPT_MODEL ?? DEFAULT_MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            ...sources,
            {
              type: "text",
              text:
                files.length === 1
                  ? "Poimi tämän kuitin tiedot."
                  : `Poimi tämän kuitin tiedot. Kuitti on ${files.length} sivua ja ne ovat ` +
                    "tässä järjestyksessä. Lue ne yhtenä kuittina: rivit jatkuvat sivulta " +
                    "toiselle ja loppusumma on yleensä viimeisellä sivulla. Palauta rivit " +
                    "kaikilta sivuilta yhtenä listana.",
            },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(extraction) },
    });

    // Turvaluokittelija voi kieltäytyä. Se ei ole poikkeus vaan
    // normaali vastaus, joten se on tarkistettava ennen sisältöä.
    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Kuvaa ei voitu lukea. Täytä tiedot käsin." },
        { status: 422 },
      );
    }

    const parsed = response.parsed_output;
    if (!parsed) return NextResponse.json(emptyResult());

    return NextResponse.json(sanitize(parsed));
  } catch (error) {
    /*
     * Kerrotaan mitä tapahtui. Hiljainen paluu tyhjään lomakkeeseen
     * näyttäisi siltä ettei kuitissa ollut mitään luettavaa.
     *
     * Sama selitys kuin Matilla: saldon loppuminen ja ruuhka vaativat
     * eri toimenpiteet, ja "yritä uudelleen" on toisessa väärä neuvo.
     */
    const failure = explainAiError(error);

    console.error("poiminta: mallikutsu epäonnistui", {
      reason: failure.reason,
      error: error instanceof Error ? error.message : String(error),
    });

    const message = failure.retryable
      ? `${failure.message} Voit myös täyttää tiedot käsin.`
      : `${failure.message} Täytä tiedot käsin siihen asti.`;

    return NextResponse.json(
      { error: message, retryable: failure.retryable },
      { status: failure.status },
    );
  }
}

// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Luet ravintolan ostokuitteja kulunseurantaa varten.

Säännöt, joista ei poiketa:
- Rahasummat ovat SENTTEJÄ kokonaislukuina. 186,90 € on 18690.
- Jos et näe kenttää selvästi, palauta value: null ja confidence: "low".
  Älä koskaan arvaa. Väärä luku kirjanpidossa on pahempi kuin puuttuva,
  koska väärää lukua ei kukaan tarkista.
- Älä laske ALV:tä itse jos sitä ei ole kuitissa. Palauta null.
- Rivin vatRate on MURTOLUKU, ei prosenttiluku: 14 % on 0.14 ja
  25,5 % on 0.255. Jos kantaa ei näy rivillä, palauta null.
- Päivämäärä on ostopäivä muodossa VVVV-KK-PP, ei tulostuspäivä.
- businessId on myyjän Y-tunnus muodossa 1234567-8. Se löytyy yleensä
  kuitin alalaidasta. Älä sekoita sitä ALV-numeroon (FI12345678) tai
  kuittinumeroon. Jos sitä ei näy, palauta null.
- imageQuality on "poor" vain jos kuva on oikeasti epäselvä, vinossa tai
  osittain rajautunut. Älä merkitse hyvää kuvaa huonoksi.
- items saa olla tyhjä lista jos rivejä ei erotu. Älä keksi rivejä
  saadaksesi summan täsmäämään.
- Rivien summan pitäisi täsmätä loppusummaan. Jos ei täsmää, jätä rivit
  pois ennemmin kuin muokkaa niitä.

Kategoriat: ${CATEGORY_KEYS.join(", ")}.
Maksutavat: ${PAYMENT_KEYS.join(", ")}.`;

type Parsed = z.infer<typeof extraction>;
type Confidence = "high" | "medium" | "low";

/**
 * Tarkistaa mallin vastauksen.
 *
 * Skeema takaa muodon, tämä järkevyyden: negatiivinen summa,
 * mahdoton päivä tai miljoonan euron kuitti ovat lukuvirheitä eivätkä
 * ostoksia. Luottamus ei voi olla korkea arvolle jota ei ole.
 */
function sanitize(parsed: Parsed): ExtractionResult {
  const field = <T>(
    raw: { value: T | null; confidence: Confidence },
    check: (value: T) => T | null,
  ) => {
    const value = raw.value === null ? null : check(raw.value);
    return { value, confidence: value === null ? ("low" as const) : raw.confidence };
  };

  return {
    supplier: field(parsed.supplier, text),
    date: field(parsed.date, date),
    totalCents: field(parsed.totalCents, cents),
    vatCents: field(parsed.vatCents, cents),
    category: narrow<ExpenseCategory>(parsed.category),
    paymentMethod: narrow<PaymentMethod>(parsed.paymentMethod),
    receiptNumber: field(parsed.receiptNumber, text),
    // Tarkiste lasketaan tässä: väärin luettu Y-tunnus on pahempi kuin
    // puuttuva, koska tunnistus luottaa siihen kaiken muun ohi.
    businessId: field(parsed.businessId, (raw) => parseBusinessId(raw)),
    items: parsed.items
      .slice(0, 100)
      .map((item): ExtractedItem | null => {
        const totalCents = cents(item.totalCents);
        if (totalCents === null) return null;

        return {
          description: text(item.description) ?? "",
          quantity: quantityOf(item.quantity),
          unit: text(item.unit ?? ""),
          totalCents,
          category: item.category as ExpenseCategory,
          vatRate: vatRateOf(item.vatRate),
          productGroup: text(item.productGroup ?? ""),
        };
      })
      .filter((item): item is ExtractedItem => item !== null),
    imageQuality: parsed.imageQuality,
    elapsedMs: 0,
  };
}

/**
 * Kaventaa skeeman sallimasta merkkijonosta sovelluksen liittotyypiksi.
 *
 * Skeema rajaa arvot samaan luetteloon josta liittotyyppi on johdettu,
 * joten kavennus on turvallinen — mutta se tehdään yhdessä paikassa
 * eikä hajautettuna castina joka kentässä.
 */
function narrow<T extends string>(raw: {
  value: string | null;
  confidence: Confidence;
}): { value: T | null; confidence: Confidence } {
  return {
    value: raw.value === null ? null : (raw.value as T),
    confidence: raw.value === null ? "low" : raw.confidence,
  };
}

function text(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed.slice(0, 160);
}

function date(value: string): string | null {
  const trimmed = value.trim();
  if (!ISO_DATE.test(trimmed)) return null;
  return Number.isNaN(Date.parse(`${trimmed}T12:00:00Z`)) ? null : trimmed;
}

function cents(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  // Yli miljoona euroa yhdessä kuitissa on lukuvirhe, ei ostos.
  if (rounded < 0 || rounded > 100_000_000) return null;
  return rounded;
}

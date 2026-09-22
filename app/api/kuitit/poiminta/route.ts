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
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { ISO_DATE } from "@/lib/restoflow/dates";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireContext } from "@/lib/restoflow/session";
import { parseBusinessId } from "@/lib/restoflow/merchants";
import { explainAiError } from "@/lib/matti/errors";
import {
  checkUploads,
  filesFrom,
  toContentBlocks,
} from "@/lib/restoflow/extract-upload";
import { canAddReceipts } from "@/lib/restoflow/permissions";
import {
  DEFAULT_MODEL,
  emptyResult,
  isRealExtractor,
  quantityOf,
  vatRateOf,
  vatSharesOf,
  linesMatchShares,
  type VatShare,
  type ExtractedItem,
  type ExtractionResult,
} from "@/lib/restoflow/receipt-ai";
import {
  PAYMENT_ORDER,
  type ExpenseCategory,
  type PaymentMethod,
} from "@/lib/restoflow/types";
import {
  businessDescription,
  categoriesFor,
  type BusinessType,
} from "@/lib/restoflow/business";

/** Poiminta voi kestää: iso kuva ja tarkka luku vievät aikaa. */
export const maxDuration = 60;

/*
 * Tiedostojen koko, tyyppi ja muunnos ovat extract-uploadissa.
 *
 * Sama tarkistus tehdään kolmella reitillä: kuitit, kassaraportit ja
 * laskut. HEIC-viesti on juuri sellainen jota myöhemmin tarkennetaan,
 * ja kolmesta kopiosta kaksi jäisi tarkentamatta.
 *
 * Viestit ovat yhä täällä, koska ne eivät ole samat: kuitille
 * sanotaan "kuvaa se uudelleen", raportille "kuvaa raportti
 * uudelleen".
 */

/*
 * Avaimet tulevat tyyppilistoista eivat nimikkeista.
 *
 * Malli palauttaa avaimen, ei nakyvaa nimea, joten kieli ei saa
 * vaikuttaa siihen mita se saa palauttaa.
 */
const PAYMENT_KEYS = PAYMENT_ORDER as unknown as [string, ...string[]];

const confidence = z.enum(["high", "medium", "low"]);

/**
 * Poiminnan muoto.
 *
 * Rakenteinen ulostulo takaa että vastaus on tätä skeemaa — mallin ei
 * tarvitse muistaa palauttaa JSONia, eikä meidän tarvitse siivota
 * koodiaitoja tai varautua jäsennysvirheeseen.
 */
function extractionSchema(categoryKeys: [string, ...string[]]) {
  return z.object({
  supplier: z.object({ value: z.string().nullable(), confidence }),
  date: z.object({ value: z.string().nullable(), confidence }),
  totalCents: z.object({ value: z.number().int().nullable(), confidence }),
  vatCents: z.object({ value: z.number().int().nullable(), confidence }),
  category: z.object({ value: z.enum(categoryKeys).nullable(), confidence }),
  paymentMethod: z.object({
    value: z.enum(PAYMENT_KEYS).nullable(),
    confidence,
  }),
  receiptNumber: z.object({ value: z.string().nullable(), confidence }),
  businessId: z.object({ value: z.string().nullable(), confidence }),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().nullable(),
      unit: z.string().nullable(),
      totalCents: z.number().int(),
      category: z.enum(categoryKeys),
      vatRate: z.number().nullable(),
      productGroup: z.string().nullable(),
    }),
  ),
  vatBreakdown: z.array(
    z.object({
      rate: z.number(),
      vatCents: z.number().int(),
      grossCents: z.number().int(),
    }),
  ),
  imageQuality: z.enum(["good", "poor"]),
  });
}

export async function POST(request: Request) {
  // Poiminta maksaa jokaisesta kutsusta, joten reitti ei ole auki
  // kenellekään kirjautuneelle vaan niille jotka saavat lisätä kuitteja.
  const { role, restaurant } = await requireContext("/admin/kuitit/uusi");

  /*
   * Kategoriat yrityksen toimialan mukaan: parturin kuitille ei tarjota
   * ruokaa eikä alkoholia, jolloin malli ei voi valita niitä.
   */
  const categoryKeys = categoriesFor(restaurant.businessType) as unknown as [
    string,
    ...string[],
  ];
  if (!canAddReceipts(role)) {
    return NextResponse.json({ error: "Ei oikeutta." }, { status: 403 });
  }

  if (!isRealExtractor()) {
    // 501 on sovittu merkki selaimelle: avaa käsintäyttö äläkä näytä
    // virhettä. Kuitin lisäyksen on toimittava ilman poimintaa.
    return NextResponse.json(
      { error: "Poimintaa ei ole kytketty." },
      { status: 501 },
    );
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
  const files = filesFrom(form, "pages", "file");

  const ongelma = checkUploads(files, {
    missing: "Tiedosto puuttuu.",
    tooLarge: "Yksi sivuista on liian suuri. Kuvaa se uudelleen.",
    tooLargeTotal:
      "Sivut ovat yhteensä liian suuria ({mb} MB). " +
      "Poista muutama sivu ja lisää ne omana kuittinaan, tai kuvaa ne pienemmällä tarkkuudella.",
    heic:
      "Kuvamuotoa HEIC ei voi lukea. Valitse puhelimen kamera-asetuksista Yhteensopivin (JPEG).",
    unsupported:
      "Tätä tiedostomuotoa ei voi lukea. Käytä JPEG-, PNG- tai PDF-tiedostoa.",
  });

  if (ongelma) {
    return NextResponse.json(
      { error: ongelma.error },
      { status: ongelma.status },
    );
  }

  const sources = await toContentBlocks(files);

  const client = new Anthropic();

  try {
    const response = await client.messages.parse({
      model: process.env.RECEIPT_MODEL ?? DEFAULT_MODEL,
      max_tokens: 16000,
      system: systemPrompt(restaurant.businessType, categoryKeys),
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
      output_config: { format: zodOutputFormat(extractionSchema(categoryKeys)) },
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
    const failure = explainAiError(error, adminText(await resolveLocale()));

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

/**
 * Ohjeet mallille toimialan mukaan.
 *
 * Kategorioiden selitykset kertovat mitä kukin tarkoittaa: pelkkä avain
 * "equipment" ei kerro, kuuluuko trimmeri siihen vai muihin kuluihin.
 */
const CATEGORY_HINTS: Record<ExpenseCategory, string> = {
  food: "ruoka ja elintarvikkeet, myös leivonnaiset ja raaka-aineet",
  alcohol: "alkoholijuomat",
  soft_drinks: "alkoholittomat juomat, kahvi ja tee",
  kitchen_supplies: "keittiön pientarvikkeet ja kertakäyttöastiat",
  packaging: "pakkaukset, take away -astiat ja kassit",
  cleaning: "siivous- ja hygieniatarvikkeet",
  products: "hoito- ja hiustuotteet sekä myytävät tuotteet",
  equipment: "laitteet, työvälineet ja kalusteet",
  rent: "toimitilan vuokra ja vastikkeet",
  transport: "kuljetukset ja polttoaine",
  staff: "henkilöstökulut",
  other: "kaikki muu",
};

function systemPrompt(type: BusinessType, categoryKeys: string[]): string {
  return `Luet yrityksen ostokuitteja kulunseurantaa varten. Yritys on ${businessDescription(type)}.

Säännöt, joista ei poiketa:
- Rahasummat ovat SENTTEJÄ kokonaislukuina. 186,90 € on 18690.
- Jos et näe kenttää selvästi, palauta value: null ja confidence: "low".
  Älä koskaan arvaa. Väärä luku kirjanpidossa on pahempi kuin puuttuva,
  koska väärää lukua ei kukaan tarkista.
- Älä laske ALV:tä itse jos sitä ei ole kuitissa. Palauta null.
- Rivin vatRate on MURTOLUKU, ei prosenttiluku: 14 % on 0.14 ja
  25,5 % on 0.255.
- ALV-ERITTELY. Kuitin alalaidassa on lähes aina taulukko, esimerkiksi
  "Alv% Vero + Netto = Brutto / A 25,5% 6,71 26,29 33,00 / B 13,5%
  15,21 112,66 127,87". Palauta jokainen rivi vatBreakdown-listaan.
  Se on kuitin oma tieto verokannoistaan — älä laske sitä itse.
- KANTAKIRJAIMET. Kun rivin perässä on kirjain (A, B, C…), se viittaa
  ALV-erittelyn riviin. Aseta rivin vatRate sen kirjaimen kannasta:
  esimerkin "Lambi talouspaperi valko 12,45 B" saa vatRate 0.135.
  Ilman kirjainta ja ilman erittelyä palauta null.
- ALENNUKSET JA PANTIT. "Alennus 20% -0,82", "Lidl Plus -säästösi
  -2,00" ja pantit ovat omia rivejään ja niiden totalCents on
  NEGATIIVINEN. Ota ne mukaan — ilman niitä rivit eivät summaudu
  loppusummaan. Alennusrivin vatRate on sama kuin sen rivin, jota se
  alentaa (yleensä juuri edellinen rivi).
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
- TARKISTA LOPUKSI: laske rivien bruttosummat kannoittain ja vertaa
  niitä ALV-erittelyn Brutto-sarakkeeseen. Jos ne eivät täsmää, jonkin
  rivin kanta on väärin — korjaa se ennen vastaamista. Alennusrivi
  kuuluu sen tuotteen kantaan jota se alentaa.

Kategoriat (valitse vain näistä):
${categoryKeys
  .map((key) => `- ${key}: ${CATEGORY_HINTS[key as ExpenseCategory]}`)
  .join("\n")}
Maksutavat: ${PAYMENT_KEYS.join(", ")}.`;
}

type Parsed = z.infer<ReturnType<typeof extractionSchema>>;
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
    return {
      value,
      confidence: value === null ? ("low" as const) : raw.confidence,
    };
  };

  /*
   * ALV-erittely ensin: sitä tarvitaan sekä kokonais-ALV:n varmistukseen
   * että rivien kannan täydentämiseen.
   */
  const breakdown = vatSharesOf(parsed.vatBreakdown);
  const vatFromBreakdown = breakdown.reduce((sum, r) => sum + r.vatCents, 0);

  const rivit: ExtractedItem[] = parsed.items
    .slice(0, 100)
    .map((item): ExtractedItem | null => {
      const totalCents = lineCents(item.totalCents);
      if (totalCents === null) return null;

      return {
        description: text(item.description) ?? "",
        quantity: quantityOf(item.quantity),
        unit: text(item.unit ?? ""),
        totalCents,
        category: item.category as ExpenseCategory,
        vatRate: vatRateOf(item.vatRate) ?? ainoaKanta(breakdown),
        productGroup: text(item.productGroup ?? ""),
      };
    })
    .filter((item): item is ExtractedItem => item !== null);

  return {
    supplier: field(parsed.supplier, text),
    date: field(parsed.date, date),
    totalCents: field(parsed.totalCents, cents),
    /*
     * Kuitin oma erittely on parempi lähde kuin yksittäinen luku.
     *
     * Jos erittelyä ei ole, käytetään poimittua ALV:tä kuten ennen.
     */
    vatCents:
      breakdown.length > 0
        ? {
            value: vatFromBreakdown,
            /*
             * Erittely on varma vain jos rivit ovat samaa mieltä sen
             * kanssa. Jos kannoittaiset bruttosummat eivät täsmää,
             * jonkin rivin kanta on luettu väärin — silloin luku
             * merkitään tarkistettavaksi eikä varmaksi.
             */
            confidence: linesMatchShares(rivit, breakdown)
              ? ("high" as const)
              : ("medium" as const),
          }
        : field(parsed.vatCents, cents),
    category: narrow<ExpenseCategory>(parsed.category),
    paymentMethod: narrow<PaymentMethod>(parsed.paymentMethod),
    receiptNumber: field(parsed.receiptNumber, text),
    // Tarkiste lasketaan tässä: väärin luettu Y-tunnus on pahempi kuin
    // puuttuva, koska tunnistus luottaa siihen kaiken muun ohi.
    businessId: field(parsed.businessId, (raw) => parseBusinessId(raw)),
    items: rivit,
    vatBreakdown: breakdown,
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

/**
 * Rivin summa. Alennus, pantti ja hyvitys ovat negatiivisia.
 *
 * Ennen jokainen negatiivinen rivi hylättiin, jolloin rivit eivät
 * summautuneet loppusummaan. Silloin ALV-tarkistus ei voinut käyttää
 * rivejä todisteena ja päätteli kannan koko kuitin summista: Lidlin
 * kuitilla 21,92 / 138,95 = 15,8 %, joka ei ole mikään verokanta.
 * Kuitti merkittiin tarkistettavaksi, vaikka siinä luki 25,5 % ja 13,5 %.
 */
function lineCents(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (Math.abs(rounded) > 100_000_000) return null;
  return rounded;
}

/** Kanta riville jolla sitä ei näy: vain jos kuitissa on yksi kanta. */
function ainoaKanta(breakdown: VatShare[]): number | null {
  return breakdown.length === 1 ? breakdown[0].rate : null;
}

function cents(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  // Yli miljoona euroa yhdessä kuitissa on lukuvirhe, ei ostos.
  if (rounded < 0 || rounded > 100_000_000) return null;
  return rounded;
}

/**
 * Kuitin poiminta kuvasta.
 *
 * Palvelimella, koska API-avain ei voi olla selaimessa: NEXT_PUBLIC-
 * muuttuja päätyy sivun lähdekoodiin ja on siten julkinen.
 *
 * KESKEINEN SÄÄNTÖ säilyy: malli palauttaa arvon ja luottamuksen, ei
 * pelkkää arvoa. Kaikki mitä se palauttaa tarkistetaan tässä, ja mikä
 * tahansa outo arvo pudotetaan tyhjäksi. Tyhjä kenttä on parempi kuin
 * keksitty — käyttäjä täyttää sen itse ja tietää tehneensä niin.
 */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/restoflow/session";
import { canAddReceipts } from "@/lib/restoflow/permissions";
import {
  DEFAULT_MODEL,
  emptyResult,
  isRealExtractor,
  type ExtractedItem,
  type ExtractionResult,
} from "@/lib/restoflow/receipt-ai";
import {
  CATEGORY_LABELS,
  PAYMENT_LABELS,
  type ExpenseCategory,
  type PaymentMethod,
} from "@/lib/restoflow/types";

const MAX_BYTES = 20 * 1024 * 1024;

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export async function POST(request: Request) {
  // Poiminta maksaa rahaa jokaisesta kutsusta, joten reitti ei ole auki
  // kenellekään kirjautuneelle vaan niille jotka saavat lisätä kuitteja.
  const { role } = await requireContext("/admin/kuitit/uusi");
  if (!canAddReceipts(role)) {
    return NextResponse.json({ error: "Ei oikeutta" }, { status: 403 });
  }

  if (!isRealExtractor()) {
    // 501 on sovittu merkki selaimelle: palaa jäljitelmään äläkä näytä
    // virhettä. Kuitin lisäyksen on toimittava ilman poimintaa.
    return NextResponse.json({ error: "Poimintaa ei ole kytketty" }, { status: 501 });
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Tiedosto puuttuu" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Tiedosto on liian suuri" }, { status: 413 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Tiedostomuotoa ei tueta" }, { status: 415 });
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const isPdf = file.type === "application/pdf";

  const source = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: file.type, data: base64 } };

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY as string,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.RECEIPT_MODEL ?? DEFAULT_MODEL,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [source, { type: "text", text: "Poimi tämän kuitin tiedot." }],
          },
        ],
      }),
    });
  } catch {
    return NextResponse.json({ error: "Poimintapalvelu ei vastaa" }, { status: 502 });
  }

  if (!response.ok) {
    return NextResponse.json({ error: "Poiminta epäonnistui" }, { status: 502 });
  }

  const payload = (await response.json()) as {
    content?: { type: string; text?: string }[];
  };

  const text = payload.content?.find((c) => c.type === "text")?.text ?? "";

  let raw: unknown;
  try {
    raw = JSON.parse(stripFence(text));
  } catch {
    // Malli palautti jotain muuta kuin JSONia. Tyhjä tulos on oikea
    // vastaus: käyttäjä täyttää kentät eikä mitään keksitä.
    return NextResponse.json(emptyResult());
  }

  return NextResponse.json(sanitize(raw));
}

// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Olet kuittien lukija ravintolan kulunseurantaan.

Palauta VAIN JSON, ilman selityksiä ja ilman koodiaitaa. Muoto:

{
  "supplier": { "value": string|null, "confidence": "high"|"medium"|"low" },
  "date": { "value": "VVVV-KK-PP"|null, "confidence": ... },
  "totalCents": { "value": kokonaisluku|null, "confidence": ... },
  "vatCents": { "value": kokonaisluku|null, "confidence": ... },
  "category": { "value": kategoria|null, "confidence": ... },
  "paymentMethod": { "value": maksutapa|null, "confidence": ... },
  "receiptNumber": { "value": string|null, "confidence": ... },
  "items": [
    { "description": string, "quantity": number|null, "unit": string|null,
      "totalCents": kokonaisluku, "category": kategoria,
      "vatRate": number|null, "productGroup": string|null }
  ],
  "imageQuality": "good"|"poor"
}

Kategoriat: ${Object.keys(CATEGORY_LABELS).join(", ")}.
Maksutavat: ${Object.keys(PAYMENT_LABELS).join(", ")}.

Säännöt, joista ei poiketa:
- Rahasummat ovat SENTTEJÄ kokonaislukuina. 186,90 € on 18690.
- Jos et näe kenttää selvästi, palauta value: null ja confidence: "low".
  Älä koskaan arvaa. Väärä luku kirjanpidossa on pahempi kuin puuttuva.
- Älä laske ALV:tä itse, jos sitä ei ole kuitissa. Palauta null.
- Päivämäärä on ostopäivä, ei tulostuspäivä.
- Jos kuva on epäselvä tai vinossa, imageQuality on "poor".
- items saa olla tyhjä lista, jos rivejä ei erotu.`;

function stripFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?/, "").replace(/```$/, "").trim();
}

type Confidence = "high" | "medium" | "low";

function confidenceOf(input: unknown): Confidence {
  return input === "high" || input === "medium" ? input : "low";
}

function field<T>(input: unknown, parse: (value: unknown) => T | null) {
  const record = (input ?? {}) as { value?: unknown; confidence?: unknown };
  const value = parse(record.value);

  // Luottamus ei voi olla korkea arvolle jota ei ole.
  return {
    value,
    confidence: value === null ? ("low" as const) : confidenceOf(record.confidence),
  };
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed.slice(0, 160);
}

function asDate(value: unknown): string | null {
  const text = asText(value);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return Number.isNaN(Date.parse(`${text}T12:00:00Z`)) ? null : text;
}

function asCents(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const cents = Math.round(value);
  // Yli miljoona euroa yhdessä kuitissa on lukuvirhe, ei ostos.
  if (cents < 0 || cents > 100_000_000) return null;
  return cents;
}

function asCategory(value: unknown): ExpenseCategory | null {
  const text = asText(value);
  return text && text in CATEGORY_LABELS ? (text as ExpenseCategory) : null;
}

function asPayment(value: unknown): PaymentMethod | null {
  const text = asText(value);
  return text && text in PAYMENT_LABELS ? (text as PaymentMethod) : null;
}

function asItems(value: unknown): ExtractedItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, 100)
    .map((entry) => {
      const row = (entry ?? {}) as Record<string, unknown>;
      const totalCents = asCents(row.totalCents);
      if (totalCents === null) return null;

      return {
        description: asText(row.description) ?? "",
        quantity: typeof row.quantity === "number" ? row.quantity : null,
        unit: asText(row.unit),
        totalCents,
        category: asCategory(row.category) ?? "other",
        vatRate: typeof row.vatRate === "number" ? row.vatRate : null,
        productGroup: asText(row.productGroup),
      } satisfies ExtractedItem;
    })
    .filter((item): item is ExtractedItem => item !== null);
}

/**
 * Puhdistaa mallin vastauksen.
 *
 * Mallin ulostuloon ei luoteta sen enempää kuin mihinkään muuhunkaan
 * ulkopuoliseen syötteeseen: tuntematon kategoria, negatiivinen summa tai
 * väärän muotoinen päivä pudotetaan tyhjäksi.
 */
function sanitize(raw: unknown): ExtractionResult {
  const record = (raw ?? {}) as Record<string, unknown>;

  return {
    supplier: field(record.supplier, asText),
    date: field(record.date, asDate),
    totalCents: field(record.totalCents, asCents),
    vatCents: field(record.vatCents, asCents),
    category: field(record.category, asCategory),
    paymentMethod: field(record.paymentMethod, asPayment),
    receiptNumber: field(record.receiptNumber, asText),
    items: asItems(record.items),
    imageQuality: record.imageQuality === "poor" ? "poor" : "good",
    elapsedMs: 0,
  };
}

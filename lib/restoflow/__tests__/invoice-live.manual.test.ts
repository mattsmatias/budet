import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { INVOICE_PROMPT, invoiceSchema } from "../invoice-ai";
import { invoiceToTask, type InvoiceExtraction } from "../invoice";

/**
 * Elävä tarkistus laskun lukemisesta.
 *
 * Ajetaan käsin, ei osana testisarjaa: tämä kutsuu oikeaa rajapintaa
 * ja maksaa jokaisella ajolla.
 *
 *   npx vitest run --config vitest.live.mts invoice-live
 *
 * Rakennetestit (invoice.test.ts) todentavat tarkisteet ja
 * kenttien kokoamisen. Ne eivät voi todentaa sitä yhtä asiaa jonka
 * takia tämä on olemassa: lukeeko malli eräpäivän eräpäiväksi eikä
 * laskun päiväykseksi. Se on kehotteen kohta 3, ja se on koko
 * ominaisuuden arvokkain rivi.
 */

function loadKey(): string | null {
  try {
    const line = readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("ANTHROPIC_API_KEY="));

    return line?.slice("ANTHROPIC_API_KEY=".length).trim() || null;
  } catch {
    return null;
  }
}

const key = loadKey();

/**
 * Testilasku PDF:nä.
 *
 * Kuvatiedosto olisi pitänyt liittää mukaan binäärinä, ja binääri
 * jonka sisältöä ei näe diffissä on huono testiaineisto. PDF
 * rakennetaan tässä tekstistä: laskun sisältö on luettavissa
 * lähdekoodista, ja sitä voi muuttaa yhtä riviä muokkaamalla.
 */
function invoicePdf(rivit: string[]): Buffer {
  const esc = (s: string) => s.replace(/([()\\])/g, "\\$1");

  const content =
    "BT\n/F1 11 Tf\n" +
    rivit
      .map((rivi, i) => `1 0 0 1 50 ${780 - i * 20} Tm (${esc(rivi)}) Tj`)
      .join("\n") +
    "\nET";

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica " +
      "/Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\n` +
      `stream\n${content}\nendstream`,
  ];

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];

  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  /* xref-taulun on osoitettava tavuina, joten offsetit mitataan latin1:nä. */
  const xrefStart = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  out +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(out, "latin1");
}

/*
 * Laskun ansat ovat tarkoituksellisia.
 *
 * Päiväys ja eräpäivä ovat molemmat sivulla, ja päiväys tulee ensin.
 * Laskun numero ja viitenumero ovat molemmat numeroita, ja laskun
 * numero on ylempänä. Kaksi nimeä: laskuttaja ja maksaja. Jos malli
 * lukee näistä väärän, tehtävään tulee väärä eräpäivä tai viite —
 * ja juuri se on virhe jota ei huomaa.
 */
const LASKU = [
  "TUKKU POHJOLA OY",
  "Satamakatu 12, 00980 Helsinki",
  "Y-tunnus 2765459-8",
  "",
  "LASKU",
  "",
  "Laskun numero      A-100294",
  "Laskun paivays     01.09.2026",
  "Toimituspaiva      28.08.2026",
  "Erapaiva           15.09.2026",
  "Maksuehto          14 pv netto",
  "",
  "Asiakas",
  "Ravintola Cafe Monami",
  "Kauppurienkatu 3, 90100 Oulu",
  "",
  "Tuotteet                            1 000,40",
  "Arvonlisavero 14 %                    140,06",
  "MAKSETTAVA YHTEENSA                 1 140,46 EUR",
  "",
  "Tilinumero  FI21 1234 5600 0007 85",
  "Viitenumero 12344",
  "BIC         NDEAFIHH",
];

const AJA = key ? describe : describe.skip;

AJA("laskun poiminta oikealla mallilla", () => {
  it(
    "lukee erapaivan, summan ja viitteen oikein",
    async () => {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: key! });

      const response = await client.messages.parse({
        model: "claude-sonnet-5",
        max_tokens: 4000,
        system: INVOICE_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: invoicePdf(LASKU).toString("base64"),
                },
              },
              { type: "text", text: "Poimi tämän laskun tiedot." },
            ],
          },
        ],
        output_config: { format: zodOutputFormat(invoiceSchema) },
      });

      const parsed = response.parsed_output as InvoiceExtraction;
      console.log(JSON.stringify(parsed, null, 2));

      expect(parsed.isInvoice).toBe(true);

      /* Eräpäivä, ei päiväys eikä toimituspäivä. */
      expect(parsed.dueDate.value).toBe("2026-09-15");

      /* Saaja on laskuttaja, ei ravintola joka maksaa. */
      expect(parsed.supplier.value).toMatch(/Pohjola/i);

      /* Sentteinä, ALV mukaan lukien. */
      expect(parsed.totalCents.value).toBe(114046);

      /* Viitenumero, ei laskun numero. */
      expect(parsed.reference.value?.replace(/\D/g, "")).toBe("12344");
      expect(parsed.iban.value?.replace(/\s/g, "")).toBe("FI2112345600000785");

      /* Ja koko ketju loppuun asti. */
      const draft = invoiceToTask(parsed, "2026-09-01");
      console.log(draft);

      expect(draft.dueOn).toBe("2026-09-15");
      expect(draft.description).toContain("Viite 12344");
      expect(draft.uncertain).toEqual([]);
    },
    120_000,
  );

  it(
    "ei pida kuittia laskuna",
    async () => {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey: key! });

      const response = await client.messages.parse({
        model: "claude-sonnet-5",
        max_tokens: 4000,
        system: INVOICE_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: invoicePdf([
                    "K-MARKET RUSKO",
                    "26.08.2026 klo 14:12",
                    "",
                    "Maito 1 l        1,29",
                    "Ruisleipa        2,45",
                    "YHTEENSA         3,74",
                    "Kortti           3,74",
                  ]).toString("base64"),
                },
              },
              { type: "text", text: "Poimi tämän laskun tiedot." },
            ],
          },
        ],
        output_config: { format: zodOutputFormat(invoiceSchema) },
      });

      const parsed = response.parsed_output as InvoiceExtraction;
      console.log(JSON.stringify(parsed, null, 2));

      /*
       * Kuitti ei ole lasku. Ilman tätä tarkistusta ostoskuitista
       * syntyisi maksumuistutus jolla ei ole eräpäivää eikä saajaa.
       */
      expect(parsed.isInvoice).toBe(false);
    },
    120_000,
  );
});

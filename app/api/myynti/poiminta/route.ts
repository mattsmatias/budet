/**
 * Kassan päiväraportin poiminta kuvasta.
 *
 * Palvelimella, koska API-avain ei voi olla selaimessa: NEXT_PUBLIC-
 * muuttuja päätyy sivun lähdekoodiin ja on siten julkinen.
 *
 * KESKEINEN SÄÄNTÖ säilyy kuiteista: malli palauttaa arvon ja
 * luottamuksen, ei pelkkää arvoa. Arvot tarkistetaan vielä tässä —
 * mahdoton summa tai tuleva päivä pudotetaan tyhjäksi. Tyhjä kenttä on
 * parempi kuin keksitty: käyttäjä täyttää sen itse ja tietää tehneensä
 * niin.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireContext } from "@/lib/restoflow/session";
import { explainAiError } from "@/lib/matti/errors";
import { can } from "@/lib/restoflow/permissions";
import { DEFAULT_MODEL, isRealExtractor } from "@/lib/restoflow/receipt-ai";
import { emptySalesExtraction, type SalesExtraction } from "@/lib/restoflow/sales-ai";
import { plausibleReportDate } from "@/lib/restoflow/sales-report";
import { todayIn } from "@/lib/restoflow/clock-context";
import type { Extracted } from "@/lib/restoflow/types";

/** Poiminta voi kestää: iso kuva ja tarkka luku vievät aikaa. */
export const maxDuration = 60;

const MAX_BYTES = 20 * 1024 * 1024;

/** Yhden pyynnön yhteiskoko. Sivuja saa olla monta, tavuja ei rajatta. */
const MAX_TOTAL_BYTES = 28 * 1024 * 1024;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const PDF_TYPE = "application/pdf";

/**
 * Ylin summa jonka päiväraportti voi näyttää.
 *
 * Miljoona euroa päivässä ei ole ravintola vaan luentavirhe — yleensä
 * senttierottimen katoaminen. Raja on tässä eikä kannassa, koska tämä
 * on ainoa paikka jossa luku on koneen keksimä.
 */
const MAX_CENTS = 100_000_000;

const confidence = z.enum(["high", "medium", "low"]);

const extraction = z.object({
  date: z.object({ value: z.string().nullable(), confidence }),
  grossCents: z.object({ value: z.number().int().nullable(), confidence }),
  vatCents: z.object({ value: z.number().int().nullable(), confidence }),
  netCents: z.object({ value: z.number().int().nullable(), confidence }),
  transactions: z.object({ value: z.number().int().nullable(), confidence }),
  groups: z.array(
    z.object({
      posName: z.string(),
      grossCents: z.number().int(),
      vatCents: z.number().int().nullable(),
    }),
  ),
  vatRates: z.array(
    z.object({
      ratePercent: z.number(),
      vatCents: z.number().int(),
      netCents: z.number().int().nullable(),
      grossCents: z.number().int().nullable(),
    }),
  ),
  imageQuality: z.enum(["good", "poor"]),
});

const SYSTEM_PROMPT = `Luet ravintolan kassajärjestelmän päiväraporttia (Z-raportti, päivän myyntiraportti) ja poimit siitä päivän luvut.

Palauta jokaiselle kentälle arvo JA luottamus. Jos et näe arvoa selvästi, palauta null ja luottamus "low". Älä koskaan arvaa lukua.

KENTÄT

date: raportin myyntipäivä muodossa YYYY-MM-DD. Raportissa se on usein "Päivä", "Pvm", "Myyntipäivä" tai tulostuspäivä. Jos raportissa on sekä myyntipäivä että tulostusaika, valitse myyntipäivä. Suomalainen muoto 25.08.2026 tarkoittaa 2026-08-25.

grossCents: verollinen myynti yhteensä sentteinä. Raportissa "Myynti yhteensä", "Yhteensä", "Brutto", "Kokonaismyynti". Tämä on suurin summa raportissa. 2 430,50 € = 243050.

vatCents: arvonlisävero yhteensä sentteinä. Raportissa "ALV yhteensä" tai ALV-erittelyn rivien summa. Jos erittelyssä on useita kantoja (14 %, 25,5 %, 10 %, 0 %), laske veron osuudet yhteen — älä palauta yhtä riviä.

netCents: veroton myynti sentteinä. Raportissa "Veroton", "ALV 0 %", "Netto", "Verollinen myynti ilman ALV". Huomaa: "ALV 0 %" ALV-erittelyn rivinä tarkoittaa nollaverokannan myyntiä eikä koko verotonta summaa — älä sekoita niitä.

groups: myyntiryhmien erittely. Kassan päiväraportissa myynti on lähes aina jaettu ryhmiin: "Ruoka", "Juomat", "Viini", "Olut", "Take away", "Kahvi". Palauta jokainen ryhmä omana alkionaan.

posName: ryhmän nimi täsmälleen sellaisena kuin se raportissa lukee.
grossCents: ryhmän myynti verollisena sentteinä.
vatCents: kyseisen ryhmän ALV sentteinä, jos raportti kertoo sen ryhmäkohtaisesti. Jos ALV on eritelty vain verokannoittain eikä ryhmittäin, palauta null.

Älä laske ryhmiä yhteen äläkä jaa niitä osiin. Älä keksi ryhmää jota raportissa ei ole. Jos raportti ei erittele myyntiä ryhmiin lainkaan, palauta tyhjä lista.

Palautus-, alennus- ja mitätöintirivit eivät ole myyntiryhmiä. Maksutavat (Kortti, Käteinen) eivät ole myyntiryhmiä — ne kertovat miten maksettiin, eivät mitä myytiin.

vatRates: raportin ALV-erittely verokannoittain. Lähes jokainen Z-raportti päättyy taulukkoon jossa on rivi kutakin verokantaa kohti: "ALV 25,5 %", "ALV 13,50 %", "ALV 10 %", "ALV 0 %". Riviltä löytyy kolme lukua: vero, veroton ja verollinen. Sarakkeet voivat olla otsikoitu "ALV / NE / TTC", "Vero / Veroton / Verollinen" tai "ALV / Netto / Brutto".

ratePercent: verokanta prosenttilukuna sellaisena kuin se rivillä lukee. 25,5 % = 25.5. 13,50 % = 13.5. Ei osuutena.
vatCents: rivin veron määrä sentteinä. Tämä on pakollinen — ilman sitä riviä ei palauteta lainkaan.
netCents: rivin veroton myynti sentteinä, tai null jos raportti ei kerro sitä.
grossCents: rivin verollinen myynti sentteinä, tai null jos raportti ei kerro sitä.

Osa kassoista tulostaa kannoittain vain veron: "ALV 14 % 12,34". Palauta silloin vatCents ja jätä netCents ja grossCents nulliksi. ÄLÄ laske puuttuvia lukuja verosta ja kannasta — laskettu luku näyttäisi raportissa lukevalta.

Tämä taulukko on eri asia kuin myyntiryhmät. Ryhmät kertovat mitä myytiin, ALV-erittely millä kannalla. Palauta molemmat jos molemmat ovat raportissa.

transactions: kuittien tai tapahtumien lukumäärä. Raportissa "Kuitteja", "Tapahtumia", "Asiakkaita", "Myyntitapahtumat". Ei euroja vaan kappaleita.

TÄRKEÄÄ

Älä laske puuttuvaa lukua muista luvuista. Jos veroton ei lue raportissa, palauta null — laskeminen tehdään muualla ja sen on näyttävä lasketulta.

Palautukset, alennukset ja mitätöinnit eivät ole myyntiä. Jos raportissa on erikseen "Myynti yhteensä" ja "Netto" jossa palautukset on vähennetty, valitse se mikä on päivän toteutunut myynti.

Jos kuvassa ei ole päiväraporttia lainkaan — se on kuitti, valokuva ruoasta tai jotain muuta — palauta kaikki kentät nullina ja imageQuality "poor".

imageQuality: "poor" jos kuva on epätarkka, vinossa, osittain rajattu tai heikosti valaistu niin että numeroista voi erehtyä.`;

export async function POST(request: Request) {
  // Poiminta maksaa jokaisesta kutsusta, joten reitti ei ole auki
  // kenellekään kirjautuneelle vaan niille jotka kirjaavat myyntiä.
  const { role, restaurant } = await requireContext("/admin/myynti");
  if (!can(role, "sales.manage")) {
    return NextResponse.json({ error: "Ei oikeutta." }, { status: 403 });
  }

  if (!isRealExtractor()) {
    // 501 on sovittu merkki selaimelle: palaa jäljitelmään äläkä näytä
    // virhettä. Myynnin kirjaamisen on toimittava ilman poimintaa.
    return NextResponse.json({ error: "Poimintaa ei ole kytketty." }, { status: 501 });
  }

  const form = await request.formData();

  /*
   * Raportti voi olla monta kuvaa.
   *
   * Z-raportti on pitkä liuska. Puhelimella siitä saa tarkan kuvan
   * vain osissa, ja aiemmin toinen puolisko oli pakko jättää
   * lukematta. Vanha "file"-kenttä kelpaa yhä: se on sama pyyntö
   * yhdellä sivulla.
   */
  const files = [...form.getAll("pages"), ...form.getAll("file")].filter(
    (entry): entry is File => entry instanceof File,
  );

  if (files.length === 0) {
    return NextResponse.json({ error: "Tiedosto puuttuu." }, { status: 400 });
  }

  let totalBytes = 0;

  for (const file of files) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Tiedosto on liian suuri. Kuvaa raportti uudelleen." },
        { status: 413 },
      );
    }

    totalBytes += file.size;

    if (file.type !== PDF_TYPE && !IMAGE_TYPES.has(file.type)) {
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
   * Sivumäärää ei rajata, yhteiskokoa rajataan.
   *
   * Raportissa on niin monta sivua kuin siinä on, mutta yksi pyyntö ei
   * saa kasvaa rajatta: liian suuri pyyntö epäonnistuu vasta
   * rajapinnassa, ja silloin virhe on siellä eikä täällä.
   */
  if (totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      {
        error:
          "Kuvat ovat yhteensä liian suuret. Kuvaa raportti harvempana " +
          "sivuna tai pienemmällä tarkkuudella.",
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
              media_type: file.type as
                | "image/jpeg"
                | "image/png"
                | "image/gif"
                | "image/webp",
              data: base64,
            },
          });
    }),
  );

  const client = new Anthropic();

  try {
    const response = await client.messages.parse({
      model: process.env.RECEIPT_MODEL ?? DEFAULT_MODEL,
      max_tokens: 4000,
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
                  ? "Poimi tämän päiväraportin luvut."
                  : `Poimi tämän päiväraportin luvut. Raportti on ${files.length} ` +
                    "kuvassa, järjestyksessä. Ne ovat saman raportin osia: " +
                    "myyntiryhmät jatkuvat kuvasta toiseen, ja ALV-erittely " +
                    "sekä loppusumma ovat tavallisesti viimeisessä. Poimi " +
                    "jokainen ryhmä kerran — jos sama ryhmä näkyy kahdessa " +
                    "kuvassa päällekkäisen rajauksen takia, palauta se vain " +
                    "kerran äläkä laske summia yhteen.",
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
        { error: "Kuvaa ei voitu lukea. Täytä luvut käsin." },
        { status: 422 },
      );
    }

    const parsed = response.parsed_output;
    if (!parsed) return NextResponse.json(emptySalesExtraction());

    return NextResponse.json(sanitize(parsed, todayIn(restaurant.timezone)));
  } catch (error) {
    /*
     * Kerrotaan mitä tapahtui. Hiljainen paluu tyhjään lomakkeeseen
     * näyttäisi siltä ettei raportissa ollut mitään luettavaa, ja
     * käyttäjä kuvaisi sen turhaan uudelleen.
     */
    const failure = explainAiError(error);

    console.error("myynnin poiminta: mallikutsu epäonnistui", {
      reason: failure.reason,
      error: error instanceof Error ? error.message : String(error),
    });

    const message = failure.retryable
      ? `${failure.message} Voit myös täyttää luvut käsin.`
      : `${failure.message} Täytä luvut käsin siihen asti.`;

    return NextResponse.json(
      { error: message, retryable: failure.retryable },
      { status: failure.status },
    );
  }
}

// ---------------------------------------------------------------------------

/**
 * Mahdoton arvo pudotetaan tyhjäksi.
 *
 * Malli voi lukea väärin, ja väärin luettu luku on vaarallisempi kuin
 * puuttuva: puuttuvan käyttäjä huomaa, väärän hän tallentaa.
 */
function sanitize(
  parsed: z.infer<typeof extraction>,
  today: string,
): Omit<SalesExtraction, "elapsedMs"> {
  const money = (field: Extracted<number>): Extracted<number> =>
    field.value !== null && field.value >= 0 && field.value <= MAX_CENTS
      ? field
      : { value: null, confidence: "low" };

  const date =
    parsed.date.value !== null && plausibleReportDate(parsed.date.value, today)
      ? parsed.date
      : { value: null, confidence: "low" as const };

  /*
   * Tuhat kuittia päivässä on kolme sekunnin välein kahdeksan tunnin
   * ajan. Sitä suurempi luku on lähes varmasti euromäärä joka on
   * luettu kappalemääräksi.
   */
  const transactions =
    parsed.transactions.value !== null &&
    parsed.transactions.value >= 0 &&
    parsed.transactions.value <= 1000
      ? parsed.transactions
      : { value: null, confidence: "low" as const };

  /*
   * Mahdoton ryhmä pudotetaan, ei koko erittelyä.
   *
   * Yksi väärin luettu rivi ei saa hävittää muita — vajaa erittely
   * näkyy täsmäytyksessä erona, ja se on parempi kuin erittelyn
   * puuttuminen kokonaan.
   */
  const groups = parsed.groups
    .filter(
      (g) =>
        g.posName.trim() !== "" &&
        g.grossCents >= 0 &&
        g.grossCents <= MAX_CENTS &&
        (g.vatCents === null || (g.vatCents >= 0 && g.vatCents <= g.grossCents)),
    )
    .map((g) => ({
      posName: g.posName.trim().slice(0, 80),
      grossCents: g.grossCents,
      vatCents: g.vatCents,
    }));

  /*
   * ALV-rivi kelpaa vajaanakin, muttei ristiriitaisena.
   *
   * Vero on ainoa pakollinen luku: osa kassoista tulostaa kannoittain
   * vain sen. Veroton ja verollinen ovat vertailun tarkkuutta, eivät
   * sen edellytys.
   *
   * Jos molemmat kuitenkin ovat, niiden on summauduttava verolliseksi
   * sentin sisällä. Ristiriitainen rivi on luettu väärin, eikä väärin
   * luettu kassan luku saa päästä kirjanpidon lähteeksi — se on juuri
   * se luku johon kaikki muu verrataan.
   */
  const vatRates = parsed.vatRates
    .filter((r) => {
      const rate = r.ratePercent / 100;

      if (rate < 0 || rate >= 1) return false;
      if (r.vatCents < 0 || r.vatCents > MAX_CENTS) return false;
      if (r.netCents !== null && (r.netCents < 0 || r.netCents > MAX_CENTS)) return false;
      if (r.grossCents !== null && (r.grossCents < 0 || r.grossCents > MAX_CENTS)) {
        return false;
      }

      if (r.netCents === null || r.grossCents === null) return true;

      return Math.abs(r.vatCents + r.netCents - r.grossCents) <= 1;
    })
    .map((r) => ({
      // Prosentti sentin tarkkuudella: 13,5 % → 0,135. Pyöristys on
      // tässä, koska 13.5/100 ei ole tarkka liukuluku.
      vatRate: Math.round(r.ratePercent * 1000) / 100000,
      vatCents: r.vatCents,
      netCents: r.netCents,
      grossCents: r.grossCents,
    }));

  return {
    date,
    groups,
    vatRates,
    grossCents: money(parsed.grossCents),
    vatCents: money(parsed.vatCents),
    netCents: money(parsed.netCents),
    transactions,
    imageQuality: parsed.imageQuality,
  };
}

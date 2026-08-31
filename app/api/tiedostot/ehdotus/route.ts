/**
 * Arkistointiehdotus ladattavalle tiedostolle.
 *
 * Ravintoloitsija ottaa kuvan paperista tai pudottaa PDF:n. Kate lukee
 * sen ja ehdottaa kaikkea kerralla: nimen, kansion, voimassaolon ja
 * toimittajan.
 *
 * Ongelma ei ole että arkistointi olisi vaikeaa. Se on tylsää, ja siksi
 * sitä ei tehdä — paperit jäävät laatikkoon ja PDF:t sähköpostiin.
 *
 * ---------------------------------------------------------------------
 * KATE EHDOTTAA, KÄYTTÄJÄ PÄÄTTÄÄ
 * ---------------------------------------------------------------------
 *
 * Vastaus täyttää lomakkeen kentät. Käyttäjä näkee ne ja voi muuttaa
 * jokaista ennen tallennusta. Mitään ei tallenneta tässä.
 *
 * Kansio ehdotetaan vain jos se on Katen oma lähtökansio jota käyttäjä
 * ei ole nimennyt uudelleen — tai jos saman toimittajan aiemmat
 * tiedostot ovat jossakin kansiossa. Jälkimmäinen on parempi ehdotus
 * kuin Katen mielipide: se on käyttäjän oma aiempi valinta.
 *
 * Jos käyttäjä on rakentanut oman rakenteensa eikä toimittajasta ole
 * historiaa, kansiota ei ehdoteta. Rakenteen arvailu nimien perusteella
 * olisi juuri se ylimääräinen älykkyys josta seuraa tiedostoja
 * väärissä paikoissa.
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
  DOCUMENT_PROMPT,
  documentSchema,
  folderKeyFor,
  type DocumentExtraction,
} from "@/lib/restoflow/document-ai";
import { loadFolders } from "@/lib/restoflow/file-queries";
import { suggestName } from "@/lib/restoflow/files";
import { createClient } from "@/utils/supabase/server";

export const maxDuration = 60;

export interface FileProposal {
  /** Mitä Kate arvelee asiakirjan olevan. Näytetään sellaisenaan. */
  title: string | null;
  name: string | null;
  folderId: string | null;
  expiresOn: string | null;
  supplierId: string | null;
  supplierName: string | null;
  /** Matalalla varmuudella ehdotus näytetään varauksellisemmin. */
  sure: boolean;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext("/admin/tiedostot");

  if (!can(role, "files.manage")) {
    return NextResponse.json({ error: t.tiedosto.readOnly }, { status: 403 });
  }

  if (!isRealExtractor()) {
    /* 501: selain piilottaa painikkeen eikä näytä virhettä. */
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

  let parsed: DocumentExtraction | null = null;

  try {
    const client = new Anthropic();

    const response = await client.messages.parse({
      model: process.env.RECEIPT_MODEL ?? DEFAULT_MODEL,
      max_tokens: 2000,
      system: DOCUMENT_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            ...(await toContentBlocks(files)),
            { type: "text", text: "Mikä asiakirja tämä on ja mitä siitä löytyy?" },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(documentSchema) },
    });

    if (response.stop_reason !== "refusal") {
      parsed = response.parsed_output as DocumentExtraction | null;
    }
  } catch (error) {
    /*
     * Epäonnistuminen on hiljainen.
     *
     * Ehdotus on mukavuus, ei toiminto. Lataus onnistuu ilman sitä, ja
     * virheilmoitus olisi este asialle joka toimii.
     */
    console.error("arkistointiehdotus epäonnistui", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (!parsed) return NextResponse.json({ proposal: null });

  const issuer = parsed.issuer.value?.trim() || null;
  const supplier = await matchSupplier(restaurant.id, issuer);

  return NextResponse.json({
    proposal: {
      title: parsed.title.value?.trim() || null,
      name: suggestName(original, issuer ?? parsed.title.value, parsed.date.value),
      folderId: await pickFolder(restaurant.id, parsed, supplier?.id ?? null),
      expiresOn: ISO_DATE.test(parsed.validUntil.value ?? "")
        ? parsed.validUntil.value
        : null,
      supplierId: supplier?.id ?? null,
      supplierName: supplier?.name ?? null,
      sure:
        parsed.title.confidence === "high" && parsed.imageQuality === "good",
    } satisfies FileProposal,
  });
}

/**
 * Toimittaja nimen perusteella.
 *
 * Tarkka osuma ensin, sitten sisältyminen kumpaankin suuntaan: laskussa
 * lukee "Metro Tukku Oy" ja ravintolan listalla "Metro". Yksi osuma
 * kelpaa, useampi ei — kahdesta samannimisestä ei voi valita puolesta.
 */
async function matchSupplier(
  restaurantId: string,
  issuer: string | null,
): Promise<{ id: string; name: string } | null> {
  if (!issuer || issuer.length < 3) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("restaurant_id", restaurantId);

  const suppliers = (data as { id: string; name: string }[] | null) ?? [];
  const needle = issuer.toLowerCase();

  const exact = suppliers.filter((s) => s.name.toLowerCase() === needle);
  if (exact.length === 1) return exact[0];

  const partial = suppliers.filter((s) => {
    const name = s.name.toLowerCase();
    return name.includes(needle) || needle.includes(name);
  });

  return partial.length === 1 ? partial[0] : null;
}

/**
 * Kansio: ensin käyttäjän oma tapa, sitten Katen oletus.
 *
 * Jos saman toimittajan aiemmat tiedostot ovat kaikki yhdessä
 * kansiossa, se on parempi ehdotus kuin mikään Katen mielipide — se on
 * käyttäjän oma aiempi valinta. Hajallaan olevat eivät kerro mitään,
 * joten silloin ei ehdoteta niiden perusteella.
 */
async function pickFolder(
  restaurantId: string,
  parsed: DocumentExtraction,
  supplierId: string | null,
): Promise<string | null> {
  const supabase = await createClient();

  if (supplierId) {
    const { data } = await supabase
      .from("files")
      .select("folder_id")
      .eq("restaurant_id", restaurantId)
      .eq("supplier_id", supplierId)
      .is("deleted_at", null)
      .not("folder_id", "is", null)
      .limit(50);

    const folders = ((data as { folder_id: string }[] | null) ?? []).map(
      (row) => row.folder_id,
    );

    const unique = [...new Set(folders)];
    if (unique.length === 1) return unique[0];
  }

  const key = folderKeyFor(parsed.kind);
  if (!key) return null;

  const all = await loadFolders(restaurantId);
  return all.find((folder) => folder.defaultKey === key)?.id ?? null;
}

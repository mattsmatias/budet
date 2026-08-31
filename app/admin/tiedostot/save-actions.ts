"use server";

/**
 * Katen omat asiakirjat tiedostokaappiin.
 *
 * Raportti, kuitti tai lasku on jo olemassa Katessa. Ilman tätä
 * ravintoloitsija joutuisi lataamaan sen koneelleen ja lataamaan
 * takaisin — kahden askeleen kierros, jonka päässä tiedosto on samassa
 * järjestelmässä josta se lähti.
 *
 * ---------------------------------------------------------------------
 * TIEDOSTO SYNTYY PALVELIMELLA
 * ---------------------------------------------------------------------
 *
 * Tavallisessa latauksessa selain lähettää tiedoston suoraan storageen,
 * koska se on käyttäjän oma tiedosto ja voi olla kaksikymmentäviisi
 * megatavua. Tässä tiedosto syntyy palvelimella joka tapauksessa:
 * raportti rakennetaan kannasta ja kuitti kopioidaan toisesta
 * bucketista. Kierrätys selaimen kautta olisi kaksi ylimääräistä
 * siirtoa eikä toisi mitään.
 *
 * Oikeudet tarkistaa kanta: storage-käytäntö polusta ja register_file
 * omalla is_manager-tarkistuksellaan.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { ISO_MONTH } from "@/lib/restoflow/dates";
import { can } from "@/lib/restoflow/permissions";
import {
  buildReportFile,
  isReportProblem,
  type ReportFormat,
} from "@/lib/restoflow/report-file";
import { REPORT_KINDS, type ReportKind } from "@/lib/restoflow/report-rows";
import { requireContext } from "@/lib/restoflow/session";
import { loadFolders } from "@/lib/restoflow/file-queries";
import { folderPath } from "@/lib/restoflow/files";
import { createClient } from "@/utils/supabase/server";
import type { FileState } from "./actions";

const UUID = z.string().uuid();

export interface FolderChoice {
  id: string | null;
  /** Koko polku, esimerkiksi "Talous / 2026 / Elokuu". */
  path: string;
}

/**
 * Kansiot valintalistaan.
 *
 * Koko polku eikä pelkkä nimi: "2026" yksinään ei kerro kummasta
 * vuodesta on kyse, jos niitä on kaksi eri haarassa.
 */
export async function folderChoices(): Promise<FolderChoice[]> {
  const { restaurant, role } = await requireContext("/admin/tiedostot");
  if (!can(role, "files.manage")) return [];

  const folders = await loadFolders(restaurant.id);

  return folders
    .map((folder) => ({ id: folder.id, path: folderPath(folders, folder.id) }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Tallennus storageen ja kirjaus kantaan.
 *
 * Sama kahden vaiheen kuvio kuin selaimen latauksessa: objekti ensin,
 * rivi sen jälkeen. Jos kirjaus epäonnistuu, objekti poistetaan —
 * muuten jäisi tiedosto jota kukaan ei näe eikä voi poistaa, koska
 * sillä ei ole riviä missään näkymässä.
 */
async function store(
  restaurantId: string,
  folderId: string | null,
  fileName: string,
  mime: string,
  bytes: Uint8Array | Blob,
  link: { receiptId?: string } = {},
): Promise<string | null> {
  const supabase = await createClient();

  const extension = fileName.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${restaurantId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("files")
    .upload(path, bytes, { contentType: mime, upsert: false });

  if (uploadError) return uploadError.message;

  const { error } = await supabase.rpc("register_file", {
    p_restaurant: restaurantId,
    p_folder: folderId,
    p_name: fileName,
    p_path: path,
    p_type: mime,
    p_size: bytes instanceof Blob ? bytes.size : bytes.length,
    p_receipt: link.receiptId ?? null,
  });

  if (error) {
    await supabase.storage.from("files").remove([path]);
    return error.message;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Raportit
// ---------------------------------------------------------------------------

export async function saveReportToFiles(input: {
  kind: ReportKind | null;
  month: string;
  format: ReportFormat;
  folderId: string | null;
}): Promise<FileState> {
  const locale = await resolveLocale();
  const t = adminText(locale);
  const { restaurant, role } = await requireContext("/admin/raportit");

  /*
   * Kaksi oikeutta, molemmat tarpeen.
   *
   * Viennin oikeus kertoo saako raportin ulos; kaapin oikeus saako
   * sinne kirjoittaa. Kirjanpitäjä saa viedä muttei tallentaa, ja
   * esihenkilö joka ei saa viedä ei saa tallentaakaan.
   */
  if (!can(role, "reports.export") || !can(role, "files.manage")) {
    return { error: t.tiedosto.readOnly };
  }

  const parsed = z
    .object({
      kind: z.enum(REPORT_KINDS as unknown as [string, ...string[]]).nullable(),
      month: z.string().regex(ISO_MONTH),
      format: z.enum(["csv", "xlsx"]),
      folderId: UUID.nullable(),
    })
    .safeParse(input);

  if (!parsed.success) return { error: t.tiedosto.errorGeneric };

  const built = await buildReportFile({
    restaurantId: restaurant.id,
    role,
    timezone: restaurant.timezone,
    locale,
    t,
    kind: parsed.data.kind as ReportKind | null,
    month: parsed.data.month,
    format: parsed.data.format,
  });

  if (isReportProblem(built)) {
    return {
      error:
        built === "accounting"
          ? t.raportti.noRightAccounting
          : t.tiedosto.errorGeneric,
    };
  }

  const problem = await store(
    restaurant.id,
    parsed.data.folderId,
    built.fileName,
    built.mime,
    built.bytes,
  );

  if (problem) return { error: t.tiedosto.errorUpload };

  revalidatePath("/admin/tiedostot");
  return { notice: built.fileName };
}

// ---------------------------------------------------------------------------
// Kuitit ja laskut
// ---------------------------------------------------------------------------

/**
 * Kuitin kuvat kaappiin.
 *
 * Kuva on jo receipts-bucketissa. Se kopioidaan files-bucketiin eikä
 * viitata alkuperäiseen: kuitin poisto ei saa tyhjentää kaappiin
 * tallennettua tositetta, ja kaapin tiedostot elävät omaa elämäänsä
 * siitä hetkestä lähtien kun ne on sinne pantu.
 *
 * Monisivuinen kuitti tallentuu monena tiedostona numeroituna. Yksi
 * tiedosto jossa on vain ensimmäinen sivu olisi tosite joka näyttää
 * täydelliseltä muttei ole.
 */
export async function saveReceiptToFiles(input: {
  receiptId: string;
  folderId: string | null;
}): Promise<FileState> {
  const t = adminText(await resolveLocale());
  const { restaurant, role } = await requireContext("/admin/kuitit");

  if (!can(role, "receipts.view") || !can(role, "files.manage")) {
    return { error: t.tiedosto.readOnly };
  }

  if (!UUID.safeParse(input.receiptId).success) {
    return { error: t.tiedosto.errorGeneric };
  }
  if (input.folderId !== null && !UUID.safeParse(input.folderId).success) {
    return { error: t.tiedosto.errorGeneric };
  }

  const supabase = await createClient();

  /*
   * Kuitti haetaan tunnisteella rivitason käytäntöjen läpi.
   *
   * Toisen ravintolan tunniste ei palauta riviä lainkaan, joten
   * erillistä ravintolatarkistusta ei tarvita — ja jos käytäntö
   * jostain syystä pettäisi, register_file torjuisi polun joka ei ala
   * tämän ravintolan tunnisteella.
   */
  const { data: receipt } = await supabase
    .from("receipts")
    .select(
      "id, supplier_name, receipt_date, image_path, receipt_pages(page_number, storage_path)",
    )
    .eq("id", input.receiptId)
    .maybeSingle();

  const row = receipt as
    | {
        supplier_name: string | null;
        receipt_date: string | null;
        image_path: string | null;
        receipt_pages: { page_number: number; storage_path: string }[] | null;
      }
    | null;

  if (!row) return { error: t.tiedosto.errorGeneric };

  /*
   * Sivut järjestyksessä, ja vanha yhden kuvan kuitti mukaan.
   *
   * receipt_pages on uudempi rakenne. Ennen sitä kuva oli receiptsin
   * image_path-sarakkeessa, ja niitä kuitteja on kannassa yhä — ne
   * eivät saa jäädä tallennuksen ulkopuolelle.
   */
  const pages = (row.receipt_pages ?? [])
    .filter((page) => page.storage_path)
    .sort((a, b) => a.page_number - b.page_number);

  if (pages.length === 0 && row.image_path) {
    pages.push({ page_number: 1, storage_path: row.image_path });
  }

  if (pages.length === 0) return { error: t.tiedosto.errorGeneric };

  const merchant = (row.supplier_name ?? "").trim() || t.tiedosto.title;
  const date = (row.receipt_date ?? "").slice(0, 10);

  let saved = 0;

  for (const [index, page] of pages.entries()) {
    const { data: blob, error } = await supabase.storage
      .from("receipts")
      .download(page.storage_path);

    if (error || !blob) continue;

    const extension = page.storage_path.split(".").pop()?.toLowerCase() ?? "jpg";
    const suffix = pages.length > 1 ? `-${index + 1}` : "";

    /* Nimi puhdistetaan: kauppiaan nimessä voi olla mitä tahansa. */
    const safeName = `${merchant} ${date}${suffix}.${extension}`
      .replace(/[\\/:*?"<>|]/g, "-")
      .slice(0, 200);

    /*
     * Liitos kuittiin syntyy itsestaan.
     *
     * Tiedosto ON se kuitti. Erikseen liitettava tieto jaisi
     * liittamatta, ja kuittisivu nayttaisi tyhjaa vaikka tosite on
     * kaapissa.
     */
    const problem = await store(
      restaurant.id,
      input.folderId,
      safeName,
      blob.type || "image/jpeg",
      blob,
      { receiptId: input.receiptId },
    );

    if (!problem) saved += 1;
  }

  if (saved === 0) return { error: t.tiedosto.errorUpload };

  revalidatePath("/admin/tiedostot");
  return { notice: `${merchant} ${date}` };
}

// ---------------------------------------------------------------------------
// Toimittajat liitosvalintaan
// ---------------------------------------------------------------------------

export interface SupplierChoice {
  id: string;
  name: string;
}

/**
 * Ravintolan toimittajat nimeltä.
 *
 * Haetaan vasta kun liitosdialogi avataan. Toimittajia voi olla
 * satoja, eikä niitä kannata kuljettaa jokaisen tiedostorivin mukana
 * listaan jossa käyttäjä avaa yhden valikon tai ei yhtään.
 */
export async function supplierChoices(): Promise<SupplierChoice[]> {
  const { restaurant, role } = await requireContext("/admin/tiedostot");
  if (!can(role, "files.manage")) return [];

  const supabase = await createClient();

  const { data } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("restaurant_id", restaurant.id)
    .order("name");

  return ((data as SupplierChoice[] | null) ?? []).map((row) => ({
    id: row.id,
    name: row.name,
  }));
}

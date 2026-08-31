/**
 * Tiedostokaapin luku.
 *
 * Erillään files.ts:stä, koska tämä tuo palvelimen Supabase-asiakkaan.
 * Sen tuominen klienttikomponenttiin rikkoo käännöksen — ja rikkoo sen
 * vasta buildissa, kun kaikki näyttää toimivan.
 *
 * ---------------------------------------------------------------------
 * LUKU KULKEE KÄYTÄNTÖJEN LÄPI, EI FUNKTIOIDEN
 * ---------------------------------------------------------------------
 *
 * Muutokset kulkevat security definer -funktioiden kautta, koska niihin
 * liittyy tarkistuksia joita käytäntö ei osaa ilmaista. Luku ei
 * tarvitse niitä: rivitason käytäntö sanoo täsmälleen saman kuin
 * funktio sanoisi, ja suora kysely on yksi kerros vähemmän jossa voi
 * olla vikaa.
 */

import { createClient } from "@/utils/supabase/server";
import type { Crumb, FileRow, FolderRow } from "./files";

/*
 * Allekirjoitetun osoitteen voimassaolo.
 *
 * Tunti, kuten kuiteilla. Osoite riittää yhden istunnon ajaksi eikä jää
 * elämään sähköpostiin liitettynä.
 */
const URL_SECONDS = 3600;

interface FolderRecord {
  id: string;
  parent_folder_id: string | null;
  name: string;
  sort_order: number;
  created_at: string;
}

interface FileRecord {
  id: string;
  folder_id: string | null;
  file_name: string;
  storage_path: string;
  file_type: string;
  file_size: number;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  expires_on: string | null;
  supplier_id: string | null;
  receipt_id: string | null;
  deleted_at: string | null;
}

const FILE_COLUMNS =
  "id, folder_id, file_name, storage_path, file_type, file_size, is_favorite, " +
  "created_at, updated_at, expires_on, supplier_id, receipt_id, deleted_at";

function toFile(row: FileRecord, folderPath?: string): FileRow {
  return {
    id: row.id,
    folderId: row.folder_id,
    name: row.file_name,
    storagePath: row.storage_path,
    type: row.file_type,
    size: Number(row.file_size),
    isFavorite: row.is_favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresOn: row.expires_on,
    supplierId: row.supplier_id,
    receiptId: row.receipt_id,
    deletedAt: row.deleted_at,
    ...(folderPath === undefined ? {} : { folderPath }),
  };
}

/**
 * Koko kansiopuu tiedostomäärineen.
 *
 * Kansioita on ravintolassa kymmeniä, ei tuhansia, joten puu haetaan
 * aina kokonaan. Se maksaa yhden kyselyn ja antaa vastineeksi
 * murupolun, siirtovalikon kohteet ja alikansioiden tunnistuksen ilman
 * yhtään lisäkyselyä.
 */
export async function loadFolders(restaurantId: string): Promise<FolderRow[]> {
  const supabase = await createClient();

  const [{ data: folders }, { data: counts }] = await Promise.all([
    supabase
      .from("folders")
      .select("id, parent_folder_id, name, sort_order, created_at")
      .eq("restaurant_id", restaurantId)
      .is("deleted_at", null)
      .order("sort_order")
      .order("name"),
    supabase.rpc("folder_counts", { p_restaurant: restaurantId }),
  ]);

  if (!folders) return [];

  const byFolder = new Map<string, number>(
    ((counts as { folder_id: string; file_count: number }[] | null) ?? []).map(
      (row) => [row.folder_id, Number(row.file_count)],
    ),
  );

  const rows = folders as FolderRecord[];
  const parents = new Set(
    rows.map((row) => row.parent_folder_id).filter((id): id is string => Boolean(id)),
  );

  return rows.map((row) => ({
    id: row.id,
    parentId: row.parent_folder_id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    fileCount: byFolder.get(row.id) ?? 0,
    hasChildren: parents.has(row.id),
  }));
}

/** Yhden kansion tiedostot. Juuri on null. */
export async function loadFiles(
  restaurantId: string,
  folderId: string | null,
): Promise<FileRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("files")
    .select(FILE_COLUMNS)
    .eq("restaurant_id", restaurantId)
    /* Roskakorissa oleva ei ole kansiossa vaikka folder_id niin sanoo. */
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  query = folderId === null ? query.is("folder_id", null) : query.eq("folder_id", folderId);

  const { data } = await query;
  return ((data as FileRecord[] | null) ?? []).map((row) => toFile(row));
}

/**
 * Murupolku kannasta, ei selaimen muistista.
 *
 * Käyttäjä voi tulla kansioon suoralla osoitteella, jolloin selain ei
 * tiedä yläpuolisia kansioita. Polku on kannassa yhtä kaukana kuin
 * kansio itse.
 */
export async function loadCrumbs(folderId: string | null): Promise<Crumb[]> {
  if (!folderId) return [];

  const supabase = await createClient();
  const { data } = await supabase.rpc("folder_breadcrumb", { p_folder: folderId });

  return ((data as { id: string; name: string }[] | null) ?? []).map((row) => ({
    id: row.id,
    name: row.name,
  }));
}

/** Tähdellä merkityt, kansiosta riippumatta. */
export async function loadFavorites(restaurantId: string): Promise<FileRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("files")
    .select(FILE_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .eq("is_favorite", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return attachPaths(restaurantId, (data as FileRecord[] | null) ?? []);
}

/** Viimeksi lisätyt, kansiosta riippumatta. */
export async function loadRecent(
  restaurantId: string,
  limit = 25,
): Promise<FileRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("files")
    .select(FILE_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  return attachPaths(restaurantId, (data as FileRecord[] | null) ?? []);
}

/**
 * Sijainti mukaan koontinäkymiin.
 *
 * Tähdet ja viimeksi lisätyt näyttävät tiedostoja eri kansioista, joten
 * kummassakin on kerrottava mistä tiedosto löytyy — muuten käyttäjä
 * näkee nimen jonka sijaintia hän ei tiedä.
 *
 * Polku lasketaan valmiiksi haetusta kansiopuusta eikä kysytä kannalta
 * riviä kohden: kolmenkymmenen tiedoston lista olisi kolmekymmentä
 * rekursiivista kyselyä.
 */
async function attachPaths(
  restaurantId: string,
  rows: FileRecord[],
): Promise<FileRow[]> {
  if (rows.length === 0) return [];

  const folders = await loadFolders(restaurantId);
  const byId = new Map(folders.map((folder) => [folder.id, folder]));

  function path(id: string | null): string {
    const parts: string[] = [];
    let current = id ? byId.get(id) : undefined;
    let guard = 0;

    while (current && guard < 50) {
      parts.unshift(current.name);
      current = current.parentId ? byId.get(current.parentId) : undefined;
      guard += 1;
    }

    return parts.join(" / ");
  }

  return rows.map((row) => toFile(row, path(row.folder_id)));
}

/**
 * Haku koko ravintolan tiedostoista.
 *
 * Kannan funktio hoitaa sijainnin, koska se osaa kävellä puun
 * rekursiivisesti yhdellä kyselyllä.
 */
export async function searchFiles(
  restaurantId: string,
  term: string,
): Promise<FileRow[]> {
  const trimmed = term.trim();
  if (trimmed === "") return [];

  const supabase = await createClient();
  const { data } = await supabase.rpc("search_files", {
    p_restaurant: restaurantId,
    p_term: trimmed,
    p_limit: 100,
  });

  return (
    (data as
      | {
          id: string;
          file_name: string;
          file_type: string;
          file_size: number;
          folder_id: string | null;
          folder_path: string;
          is_favorite: boolean;
          created_at: string;
          expires_on: string | null;
        }[]
      | null) ?? []
  ).map((row) => ({
    id: row.id,
    folderId: row.folder_id,
    name: row.file_name,
    storagePath: "",
    type: row.file_type,
    size: Number(row.file_size),
    isFavorite: row.is_favorite,
    createdAt: row.created_at,
    updatedAt: row.created_at,
    expiresOn: row.expires_on,
    supplierId: null,
    receiptId: null,
    deletedAt: null,
    folderPath: row.folder_path,
  }));
}

/**
 * Allekirjoitettu osoite tiedostoon.
 *
 * Bucket on yksityinen. Osoite luodaan vasta kun käyttäjä pyytää
 * tiedostoa, eikä sitä kirjoiteta listaan valmiiksi: sata osoitetta
 * listan piirtoa varten olisi sata pyyntöä joista käyttäjä avaa yhden.
 */
export async function signedUrl(path: string): Promise<string | null> {
  if (!path) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("files")
    .createSignedUrl(path, URL_SECONDS);

  return error || !data ? null : data.signedUrl;
}

// ---------------------------------------------------------------------------
// Vanhenevat
// ---------------------------------------------------------------------------

/**
 * Tiedostot joilla on voimassaolo.
 *
 * Kaikki, ei vain vanhentuvat: näkymä on lista siitä mikä on
 * voimassa ja mikä ei. Pelkkä varoituslista näyttäisi tyhjältä juuri
 * silloin kun kaikki on kunnossa, eikä käyttäjä tietäisi onko se hyvä
 * merkki vai unohtiko hän merkitä mitään.
 */
export async function loadExpiring(restaurantId: string): Promise<FileRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("files")
    .select(FILE_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .is("deleted_at", null)
    .not("expires_on", "is", null)
    .order("expires_on", { ascending: true });

  return attachPaths(restaurantId, (data as FileRecord[] | null) ?? []);
}

/**
 * Montako vaatii huomiota.
 *
 * Yleiskatsaus tarvitsee luvun eikä listaa, ja väli lasketaan
 * kannassa: selaimen kello voi olla väärässä, ja ravintolan
 * aikavyöhyke on se joka ratkaisee.
 */
export async function countExpiringSoon(
  restaurantId: string,
  withinDays: number,
): Promise<number> {
  const supabase = await createClient();

  const limit = new Date();
  limit.setUTCDate(limit.getUTCDate() + withinDays);

  const { count } = await supabase
    .from("files")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .is("deleted_at", null)
    .not("expires_on", "is", null)
    .lte("expires_on", limit.toISOString().slice(0, 10));

  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Roskakori
// ---------------------------------------------------------------------------

export interface TrashContents {
  files: FileRow[];
  folders: { id: string; name: string; deletedAt: string }[];
}

/**
 * Roskakorin sisältö.
 *
 * Kansiot ja tiedostot erikseen, koska palautus on eri toiminto
 * kummallekin: kansion palautus tuo takaisin kansion, ei sen sisältöä.
 */
export async function loadTrash(restaurantId: string): Promise<TrashContents> {
  const supabase = await createClient();

  const [{ data: files }, { data: folders }] = await Promise.all([
    supabase
      .from("files")
      .select(FILE_COLUMNS)
      .eq("restaurant_id", restaurantId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("folders")
      .select("id, name, deleted_at")
      .eq("restaurant_id", restaurantId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
  ]);

  return {
    files: ((files as FileRecord[] | null) ?? []).map((row) => toFile(row)),
    folders: (
      (folders as { id: string; name: string; deleted_at: string }[] | null) ?? []
    ).map((row) => ({ id: row.id, name: row.name, deletedAt: row.deleted_at })),
  };
}

// ---------------------------------------------------------------------------
// Liitokset
// ---------------------------------------------------------------------------

/**
 * Toimittajaan tai kuittiin liitetyt tiedostot.
 *
 * Näytetään toimittajan ja kuitin omilla sivuilla, jotta sopimus
 * löytyy sieltä missä sitä tarvitaan eikä vain kaapista.
 */
export async function loadLinkedFiles(
  restaurantId: string,
  link: { supplierId?: string; receiptId?: string },
): Promise<FileRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("files")
    .select(FILE_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (link.supplierId) query = query.eq("supplier_id", link.supplierId);
  else if (link.receiptId) query = query.eq("receipt_id", link.receiptId);
  else return [];

  const { data } = await query;
  return ((data as FileRecord[] | null) ?? []).map((row) => toFile(row));
}

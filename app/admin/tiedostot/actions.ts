"use server";

/**
 * Tiedostokaapin toiminnot.
 *
 * Oikeustarkistus on kannan funktioissa, kuten muuallakin: jokainen
 * niistä lukee ravintolan rivistä ja tarkistaa is_manager itse. Tämä
 * kerros validoi muodon, kääntää virheen luettavaksi ja hoitaa sen mitä
 * kanta ei ylety tekemään — storage-objektien poiston.
 *
 * ---------------------------------------------------------------------
 * MIKSI RAVINTOLAA EI VÄLITETÄ SELAIMESTA
 * ---------------------------------------------------------------------
 *
 * Toiminnot ottavat vastaan kansion tai tiedoston tunnisteen, eivät
 * ravintolaa. Kanta hakee ravintolan siitä rivistä ja tarkistaa
 * oikeuden sitä vastaan, joten vieraan tunnisteen lähettäminen ei avaa
 * mitään — se vain kaataa kutsun oikeusvirheeseen.
 *
 * Luonnissa ja latauksessa ravintola tarvitaan, ja se luetaan
 * istunnosta requireContextilla — ei pyynnön rungosta.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminText, type AdminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { fill } from "@/lib/i18n/auth-text";
import { formatDayIn } from "@/lib/i18n/labels";
import { reminderDay } from "@/lib/restoflow/files";
import { can } from "@/lib/restoflow/permissions";
import { requireContext } from "@/lib/restoflow/session";
import { createClient } from "@/utils/supabase/server";

export interface FileState {
  error?: string;
  notice?: string;
}

const UUID = z.string().uuid();

function revalidate(): void {
  revalidatePath("/admin/tiedostot");
}

/**
 * Kannan virhe luettavaksi lauseeksi.
 *
 * Kannan viestit ovat suomenkielisiä ja tarkoitettu kehittäjälle.
 * Käyttäjä saa oman kielensä lauseen, ja tuntematon virhe saa yleisen —
 * kannan sisäistä sanamuotoa ei näytetä kenellekään.
 */
function explain(message: string | undefined, t: AdminText): string {
  const text = message ?? "";

  if (text.includes("liian syvä")) return t.tiedosto.errorDepth;
  if (text.includes("duplicate key") || text.includes("folders_unique")) {
    return t.tiedosto.errorDuplicate;
  }
  if (text.includes("Ei oikeutta") || text.includes("toisessa ravintolassa")) {
    return t.tiedosto.errorGeneric;
  }

  return t.tiedosto.errorGeneric;
}

/**
 * Yhteinen alku jokaiselle muutokselle.
 *
 * Rooliraja tarkistetaan tässäkin, vaikka kanta tarkistaa saman. Se ei
 * ole turhaa toistoa: ilman tätä työntekijä saisi kannan
 * oikeusvirheen, ja käyttöliittymä näyttäisi rikkinäiseltä sen sijaan
 * että kertoisi rehellisesti ettei toiminto kuulu hänelle.
 */
async function alusta(): Promise<
  | { ok: true; t: AdminText; restaurantId: string }
  | { ok: false; state: FileState }
> {
  const { restaurant, role } = await requireContext("/admin/tiedostot");
  const t = adminText(await resolveLocale());

  if (!can(role, "files.manage")) {
    return { ok: false, state: { error: t.tiedosto.readOnly } };
  }

  return { ok: true, t, restaurantId: restaurant.id };
}

// ---------------------------------------------------------------------------
// Kansiot
// ---------------------------------------------------------------------------

export async function createFolder(
  _prev: FileState,
  form: FormData,
): Promise<FileState> {
  const alku = await alusta();
  if (!alku.ok) return alku.state;

  const parsed = z
    .object({
      name: z.string().trim().min(1).max(120),
      parentId: UUID.nullable().optional(),
    })
    .safeParse({
      name: form.get("name"),
      parentId: form.get("parentId") || null,
    });

  if (!parsed.success) return { error: alku.t.tiedosto.errorGeneric };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_folder", {
    p_restaurant: alku.restaurantId,
    p_parent: parsed.data.parentId ?? null,
    p_name: parsed.data.name,
  });

  if (error) return { error: explain(error.message, alku.t) };

  revalidate();
  return {};
}

export async function renameFolder(
  _prev: FileState,
  form: FormData,
): Promise<FileState> {
  const alku = await alusta();
  if (!alku.ok) return alku.state;

  const parsed = z
    .object({ id: UUID, name: z.string().trim().min(1).max(120) })
    .safeParse({ id: form.get("id"), name: form.get("name") });

  if (!parsed.success) return { error: alku.t.tiedosto.errorGeneric };

  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_folder", {
    p_folder: parsed.data.id,
    p_name: parsed.data.name,
  });

  if (error) return { error: explain(error.message, alku.t) };

  revalidate();
  return {};
}

export async function moveFolder(
  folderId: string,
  targetId: string | null,
): Promise<FileState> {
  const alku = await alusta();
  if (!alku.ok) return alku.state;

  if (!UUID.safeParse(folderId).success) {
    return { error: alku.t.tiedosto.errorGeneric };
  }
  if (targetId !== null && !UUID.safeParse(targetId).success) {
    return { error: alku.t.tiedosto.errorGeneric };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("move_folder", {
    p_folder: folderId,
    p_parent: targetId,
  });

  if (error) return { error: explain(error.message, alku.t) };

  revalidate();
  return {};
}

/**
 * Kansion poisto.
 *
 * Kannan funktio palauttaa poistettujen tiedostojen polut, koska se ei
 * itse ylety storageen. Objektit poistetaan tässä sen jälkeen kun rivit
 * ovat jo poissa: jäljelle jäävä objekti on siivousasia, mutta jäljelle
 * jäävä rivi ilman objektia olisi rikkinäinen tiedosto näkymässä.
 */
export async function deleteFolder(
  folderId: string,
  mode: "keep" | "contents",
): Promise<FileState> {
  const alku = await alusta();
  if (!alku.ok) return alku.state;

  if (!UUID.safeParse(folderId).success) {
    return { error: alku.t.tiedosto.errorGeneric };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_folder", {
    p_folder: folderId,
    p_mode: mode,
  });

  if (error) return { error: explain(error.message, alku.t) };

  /*
   * Storagea ei kosketa.
   *
   * Poisto vie roskakoriin, ja objekti tarvitaan yhä jos käyttäjä
   * palauttaa. Objektit häviävät vasta lopullisessa siivouksessa.
   */
  revalidate();
  return {};
}

export async function reorderFolders(
  parentId: string | null,
  ids: string[],
): Promise<FileState> {
  const alku = await alusta();
  if (!alku.ok) return alku.state;

  const parsed = z.array(UUID).min(1).max(500).safeParse(ids);
  if (!parsed.success) return { error: alku.t.tiedosto.errorGeneric };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_folders", {
    p_parent: parentId,
    p_restaurant: alku.restaurantId,
    p_ids: parsed.data,
  });

  if (error) return { error: explain(error.message, alku.t) };

  revalidate();
  return {};
}

// ---------------------------------------------------------------------------
// Tiedostot
// ---------------------------------------------------------------------------

/**
 * Ladatun tiedoston kirjaus.
 *
 * Objekti on jo storagessa: selain latasi sen suoraan omalla
 * istunnollaan, ja storage-käytäntö tarkisti ravintolan polusta. Sama
 * tarkistetaan tässä kannan puolelta, koska rivi on se jonka
 * käyttöliittymä näyttää.
 *
 * Lataus menee selaimesta suoraan storageen eikä tämän palvelimen
 * läpi. Kahdenkymmenenviiden megatavun tiedoston kierrättäminen
 * palvelinfunktion muistin kautta olisi hitaampaa ja kaatuisi
 * suurimpiin.
 */
export async function registerFile(input: {
  folderId: string | null;
  name: string;
  path: string;
  type: string;
  size: number;
  /* Voimassaolo ja liitos latauksen yhteydessa: erillinen kutsu olisi
     toinen verkkokierros, jonka epaonnistuminen jattaisi tiedoston
     puolitiehen. */
  expiresOn?: string | null;
  supplierId?: string | null;
}): Promise<FileState> {
  const alku = await alusta();
  if (!alku.ok) return alku.state;

  const parsed = z
    .object({
      folderId: UUID.nullable(),
      name: z.string().trim().min(1).max(200),
      path: z.string().trim().min(1).max(400),
      type: z.string().trim().max(160),
      size: z.number().int().positive().max(25 * 1024 * 1024),
      expiresOn: z
        .string()
        .regex(/^d{4}-d{2}-d{2}$/)
        .nullable()
        .default(null),
      supplierId: UUID.nullable().default(null),
    })
    .safeParse({
      ...input,
      expiresOn: input.expiresOn ?? null,
      supplierId: input.supplierId ?? null,
    });

  if (!parsed.success) return { error: alku.t.tiedosto.errorGeneric };

  const supabase = await createClient();
  const { data: created, error } = await supabase.rpc("register_file", {
    p_restaurant: alku.restaurantId,
    p_folder: parsed.data.folderId,
    p_name: parsed.data.name,
    p_path: parsed.data.path,
    p_type: parsed.data.type,
    p_size: parsed.data.size,
    p_expires: parsed.data.expiresOn,
    p_supplier: parsed.data.supplierId,
  });

  if (error) {
    /*
     * Kirjaus epäonnistui mutta objekti on jo storagessa.
     *
     * Ilman siivousta jäisi tiedosto jota kukaan ei näe eikä voi
     * poistaa: sillä ei ole riviä, joten se ei ole missään näkymässä.
     */
    await supabase.storage.from("files").remove([parsed.data.path]);
    return { error: explain(error.message, alku.t) };
  }

  /*
   * Voimassaolo latauksessa tekee muistutuksen heti.
   *
   * Muuten se syntyisi vasta jos käyttäjä avaisi voimassaolodialogin
   * uudelleen — eli tekisi saman työn kahdesti.
   */
  const newId = typeof created === "string" ? created : null;

  if (parsed.data.expiresOn && newId) {
    await syncReminder(newId, parsed.data.expiresOn, alku.t);
  }

  revalidate();
  return { notice: parsed.data.name };
}

export async function renameFile(
  _prev: FileState,
  form: FormData,
): Promise<FileState> {
  const alku = await alusta();
  if (!alku.ok) return alku.state;

  const parsed = z
    .object({ id: UUID, name: z.string().trim().min(1).max(200) })
    .safeParse({ id: form.get("id"), name: form.get("name") });

  if (!parsed.success) return { error: alku.t.tiedosto.errorGeneric };

  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_file", {
    p_file: parsed.data.id,
    p_name: parsed.data.name,
  });

  if (error) return { error: explain(error.message, alku.t) };

  revalidate();
  return {};
}

export async function moveFile(
  fileId: string,
  targetId: string | null,
): Promise<FileState> {
  const alku = await alusta();
  if (!alku.ok) return alku.state;

  if (!UUID.safeParse(fileId).success) {
    return { error: alku.t.tiedosto.errorGeneric };
  }
  if (targetId !== null && !UUID.safeParse(targetId).success) {
    return { error: alku.t.tiedosto.errorGeneric };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("move_file", {
    p_file: fileId,
    p_folder: targetId,
  });

  if (error) return { error: explain(error.message, alku.t) };

  revalidate();
  return {};
}

export async function toggleFavorite(
  fileId: string,
  value: boolean,
): Promise<FileState> {
  const alku = await alusta();
  if (!alku.ok) return alku.state;

  if (!UUID.safeParse(fileId).success) {
    return { error: alku.t.tiedosto.errorGeneric };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_file_favorite", {
    p_file: fileId,
    p_value: value,
  });

  if (error) return { error: explain(error.message, alku.t) };

  revalidate();
  return {};
}

export async function deleteFile(fileId: string): Promise<FileState> {
  const alku = await alusta();
  if (!alku.ok) return alku.state;

  if (!UUID.safeParse(fileId).success) {
    return { error: alku.t.tiedosto.errorGeneric };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_file", { p_file: fileId });

  if (error) return { error: explain(error.message, alku.t) };

  revalidate();
  return {};
}

// ---------------------------------------------------------------------------
// Avaaminen
// ---------------------------------------------------------------------------
//
// Tiedosto avataan reitistä /api/tiedostot/<tunnus>, joka tarkistaa
// oikeuden ja välittää tavut. Aiemmin tässä oli toiminto joka palautti
// allekirjoitetun storage-osoitteen selaimelle — se päätyi
// osoiteriville ja paljasti projektin, bucketin ja ravintolan
// tunnisteen.

// ---------------------------------------------------------------------------
// Voimassaolo
// ---------------------------------------------------------------------------

/**
 * Voimassaolon asetus tai poisto.
 *
 * Tyhjä päivä poistaa voimassaolon. Useimmilla tiedostoilla sitä ei
 * ole, ja väärin merkityn poistamisen on oltava yhtä helppoa kuin sen
 * asettamisen.
 */
export async function setExpiry(
  fileId: string,
  date: string | null,
): Promise<FileState> {
  const alku = await alusta();
  if (!alku.ok) return alku.state;

  const parsed = z
    .object({
      id: UUID,
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
    })
    .safeParse({ id: fileId, date: date || null });

  if (!parsed.success) return { error: alku.t.tiedosto.errorGeneric };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_file_expiry", {
    p_file: parsed.data.id,
    p_date: parsed.data.date,
  });

  if (error) return { error: explain(error.message, alku.t) };

  const made = await syncReminder(parsed.data.id, parsed.data.date, alku.t);

  revalidate();
  return made ? { notice: alku.t.tiedosto.reminderMade } : {};
}

// ---------------------------------------------------------------------------
// Muistutus tehtäviin
// ---------------------------------------------------------------------------

/**
 * Voimassaolo tehtäväksi.
 *
 * Merkintä rivillä on huomio; tehtävä on teko. Vanheneva anniskelulupa
 * ei korjaa itseään sillä että joku näki keltaisen merkinnän
 * ohimennen.
 *
 * Palauttaa true jos uusi tehtävä syntyi, jotta käyttäjälle voidaan
 * kertoa siitä. Hiljaa tehty tehtävä toisessa osiossa on yllätys.
 */
async function syncReminder(
  fileId: string,
  expires: string | null,
  t: AdminText,
): Promise<boolean> {
  const locale = await resolveLocale();
  const { restaurant, user } = await requireContext("/admin/tiedostot");
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("files")
    .select("file_name, reminder_task_id")
    .eq("id", fileId)
    .maybeSingle();

  const file = row as
    | { file_name: string; reminder_task_id: string | null }
    | null;

  if (!file) return false;

  /*
   * Vanha tehtävä: päivitetään vain jos se on yhä auki.
   *
   * Tehty tai peruttu tehtävä on merkintä siitä mitä ihminen teki,
   * eikä sitä kirjoiteta uusiksi. Uusi voimassaolo saa oman
   * tehtävänsä.
   */
  const existing = file.reminder_task_id
    ? await openTask(file.reminder_task_id)
    : null;

  if (!expires) {
    /* Voimassaolo poistettiin: avoin muistutus ei koske enää mitään. */
    if (existing) {
      await supabase.from("tasks").delete().eq("id", existing);
      await supabase
        .from("files")
        .update({ reminder_task_id: null })
        .eq("id", fileId);
    }
    return false;
  }

  const due = reminderDay(expires, todayFor(restaurant.timezone));

  const payload = {
    restaurant_id: restaurant.id,
    title: fill(t.tiedosto.reminderTitleFixed, {
      nimi: file.file_name,
    }).slice(0, 200),
    description: fill(t.tiedosto.reminderNote, {
      pvm: formatDayIn(expires, locale),
    }),
    due_on: due,
    priority: "important" as const,
    visibility: "managers" as const,
  };

  if (existing) {
    await supabase.from("tasks").update(payload).eq("id", existing);
    return false;
  }

  const { data: created } = await supabase
    .from("tasks")
    .insert({ ...payload, created_by: user.id })
    .select("id")
    .maybeSingle();

  const taskId = (created as { id: string } | null)?.id;
  if (!taskId) return false;

  await supabase
    .from("files")
    .update({ reminder_task_id: taskId })
    .eq("id", fileId);

  /* Tehtävälista muuttui toisessa osiossa. */
  revalidatePath("/admin/tehtavat");
  revalidatePath("/admin", "layout");

  return true;
}

/** Tehtävän tunnus jos se on yhä auki, muuten null. */
async function openTask(taskId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("tasks")
    .select("id, completed_at, cancelled_at")
    .eq("id", taskId)
    .maybeSingle();

  const task = data as
    | { id: string; completed_at: string | null; cancelled_at: string | null }
    | null;

  if (!task || task.completed_at || task.cancelled_at) return null;
  return task.id;
}

/** Tänään ravintolan vyöhykkeellä, ei palvelimen. */
function todayFor(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// ---------------------------------------------------------------------------
// Liitokset
// ---------------------------------------------------------------------------

export async function linkFile(
  fileId: string,
  link: { supplierId?: string | null; receiptId?: string | null },
): Promise<FileState> {
  const alku = await alusta();
  if (!alku.ok) return alku.state;

  const parsed = z
    .object({
      id: UUID,
      supplierId: UUID.nullable(),
      receiptId: UUID.nullable(),
    })
    .safeParse({
      id: fileId,
      supplierId: link.supplierId ?? null,
      receiptId: link.receiptId ?? null,
    });

  if (!parsed.success) return { error: alku.t.tiedosto.errorGeneric };

  const supabase = await createClient();
  const { error } = await supabase.rpc("link_file", {
    p_file: parsed.data.id,
    p_supplier: parsed.data.supplierId,
    p_receipt: parsed.data.receiptId,
  });

  if (error) return { error: explain(error.message, alku.t) };

  revalidate();
  return {};
}

// ---------------------------------------------------------------------------
// Joukkotoiminnot
// ---------------------------------------------------------------------------
//
// Kanta tekee koko joukon yhtenä lauseena. Silmukka täältä olisi sata
// kutsua, joista osa voisi onnistua ja osa ei — ja käyttäjä näkisi
// puolikkaan siirron jota hän ei osaisi perua.

const IDS = z.array(UUID).min(1).max(500);

export async function moveFiles(
  ids: string[],
  targetId: string | null,
): Promise<FileState> {
  const alku = await alusta();
  if (!alku.ok) return alku.state;

  const parsed = IDS.safeParse(ids);
  if (!parsed.success) return { error: alku.t.tiedosto.errorGeneric };
  if (targetId !== null && !UUID.safeParse(targetId).success) {
    return { error: alku.t.tiedosto.errorGeneric };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("move_files", {
    p_ids: parsed.data,
    p_folder: targetId,
  });

  if (error) return { error: explain(error.message, alku.t) };

  revalidate();
  return {};
}

export async function favoriteFiles(
  ids: string[],
  value: boolean,
): Promise<FileState> {
  const alku = await alusta();
  if (!alku.ok) return alku.state;

  const parsed = IDS.safeParse(ids);
  if (!parsed.success) return { error: alku.t.tiedosto.errorGeneric };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_files_favorite", {
    p_ids: parsed.data,
    p_value: value,
  });

  if (error) return { error: explain(error.message, alku.t) };

  revalidate();
  return {};
}

export async function deleteFiles(ids: string[]): Promise<FileState> {
  const alku = await alusta();
  if (!alku.ok) return alku.state;

  const parsed = IDS.safeParse(ids);
  if (!parsed.success) return { error: alku.t.tiedosto.errorGeneric };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_files", { p_ids: parsed.data });

  if (error) return { error: explain(error.message, alku.t) };

  revalidate();
  return {};
}

// ---------------------------------------------------------------------------
// Roskakori
// ---------------------------------------------------------------------------

export async function restoreFile(fileId: string): Promise<FileState> {
  const alku = await alusta();
  if (!alku.ok) return alku.state;
  if (!UUID.safeParse(fileId).success) {
    return { error: alku.t.tiedosto.errorGeneric };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_file", { p_file: fileId });

  if (error) return { error: explain(error.message, alku.t) };

  revalidate();
  return {};
}

export async function restoreFolder(folderId: string): Promise<FileState> {
  const alku = await alusta();
  if (!alku.ok) return alku.state;
  if (!UUID.safeParse(folderId).success) {
    return { error: alku.t.tiedosto.errorGeneric };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_folder", { p_folder: folderId });

  if (error) return { error: explain(error.message, alku.t) };

  revalidate();
  return {};
}

/**
 * Lopullinen siivous.
 *
 * days = 30 — vanhentuneet, ajetaan roskakoria avattaessa
 * days = 0  — kaikki, käyttäjän pyynnöstä
 *
 * Vasta tässä objektit häviävät storagesta. Rivit menevät ensin, koska
 * ne ovat se mitä käyttöliittymä näyttää: jäljelle jäävä objekti on
 * siivousasia, jäljelle jäävä rivi ilman objektia olisi rikkinäinen
 * tiedosto.
 */
export async function purgeTrash(days: 0 | 30): Promise<FileState> {
  const alku = await alusta();
  if (!alku.ok) return alku.state;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("purge_trash", {
    p_restaurant: alku.restaurantId,
    p_days: days,
  });

  if (error) return { error: explain(error.message, alku.t) };

  const paths = (data as string[] | null) ?? [];
  if (paths.length > 0) {
    await supabase.storage.from("files").remove(paths);
  }

  revalidate();
  return {};
}

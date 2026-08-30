/**
 * Tiedostokaapin puhdas logiikka.
 *
 * Ei palvelintuonteja: tätä käyttävät sekä palvelinkomponentit että
 * selaimessa ajettava lomake. Yksikin `next/headers`-ketjun kautta
 * tuleva tuonti rikkoisi käännöksen, ja rikkoisi sen vasta buildissa.
 *
 * ---------------------------------------------------------------------
 * TIEDOSTOTYYPPI EI RAJAA SIJAINTIA
 * ---------------------------------------------------------------------
 *
 * Tyyppiä käytetään kuvakkeeseen ja lajitteluun. Se ei kerro mihin
 * kansioon tiedosto kuuluu — kuitti saa olla Talous-kansiossa ja
 * myyntiraportti Kuitit-kansiossa, jos ravintola niin haluaa.
 */

export interface FolderRow {
  id: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  createdAt: string;
  /** Suoraan tässä kansiossa olevien tiedostojen määrä. */
  fileCount: number;
  /** Onko alikansioita. Kertoo tarvitseeko kansio avata. */
  hasChildren: boolean;
}

export interface FileRow {
  id: string;
  folderId: string | null;
  name: string;
  storagePath: string;
  type: string;
  size: number;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  /** Vain hakutuloksissa ja koontinäkymissä. */
  folderPath?: string;
}

export interface Crumb {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Tiedostotyypit
// ---------------------------------------------------------------------------

/**
 * Sallitut päätteet ja niiden tyypit.
 *
 * Selain ei ole luotettava tyypin kertoja: se lähettää CSV:lle milloin
 * text/csv, milloin application/vnd.ms-excel, milloin tyhjän. Pääte on
 * se mitä käyttäjä näkee ja mitä tässä käytetään, ja tyyppi johdetaan
 * siitä.
 *
 * Lopullinen sana on storagen sallittujen tyyppien luettelo — tämä
 * kertoo käyttäjälle etukäteen sen mitä storage sanoisi vasta
 * latauksen jälkeen.
 */
export const ALLOWED_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

/** Sama raja kuin storage-bucketissa. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 1 || dot === name.length - 1) return "";
  return name.slice(dot + 1).toLowerCase();
}

/**
 * Tyyppi päätteestä.
 *
 * Selaimen ilmoittama tyyppi kelpaa vain jos se on listalla; muuten
 * pääte ratkaisee. Näin CSV menee läpi silloinkin kun selain väittää
 * sitä Exceliksi.
 */
export function mimeFor(name: string, browserType?: string | null): string {
  const byExtension = ALLOWED_TYPES[extensionOf(name)];
  if (byExtension) return byExtension;

  const claimed = (browserType ?? "").trim().toLowerCase();
  return Object.values(ALLOWED_TYPES).includes(claimed)
    ? claimed
    : "application/octet-stream";
}

export type FileProblem = "type" | "size" | "empty" | null;

/**
 * Kelpaako tiedosto.
 *
 * Tarkistus on selaimessa, jotta käyttäjä saa vastauksen heti eikä
 * vasta epäonnistuneen latauksen jälkeen. Se ei ole turvatoimi:
 * storagen käytännöt ja kannan funktio ovat ne jotka päättävät.
 */
export function checkFile(file: {
  name: string;
  size: number;
  type?: string | null;
}): FileProblem {
  if (file.size <= 0) return "empty";
  if (file.size > MAX_FILE_BYTES) return "size";
  if (!ALLOWED_TYPES[extensionOf(file.name)]) return "type";
  return null;
}

export type FileKind = "pdf" | "doc" | "sheet" | "image" | "text" | "other";

export function fileKind(type: string, name = ""): FileKind {
  const extension = extensionOf(name);

  if (extension === "pdf" || type === "application/pdf") return "pdf";
  if (["doc", "docx"].includes(extension) || type.includes("word")) return "doc";
  if (["xls", "xlsx", "csv"].includes(extension) || type.includes("sheet") || type.includes("excel")) {
    return "sheet";
  }
  if (extension === "txt" || type === "text/plain") return "text";
  if (type.startsWith("image/")) return "image";
  return "other";
}

/** Voiko selain näyttää tiedoston sellaisenaan. */
export function isPreviewable(type: string, name = ""): boolean {
  const kind = fileKind(type, name);

  /*
   * HEIC on kuva muttei selaimen näytettävissä.
   *
   * iPhone tuottaa niitä, ja esikatselu näyttäisi rikkinäiseltä
   * kuvakkeelta. Latauslinkki toimii, ja se on rehellisempi.
   */
  if (extensionOf(name) === "heic" || extensionOf(name) === "heif") return false;

  return kind === "pdf" || kind === "image" || kind === "text";
}

// ---------------------------------------------------------------------------
// Koko
// ---------------------------------------------------------------------------

/**
 * Tiedoston koko luettavassa muodossa.
 *
 * Yksiköt ovat B, KB ja MB kaikilla kielillä. Ne tunnistetaan
 * yleisesti, ja käännetty "Mt" olisi kuudella kielellä kuusi tapaa
 * ilmaista sama asia — ja yksi niistä olisi väärin.
 */
export function formatFileSize(bytes: number, locale = "fi-FI"): string {
  if (bytes < 1024) return `${bytes} B`;

  const kilos = bytes / 1024;
  if (kilos < 1024) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(kilos)} KB`;
  }

  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(kilos / 1024)} MB`;
}

// ---------------------------------------------------------------------------
// Lajittelu
// ---------------------------------------------------------------------------

export type FileSort = "name" | "added" | "modified" | "type" | "size";
export type FolderSort = "name" | "newest" | "oldest" | "custom";

/**
 * Nimivertailu jossa ääkköset ovat oikeassa paikassa.
 *
 * Tavallinen merkkijonovertailu asettaa Ä:n Z:n jälkeen englannin
 * mukaan. Suomessa se on aakkosten lopussa, mutta Ö tulee Ä:n
 * jälkeen — ja ruotsissa toisin päin. Intl.Collator osaa kummankin,
 * kun sille kerrotaan kieli.
 */
function byName(locale: string): (a: string, b: string) => number {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
  return (a, b) => collator.compare(a, b);
}

export function sortFiles(
  files: FileRow[],
  key: FileSort,
  locale = "fi-FI",
): FileRow[] {
  const compare = byName(locale);
  const copy = [...files];

  switch (key) {
    case "name":
      return copy.sort((a, b) => compare(a.name, b.name));
    case "added":
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "modified":
      return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case "size":
      return copy.sort((a, b) => b.size - a.size);
    case "type":
      /*
       * Tyypin sisällä nimen mukaan.
       *
       * Pelkkä tyyppilajittelu jättäisi saman tyypin tiedostot
       * satunnaiseen järjestykseen, ja lista näyttäisi sekoittuvan
       * joka latauksella.
       */
      return copy.sort((a, b) => {
        const kinds = fileKind(a.type, a.name).localeCompare(fileKind(b.type, b.name));
        return kinds !== 0 ? kinds : compare(a.name, b.name);
      });
  }
}

export function sortFolders(
  folders: FolderRow[],
  key: FolderSort,
  locale = "fi-FI",
): FolderRow[] {
  const compare = byName(locale);
  const copy = [...folders];

  switch (key) {
    case "name":
      return copy.sort((a, b) => compare(a.name, b.name));
    case "newest":
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "oldest":
      return copy.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case "custom":
      /* Oma järjestys, ja sen sisällä nimi — tasapelit eivät saa heilua. */
      return copy.sort((a, b) =>
        a.sortOrder !== b.sortOrder
          ? a.sortOrder - b.sortOrder
          : compare(a.name, b.name),
      );
  }
}

// ---------------------------------------------------------------------------
// Siirron kohteet
// ---------------------------------------------------------------------------

/**
 * Mihin kansioihin kohteen voi siirtää.
 *
 * Kansiota ei voi siirtää itseensä eikä omaan jälkeläiseensä: siirto
 * irrottaisi haaran puusta, jolloin se ei löytyisi mistään näkymästä
 * vaikka rivit olisivat yhä kannassa. Kanta estää saman, mutta valikko
 * ei saa tarjota vaihtoehtoa joka varmasti epäonnistuu.
 */
export function movableTargets(
  all: FolderRow[],
  movingFolderId: string | null,
): FolderRow[] {
  if (!movingFolderId) return all;

  const forbidden = new Set<string>([movingFolderId]);
  let grew = true;

  while (grew) {
    grew = false;
    for (const folder of all) {
      if (folder.parentId && forbidden.has(folder.parentId) && !forbidden.has(folder.id)) {
        forbidden.add(folder.id);
        grew = true;
      }
    }
  }

  return all.filter((folder) => !forbidden.has(folder.id));
}

/**
 * Kansion koko polku nimineen.
 *
 * Siirtovalikko näyttää litteän listan, jossa "2026" yksinään ei kerro
 * kummasta vuodesta on kyse jos niitä on kaksi eri haarassa.
 */
export function folderPath(all: FolderRow[], id: string | null): string {
  if (!id) return "";

  const byId = new Map(all.map((folder) => [folder.id, folder]));
  const parts: string[] = [];

  let current = byId.get(id);
  let guard = 0;

  while (current && guard < 50) {
    parts.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
    guard += 1;
  }

  return parts.join(" / ");
}

import { describe, expect, it } from "vitest";
import {
  ALLOWED_TYPES,
  checkFile,
  extensionOf,
  fileKind,
  folderPath,
  formatFileSize,
  isPreviewable,
  MAX_FILE_BYTES,
  mimeFor,
  movableTargets,
  sortFiles,
  sortFolders,
  type FileRow,
  type FolderRow,
} from "../files";

function kansio(muutos: Partial<FolderRow> & { id: string }): FolderRow {
  return {
    parentId: null,
    name: muutos.id,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00Z",
    fileCount: 0,
    hasChildren: false,
    ...muutos,
  };
}

function tiedosto(muutos: Partial<FileRow> & { id: string }): FileRow {
  return {
    folderId: null,
    name: muutos.id,
    storagePath: "r/1",
    type: "application/pdf",
    size: 1000,
    isFavorite: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...muutos,
  };
}

describe("tiedostotyypit", () => {
  it("tunnistaa päätteen", () => {
    expect(extensionOf("Vuokrasopimus.pdf")).toBe("pdf");
    expect(extensionOf("Myyntiraportti_08.2026.xlsx")).toBe("xlsx");

    /* Ei päätettä, piste lopussa, piste alussa. */
    expect(extensionOf("nimetön")).toBe("");
    expect(extensionOf("loppuu.")).toBe("");
    expect(extensionOf(".gitignore")).toBe("");
  });

  /*
   * Selain ei ole luotettava tyypin kertoja.
   *
   * CSV tulee milloin text/csv, milloin application/vnd.ms-excel,
   * milloin tyhjänä. Pääte on se mitä käyttäjä näkee, ja siitä
   * johdettu tyyppi on se joka menee storagen läpi.
   */
  it("johtaa tyypin päätteestä eikä selaimen väitteestä", () => {
    expect(mimeFor("raportti.csv", "application/vnd.ms-excel")).toBe("text/csv");
    expect(mimeFor("raportti.csv", "")).toBe("text/csv");
    expect(mimeFor("kuva.png", null)).toBe("image/png");
  });

  it("hyväksyy jokaisen luvatun tyypin", () => {
    /* Spesifikaation vähimmäislista. Puuttuva tyyppi on hiljainen vika:
       käyttäjä valitsee tiedoston ja saa selittämättömän virheen. */
    for (const pääte of [
      "pdf", "doc", "docx", "xls", "xlsx", "csv", "txt",
      "jpg", "jpeg", "png", "webp",
    ]) {
      expect(ALLOWED_TYPES[pääte], pääte).toBeTruthy();
      expect(checkFile({ name: `a.${pääte}`, size: 10 }), pääte).toBeNull();
    }
  });

  it("hylkää tuntemattoman tyypin, liian suuren ja tyhjän", () => {
    expect(checkFile({ name: "ohjelma.exe", size: 10 })).toBe("type");
    expect(checkFile({ name: "iso.pdf", size: MAX_FILE_BYTES + 1 })).toBe("size");
    expect(checkFile({ name: "tyhjä.pdf", size: 0 })).toBe("empty");
  });

  it("luokittelee tiedostot kuvakkeita varten", () => {
    expect(fileKind("application/pdf", "a.pdf")).toBe("pdf");
    expect(fileKind("", "sopimus.docx")).toBe("doc");
    expect(fileKind("", "myynti.xlsx")).toBe("sheet");
    expect(fileKind("", "myynti.csv")).toBe("sheet");
    expect(fileKind("image/png", "kuva.png")).toBe("image");
    expect(fileKind("text/plain", "muistio.txt")).toBe("text");
  });

  /*
   * HEIC on kuva muttei selaimen näytettävissä.
   *
   * iPhone tuottaa niitä. Esikatselu näyttäisi rikkinäiseltä
   * kuvakkeelta, ja latauslinkki on rehellisempi.
   */
  it("ei lupaa esikatselua HEIC-kuvalle", () => {
    expect(isPreviewable("image/jpeg", "kuva.jpg")).toBe(true);
    expect(isPreviewable("image/heic", "kuva.heic")).toBe(false);
    expect(isPreviewable("application/vnd.ms-excel", "a.xlsx")).toBe(false);
  });
});

describe("koko", () => {
  it("kirjoittaa koon luettavasti", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5 MB");
  });
});

describe("lajittelu", () => {
  /*
   * Ääkköset ovat suomessa aakkosten lopussa.
   *
   * Tavallinen merkkijonovertailu asettaisi Ä:n Z:n jälkeen englannin
   * mukaan, ja ravintolan kansio "Äyriäiset" päätyisi väärään paikkaan.
   */
  it("järjestää nimet kielen mukaan", () => {
    const nimet = ["Öljyt", "Alkoholi", "Äyriäiset", "Zucchini"];
    const tulos = sortFolders(
      nimet.map((name, index) => kansio({ id: String(index), name })),
      "name",
      "fi-FI",
    ).map((k) => k.name);

    expect(tulos).toEqual(["Alkoholi", "Zucchini", "Äyriäiset", "Öljyt"]);
  });

  it("järjestää numerot lukuina eikä merkkeinä", () => {
    const tulos = sortFolders(
      ["Kausi 10", "Kausi 2", "Kausi 1"].map((name, i) =>
        kansio({ id: String(i), name }),
      ),
      "name",
      "fi-FI",
    ).map((k) => k.name);

    /* Merkkijonona "Kausi 10" tulisi ennen "Kausi 2". */
    expect(tulos).toEqual(["Kausi 1", "Kausi 2", "Kausi 10"]);
  });

  it("järjestää tiedostot pyydetyllä perusteella", () => {
    const lista = [
      tiedosto({ id: "a", name: "Beta", size: 10, createdAt: "2026-01-01T00:00:00Z" }),
      tiedosto({ id: "b", name: "Alfa", size: 300, createdAt: "2026-03-01T00:00:00Z" }),
      tiedosto({ id: "c", name: "Gamma", size: 20, createdAt: "2026-02-01T00:00:00Z" }),
    ];

    expect(sortFiles(lista, "name").map((f) => f.name)).toEqual([
      "Alfa", "Beta", "Gamma",
    ]);
    expect(sortFiles(lista, "added").map((f) => f.id)).toEqual(["b", "c", "a"]);
    expect(sortFiles(lista, "size").map((f) => f.id)).toEqual(["b", "c", "a"]);
  });

  /* Oma järjestys on käyttäjän, ja tasapelin pitää olla vakaa. */
  it("pitää oman järjestyksen ja ratkaisee tasapelin nimellä", () => {
    const lista = [
      kansio({ id: "1", name: "Bee", sortOrder: 5 }),
      kansio({ id: "2", name: "Aa", sortOrder: 5 }),
      kansio({ id: "3", name: "Cee", sortOrder: 1 }),
    ];

    expect(sortFolders(lista, "custom", "fi-FI").map((k) => k.name)).toEqual([
      "Cee", "Aa", "Bee",
    ]);
  });

  it("ei muuta alkuperäistä listaa", () => {
    const lista = [tiedosto({ id: "b", name: "B" }), tiedosto({ id: "a", name: "A" })];
    sortFiles(lista, "name");
    expect(lista.map((f) => f.id)).toEqual(["b", "a"]);
  });
});

describe("siirron kohteet", () => {
  /*
   * Kansiota ei voi siirtää omaan jälkeläiseensä.
   *
   * Siirto irrottaisi haaran puusta: se ei löytyisi juuresta eikä siis
   * mistään näkymästä, vaikka rivit olisivat yhä kannassa. Kanta estää
   * saman, mutta valikko ei saa tarjota vaihtoehtoa joka varmasti
   * epäonnistuu.
   */
  it("jättää pois kansion itsensä ja koko sen haaran", () => {
    const puu = [
      kansio({ id: "talous" }),
      kansio({ id: "2026", parentId: "talous" }),
      kansio({ id: "tammikuu", parentId: "2026" }),
      kansio({ id: "kuitit" }),
    ];

    const kohteet = movableTargets(puu, "talous").map((k) => k.id);

    expect(kohteet).toEqual(["kuitit"]);
  });

  it("sallii kaiken kun siirrettävänä on tiedosto", () => {
    const puu = [kansio({ id: "a" }), kansio({ id: "b", parentId: "a" })];
    expect(movableTargets(puu, null)).toHaveLength(2);
  });

  it("kirjoittaa koko polun", () => {
    const puu = [
      kansio({ id: "talous", name: "Talous" }),
      kansio({ id: "2026", name: "2026", parentId: "talous" }),
      kansio({ id: "elo", name: "Elokuu", parentId: "2026" }),
    ];

    expect(folderPath(puu, "elo")).toBe("Talous / 2026 / Elokuu");
    expect(folderPath(puu, null)).toBe("");
  });

  /* Rikkinäinen puu ei saa jumittaa selainta. */
  it("kestää silmukan kansiopuussa", () => {
    const rikki = [
      kansio({ id: "a", parentId: "b" }),
      kansio({ id: "b", parentId: "a" }),
    ];

    expect(() => folderPath(rikki, "a")).not.toThrow();
    expect(() => movableTargets(rikki, "a")).not.toThrow();
  });
});

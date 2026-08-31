import { describe, expect, it } from "vitest";
import {
  ALLOWED_TYPES,
  checkFile,
  EXPIRY_WARNING_DAYS,
  expiryState,
  extensionOf,
  fileKind,
  filesHref,
  folderLabel,
  folderPath,
  formatFileSize,
  MAX_FILE_BYTES,
  mimeFor,
  movableTargets,
  REMINDER_DAYS_BEFORE,
  reminderDay,
  sortByExpiry,
  sortFiles,
  sortFolders,
  suggestName,
  uniqueName,
  type FileRow,
  type FolderRow,
} from "../files";
import { DOCUMENT_KINDS, folderKeyFor } from "../document-ai";

/**
 * Sanakirjan osa jota nimeäminen tarvitsee.
 *
 * Tunnistettavat arvot: testi näkee heti kumpi nimi tuli mistäkin.
 */
const sanat = {
  dfContracts: "TR-sopimukset",
  dfReceipts: "Fişler",
  dfSalesReports: "TR-myynti",
  dfInvoices: "TR-laskut",
  dfFinance: "TR-talous",
  dfStaff: "TR-henkilosto",
  dfAuthorities: "TR-viranomaiset",
  dfImportant: "TR-tarkeat",
  dfOther: "TR-muut",
};

function kansio(muutos: Partial<FolderRow> & { id: string }): FolderRow {
  return {
    parentId: null,
    name: muutos.id,
    defaultKey: null,
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
    type: "application/pdf",
    size: 1000,
    isFavorite: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    expiresOn: null,
    supplierId: null,
    receiptId: null,
    deletedAt: null,
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

    expect(folderPath(puu, "elo", sanat)).toBe("Talous / 2026 / Elokuu");
    expect(folderPath(puu, null, sanat)).toBe("");
  });

  /* Rikkinäinen puu ei saa jumittaa selainta. */
  it("kestää silmukan kansiopuussa", () => {
    const rikki = [
      kansio({ id: "a", parentId: "b" }),
      kansio({ id: "b", parentId: "a" }),
    ];

    expect(() => folderPath(rikki, "a", sanat)).not.toThrow();
    expect(() => movableTargets(rikki, "a")).not.toThrow();
  });
});

describe("voimassaolo", () => {
  /*
   * Kalenteripäivä, ei tunnit.
   *
   * "Vanhenee huomenna" ei saa muuttua sanomaan "tänään" vain siksi
   * että kello on paljon — ravintoloitsija katsoo tätä illalla.
   */
  it("laskee päivät kalenteripäivinä", () => {
    expect(expiryState("2026-09-30", "2026-08-31")).toEqual({
      state: "soon",
      days: 30,
    });
    expect(expiryState("2026-08-31", "2026-08-31")).toEqual({
      state: "soon",
      days: 0,
    });
  });

  it("erottaa vanhentuneen, pian vanhenevan ja voimassa olevan", () => {
    expect(expiryState("2026-08-01", "2026-08-31").state).toBe("expired");
    expect(expiryState("2026-10-15", "2026-08-31").state).toBe("soon");
    expect(expiryState("2027-08-31", "2026-08-31").state).toBe("ok");
  });

  /* Raja on 60 päivää: lupien uusiminen vie viikkoja. */
  it("varoittaa täsmälleen rajalla muttei sen yli", () => {
    const raja = new Date(Date.UTC(2026, 7, 31));
    raja.setUTCDate(raja.getUTCDate() + EXPIRY_WARNING_DAYS);
    const yli = new Date(raja);
    yli.setUTCDate(yli.getUTCDate() + 1);

    expect(expiryState(raja.toISOString().slice(0, 10), "2026-08-31").state).toBe(
      "soon",
    );
    expect(expiryState(yli.toISOString().slice(0, 10), "2026-08-31").state).toBe(
      "ok",
    );
  });

  it("kestää puuttuvan ja kelvottoman päivän", () => {
    expect(expiryState(null, "2026-08-31").state).toBe("none");
    expect(expiryState("ei-paiva", "2026-08-31").state).toBe("none");
  });

  it("järjestää kiireellisimmän ensin ja jättää merkitsemättömät pois", () => {
    const lista = [
      tiedosto({ id: "a", expiresOn: "2026-12-01" }),
      tiedosto({ id: "b", expiresOn: null }),
      tiedosto({ id: "c", expiresOn: "2026-01-01" }),
    ];

    expect(sortByExpiry(lista).map((f) => f.id)).toEqual(["c", "a"]);
  });
});

describe("nimiehdotus", () => {
  /*
   * ISO-päivä nimessä.
   *
   * Tiedostot järjestyvät nimen mukaan oikeaan aikajärjestykseen, ja
   * sama nimi tarkoittaa samaa kaikilla kuudella kielellä.
   */
  it("kokoaa nimen toimittajasta ja päivästä", () => {
    expect(suggestName("scan_0042.pdf", "Metro", "2026-01-12")).toBe(
      "Metro 2026-01-12.pdf",
    );
  });

  /* Pääte kertoo mikä tiedosto on. Sen vaihtaminen rikkoisi avaamisen. */
  it("säilyttää alkuperäisen päätteen", () => {
    expect(suggestName("IMG_4821.JPG", "Wihuri", null)).toBe("Wihuri.JPG");
  });

  it("poistaa merkit jotka rikkovat tiedostonimen", () => {
    expect(suggestName("a.pdf", 'Metro/Oy: "iso"', null)).toBe(
      "Metro-Oy- -iso-.pdf",
    );
  });

  /* Ilman toimittajaa ei ole mitään ehdotettavaa. */
  it("palauttaa null kun toimittajaa ei tunnistettu", () => {
    expect(suggestName("scan.pdf", null, "2026-01-12")).toBeNull();
    expect(suggestName("scan.pdf", "   ", "2026-01-12")).toBeNull();
  });

  it("jättää kelvottoman päivän pois nimestä", () => {
    expect(suggestName("a.pdf", "Metro", "eilen")).toBe("Metro.pdf");
  });
});

describe("osoitteet", () => {
  /*
   * Lajittelu katosi kansioon siirryttäessä, koska kansiolinkki
   * rakennettiin eri paikassa eri säännöillä kuin lajitteluvalikko.
   * Yksi rakentaja on koko korjaus.
   */
  it("kantaa lajittelun kansiosta toiseen", () => {
    expect(
      filesHref({ folderId: "abc", fileSort: "name", folderSort: "newest" }),
    ).toBe("/admin/tiedostot?kansio=abc&jarjesta=name&kansiot=newest");
  });

  /* Oletukset eivät kuulu osoitteeseen: lyhyt osoite on jaettava. */
  it("jättää oletusarvot pois", () => {
    expect(filesHref({})).toBe("/admin/tiedostot");
    expect(filesHref({ fileSort: "added", folderSort: "custom" })).toBe(
      "/admin/tiedostot",
    );
    expect(filesHref({ view: "all" })).toBe("/admin/tiedostot");
  });

  it("kirjoittaa näkymän ja haun", () => {
    expect(filesHref({ view: "trash" })).toBe("/admin/tiedostot?nakyma=trash");
    expect(filesHref({ term: "vuokra" })).toBe("/admin/tiedostot?haku=vuokra");
  });

  /* Hakusanassa voi olla mitä tahansa, myös &-merkki. */
  it("koodaa hakusanan turvallisesti", () => {
    expect(filesHref({ term: "a&b=c" })).toBe(
      "/admin/tiedostot?haku=a%26b%3Dc",
    );
  });
});

describe("lähtökansioiden nimet", () => {
  /*
   * Kanta tallentaa nimen suomeksi, koska sen on oltava jotain.
   * Turkinkielinen käyttäjä ei kuitenkaan voi tietää onko "Kuitit"
   * käännösvirhe vai jonkun aiemmin kirjoittama nimi.
   */
  it("kääntää Katen luoman lähtökansion", () => {
    expect(
      folderLabel({ name: "Kuitit", defaultKey: "receipts" }, sanat),
    ).toBe("Fişler");
  });

  /*
   * Nimeäminen katkaisee sidoksen lopullisesti.
   *
   * Kannassa avain on tyhjennetty, joten nimi on käyttäjän oma eikä
   * käänny millään kielellä.
   */
  it("jättää käyttäjän oman nimen rauhaan", () => {
    expect(folderLabel({ name: "Kuitit", defaultKey: null }, sanat)).toBe(
      "Kuitit",
    );
    expect(folderLabel({ name: "Oma kansio", defaultKey: null }, sanat)).toBe(
      "Oma kansio",
    );
  });

  /* Tuntematon avain: kannan nimi on parempi kuin tyhjä. */
  it("palauttaa kannan nimen tuntemattomalle avaimelle", () => {
    expect(folderLabel({ name: "Uusi", defaultKey: "tuntematon" }, sanat)).toBe(
      "Uusi",
    );
  });

  it("kääntää jokaisen tason polussa", () => {
    const puu = [
      kansio({ id: "k", name: "Kuitit", defaultKey: "receipts" }),
      kansio({ id: "v", name: "2026", parentId: "k" }),
    ];

    expect(folderPath(puu, "v", sanat)).toBe("Fişler / 2026");
  });

  /*
   * Aakkosjärjestys näytettävän nimen mukaan.
   *
   * Turkinkielinen käyttäjä odottaa "Fişler" olevan F:n kohdalla eikä
   * K:n, jossa se olisi kannan nimen "Kuitit" mukaan.
   */
  it("lajittelee näytettävän nimen mukaan", () => {
    const puu = [
      kansio({ id: "k", name: "Kuitit", defaultKey: "receipts" }),
      kansio({ id: "g", name: "Gastro" }),
    ];

    /* Nayttonimella: "Fisler" alkaa F:lla, siis ennen "Gastroa". */
    expect(sortFolders(puu, "name", "tr-TR", sanat).map((f) => f.id)).toEqual([
      "k",
      "g",
    ]);

    /* Ilman sanakirjaa lajittelu putoaa kannan nimeen "Kuitit", jolloin
       jarjestys kaantyy. Juuri tama oli vika: lista nayttaa F-nimen
       K-kirjaimen kohdalla. */
    expect(sortFolders(puu, "name", "tr-TR").map((f) => f.id)).toEqual([
      "g",
      "k",
    ]);
  });
});

describe("muistutuksen ajankohta", () => {
  /*
   * Kuukausi ennen vanhenemista.
   *
   * Merkintä varoittaa 60 päivää ennen, tehtävä 30. Ne ovat eri asia:
   * toinen kertoo, toinen käskee.
   */
  it("erääntyy kuukautta ennen voimassaolon päättymistä", () => {
    expect(reminderDay("2026-12-31", "2026-08-31")).toBe("2026-12-01");
    expect(REMINDER_DAYS_BEFORE).toBe(30);
  });

  /*
   * Menneisyyteen ei voi asettaa eräpäivää.
   *
   * Jos lupa vanhenee kahden viikon päästä, muistutuksen "oikea"
   * ajankohta olisi jo mennyt. Silloin asia on tänään — eräpäivä
   * menneisyydessä syntyisi valmiiksi myöhässä olevana.
   */
  it("siirtää tähän päivään kun aika on jo kulunut", () => {
    expect(reminderDay("2026-09-10", "2026-08-31")).toBe("2026-08-31");
    expect(reminderDay("2026-01-01", "2026-08-31")).toBe("2026-08-31");
  });

  /* Kuukauden ja vuoden yli: laskenta ei saa pysähtyä rajalle. */
  it("laskee oikein kuukauden ja vuoden vaihteen yli", () => {
    expect(reminderDay("2027-01-15", "2026-08-31")).toBe("2026-12-16");
    expect(reminderDay("2026-03-01", "2026-01-01")).toBe("2026-01-30");
  });

  it("kestää kelvottoman päivän", () => {
    expect(reminderDay("ei-paiva", "2026-08-31")).toBe("2026-08-31");
  });
});

describe("asiakirjan laji kansioksi", () => {
  /*
   * Jokainen laji osuu Katen omaan lähtökansioon.
   *
   * Puuttuva kartoitus on hiljainen vika: ehdotus jää tyhjäksi eikä
   * kukaan huomaa, koska tyhjä ehdotus näyttää samalta kuin
   * tunnistamaton asiakirja.
   */
  it("sijoittaa jokaisen tunnetun lajin", () => {
    const odotetut: Record<string, string | null> = {
      invoice: "invoices",
      receipt: "receipts",
      licence: "authorities",
      tax: "authorities",
      lease: "contracts",
      contract: "contracts",
      insurance: "contracts",
      report: "sales_reports",
      payroll: "staff",
      other: null,
    };

    for (const kind of DOCUMENT_KINDS) {
      expect(folderKeyFor(kind), kind).toBe(odotetut[kind]);
    }
  });

  /* "other" on rehellinen vastaus: sijoittamaton on parempi kuin väärä. */
  it("ei sijoita tunnistamatonta", () => {
    expect(folderKeyFor("other")).toBeNull();
  });
});

describe("nimien numerointi", () => {
  /*
   * Laatikollisessa papereita on usein kaksi laskua samalta
   * toimittajalta samana päivänä, ja malli lukee niistä saman nimen.
   */
  it("jättää vapaan nimen rauhaan", () => {
    expect(uniqueName("Metro 2026-01-12.pdf", [])).toBe("Metro 2026-01-12.pdf");
    expect(uniqueName("Metro.pdf", ["Wihuri.pdf"])).toBe("Metro.pdf");
  });

  /* Numero ennen päätettä: "nimi.pdf (2)" ei aukea missään. */
  it("numeroi varatun nimen päätteen edestä", () => {
    expect(uniqueName("Metro 2026-01-12.pdf", ["Metro 2026-01-12.pdf"])).toBe(
      "Metro 2026-01-12 (2).pdf",
    );
  });

  it("jatkaa numerointia kunnes nimi on vapaa", () => {
    const varatut = ["Lasku.pdf", "Lasku (2).pdf", "Lasku (3).pdf"];
    expect(uniqueName("Lasku.pdf", varatut)).toBe("Lasku (4).pdf");
  });

  /* Tiedostonimet eivät eroa kirjainkoolla useimmissa järjestelmissä. */
  it("ei erota isoja ja pieniä kirjaimia", () => {
    expect(uniqueName("Lasku.pdf", ["lasku.PDF"])).toBe("Lasku (2).pdf");
  });

  it("kestää nimen ilman päätettä", () => {
    expect(uniqueName("Sopimus", ["Sopimus"])).toBe("Sopimus (2)");
  });
});

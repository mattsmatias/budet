import { describe, expect, it } from "vitest";
import { buildXlsx } from "../xlsx";

/**
 * Tiedosto on ZIP-paketti, joten sen rakenne on tarkistettavissa ilman
 * Exceliä. Jos allekirjoitukset tai keskushakemisto ovat väärin, Excel
 * kieltäytyy avaamasta koko tiedostoa — ja se selviää vasta käyttäjän
 * koneella ellei sitä testata täällä.
 */
function readText(file: Uint8Array): string {
  return new TextDecoder().decode(file);
}

describe("xlsx-kirjoitin", () => {
  const file = buildXlsx([
    {
      name: "Kulut",
      rows: [
        ["Kategoria", "Summa"],
        ["Ruoka", 1728000],
        ["Juomat", 1282000],
      ],
    },
  ]);

  it("alkaa ZIP-allekirjoituksella", () => {
    expect(Array.from(file.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("päättyy keskushakemiston lopetukseen", () => {
    const end = file.slice(file.length - 22, file.length - 18);
    expect(Array.from(end)).toEqual([0x50, 0x4b, 0x05, 0x06]);
  });

  it("sisältää pakolliset osat", () => {
    const text = readText(file);
    expect(text).toContain("[Content_Types].xml");
    expect(text).toContain("_rels/.rels");
    expect(text).toContain("xl/workbook.xml");
    expect(text).toContain("xl/worksheets/sheet1.xml");
    expect(text).toContain("xl/styles.xml");
  });

  /** Juuri tämä on syy tehdä xlsx CSV:n rinnalle. */
  it("kirjoittaa luvut lukuina eikä tekstinä", () => {
    const text = readText(file);
    expect(text).toContain("<v>1728000</v>");
    expect(text).not.toContain('<t xml:space="preserve">1728000</t>');
  });

  it("kirjoittaa tekstin inline-merkkijonona", () => {
    expect(readText(file)).toContain(">Ruoka<");
  });

  it("suojaa XML-merkit", () => {
    const escaped = buildXlsx([
      { name: "Testi", rows: [["A & B <c>"], ['Lainaus "tässä"']] },
    ]);

    const text = readText(escaped);
    expect(text).toContain("A &amp; B &lt;c&gt;");
    expect(text).not.toContain("A & B <c>");
  });

  /** Excel hylkää nimet joissa on : \ / ? * [ ] tai yli 31 merkkiä. */
  it("siivoaa välilehden nimen", () => {
    const odd = buildXlsx([
      {
        name: "Kulut/2026[elokuu]:kaikki yhteensä ja vielä lisää",
        rows: [["x"]],
      },
    ]);

    const text = readText(odd);
    const match = text.match(/<sheet name="([^"]*)"/);

    expect(match).not.toBeNull();
    expect(match?.[1].length).toBeLessThanOrEqual(31);
    expect(match?.[1]).not.toMatch(/[:\\/?*[\]]/);
  });

  it("jäädyttää otsikkorivin", () => {
    expect(readText(file)).toContain('ySplit="1"');
  });

  it("kirjoittaa useita välilehtiä", () => {
    const many = buildXlsx([
      { name: "Yksi", rows: [["a"]] },
      { name: "Kaksi", rows: [["b"]] },
    ]);

    const text = readText(many);
    expect(text).toContain("xl/worksheets/sheet1.xml");
    expect(text).toContain("xl/worksheets/sheet2.xml");
    expect(text).toContain('sheetId="2"');
  });

  it("kieltäytyy tyhjästä työkirjasta", () => {
    expect(() => buildXlsx([])).toThrow();
  });

  /** Sama aineisto antaa saman tiedoston: versiot ovat vertailukelpoisia. */
  it("tuottaa saman tavujonon samasta aineistosta", () => {
    const a = buildXlsx([{ name: "S", rows: [["x", 1]] }]);
    const b = buildXlsx([{ name: "S", rows: [["x", 1]] }]);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

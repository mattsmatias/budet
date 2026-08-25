import { describe, expect, it } from "vitest";
import { parseReceiptPages } from "../receipt-pages";

describe("parseReceiptPages", () => {
  it("säilyttää sivujärjestyksen", () => {
    const pages = parseReceiptPages(
      JSON.stringify([
        { path: "a.jpg", hash: "1" },
        { path: "b.jpg", hash: "2" },
        { path: "c.jpg", hash: "3" },
      ]),
    );

    expect(pages.map((page) => page.path)).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
  });

  it("ei rajoita sivujen määrää", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      path: `sivu-${i}.jpg`,
      hash: `${i}`,
    }));

    expect(parseReceiptPages(JSON.stringify(many))).toHaveLength(40);
  });

  it("pudottaa saman polun toistuvan esiintymän", () => {
    const pages = parseReceiptPages(
      JSON.stringify([
        { path: "a.jpg", hash: "1" },
        { path: "b.jpg", hash: "2" },
        { path: "a.jpg", hash: "1" },
      ]),
    );

    expect(pages.map((page) => page.path)).toEqual(["a.jpg", "b.jpg"]);
  });

  it("hylkää rivit joilla ei ole polkua", () => {
    const pages = parseReceiptPages(
      JSON.stringify([{ path: "" }, { path: "   " }, { hash: "x" }, { path: "ok.jpg" }]),
    );

    expect(pages).toEqual([{ path: "ok.jpg", hash: "" }]);
  });

  it("antaa tyhjän listan rikkinäisestä syötteestä", () => {
    // Kuitti tallentuu silti — sivut voi liittää uudelleen.
    expect(parseReceiptPages("{ ei json")).toEqual([]);
    expect(parseReceiptPages(JSON.stringify({ path: "a.jpg" }))).toEqual([]);
    expect(parseReceiptPages(null)).toEqual([]);
    expect(parseReceiptPages("")).toEqual([]);
  });

  it("täydentää puuttuvan tiivisteen tyhjäksi eikä pudota sivua", () => {
    // Tiiviste on kaksoiskappaleiden tunnistusta varten. Sen puute ei
    // tee sivusta kelvotonta: kuva on silti kuitin sivu.
    const pages = parseReceiptPages(JSON.stringify([{ path: "a.jpg", hash: 7 }]));

    expect(pages).toEqual([{ path: "a.jpg", hash: "" }]);
  });
});

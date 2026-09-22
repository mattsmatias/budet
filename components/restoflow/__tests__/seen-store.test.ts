import { describe, expect, it } from "vitest";
import { mergeSeen, seenIn } from "../seen-store";

/**
 * Kellon merkki laskee vain näkemättömät.
 *
 * Nähty ilmoitus ei saa palauttaa merkkiä, uusi ilmoitus saa.
 */
describe("nähdyt ilmoitukset", () => {
  it("merkitsee nähdyksi ja tunnistaa uuden", () => {
    const raw = mergeSeen("", ["a", "b"]);
    expect(seenIn(raw, "a")).toBe(true);
    expect(seenIn(raw, "b")).toBe(true);
    expect(seenIn(raw, "c")).toBe(false);
  });

  it("ei tallenna samaa kahdesti", () => {
    const raw = mergeSeen(mergeSeen("", ["a"]), ["a", "b"]);
    expect(raw.split("\n")).toEqual(["a", "b"]);
  });

  it("pitää palvelimen oletuksena kaiken nähtynä", () => {
    expect(seenIn("*", "mikä-tahansa")).toBe(true);
    expect(mergeSeen("*", ["a"])).toBe("a");
  });

  it("unohtaa vanhimmat kun raja täyttyy", () => {
    const ids = Array.from({ length: 510 }, (_, i) => `id-${i}`);
    const raw = mergeSeen("", ids);
    expect(seenIn(raw, "id-0")).toBe(false);
    expect(seenIn(raw, "id-509")).toBe(true);
    expect(raw.split("\n")).toHaveLength(500);
  });
});

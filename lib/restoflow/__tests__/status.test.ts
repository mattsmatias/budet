import { describe, expect, it } from "vitest";
import { adminText } from "@/lib/i18n/admin-text";
import { overallStatus } from "../status";
import type { FocusItem, FocusSeverity } from "../dashboard";

function item(severity: FocusSeverity, id: string = severity): FocusItem {
  return {
    id,
    severity,
    title: "x",
    detail: "y",
    href: "/admin",
    icon: "alert",
  };
}

/** Testit lukevat suomenkielisen otsikon, joten kieli on kiinnitetty. */
const suomi = adminText("fi");

describe("kokonaistila", () => {
  it("nostaa kriittisen kaiken edelle", () => {
    const s = overallStatus(
      [item("info"), item("warning"), item("critical")],
      true,
      suomi,
    );
    expect(s.tone).toBe("bad");
    expect(s.headline).toBe("1 kriittinen asia vaatii huomiota");
    /* Yksi varoitus ja yksi havainto: kaksi riviä otsikon lisäksi. */
    expect(s.detail).toBe("Lisäksi 2 muuta kohtaa.");
  });

  it("taivuttaa monikon", () => {
    const s = overallStatus(
      [item("critical", "a"), item("critical", "b")],
      true,
      suomi,
    );
    expect(s.headline).toBe("2 kriittistä asiaa vaatii huomiota");
  });

  /*
   * Otsikon luku on listan pituus.
   *
   * Otsikko laski aiemmin vain varoitukset, joten kaksi varoitusta ja
   * yksi havainto tuotti otsikon "2 asiaa vaatii huomiota" kolmen
   * rivin yllä.
   */
  it("laskee otsikkoon myös havainnot", () => {
    const s = overallStatus([item("warning"), item("info")], true, suomi);
    expect(s.tone).toBe("warn");
    expect(s.headline).toBe("2 asiaa vaatii huomiota");
    expect(s.detail).toBe("1 tarkistettavaa ja 1 havainto seurattavaksi.");
  });

  it("jättää erittelyn pois kun havaintoja ei ole", () => {
    const s = overallStatus(
      [item("warning", "a"), item("warning", "b")],
      true,
      suomi,
    );
    expect(s.headline).toBe("2 asiaa vaatii huomiota");
    expect(s.detail).toBeNull();
  });

  it("sanoo että kaikki on hyvin kun mitään ei ole", () => {
    const s = overallStatus([], true, suomi);
    expect(s.tone).toBe("good");
    expect(s.headline).toBe("Kaikki näyttää hyvältä");
  });

  /*
   * Havainto ei ole puute vaan suunta. Vihreä piste ja otsikko
   * "vaatii huomiota" väittäisivät samassa kortissa eri asiaa, joten
   * pelkkä havainto pitää tilan hyvänä — mutta luku kerrotaan, koska
   * havainto piirtyy riviksi otsikon alle.
   */
  it("mainitsee seurattavat havainnot hyvässäkin tilassa", () => {
    const s = overallStatus([item("info")], true, suomi);
    expect(s.tone).toBe("good");
    expect(s.headline).toBe("Kaikki näyttää hyvältä");
    expect(s.detail).toBe("1 havainto seurattavaksi.");
  });

  /*
   * Tämä on tilan tärkein tapaus.
   *
   * Tyhjä aineisto ei ole hyvä uutinen. Jos "ei vielä arvioitavaa"
   * piirrettäisiin vihreänä, ravintoloitsija luulisi tarkastuksen
   * menneen läpi vaikka sitä ei ole tehty.
   */
  it("erottaa arvioimattomuuden hyvästä tilanteesta", () => {
    const s = overallStatus([], false, suomi);
    expect(s.tone).toBe("unknown");
    expect(s.tone).not.toBe("good");
    expect(s.headline).toBe("Ei vielä arvioitavaa");
    expect(s.detail).toContain("Tyhjä aineisto ei tarkoita");
  });

  // Poikkeama on poikkeama vaikka aineisto olisi ohut.
  it("näyttää poikkeaman vaikka arviointi olisi vajaa", () => {
    expect(overallStatus([item("critical")], false, suomi).tone).toBe("bad");
  });

  it("laskee määrät", () => {
    const s = overallStatus(
      [
        item("critical", "a"),
        item("warning", "b"),
        item("warning", "c"),
        item("info", "d"),
      ],
      true,
      suomi,
    );
    expect(s.counts).toEqual({ critical: 1, warning: 2, info: 1 });
  });
});

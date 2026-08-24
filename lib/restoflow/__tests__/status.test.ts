import { describe, expect, it } from "vitest";
import { overallStatus } from "../status";
import type { FocusItem, FocusSeverity } from "../dashboard";

function item(severity: FocusSeverity, id: string = severity): FocusItem {
  return { id, severity, title: "x", detail: "y", href: "/admin" };
}

describe("kokonaistila", () => {
  it("nostaa kriittisen kaiken edelle", () => {
    const s = overallStatus([item("info"), item("warning"), item("critical")], true);
    expect(s.tone).toBe("bad");
    expect(s.headline).toBe("1 kriittinen asia vaatii huomiota");
    expect(s.detail).toContain("1 huomautusta");
  });

  it("taivuttaa monikon", () => {
    const s = overallStatus([item("critical", "a"), item("critical", "b")], true);
    expect(s.headline).toBe("2 kriittistä asiaa vaatii huomiota");
  });

  it("kertoo huomautuksista kun kriittisiä ei ole", () => {
    const s = overallStatus([item("warning"), item("info")], true);
    expect(s.tone).toBe("warn");
    expect(s.headline).toBe("1 asia vaatii huomiota");
  });

  it("sanoo että kaikki on hyvin kun mitään ei ole", () => {
    const s = overallStatus([], true);
    expect(s.tone).toBe("good");
    expect(s.headline).toBe("Kaikki näyttää hyvältä");
  });

  it("mainitsee seurattavat havainnot hyvässäkin tilassa", () => {
    const s = overallStatus([item("info")], true);
    expect(s.tone).toBe("good");
    expect(s.detail).toContain("1 havainto");
  });

  /*
   * Tämä on tilan tärkein tapaus.
   *
   * Tyhjä aineisto ei ole hyvä uutinen. Jos "ei vielä arvioitavaa"
   * piirrettäisiin vihreänä, ravintoloitsija luulisi tarkastuksen
   * menneen läpi vaikka sitä ei ole tehty.
   */
  it("erottaa arvioimattomuuden hyvästä tilanteesta", () => {
    const s = overallStatus([], false);
    expect(s.tone).toBe("unknown");
    expect(s.tone).not.toBe("good");
    expect(s.headline).toBe("Ei vielä arvioitavaa");
    expect(s.detail).toContain("Tyhjä aineisto ei tarkoita");
  });

  // Poikkeama on poikkeama vaikka aineisto olisi ohut.
  it("näyttää poikkeaman vaikka arviointi olisi vajaa", () => {
    expect(overallStatus([item("critical")], false).tone).toBe("bad");
  });

  it("laskee määrät", () => {
    const s = overallStatus(
      [item("critical", "a"), item("warning", "b"), item("warning", "c"), item("info", "d")],
      true,
    );
    expect(s.counts).toEqual({ critical: 1, warning: 2, info: 1 });
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Tunnus on kahdessa paikassa, ja se on pakko.
 *
 * Komponentti piirtää tunnuksen sovelluksessa; favicon on oltava
 * staattinen tiedosto, jota selain osaa hakea ilman Reactia. Polut
 * ovat siis väistämättä kahdessa tiedostossa.
 *
 * JUURI TÄMÄ KAATOI EDELLISEN TUNNUKSEN.
 *
 * B-merkki oli kirjoitettu kolmeen paikkaan, ja ne olivat ehtineet
 * erota toisistaan ennen kuin kukaan huomasi. Kopio ei ole ongelma
 * niin kauan kuin jokin huomaa kun kopiot eroavat — tämä testi on se
 * jokin.
 */

const juuri = join(import.meta.dirname, "..", "..", "..");
const komponentti = readFileSync(join(juuri, "components", "brand", "logo.tsx"), "utf8");
const favicon = readFileSync(join(juuri, "app", "icon.svg"), "utf8");

/**
 * Juuri-svg pois vertailusta.
 *
 * Favicon kertoo mittansa literaalina, koska tiedostolla ei ole
 * kutsujaa; komponentti saa ne size-propista. Ne EIVÄT saa olla samat,
 * joten vain juurta seuraavat muodot vertaillaan.
 */
function muodot(lahde: string): string {
  const alku = lahde.indexOf("<rect");
  return alku === -1 ? "" : lahde.slice(alku);
}

/** Kaikki d-attribuutit tiedostosta. */
function polut(lahde: string): string[] {
  return [...muodot(lahde).matchAll(/\bd="([^"]+)"/g)].map((m) => m[1].trim());
}

/** Muotoa määrittävät luvut: säteet, mitat ja viivan paksuus. */
function mitat(lahde: string): string[] {
  return [
    ...muodot(lahde).matchAll(
      /\b(?:x|y|width|height|rx|stroke-width|strokeWidth)="([\d.]+)"/g,
    ),
  ].map((m) => m[1]);
}

describe("tunnus", () => {
  it("piirtää samat polut komponentissa ja faviconissa", () => {
    const a = polut(komponentti);
    const b = polut(favicon);

    expect(a.length, "komponentista ei löytynyt polkuja").toBeGreaterThan(0);
    expect(b).toEqual(a);
  });

  it("käyttää samoja mittoja molemmissa", () => {
    expect(mitat(favicon)).toEqual(mitat(komponentti));
  });

  /*
   * Värit erikseen: ne on helppo vaihtaa vain toisesta paikasta, ja
   * väärän värinen favicon huomataan vasta kun se on jo julkaistu.
   */
  it("käyttää samoja värejä molemmissa", () => {
    const varit = (lahde: string) =>
      [...lahde.matchAll(/#[0-9a-f]{3,6}/gi)].map((m) => m[0].toLowerCase());

    expect(varit(favicon)).toEqual(varit(komponentti));
  });
});

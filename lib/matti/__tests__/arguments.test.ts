import { describe, expect, it } from "vitest";
import { TOOLS } from "../tools";

/**
 * Ehdotuksen argumentit ja niiden hyväksyntä.
 *
 * Tämä tiedosto on olemassa yhden tuotantovirheen takia.
 *
 * Matti ehdotti muutosta, ehdotus näkyi käyttäjälle oikein, ja
 * Hyväksy kaatui virheeseen "En saanut muutosta tehtyä". Syy:
 * hyväksyntäpolulla oli käsin kirjoitettu kopio työkalun skeemasta,
 * ja kopion päivämääräkuviosta olivat kenoviivat kadonneet. Ehdotus
 * validoitui ehjällä skeemalla, hyväksyntä rikkinäisellä.
 *
 * Nyt hyväksyntä käyttää työkalun omaa skeemaa, ja tämä testi
 * varmistaa että jokaisella kirjoittavalla työkalulla on ainakin yksi
 * kelvollinen esimerkki jonka sen oma skeema hyväksyy.
 *
 * Tällä hetkellä kirjoittavia työkaluja ei ole — ne olivat lounaslistan
 * ehdotuksia, ja lounas poistui Katesta. Vartija jää: uusi kirjoittava
 * työkalu ilman näytettä kaatuu tähän.
 */

/**
 * Jokaiselle kirjoittavalle työkalulle kelvollinen esimerkki.
 *
 * Skeema jota mikään ei läpäise on ominaisuus jota ei voi käyttää — ja
 * juuri sellainen tämä oli.
 */
const NAYTTEET: Record<string, unknown> = {};

describe("kirjoittavien työkalujen skeemat", () => {
  it("hyväksyy kelvollisen esimerkin jokaiselle", () => {
    for (const tool of TOOLS.filter((t) => t.level === "write")) {
      const sample = NAYTTEET[tool.name];

      // Uusi kirjoittava työkalu ilman näytettä jää tähän kiinni.
      expect(sample, `puuttuva näyte: ${tool.name}`).toBeDefined();
      expect(
        tool.schema.safeParse(sample).success,
        `skeema hylkäsi näytteen: ${tool.name}`,
      ).toBe(true);
    }
  });

  it("ei pidä näytteitä työkaluille joita ei ole", () => {
    const names = new Set(TOOLS.map((t) => t.name));
    for (const name of Object.keys(NAYTTEET)) {
      expect(names.has(name), `näyte ilman työkalua: ${name}`).toBe(true);
    }
  });
});

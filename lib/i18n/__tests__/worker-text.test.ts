import { describe, expect, it } from "vitest";
import { APP_LOCALES } from "../app-locales";
import { workerText } from "../worker-text";
import { workerErrors } from "../worker-errors";

/**
 * Työntekijänäkymän käännösten täydellisyys.
 *
 * Sama vartiointi kuin auth-text.test.ts:ssä. Tyyppi estää puuttuvan
 * avaimen, mutta ei tyhjää tekstiä, kadonnutta paikkamerkkiä eikä
 * käännöstä joka on jäänyt kopioksi suomesta.
 */

type Solmu = string | { [k: string]: Solmu };

function litista(solmu: Solmu, polku = ""): [string, string][] {
  if (typeof solmu === "string") return [[polku, solmu]];
  return Object.entries(solmu).flatMap(([avain, arvo]) =>
    litista(arvo, polku ? `${polku}.${avain}` : avain),
  );
}

/** Kaikki {paikkamerkit} tekstistä, järjestyksessä. */
function merkit(teksti: string): string[] {
  return (teksti.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
}

const OSAT = [
  ["näkymä", (l: (typeof APP_LOCALES)[number]) => workerText(l) as unknown as Solmu],
  ["viestit", (l: (typeof APP_LOCALES)[number]) => workerErrors(l) as unknown as Solmu],
] as const;

for (const [nimi, hae] of OSAT) {
  describe(`työntekijänäkymän ${nimi}`, () => {
    const suomi = litista(hae("fi"));

    it("kattaa jokaisen kielen samalla rakenteella", () => {
      for (const locale of APP_LOCALES) {
        expect(
          litista(hae(locale)).map(([polku]) => polku),
          locale,
        ).toEqual(suomi.map(([polku]) => polku));
      }
    });

    it("ei jätä yhtäkään tekstiä tyhjäksi", () => {
      for (const locale of APP_LOCALES) {
        for (const [polku, arvo] of litista(hae(locale))) {
          expect(arvo.trim(), `${locale}: ${polku}`).not.toBe("");
        }
      }
    });

    /*
     * Paikkamerkki on helppo pudottaa käännöksestä vahingossa, ja
     * silloin lause on ehjä mutta kertoo väärää: "Aloitettu." ilman
     * kellonaikaa.
     */
    it("säilyttää paikkamerkit jokaisessa käännöksessä", () => {
      for (const locale of APP_LOCALES) {
        const omat = litista(hae(locale));
        for (const [i, [polku, arvo]] of omat.entries()) {
          expect(merkit(arvo), `${locale}: ${polku}`).toEqual(merkit(suomi[i][1]));
        }
      }
    });

    /*
     * Kääntämätön kohta näkyy siinä että teksti on sana sanalta sama
     * kuin suomeksi. Lyhyet sanat voivat olla aidosti samoja — "Nimi"
     * on viroksi "Nimi" — joten raja on pituudessa.
     */
    it("ei sisällä suomea muissa kielissä", () => {
      const raja = 14;

      for (const locale of APP_LOCALES) {
        if (locale === "fi") continue;

        const kopiot = litista(hae(locale))
          .filter(([, arvo], i) => arvo.length > raja && arvo === suomi[i][1])
          .map(([polku]) => polku);

        expect(kopiot, `${locale} kääntämättä`).toEqual([]);
      }
    });
  });
}

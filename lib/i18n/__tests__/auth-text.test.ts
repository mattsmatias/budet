import { describe, expect, it } from "vitest";
import { APP_LOCALES } from "../app-locales";
import { authText, fill } from "../auth-text";

/**
 * Käännösten täydellisyys.
 *
 * Tyyppi jo estää puuttuvan avaimen, mutta ei tyhjää merkkijonoa eikä
 * sitä että käännös on jäänyt kopioksi suomesta. Nämä testit ovat
 * siitä toisesta puolesta.
 */

type Solmu = string | { [k: string]: Solmu };

/** Kaikki polut ja arvot litteänä listana. */
function litista(solmu: Solmu, polku = ""): [string, string][] {
  if (typeof solmu === "string") return [[polku, solmu]];
  return Object.entries(solmu).flatMap(([avain, arvo]) =>
    litista(arvo, polku ? `${polku}.${avain}` : avain),
  );
}

describe("kirjautumisen tekstit", () => {
  const suomi = litista(authText("fi") as unknown as Solmu);

  it("kattaa jokaisen kielen samalla rakenteella", () => {
    for (const locale of APP_LOCALES) {
      const omat = litista(authText(locale) as unknown as Solmu);
      expect(
        omat.map(([polku]) => polku),
        locale,
      ).toEqual(suomi.map(([polku]) => polku));
    }
  });

  it("ei jätä yhtäkään tekstiä tyhjäksi", () => {
    for (const locale of APP_LOCALES) {
      for (const [polku, arvo] of litista(
        authText(locale) as unknown as Solmu,
      )) {
        expect(arvo.trim(), `${locale}: ${polku}`).not.toBe("");
      }
    }
  });

  /*
   * Kääntämätön kohta näkyy siinä että teksti on sana sanalta sama
   * kuin suomeksi. Lyhyet kentät voivat olla aidosti samoja — "Nimi"
   * on viroksi "Nimi" — joten raja on pituudessa: sitä pidempi osuma
   * on kopio eikä sattuma.
   */
  it("ei sisällä suomea muissa kielissä", () => {
    const raja = 12;

    for (const locale of APP_LOCALES) {
      if (locale === "fi") continue;

      const omat = litista(authText(locale) as unknown as Solmu);
      const kopiot = omat
        .filter(([polku, arvo], i) => {
          const lahde = suomi[i][1];
          return arvo.length > raja && arvo === lahde && polku !== "";
        })
        .map(([polku]) => polku);

      expect(kopiot, `${locale} kääntämättä`).toEqual([]);
    }
  });

  /*
   * Paikkamerkki on helppo pudottaa käännöksestä vahingossa, ja
   * silloin lause on kielioppisesti ehjä mutta kertoo väärää: "Asetat
   * salasanan tunnukselle." ilman tunnusta.
   */
  it("säilyttää paikkamerkit jokaisessa kielessä", () => {
    for (const locale of APP_LOCALES) {
      const t = authText(locale);
      expect(t.uusiSalasana.forAccount, locale).toContain("{email}");
      expect(t.virheet.signUpFailed, locale).toContain("{syy}");
    }
  });

  it("sijoittaa arvon paikkamerkin tilalle", () => {
    expect(fill("Tunnus {email} ja {email}.", { email: "a@b.fi" })).toBe(
      "Tunnus a@b.fi ja a@b.fi.",
    );
    // Tuntematon paikkamerkki jää näkyviin eikä katoa hiljaa.
    expect(fill("Hei {nimi}", {})).toBe("Hei {nimi}");
  });
});

import { describe, expect, it } from "vitest";
import { APP_LOCALES } from "../app-locales";
import { adminText } from "../admin-text";
import {
  dayCountIn,
  guestCountIn,
  labels,
  reservationCountIn,
} from "../labels";

/**
 * Hallintanäkymän käännösten täydellisyys.
 *
 * Sama vartiointi kuin työntekijänäkymässä, mutta huomattavasti
 * suuremmalle sanakirjalle: hallinnassa on yli tuhat merkkijonoa
 * kolmessakymmenessä osiossa.
 *
 * Tyyppi takaa jo että jokaisella kielellä on jokainen avain — tyyppi
 * johdetaan suomesta. Nämä testit koskevat sitä mitä tyyppi ei näe:
 * tyhjä arvo, kadonnut paikkamerkki ja käännös joka on jäänyt
 * kopioksi suomesta.
 *
 * Jaetut nimikkeet ovat mukana samassa tiedostossa, koska ne ovat osa
 * samaa näkymää vaikka asuvat omassa moduulissaan.
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
  [
    "tekstit",
    (l: (typeof APP_LOCALES)[number]) => adminText(l) as unknown as Solmu,
  ],
  [
    "nimikkeet",
    (l: (typeof APP_LOCALES)[number]) => labels(l) as unknown as Solmu,
  ],
] as const;

for (const [nimi, hae] of OSAT) {
  describe(`hallintanäkymän ${nimi}`, () => {
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
     * Paikkamerkin katoaminen ei kaadu mihinkään: lause on ehjä mutta
     * kertoo väärää. "Kirjaa tositteen ja lukitsee kuukauden" ilman
     * lukumäärää on kielioppinsa puolesta moitteeton.
     */
    it("säilyttää paikkamerkit jokaisessa käännöksessä", () => {
      for (const locale of APP_LOCALES) {
        const omat = litista(hae(locale));
        for (const [i, [polku, arvo]] of omat.entries()) {
          expect(merkit(arvo), `${locale}: ${polku}`).toEqual(
            merkit(suomi[i][1]),
          );
        }
      }
    });

    /*
     * Kääntämätön kohta näkyy siinä että teksti on merkilleen sama
     * kuin suomeksi. Lyhyet sanat voivat olla aidosti samoja — "Nimi"
     * on viroksi "Nimi" ja "Facebook" on kaikilla kielillä Facebook —
     * joten raja on pituudessa.
     *
     * Pituus lasketaan paikkamerkkien ulkopuolelta. "{ennen} → {nyt}"
     * on pitkä mutta siinä ei ole yhtään sanaa käännettäväksi, ja se
     * on samanlainen jokaisella kielellä syystä.
     */
    it("ei sisällä suomea muissa kielissä", () => {
      const raja = 14;
      const sanat = (teksti: string) => teksti.replace(/\{[a-zA-Z]+\}/g, "");

      for (const locale of APP_LOCALES) {
        if (locale === "fi") continue;

        const kopiot = litista(hae(locale))
          .filter(
            ([, arvo], i) => sanat(arvo).length > raja && arvo === suomi[i][1],
          )
          .map(([polku]) => polku);

        expect(kopiot, `${locale} kääntämättä`).toEqual([]);
      }
    });
  });
}

/**
 * Taivutetut lukumäärät.
 *
 * "1 vierasta" on virhe joka pistää silmään heti, ja se syntyy heti
 * kun luku liimataan sanaan käännöstiedostossa. Nämä kolme ovat
 * taulukossa juuri siksi, joten testi tarkistaa nimenomaan yksikön.
 */
describe("lukumäärät", () => {
  it("taivuttaa yksikön suomeksi", () => {
    expect(guestCountIn(1, "fi")).toBe("1 vieras");
    expect(dayCountIn(1, "fi")).toBe("1 päivä");
    expect(reservationCountIn(1, "fi")).toBe("1 varaus");
  });

  it("käyttää monikkoa muualla", () => {
    expect(guestCountIn(2, "fi")).toBe("2 vierasta");
    expect(dayCountIn(0, "fi")).toBe("0 päivää");
    expect(reservationCountIn(12, "fi")).toBe("12 varausta");
  });

  it("erottaa yksikön ja monikon jokaisella kielellä", () => {
    for (const locale of APP_LOCALES) {
      for (const laske of [guestCountIn, dayCountIn, reservationCountIn]) {
        expect(laske(1, locale), `${locale} yksikkö`).toContain("1");
        expect(laske(7, locale), `${locale} monikko`).toContain("7");
      }
    }
  });
});

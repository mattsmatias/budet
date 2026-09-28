import { describe, expect, it } from "vitest";
import {
  alvNumero,
  muotoileIban,
  onKelvollinenIban,
  onKelvollinenYTunnus,
  siistiYTunnus,
} from "../yritystunnus";

/*
 * Tunnuksia joiden tarkistusnumero on laskettu käsin.
 *
 * 0201256-6 on PRH:n omissa ohjeissa käytetty esimerkki. Kaksi muuta
 * on laskettu paperilla samalla kaavalla mutta tästä koodista
 * riippumatta — muuten testi todistaisi vain että laskenta on itsensä
 * kanssa yhtä mieltä.
 *
 * Jakojäännökset ovat tarkoituksella eri: 0201256 antaa 5 (tarkiste
 * 6) ja 1041090 antaa 0 (tarkiste 0). Nollatapaus on oma haaransa
 * eikä se tulisi katetuksi muuten.
 */
const OIKEITA = [
  "0201256-6", // 71 mod 11 = 5 → 11 − 5 = 6
  "2762387-3", // 217 mod 11 = 8 → 11 − 8 = 3
  "1041090-0", // 88 mod 11 = 0 → tarkiste 0
];

describe("Y-tunnus", () => {
  it("hyvaksyy oikeat tunnukset", () => {
    for (const tunnus of OIKEITA) {
      expect(onKelvollinenYTunnus(tunnus)).toBe(true);
    }
  });

  /*
   * Juuri tämä tunnus oli Kahvila Demon tiedoissa paikkamerkkinä.
   *
   * Se näyttää Y-tunnukselta ja menisi läpi muototarkistuksesta, mutta
   * jakojäännös on 10 eikä siitä synny tarkistusnumeroa lainkaan.
   */
  it("hylkaa paikkamerkin 1234567-8", () => {
    expect(onKelvollinenYTunnus("1234567-8")).toBe(false);
  });

  it("hylkaa vaaran tarkistusnumeron", () => {
    expect(onKelvollinenYTunnus("0201256-5")).toBe(false);
    expect(onKelvollinenYTunnus("2762387-1")).toBe(false);
  });

  it("hylkaa vaaran muodon", () => {
    expect(onKelvollinenYTunnus("020125-66")).toBe(false);
    expect(onKelvollinenYTunnus("02012566")).toBe(false);
    expect(onKelvollinenYTunnus("")).toBe(false);
    expect(onKelvollinenYTunnus("FI02012566")).toBe(false);
  });

  it("siistii viivattoman ja valilyodyt", () => {
    expect(siistiYTunnus("02012566")).toBe("0201256-6");
    expect(siistiYTunnus(" 0201256-6 ")).toBe("0201256-6");
    expect(siistiYTunnus("0201256 6")).toBe("0201256-6");
  });

  it("ei siisti kelvotonta tunnusta muotoon", () => {
    expect(siistiYTunnus("12345678")).toBeNull();
    expect(siistiYTunnus("123")).toBeNull();
  });

  it("johtaa alv-numeron", () => {
    expect(alvNumero("0201256-6")).toBe("FI02012566");
    expect(alvNumero("1234567-8")).toBeNull();
  });
});

describe("IBAN", () => {
  /*
   * Suomalainen IBAN on 18 merkkia. Nama ovat muodollisesti oikeita
   * tarkistusnumeroltaan.
   */
  it("hyvaksyy oikean ibanin", () => {
    expect(onKelvollinenIban("FI2112345600000785")).toBe(true);
    expect(onKelvollinenIban("FI 21 1234 5600 0007 85")).toBe(true);
    expect(onKelvollinenIban("DE89370400440532013000")).toBe(true);
  });

  it("hylkaa vaaran tarkistusnumeron", () => {
    expect(onKelvollinenIban("FI2212345600000785")).toBe(false);
    expect(onKelvollinenIban("DE88370400440532013000")).toBe(false);
  });

  /* Suomalainen IBAN on aina 18 merkkia, ei 17 eika 19. */
  it("hylkaa vaaran pituuden suomalaiselta", () => {
    expect(onKelvollinenIban("FI211234560000078")).toBe(false);
    expect(onKelvollinenIban("FI21123456000007855")).toBe(false);
  });

  it("muotoilee neljan ryhmiin", () => {
    expect(muotoileIban("FI2112345600000785")).toBe("FI21 1234 5600 0007 85");
  });
});

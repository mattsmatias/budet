import { describe, expect, it } from "vitest";
import {
  erapaiva,
  laskunSummat,
  onMyohassa,
  rivinNetto,
  senteiksi,
} from "../invoice-math";

const STD = 0.255; // Suomen yleinen kanta
const RED = 0.135; // elintarvikkeet ja ravintolaruoka

describe("pyoristys", () => {
  it("pyoristaa puolikkaat poispain nollasta", () => {
    expect(senteiksi(0.5)).toBe(1);
    expect(senteiksi(1.5)).toBe(2);

    /*
     * Math.round(-0.5) on -0, eli hyvityslasku olisi sentin
     * erisuuruinen kuin alkuperainen lasku.
     */
    expect(senteiksi(-0.5)).toBe(-1);
    expect(senteiksi(-1.5)).toBe(-2);
  });

  it("on symmetrinen", () => {
    for (const arvo of [0.4, 0.6, 2.5, 3.49, 123.5]) {
      expect(senteiksi(-arvo)).toBe(-senteiksi(arvo));
    }
  });
});

describe("rivin netto", () => {
  it("kertoo maaran ja hinnan", () => {
    expect(rivinNetto({ quantity: 3, unitPriceCents: 1000, vatRate: STD })).toBe(3000);
  });

  it("kestaa murtoluvun maarana", () => {
    /* 7,5 tuntia a 65,00 = 487,50 */
    expect(rivinNetto({ quantity: 7.5, unitPriceCents: 6500, vatRate: STD })).toBe(48750);
  });

  it("pyoristaa murto-osasentin", () => {
    /* 3 x 3,335 = 10,005 -> 1001 senttia */
    expect(rivinNetto({ quantity: 3, unitPriceCents: 333.5, vatRate: STD })).toBe(1001);
  });
});

describe("laskun summat", () => {
  it("laskee yhden kannan", () => {
    const s = laskunSummat([
      { quantity: 1, unitPriceCents: 10000, vatRate: STD },
    ]);

    expect(s.netCents).toBe(10000);
    expect(s.vatCents).toBe(2550);
    expect(s.totalCents).toBe(12550);
  });

  /*
   * TAMA ON SE TESTI JOTA VARTEN LASKENTA ON KANNOITTAIN.
   *
   * Kolme rivia a 3,35 euroa, kanta 25,5 %:
   *   riveittain   round(335 x 0,255) = 85, kolme kertaa = 255
   *   kannoittain  round(1005 x 0,255) = 256
   *
   * Laki vaatii veron kannoittain, joten oikea vastaus on 256.
   */
  it("laskee ALV:n kannoittain eika riveittain", () => {
    const s = laskunSummat([
      { quantity: 1, unitPriceCents: 335, vatRate: STD },
      { quantity: 1, unitPriceCents: 335, vatRate: STD },
      { quantity: 1, unitPriceCents: 335, vatRate: STD },
    ]);

    expect(s.netCents).toBe(1005);
    expect(s.vatCents).toBe(256);

    /* Riveittain laskettuna tulos olisi 255 — varmistetaan ero. */
    const riveittain = 3 * Math.round(335 * STD);
    expect(riveittain).toBe(255);
    expect(s.vatCents).not.toBe(riveittain);
  });

  it("erittelee kannat nousevassa jarjestyksessa", () => {
    const s = laskunSummat([
      { quantity: 1, unitPriceCents: 10000, vatRate: STD },
      { quantity: 2, unitPriceCents: 500, vatRate: RED },
      { quantity: 1, unitPriceCents: 2000, vatRate: STD },
    ]);

    expect(s.kannat.map((k) => k.vatRate)).toEqual([RED, STD]);

    const alennettu = s.kannat[0];
    expect(alennettu.netCents).toBe(1000);
    expect(alennettu.vatCents).toBe(135);

    const yleinen = s.kannat[1];
    expect(yleinen.netCents).toBe(12000);
    expect(yleinen.vatCents).toBe(3060);

    expect(s.netCents).toBe(13000);
    expect(s.vatCents).toBe(3195);
    expect(s.totalCents).toBe(16195);
  });

  it("kestaa nollakannan", () => {
    const s = laskunSummat([
      { quantity: 1, unitPriceCents: 5000, vatRate: 0 },
    ]);

    expect(s.vatCents).toBe(0);
    expect(s.totalCents).toBe(5000);
    expect(s.kannat).toHaveLength(1);
  });

  it("kestaa tyhjan laskun", () => {
    const s = laskunSummat([]);
    expect(s).toEqual({ netCents: 0, vatCents: 0, totalCents: 0, kannat: [] });
  });

  /* Hyvityslasku: negatiiviset summat kayttaytyvat peilikuvana. */
  it("laskee hyvityslaskun peilikuvana", () => {
    const rivit = [
      { quantity: 1, unitPriceCents: 335, vatRate: STD },
      { quantity: 1, unitPriceCents: 335, vatRate: STD },
      { quantity: 1, unitPriceCents: 335, vatRate: STD },
    ];
    const lasku = laskunSummat(rivit);
    const hyvitys = laskunSummat(
      rivit.map((r) => ({ ...r, unitPriceCents: -r.unitPriceCents })),
    );

    expect(hyvitys.netCents).toBe(-lasku.netCents);
    expect(hyvitys.vatCents).toBe(-lasku.vatCents);
    expect(hyvitys.totalCents).toBe(-lasku.totalCents);
  });

  it("summa taysmaa aina kantojen kanssa", () => {
    const s = laskunSummat([
      { quantity: 3, unitPriceCents: 1234, vatRate: STD },
      { quantity: 1, unitPriceCents: 999, vatRate: RED },
      { quantity: 2.5, unitPriceCents: 777, vatRate: 0.1 },
    ]);

    expect(s.netCents).toBe(s.kannat.reduce((y, k) => y + k.netCents, 0));
    expect(s.vatCents).toBe(s.kannat.reduce((y, k) => y + k.vatCents, 0));
    expect(s.totalCents).toBe(s.netCents + s.vatCents);
  });
});

describe("erapaiva", () => {
  it("lisaa maksuajan paivina", () => {
    expect(erapaiva("2026-09-29", 14)).toBe("2026-10-13");
    expect(erapaiva("2026-09-29", 0)).toBe("2026-09-29");
  });

  it("ylittaa kuukauden ja vuoden vaihteen", () => {
    expect(erapaiva("2026-12-20", 21)).toBe("2027-01-10");
    expect(erapaiva("2026-01-31", 1)).toBe("2026-02-01");
  });

  /*
   * Kesaaika vaihtuu Suomessa lokakuun viimeisena sunnuntaina.
   * Paikallisessa ajassa laskettuna erapaiva siirtyisi paivalla.
   */
  it("ei siirry kesaajan vaihtuessa", () => {
    expect(erapaiva("2026-10-20", 14)).toBe("2026-11-03");
    expect(erapaiva("2026-03-20", 14)).toBe("2026-04-03");
  });

  it("osaa karkausvuoden", () => {
    expect(erapaiva("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("myohassa", () => {
  it("on myohassa vasta erapaivan jalkeen", () => {
    const lasku = { status: "sent", dueDate: "2026-09-29" };

    expect(onMyohassa(lasku, "2026-09-28")).toBe(false);
    expect(onMyohassa(lasku, "2026-09-29")).toBe(false);
    expect(onMyohassa(lasku, "2026-09-30")).toBe(true);
  });

  it("maksettu tai mitatoity ei ole myohassa", () => {
    for (const status of ["draft", "paid", "cancelled"]) {
      expect(onMyohassa({ status, dueDate: "2026-01-01" }, "2026-09-29")).toBe(
        false,
      );
    }
  });
});

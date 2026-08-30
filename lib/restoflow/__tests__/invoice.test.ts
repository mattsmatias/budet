import { describe, expect, it } from "vitest";
import {
  formatIban,
  formatReference,
  invoiceToTask,
  parseAnyReference,
  parseIban,
  parseReference,
  parseRfReference,
  type InvoiceExtraction,
} from "../invoice";

/**
 * Laskun tarkisteet.
 *
 * Testiarvot ovat vakiintuneita esimerkkejä eivätkä omalla koodilla
 * laskettuja. Jos tarkiste laskettaisiin samalla funktiolla jota se
 * testaa, testi menisi läpi myös väärällä algoritmilla.
 */

describe("kotimainen viitenumero", () => {
  /*
   * 12344: runko 1234, tarkiste 4.
   * Painot oikealta 7,3,1: 4×7 + 3×3 + 2×1 + 1×7 = 28+9+2+7 = 46.
   * Täydennys seuraavaan kymmeneen: 50 − 46 = 4.
   */
  it("hyväksyy oikean tarkisteen", () => {
    expect(parseReference("12344")).toBe("12344");
    expect(parseReference("1232")).toBe("1232");
  });

  it("hylkää väärän tarkisteen", () => {
    expect(parseReference("12345")).toBeNull();
    expect(parseReference("1233")).toBeNull();
  });

  it("sietää välilyöntejä ja viivoja", () => {
    expect(parseReference("1 2344")).toBe("12344");
    expect(parseReference("1234-4")).toBe("12344");
  });

  it("hylkää liian lyhyen ja liian pitkän", () => {
    expect(parseReference("123")).toBeNull();
    expect(parseReference("1".repeat(21))).toBeNull();
  });

  it("hylkää pelkät nollat", () => {
    /* 0000 läpäisisi tarkisteen mutta ei ole viite. */
    expect(parseReference("0000")).toBeNull();
  });

  it("hylkää tyhjän", () => {
    expect(parseReference(null)).toBeNull();
    expect(parseReference("")).toBeNull();
    expect(parseReference("ei numeroita")).toBeNull();
  });
});

describe("RF-viite", () => {
  /* RF18539007547034 on standardin oma esimerkki. */
  it("hyväksyy standardin esimerkin", () => {
    expect(parseRfReference("RF18539007547034")).toBe("RF18539007547034");
    expect(parseRfReference("RF18 5390 0754 7034")).toBe("RF18539007547034");
  });

  it("hylkää muutetun merkin", () => {
    expect(parseRfReference("RF18539007547035")).toBeNull();
  });

  it("hylkää muun kuin RF-alkuisen", () => {
    expect(parseRfReference("FI18539007547034")).toBeNull();
  });
});

describe("parseAnyReference", () => {
  it("tunnistaa kummankin muodon", () => {
    expect(parseAnyReference("RF18539007547034")).toBe("RF18539007547034");
    expect(parseAnyReference("12344")).toBe("12344");
  });

  it("palauttaa null kun kumpikaan ei kelpaa", () => {
    expect(parseAnyReference("12345")).toBeNull();
  });
});

describe("IBAN", () => {
  /* FI2112345600000785 on IBAN-standardin suomalainen esimerkki. */
  it("hyväksyy standardin esimerkin", () => {
    expect(parseIban("FI2112345600000785")).toBe("FI2112345600000785");
    expect(parseIban("FI21 1234 5600 0007 85")).toBe("FI2112345600000785");
  });

  it("hyväksyy muun maan IBANin", () => {
    /* GB82WEST12345698765432 on standardin brittiesimerkki. */
    expect(parseIban("GB82 WEST 1234 5698 7654 32")).toBe(
      "GB82WEST12345698765432",
    );
  });

  it("hylkää yhden muutetun numeron", () => {
    expect(parseIban("FI2112345600000786")).toBeNull();
  });

  it("hylkää roskan", () => {
    expect(parseIban("FI21")).toBeNull();
    expect(parseIban("1234567890")).toBeNull();
    expect(parseIban(null)).toBeNull();
  });
});

describe("muotoilu", () => {
  it("ryhmittelee viitteen viideksi oikealta", () => {
    expect(formatReference("1234561")).toBe("12 34561");
    expect(formatReference("12344")).toBe("12344");
  });

  it("ryhmittelee RF-viitteen neljän välein", () => {
    expect(formatReference("RF18539007547034")).toBe("RF18 5390 0754 7034");
  });

  it("ryhmittelee IBANin neljän välein", () => {
    expect(formatIban("FI2112345600000785")).toBe("FI21 1234 5600 0007 85");
  });
});

// ---------------------------------------------------------------------------
// Laskusta tehtäväksi
// ---------------------------------------------------------------------------

const TANAAN = "2026-09-01";

function poiminta(osat: Partial<InvoiceExtraction> = {}): InvoiceExtraction {
  const varma = <T>(value: T | null) => ({ value, confidence: "high" as const });

  return {
    isInvoice: true,
    supplier: varma("Heinon Tukku Oy"),
    dueDate: varma("2026-09-15"),
    invoiceDate: varma("2026-09-01"),
    totalCents: varma(124050),
    reference: varma("12344"),
    iban: varma("FI2112345600000785"),
    invoiceNumber: varma("A-1029"),
    imageQuality: "good",
    ...osat,
  };
}

describe("invoiceToTask", () => {
  it("kokoaa otsikkoon saajan ja summan", () => {
    const draft = invoiceToTask(poiminta(), TANAAN);

    /*
     * Osiin eikä välimerkkeihin.
     *
     * Intl erottaa tuhannet sitovalla välilyönnillä, ja merkki riippuu
     * ajoympäristön ICU-versiosta. Testi joka kiinnittää sen kaatuu
     * jonain päivänä ilman että mikään meni rikki.
     */
    expect(draft.title.startsWith("Heinon Tukku Oy")).toBe(true);
    expect(draft.title).toMatch(/1.240,50/);
    expect(draft.title).toContain("€");
  });

  it("ei jätä välilyöntiä kun saaja puuttuu", () => {
    const draft = invoiceToTask(
      poiminta({ supplier: { value: null, confidence: "low" } }),
      TANAAN,
    );
    expect(draft.title.startsWith(" ")).toBe(false);
    expect(draft.title).toMatch(/^1/);
  });

  it("ottaa eräpäivän tehtävän eräpäiväksi", () => {
    expect(invoiceToTask(poiminta(), TANAAN).dueOn).toBe("2026-09-15");
  });

  it("kirjoittaa viitteen ja IBANin kuvaukseen ryhmiteltynä", () => {
    const draft = invoiceToTask(poiminta(), TANAAN);
    expect(draft.description).toContain("Viite 12344");
    expect(draft.description).toContain("IBAN FI21 1234 5600 0007 85");
    expect(draft.description).toContain("Laskun numero A-1029");
  });

  it("ei merkitse mitään tarkistettavaksi kun kaikki luettiin varmasti", () => {
    expect(invoiceToTask(poiminta(), TANAAN).uncertain).toEqual([]);
  });

  /*
   * Väärä viite on pahempi kuin puuttuva: maksu ei kohdistu, ja lasku
   * jää auki vaikka raha lähti. Siksi tarkisteen pudottama viite ei
   * päädy kuvaukseen vaan tarkistettavien listalle.
   */
  it("jättää tarkisteen hylkäämän viitteen pois ja merkitsee sen", () => {
    const draft = invoiceToTask(
      poiminta({ reference: { value: "12345", confidence: "high" } }),
      TANAAN,
    );

    expect(draft.description).not.toContain("Viite");
    expect(draft.uncertain).toContain("reference");
  });

  it("jättää tarkisteen hylkäämän IBANin pois ja merkitsee sen", () => {
    const draft = invoiceToTask(
      poiminta({ iban: { value: "FI2112345600000786", confidence: "high" } }),
      TANAAN,
    );

    expect(draft.description).not.toContain("IBAN");
    expect(draft.uncertain).toContain("iban");
  });

  it("hylkää mahdottoman eräpäivän", () => {
    const draft = invoiceToTask(
      poiminta({ dueDate: { value: "1925-03-04", confidence: "high" } }),
      TANAAN,
    );

    expect(draft.dueOn).toBeNull();
    expect(draft.uncertain).toContain("dueDate");
  });

  it("hyväksyy myöhässä olevan laskun", () => {
    /* Kuukausi myöhässä on tavallinen syy tehdä tehtävä. */
    const draft = invoiceToTask(
      poiminta({ dueDate: { value: "2026-08-01", confidence: "high" } }),
      TANAAN,
    );

    expect(draft.dueOn).toBe("2026-08-01");
    expect(draft.uncertain).not.toContain("dueDate");
  });

  it("merkitsee epävarmasti luetun kentän tarkistettavaksi", () => {
    const draft = invoiceToTask(
      poiminta({ totalCents: { value: 124050, confidence: "low" } }),
      TANAAN,
    );

    expect(draft.uncertain).toContain("totalCents");
    /* Arvo näytetään silti: käyttäjä korjaa sen, ei arvaa sitä. */
    expect(draft.title).toContain("1");
  });

  it("tulee toimeen puuttuvilla kentillä", () => {
    const tyhja = { value: null, confidence: "low" as const };
    const draft = invoiceToTask(
      poiminta({
        supplier: tyhja,
        totalCents: tyhja,
        reference: tyhja,
        iban: tyhja,
        invoiceNumber: tyhja,
        dueDate: tyhja,
      }),
      TANAAN,
    );

    expect(draft.title).toBe("");
    expect(draft.dueOn).toBeNull();
    expect(draft.description).toBe("");
    /* Puuttuva ei ole epävarma: sitä ei luettu väärin, sitä ei ollut. */
    expect(draft.uncertain).toEqual([]);
  });
});

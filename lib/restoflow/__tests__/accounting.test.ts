import { describe, expect, it } from "vitest";
import {
  blockingIssues,
  canClose,
  entryTotal,
  isBalanced,
  monthLabel,
  monthStart,
  monthTone,
  sortIssues,
  sourceState,
  type LedgerEntry,
  type MonthIssue,
  type MonthState,
} from "../accounting";

/**
 * Kirjanpidon johdettu tila.
 *
 * Summia ei lasketa täällä eikä siis testata täällä: tasapaino,
 * täsmäytys ja raporttien luvut syntyvät Postgresissa ja ne on
 * todennettu peruutettavilla transaktioilla. Nämä testit koskevat
 * tulkintaa — mikä on estävä ongelma, missä järjestyksessä asiat
 * luetaan ja mitä yhden kuitin tila kertoo.
 */

function entry(lines: [number, number][]): LedgerEntry {
  return {
    id: "e1",
    entryNumber: 1,
    entryDate: "2026-08-26",
    description: "K-Market",
    sourceType: "receipt",
    sourceId: "r1",
    status: "proposed",
    correctsId: null,
    totalCents: 0,
    lines: lines.map(([debit, credit], i) => ({
      accountNumber: `40${i}0`,
      accountName: "Tili",
      debitCents: debit,
      creditCents: credit,
      vatRate: null,
      vatCents: null,
      description: null,
    })),
  };
}

function state(over: Partial<MonthState> = {}): MonthState {
  return {
    month: "2026-08",
    status: "open",
    proposed: 0,
    posted: 0,
    rejected: 0,
    receiptsMissing: 0,
    salesDaysMissing: 0,
    vat: {
      month: "2026-08",
      byRate: [],
      salesVatSource: 0,
      salesVatLedger: 0,
      purchaseVatSource: 0,
      purchaseVatLedger: 0,
      payableCents: 0,
      salesGrossSource: 0,
      salesGrossLedger: 0,
    },
    issues: [],
    ...over,
  };
}

const kriittinen: MonthIssue = {
  kind: "vat_mismatch",
  severity: "critical",
  count: 1,
  title: "ALV ei täsmää",
  detail: "Erotus 300 €",
  differenceCents: 30000,
};

const varoitus: MonthIssue = {
  kind: "receipts_missing",
  severity: "warning",
  count: 3,
  title: "Kuitteja ei ole kirjattu",
  detail: "3 kuittia",
};

const tiedote: MonthIssue = {
  kind: "proposals",
  severity: "info",
  count: 12,
  title: "Kirjausesityksiä odottaa",
  detail: "12 esitystä",
};

describe("tositteen tasapaino", () => {
  it("tunnistaa tasapainoisen tositteen", () => {
    expect(isBalanced(entry([[10925, 0], [1475, 0], [0, 12400]]))).toBe(true);
  });

  it("tunnistaa epätasapainon", () => {
    expect(isBalanced(entry([[10000, 0], [0, 9000]]))).toBe(false);
  });

  it("laskee loppusumman debet-puolelta", () => {
    expect(entryTotal(entry([[10925, 0], [1475, 0], [0, 12400]]))).toBe(12400);
  });
});

describe("kuukauden sulkeminen", () => {
  it("estyy kun täsmäytys ei mene läpi", () => {
    expect(canClose(state({ issues: [kriittinen] }))).toBe(false);
  });

  it("estyy kun esityksiä on hyväksymättä", () => {
    expect(canClose(state({ proposed: 4 }))).toBe(false);
  });

  it("estyy kun kuukausi on jo lukittu", () => {
    expect(canClose(state({ status: "locked" }))).toBe(false);
  });

  it("onnistuu kun mikään ei estä", () => {
    expect(canClose(state({ status: "ready", posted: 12 }))).toBe(true);
  });

  it("varoitus yksin ei estä sulkemista", () => {
    // Puuttuva kuitti on huomio, ei virhe: kuukausi voi olla oikein
    // vaikka kaikkea ei ole kirjattu.
    expect(canClose(state({ status: "ready", issues: [varoitus] }))).toBe(true);
  });

  it("erottaa estävät ongelmat muista", () => {
    const s = state({ issues: [varoitus, kriittinen, tiedote] });
    expect(blockingIssues(s)).toEqual([kriittinen]);
  });
});

describe("ongelmien järjestys", () => {
  it("nostaa kriittisen ylimmäksi määrästä riippumatta", () => {
    const sorted = sortIssues([tiedote, varoitus, kriittinen]);
    expect(sorted[0]).toBe(kriittinen);
  });

  it("järjestää saman vakavuuden määrän mukaan", () => {
    const iso: MonthIssue = { ...varoitus, count: 9 };
    const pieni: MonthIssue = { ...varoitus, kind: "muu", count: 2 };
    const sorted = sortIssues([pieni, iso]);
    expect(sorted[0]).toBe(iso);
  });

  it("ei muuta alkuperäistä listaa", () => {
    const lista = [tiedote, kriittinen];
    sortIssues(lista);
    expect(lista[0]).toBe(tiedote);
  });
});

describe("lähdetapahtuman tila", () => {
  const entries = [
    { sourceType: "receipt" as const, sourceId: "a", status: "posted" as const },
    { sourceType: "receipt" as const, sourceId: "b", status: "proposed" as const },
    { sourceType: "daily_sales" as const, sourceId: "a", status: "rejected" as const },
  ];

  it("kertoo kirjatun kuitin", () => {
    expect(sourceState(entries, "receipt", "a")).toBe("posted");
  });

  it("kertoo esityksen", () => {
    expect(sourceState(entries, "receipt", "b")).toBe("proposed");
  });

  it("ei sekoita eri lähdetyyppejä samalla tunnisteella", () => {
    // Kuitilla ja myyntipäivällä voi olla sama tunniste eri tauluissa.
    expect(sourceState(entries, "daily_sales", "a")).toBe("rejected");
  });

  it("tuntematon lähde on käsittelemätön eikä virhe", () => {
    expect(sourceState(entries, "receipt", "tuntematon")).toBe("unprocessed");
  });
});

describe("kuukauden esitys", () => {
  it("muodostaa kannan odottaman päivämäärän", () => {
    expect(monthStart("2026-08")).toBe("2026-08-01");
  });

  it("nimeää kuukauden suomeksi", () => {
    expect(monthLabel("2026-08")).toBe("Elokuu 2026");
    expect(monthLabel("2026-01")).toBe("Tammikuu 2026");
    expect(monthLabel("2026-12")).toBe("Joulukuu 2026");
  });

  it("palauttaa syötteen sellaisenaan jos se ei ole kuukausi", () => {
    expect(monthLabel("roska")).toBe("roska");
    expect(monthLabel("2026-13")).toBe("2026-13");
  });

  it("avoin kuukausi on neutraali eikä huomautus", () => {
    expect(monthTone("open")).toBe("neutral");
    expect(monthTone("review")).toBe("warn");
    expect(monthTone("ready")).toBe("good");
    expect(monthTone("locked")).toBe("muted");
  });
});

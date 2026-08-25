import { describe, expect, it } from "vitest";
import { formatMoney, formatRate } from "@/lib/money";
import {
  lineFromGross,
  lineFromNet,
  reconcile,
  summarise,
  toleranceFor,
  type SalesLine,
} from "../sales-vat";

function line(
  vatRate: number,
  grossCents: number,
  posVatCents: number | null = null,
  salesGroupId = `g-${vatRate}`,
): SalesLine {
  const { vatCents, netCents } = lineFromGross(grossCents, vatRate);
  return { salesGroupId, vatRate, grossCents, vatCents, netCents, posName: null, posVatCents };
}

describe("lineFromGross", () => {
  /* Tehtävänannon esimerkki: 1 135 € bruttona 13,5 %:lla on 1 000 € netto. */
  it("laskee tehtävänannon esimerkin", () => {
    const r = lineFromGross(113500, 0.135);
    expect(r.vatCents).toBe(13500);
    expect(r.netCents).toBe(100000);
  });

  it("laskee Suomen ravintolakannan 14 %", () => {
    const r = lineFromGross(114000, 0.14);
    expect(r.vatCents).toBe(14000);
    expect(r.netCents).toBe(100000);
  });

  it("laskee alkoholikannan 25,5 %", () => {
    const r = lineFromGross(125500, 0.255);
    expect(r.vatCents).toBe(25500);
    expect(r.netCents).toBe(100000);
  });

  it("kestää nollakannan", () => {
    const r = lineFromGross(50000, 0);
    expect(r.vatCents).toBe(0);
    expect(r.netCents).toBe(50000);
  });

  /*
   * BRUTTO = VERO + VEROTON, AINA.
   *
   * Veroton lasketaan erotuksena eikä omalla pyöristyksellään. Jos
   * molemmat pyöristettäisiin erikseen, summa voisi olla sentin
   * sivussa — ja kannan check-ehto kannassa hylkäisi rivin.
   */
  it("pitää summan tasan jokaisella sentillä", () => {
    for (const rate of [0, 0.1, 0.135, 0.14, 0.255]) {
      for (let gross = 1; gross <= 400; gross += 1) {
        const r = lineFromGross(gross, rate);
        expect(r.vatCents + r.netCents).toBe(gross);
      }
    }
  });

  it("ei tuota negatiivista veroa", () => {
    for (let gross = 0; gross <= 200; gross += 1) {
      expect(lineFromGross(gross, 0.255).vatCents).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("lineFromNet", () => {
  it("on brutosta laskemisen käänteinen tasaluvuilla", () => {
    const net = lineFromNet(100000, 0.14);
    expect(net.grossCents).toBe(114000);
    expect(lineFromGross(net.grossCents, 0.14).netCents).toBe(100000);
  });

  it("pitää summan tasan", () => {
    for (let net = 1; net <= 300; net += 1) {
      const r = lineFromNet(net, 0.255);
      expect(r.vatCents + r.netCents).toBe(r.grossCents);
    }
  });
});

describe("summarise", () => {
  it("laskee yhteen kannoittain eikä ryhmittäin", () => {
    /* Kaksi eri ryhmää samalla kannalla on verotuksessa sama asia. */
    const s = summarise([
      line(0.14, 100000, null, "ruoka"),
      line(0.14, 50000, null, "take-away"),
      line(0.255, 60000, null, "alkoholi"),
    ]);

    expect(s.byRate).toHaveLength(2);
    expect(s.byRate[0].vatRate).toBe(0.255);
    expect(s.byRate[1].grossCents).toBe(150000);
  });

  it("järjestää suurin kanta ensin", () => {
    const s = summarise([line(0.14, 1000), line(0.255, 1000), line(0, 1000)]);
    expect(s.byRate.map((r) => r.vatRate)).toEqual([0.255, 0.14, 0]);
  });

  it("summaa kokonaisluvut riveistä", () => {
    const s = summarise([line(0.14, 114000), line(0.255, 125500)]);
    expect(s.grossCents).toBe(239500);
    expect(s.vatCents).toBe(39500);
    expect(s.netCents).toBe(200000);
  });

  /*
   * Vajaa kassaluku ei kelpaa vertailuun.
   *
   * Jos kannan kahdesta rivistä vain toisella on kassan ilmoittama
   * ALV, summa olisi vajaa — ja vajaa summa näyttäisi täsmäytyksessä
   * erolta joka ei ole ero.
   */
  it("hylkää kassaluvun jos se puuttuu osalta saman kannan riveistä", () => {
    const s = summarise([line(0.14, 100000, 12281), line(0.14, 50000, null)]);
    expect(s.byRate[0].posVatCents).toBeNull();
  });

  it("summaa kassaluvun kun se on kaikilla", () => {
    const s = summarise([line(0.14, 100000, 12281), line(0.14, 50000, 6140)]);
    expect(s.byRate[0].posVatCents).toBe(18421);
  });

  it("kestää tyhjän päivän", () => {
    const s = summarise([]);
    expect(s.grossCents).toBe(0);
    expect(s.byRate).toEqual([]);
  });
});

describe("reconcile", () => {
  it("täsmää kun luvut ovat samat", () => {
    const lines = [line(0.14, 300000, 36842), line(0.255, 100000, 20319)];
    const s = summarise(lines);

    const r = reconcile({
      posGrossCents: 400000,
      posVatCents: s.vatCents,
      lines,
    });

    expect(r.status).toBe("match");
    expect(r.explanation).toBeNull();
    expect(r.byRate).toHaveLength(2);
  });

  /* Kassa pyöristää ryhmittäin, Budet kannoittain. Sentti ei ole virhe. */
  it("sietää sentin pyöristyseron", () => {
    const lines = [line(0.14, 300000), line(0.255, 100000)];
    const s = summarise(lines);

    const r = reconcile({
      posGrossCents: s.grossCents + 1,
      posVatCents: s.vatCents - 1,
      lines,
    });

    expect(r.status).toBe("match");
  });

  it("löytää eron loppusummasta", () => {
    const lines = [line(0.14, 479150)];
    const r = reconcile({ posGrossCents: 482150, posVatCents: null, lines });

    expect(r.status).toBe("mismatch");
    expect(r.total.diffCents).toBe(3000);
  });

  /*
   * Tehtävänannon vaatimus: älä vain näytä punaista numeroa, vaan kerro
   * mistä ero syntyy.
   */
  it("kertoo väärästä verokannasta kun myynti täsmää muttei ALV", () => {
    const lines = [line(0.255, 400000, 36842)];
    const s = summarise(lines);

    const r = reconcile({
      posGrossCents: s.grossCents,
      posVatCents: 36842,
      lines,
    });

    expect(r.status).toBe("mismatch");
    expect(r.explanation).toContain("verokantaan");
    /* formatRate käyttää sitkeää välilyöntiä, joten literaali ei kelpaa. */
    expect(r.explanation).toContain(formatRate(0.255));
  });

  it("kertoo puuttuvasta ryhmästä kun ALV täsmää muttei myynti", () => {
    const lines = [line(0.14, 300000)];
    const s = summarise(lines);

    const r = reconcile({
      posGrossCents: 400000,
      posVatCents: s.vatCents,
      lines,
    });

    expect(r.explanation).toContain("puuttuu riveiltä");
    expect(r.explanation).toContain(formatMoney(100000));
  });

  /*
   * Ei kassalukua, ei täsmäytystä.
   *
   * "Täsmää" ilman vertailukohtaa olisi valhe: se tarkoittaisi vain
   * ettei mitään ole verrattu.
   */
  it("on tuntematon kun kassan lukuja ei ole", () => {
    const r = reconcile({
      posGrossCents: null,
      posVatCents: null,
      lines: [line(0.14, 300000)],
    });

    expect(r.status).toBe("unknown");
    expect(r.total.status).toBe("unknown");
    expect(r.explanation).toBeNull();
  });

  it("vertaa kannoittain", () => {
    const lines = [line(0.14, 300000, 36842), line(0.255, 100000, 25000)];
    const r = reconcile({ posGrossCents: 400000, posVatCents: 61842, lines });

    const alkoholi = r.byRate.find((c) => c.label === formatRate(0.255));
    expect(alkoholi?.status).toBe("mismatch");
    expect(alkoholi?.posCents).toBe(25000);
  });
});

describe("toleranceFor", () => {
  it("kasvaa kantojen mukana", () => {
    expect(toleranceFor(1)).toBe(2);
    expect(toleranceFor(3)).toBe(4);
  });
});

describe("historiallinen verokanta", () => {
  /*
   * TEHTÄVÄNANNON §7.
   *
   * Rivi kantaa oman kantansa. Ryhmän asetuksen muuttaminen ei kosketa
   * kirjattua riviä, koska laskenta lukee rivin kannan eikä ryhmän.
   */
  it("säilyy vaikka ryhmän kanta muuttuisi", () => {
    const vanha = line(0.1, 110000);
    const uusi = line(0.14, 114000);

    // Ryhmän asetus on nyt 14 %, mutta vanha rivi on 10 %.
    const s = summarise([vanha, uusi]);

    expect(s.byRate.map((r) => r.vatRate)).toEqual([0.14, 0.1]);
    expect(s.byRate[1].vatCents).toBe(10000);
    expect(s.byRate[0].vatCents).toBe(14000);
  });
});

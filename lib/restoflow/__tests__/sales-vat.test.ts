import { describe, expect, it } from "vitest";
import { formatMoney, formatRate } from "@/lib/money";
import {
  lineFromGross,
  lineFromNet,
  mapReportGroups,
  parseRate,
  reconcile,
  summarise,
  toleranceFor,
  type PosMapping,
  type SalesGroup,
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
  /* Ravintolamyynnin kanta: 1 135 € bruttona 13,5 %:lla on 1 000 € netto. */
  it("laskee ravintolamyynnin kannan 13,5 %", () => {
    const r = lineFromGross(113500, 0.135);
    expect(r.vatCents).toBe(13500);
    expect(r.netCents).toBe(100000);
  });

  /*
   * Vanha kanta laskee yhä oikein.
   *
   * Ravintolaruoan kanta on laskenut 14 %:sta 13,5 %:iin, mutta ennen
   * muutosta kirjatut päivät kantavat vanhaa kantaa eivätkä muutu.
   * Laskennan on toimittava molemmilla.
   */
  it("laskee myös aiemman 14 %:n kannan", () => {
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

describe("parseRate", () => {
  it("lukee kokonaisen ja desimaalisen prosentin", () => {
    expect(parseRate("14")).toBe(0.14);
    expect(parseRate("25,5")).toBe(0.255);
    expect(parseRate("25.5")).toBe(0.255);
  });

  it("sietää prosenttimerkin ja välilyönnit", () => {
    expect(parseRate(" 13,5 % ")).toBe(0.135);
    expect(parseRate("25,5\u00a0%")).toBe(0.255);
  });

  it("hyväksyy nollakannan", () => {
    expect(parseRate("0")).toBe(0);
  });

  /*
   * 25.5/100 on liukulukuna 0.255000000000000004. Ilman pyöristystä se
   * häntä päätyisi kantaan ja jokainen siihen perustuva vero olisi
   * hiuksenhieno virhe joka kertaantuu.
   */
  it("ei päästä liukuluvun häntää läpi", () => {
    expect(parseRate("25,5")!.toString()).toBe("0.255");
    expect(parseRate("13,5")!.toString()).toBe("0.135");
  });

  it("hylkää mahdottoman kannan", () => {
    expect(parseRate("101")).toBeNull();
    expect(parseRate("-5")).toBeNull();
    expect(parseRate("abc")).toBeNull();
    expect(parseRate("")).toBeNull();
    expect(parseRate(null)).toBeNull();
  });
});

describe("mapReportGroups", () => {
  const ravintola: SalesGroup = {
    id: "g-ravintola",
    name: "Ravintolamyynti",
    vatRate: 0.14,
    active: true,
    isDefault: true,
    sortOrder: 0,
  };

  const alkoholi: SalesGroup = {
    id: "g-alkoholi",
    name: "Alkoholimyynti",
    vatRate: 0.255,
    active: true,
    isDefault: false,
    sortOrder: 1,
  };

  const groups = [ravintola, alkoholi];

  const mappings: PosMapping[] = [
    { id: "m1", posName: "Ruoka", salesGroupId: ravintola.id },
    { id: "m2", posName: "Take away", salesGroupId: ravintola.id },
    { id: "m3", posName: "Viini", salesGroupId: alkoholi.id },
    { id: "m4", posName: "Olut", salesGroupId: alkoholi.id },
  ];

  it("kohdistaa tehtävänannon esimerkin", () => {
    const r = mapReportGroups(
      [
        { posName: "Ruoka", grossCents: 200000, vatCents: null },
        { posName: "Viini", grossCents: 60000, vatCents: null },
        { posName: "Olut", grossCents: 40000, vatCents: null },
        { posName: "Take away", grossCents: 50000, vatCents: null },
      ],
      mappings,
      groups,
    );

    expect(r.unmapped).toEqual([]);
    expect(r.dropped).toEqual([]);
    expect(r.lines).toHaveLength(2);
  });

  /*
   * Kaksi kassaryhmää, yksi myyntiryhmä.
   *
   * Viini ja olut ovat molemmat alkoholimyyntiä. Päivällä voi olla vain
   * yksi rivi per myyntiryhmä — kaksi olisi kaksi totuutta samasta
   * luvusta, ja kannan yksikäsitteisyysehto hylkäisi jälkimmäisen.
   */
  it("yhdistää saman myyntiryhmän kassaryhmät", () => {
    const r = mapReportGroups(
      [
        { posName: "Viini", grossCents: 60000, vatCents: null },
        { posName: "Olut", grossCents: 40000, vatCents: null },
      ],
      mappings,
      groups,
    );

    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].grossCents).toBe(100000);
    expect(r.lines[0].posName).toBe("Viini, Olut");
  });

  it("laskee veron ryhmän kannalla", () => {
    const r = mapReportGroups(
      [{ posName: "Ruoka", grossCents: 114000, vatCents: null }],
      mappings,
      groups,
    );

    expect(r.lines[0].vatRate).toBe(0.14);
    expect(r.lines[0].vatCents).toBe(14000);
    expect(r.lines[0].netCents).toBe(100000);
  });

  it("löytää kohdistuksen kirjainkoosta riippumatta", () => {
    const r = mapReportGroups(
      [{ posName: "  RUOKA ", grossCents: 100000, vatCents: null }],
      mappings,
      groups,
    );

    expect(r.unmapped).toEqual([]);
    expect(r.lines[0].salesGroupId).toBe(ravintola.id);
  });

  /*
   * Kohdistamaton ryhmä ei katoa.
   *
   * Osittainen kirjaus on pahempi kuin kohdistamaton: silloin päivän
   * loppusumma ei enää täsmää raporttiin, eikä käyttäjä näe miksi.
   * Myynti menee oletusryhmään ja nimi kerrotaan.
   */
  it("ohjaa kohdistamattoman oletusryhmään ja kertoo siitä", () => {
    const r = mapReportGroups(
      [{ posName: "Lahjakortti", grossCents: 5000, vatCents: null }],
      mappings,
      groups,
    );

    expect(r.unmapped).toEqual(["Lahjakortti"]);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].salesGroupId).toBe(ravintola.id);
    expect(r.dropped).toEqual([]);
  });

  it("pudottaa ryhmän vain jos oletusta ei ole", () => {
    const ilmanOletusta = [{ ...ravintola, isDefault: false }, alkoholi];

    const r = mapReportGroups(
      [{ posName: "Lahjakortti", grossCents: 5000, vatCents: null }],
      mappings,
      ilmanOletusta,
    );

    expect(r.dropped).toEqual(["Lahjakortti"]);
    expect(r.lines).toEqual([]);
  });

  it("ei käytä oletuksena ryhmää joka ei ole käytössä", () => {
    const poissa = [{ ...ravintola, active: false }, alkoholi];

    const r = mapReportGroups(
      [{ posName: "Tuntematon", grossCents: 5000, vatCents: null }],
      [],
      poissa,
    );

    expect(r.dropped).toEqual(["Tuntematon"]);
  });

  it("summaa kassan ALV:n kun se on kaikilla yhdistyvillä", () => {
    const r = mapReportGroups(
      [
        { posName: "Viini", grossCents: 60000, vatCents: 12191 },
        { posName: "Olut", grossCents: 40000, vatCents: 8127 },
      ],
      mappings,
      groups,
    );

    expect(r.lines[0].posVatCents).toBe(20318);
  });

  it("hylkää kassan ALV:n jos se puuttuu yhdeltä yhdistyvältä", () => {
    const r = mapReportGroups(
      [
        { posName: "Viini", grossCents: 60000, vatCents: 12191 },
        { posName: "Olut", grossCents: 40000, vatCents: null },
      ],
      mappings,
      groups,
    );

    expect(r.lines[0].posVatCents).toBeNull();
  });

  /*
   * KOKO KETJU: raportti → rivit → täsmäytys.
   *
   * Tämä on se mitä ominaisuus lupaa. Jos tämä menee läpi, kassan
   * päiväraportti täsmää Budetin laskelmaan.
   */
  it("tuottaa täsmäävän tuloksen kokonaisesta raportista", () => {
    const raportti = [
      { posName: "Ruoka", grossCents: 200000, vatCents: 24561 },
      { posName: "Take away", grossCents: 50000, vatCents: 6140 },
      { posName: "Viini", grossCents: 60000, vatCents: 12191 },
      { posName: "Olut", grossCents: 40000, vatCents: 8127 },
    ];

    const kassaBrutto = raportti.reduce((s, g) => s + g.grossCents, 0);
    const kassaAlv = raportti.reduce((s, g) => s + (g.vatCents ?? 0), 0);

    const { lines } = mapReportGroups(raportti, mappings, groups);

    const r = reconcile({
      posGrossCents: kassaBrutto,
      posVatCents: kassaAlv,
      lines,
    });

    expect(r.status).toBe("match");
    expect(r.byRate).toHaveLength(2);
    expect(r.total.budetCents).toBe(350000);
  });
});

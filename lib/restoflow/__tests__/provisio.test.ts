import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAYROLL,
  commissionExtraCents,
  withCommission,
  type PayrollSettings,
} from "../payroll";
import { staffCost } from "../staff-cost";
import type { Employee, TimeEntry } from "../employees";

/*
 * Provisiopalkka.
 *
 * MITÄ TÄSSÄ VARMISTETAAN.
 *
 * 1. Tuntipalkkaisen luku ei muutu, vaikka kentät ovat olemassa.
 * 2. Provisio on palkkaa: siitä kertyy lomakustannus ja sivukulut.
 * 3. Takuumallissa maksetaan suurempi, ei molempia.
 * 4. Kuukauden provisio lasketaan kerran, ei vuoroittain.
 *
 * Luvut on laskettu käsin kommenteissa. Jos jokin niistä muuttuu,
 * muutos näkyy tässä eikä vasta asiakkaan palkkalaskelmassa.
 */

const ASETUKSET: PayrollSettings = {
  ...DEFAULT_PAYROLL,
  holidayRate: 0.125,
  sideCostRate: 0.24,
};

const AIKA = "Europe/Helsinki";

function tyontekija(extra: Partial<Employee> = {}): Employee {
  return {
    id: "a",
    firstName: "Emma",
    lastName: "Virtanen",
    email: null,
    jobTitle: "Parturi-kampaaja",
    hourlyCents: 1450,
    payModel: "hourly",
    commissionRate: 0,
    active: true,
    linked: false,
    ...extra,
  };
}

/** Kymmenen kahdeksan tunnin päivää = 80 h, kaikki arkena ja päivällä. */
function vuorot(): TimeEntry[] {
  const paivat = [
    "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04",
    "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10",
    "2026-09-11", "2026-09-14",
  ];

  return paivat.map((date) => ({
    id: date,
    employeeId: "a",
    date,
    clockIn: `${date}T06:00:00.000Z`,
    clockOut: `${date}T14:00:00.000Z`,
    minutes: 480,
  }));
}

/* 80 h × 14,50 € = 1 160,00 € */
const PERUSPALKKA = 116000;

describe("commissionExtraCents", () => {
  it("ei maksa provisiota tuntipalkkaiselle", () => {
    expect(commissionExtraCents("hourly", 0.4, 800000, PERUSPALKKA)).toBe(0);
  });

  it("maksaa provision tuntipalkan päälle", () => {
    /* 40 % 8 000 euron myynnistä = 3 200,00 € */
    expect(
      commissionExtraCents("hourly_commission", 0.4, 800000, PERUSPALKKA),
    ).toBe(320000);
  });

  it("takuumallissa maksetaan vain erotus", () => {
    /* 3 200,00 € − 1 160,00 € = 2 040,00 € */
    expect(
      commissionExtraCents("commission_guaranteed", 0.4, 800000, PERUSPALKKA),
    ).toBe(204000);
  });

  it("pelkässä provisiossa maksetaan koko provisio", () => {
    /* Tunnit eivät vähennä mitään: niistä ei makseta erikseen. */
    expect(
      commissionExtraCents("commission_only", 0.4, 800000, PERUSPALKKA),
    ).toBe(320000);
  });

  it("takuumallissa pieni myynti ei tuo mitään", () => {
    /* 40 % 2 000 eurosta = 800 € < 1 160 € tuntipalkka */
    expect(
      commissionExtraCents("commission_guaranteed", 0.4, 200000, PERUSPALKKA),
    ).toBe(0);
  });

  it("pyöristää kerran, lopussa", () => {
    /* 33,33 % 1 000,01 eurosta = 33 330,33… senttiä → 33 330 */
    expect(commissionExtraCents("hourly_commission", 0.3333, 100001, 0)).toBe(
      33330,
    );
  });

  it("ei tee provisiota ilman myyntiä eikä ilman prosenttia", () => {
    expect(commissionExtraCents("hourly_commission", 0.4, 0, 1000)).toBe(0);
    expect(commissionExtraCents("hourly_commission", 0, 800000, 1000)).toBe(0);
  });
});

describe("withCommission", () => {
  it("kerryttää lomakustannuksen ja sivukulut provisiosta", () => {
    const tyhja = {
      minutes: 0,
      baseCents: 0,
      supplementCents: 0,
      commissionCents: 0,
      holidayCents: 0,
      sideCostCents: 0,
      totalCents: 0,
    };

    const tulos = withCommission(tyhja, 100000, ASETUKSET);

    /* Loma 12,5 % = 12 500, sivukulut 24 % × 112 500 = 27 000 */
    expect(tulos.commissionCents).toBe(100000);
    expect(tulos.holidayCents).toBe(12500);
    expect(tulos.sideCostCents).toBe(27000);
    expect(tulos.totalCents).toBe(139500);
  });

  it("ei muuta mitään kun provisiota ei ole", () => {
    const cost = {
      minutes: 60,
      baseCents: 1450,
      supplementCents: 0,
      commissionCents: 0,
      holidayCents: 181,
      sideCostCents: 392,
      totalCents: 2023,
    };

    expect(withCommission(cost, 0, ASETUKSET)).toEqual(cost);
  });
});

describe("staffCost provisiolla", () => {
  const entries = vuorot();

  it("tuntipalkkainen ei muutu vaikka myyntiä olisi kirjattu", () => {
    const ilman = staffCost(
      [tyontekija()], entries, "2026-09", AIKA, ASETUKSET, [],
    );
    const myynnilla = staffCost(
      [tyontekija()], entries, "2026-09", AIKA, ASETUKSET, [], { a: 800000 },
    );

    expect(myynnilla.total).toEqual(ilman.total);
    expect(ilman.total.baseCents).toBe(PERUSPALKKA);
    expect(ilman.total.commissionCents).toBe(0);
  });

  it("lisää provision tuntipalkan päälle", () => {
    const tulos = staffCost(
      [tyontekija({ payModel: "hourly_commission", commissionRate: 0.4 })],
      entries, "2026-09", AIKA, ASETUKSET, [], { a: 800000 },
    );

    /*
     * Palkka 1 160,00 + 3 200,00 = 4 360,00
     * Loma 12,5 %      =   545,00
     * Sivukulut 24 %   = 1 177,20
     * Yhteensä         = 6 082,20
     */
    expect(tulos.total.baseCents).toBe(116000);
    expect(tulos.total.commissionCents).toBe(320000);
    expect(tulos.total.holidayCents).toBe(54500);
    expect(tulos.total.sideCostCents).toBe(117720);
    expect(tulos.total.totalCents).toBe(608220);
  });

  it("takuumallissa kustannus on suurempi palkka sivukuluineen", () => {
    const tulos = staffCost(
      [tyontekija({ payModel: "commission_guaranteed", commissionRate: 0.4 })],
      entries, "2026-09", AIKA, ASETUKSET, [], { a: 800000 },
    );

    /*
     * Palkka on 3 200,00 (provisio voitti), ei 1 160 + 3 200.
     * Loma 400,00, sivukulut 864,00 → 4 464,00.
     */
    expect(tulos.total.baseCents + tulos.total.commissionCents).toBe(320000);
    expect(tulos.total.totalCents).toBe(446400);
  });

  it("takuumallissa hiljainen kuukausi maksaa tuntipalkan verran", () => {
    const hiljainen = staffCost(
      [tyontekija({ payModel: "commission_guaranteed", commissionRate: 0.4 })],
      entries, "2026-09", AIKA, ASETUKSET, [], { a: 200000 },
    );
    const tunneilla = staffCost(
      [tyontekija()], entries, "2026-09", AIKA, ASETUKSET, [],
    );

    expect(hiljainen.total.totalCents).toBe(tunneilla.total.totalCents);
  });

  it("pelkässä provisiossa tunneista ei kerry palkkaa", () => {
    const tulos = staffCost(
      [tyontekija({ payModel: "commission_only", commissionRate: 0.4 })],
      entries, "2026-09", AIKA, ASETUKSET, [], { a: 800000 },
    );

    /*
     * Tunnit näkyvät, palkka ei tule niistä.
     *
     * Palkka 3 200,00 + loma 400,00 + sivukulut 864,00 = 4 464,00,
     * eli sama kuin takuumallissa jossa provisio voitti — ero on
     * siinä, ettei peruspalkkaa ole lainkaan.
     */
    expect(tulos.minutes).toBe(4800);
    expect(tulos.total.baseCents).toBe(0);
    expect(tulos.total.supplementCents).toBe(0);
    expect(tulos.total.commissionCents).toBe(320000);
    expect(tulos.total.totalCents).toBe(446400);
  });

  it("pelkässä provisiossa tuntipalkka ei vuoda kustannukseen", () => {
    /* Vanha tuntipalkka on yhä rivillä, mutta sitä ei makseta. */
    const tulos = staffCost(
      [
        tyontekija({
          payModel: "commission_only",
          commissionRate: 0.4,
          hourlyCents: 9999,
        }),
      ],
      entries, "2026-09", AIKA, ASETUKSET, [], { a: 800000 },
    );

    expect(tulos.total.baseCents).toBe(0);
    expect(tulos.total.totalCents).toBe(446400);
  });

  it("laskee provision myös ilman yhtään tuntia", () => {
    const tulos = staffCost(
      [tyontekija({ payModel: "hourly_commission", commissionRate: 0.4 })],
      [], "2026-09", AIKA, ASETUKSET, [], { a: 800000 },
    );

    expect(tulos.minutes).toBe(0);
    expect(tulos.total.commissionCents).toBe(320000);
    expect(tulos.total.totalCents).toBe(446400);
  });
});

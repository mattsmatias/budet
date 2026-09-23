import { describe, expect, it } from "vitest";
import { staffCost, staffCostPerHour } from "../staff-cost";
import type { Employee, TimeEntry } from "../employees";
import { DEFAULT_PAYROLL, type PayrollSettings } from "../payroll";

/*
 * Kustannus ja tuntihinta samasta laskennasta.
 *
 * Bugi jota nama testit vartioivat: kortti naytti 7,63 e ja 19,90 e/h
 * samalla rivilla, eika 0,4 h x 19,90 e/h vastannut sita. Syita oli
 * kaksi — yleiskatsaus laski pelkan peruspalkan omalla kaavallaan, ja
 * tunnit naytettiin pyoristettyna. Naytetyn tuntihinnan kerrottuna
 * tunneilla on oltava naytetty kustannus.
 */

const AIKA = "Europe/Helsinki";

/** Tasan yhden lisan asetus: prosentti peruspalkasta. */
function asetukset(osuus: number): PayrollSettings {
  return { ...DEFAULT_PAYROLL, sideCostRate: osuus };
}

function tyontekija(hourlyCents: number): Employee {
  return {
    id: "a",
    firstName: "Testi",
    lastName: "Test",
    email: null,
    jobTitle: null,
    hourlyCents,
    active: true,
    linked: false,
  };
}

/** Vuoro keskella arkipaivaa, jotta ilta- ja yolisat eivat osu. */
function vuoro(minutes: number): TimeEntry {
  const alku = new Date("2026-09-02T09:00:00Z");
  const loppu = new Date(alku.getTime() + minutes * 60_000);

  return {
    id: "v1",
    employeeId: "a",
    date: "2026-09-02",
    clockIn: alku.toISOString(),
    clockOut: loppu.toISOString(),
    minutes,
  };
}

/** Kuukauden kustannus yhdelle vuorolle. */
function laske(hourlyCents: number, minutes: number, osuus: number) {
  const tulos = staffCost(
    [tyontekija(hourlyCents)],
    [vuoro(minutes)],
    "2026-09",
    AIKA,
    asetukset(osuus),
  );

  return {
    cents: tulos.total.totalCents,
    perHour: staffCostPerHour(tulos.total),
    minutes: tulos.minutes,
  };
}

describe("kustannus taysilla minuuteilla", () => {
  it("23 minuuttia 14,50 e/h palkalla ei pyoristy tunneiksi", () => {
    /* Sivukulut 37,24 % nostavat 14,50 e/h kustannukseksi 19,90 e/h. */
    const r = laske(1450, 23, 0.3724);

    expect(r.perHour).toBe(1990);
    expect(r.minutes).toBe(23);
    /* 23/60 h x 19,90 e/h = 7,63 e — sama luku molemmista suunnista. */
    expect(r.cents).toBe(763);
    expect(Math.round((r.minutes / 60) * r.perHour!)).toBe(r.cents);
  });

  it("tasan 0,4 tuntia maksaa 7,96 e", () => {
    /* 24 minuuttia on tasan 0,4 h: 0,4 x 19,90 e/h = 7,96 e. */
    const r = laske(1450, 24, 0.3724);

    expect(r.perHour).toBe(1990);
    expect(r.cents).toBe(796);
  });

  it("tunti 20 e/h palkalla ja 25 % sivukuluilla maksaa 25,00 e", () => {
    const r = laske(2000, 60, 0.25);

    expect(r.perHour).toBe(2500);
    expect(r.cents).toBe(2500);
  });

  it("kaksi tuntia maksaa tasan kaksinkertaisesti", () => {
    const r = laske(2000, 120, 0.25);

    expect(r.perHour).toBe(2500);
    expect(r.cents).toBe(5000);
  });

  it("puoli tuntia maksaa tasan puolet", () => {
    const r = laske(2000, 30, 0.25);

    expect(r.perHour).toBe(2500);
    expect(r.cents).toBe(1250);
  });

  it("tuntihinta kerrottuna tunneilla on kustannus kaikilla kestoilla", () => {
    for (const minuutit of [7, 23, 45, 83, 126, 407]) {
      const r = laske(1450, minuutit, 0.3724);
      const kertolasku = Math.round((r.minutes / 60) * r.perHour!);

      /* Sentin heitto on jakolaskun pyoristys, ei eri kaava. */
      expect(Math.abs(kertolasku - r.cents)).toBeLessThanOrEqual(1);
    }
  });
});

describe("yksi lahde kaikille nakymille", () => {
  const employees = [tyontekija(1450)];
  const entries = [vuoro(23)];

  it("antaa saman luvun jokaisella kutsulla", () => {
    const a = staffCost(employees, entries, "2026-09", AIKA, asetukset(0.3724));
    const b = staffCost(employees, entries, "2026-09", AIKA, asetukset(0.3724));

    expect(a.total.totalCents).toBe(b.total.totalCents);
    expect(a.rows[0].cost.totalCents).toBe(a.total.totalCents);
  });

  it("laskee lisat ja sivukulut mukaan eika pelkkaa peruspalkkaa", () => {
    const r = staffCost(employees, entries, "2026-09", AIKA, asetukset(0.3724));

    expect(r.total.baseCents).toBe(556);
    expect(r.total.totalCents).toBeGreaterThan(r.total.baseCents);
  });

  it("ilman palkka-asetuksia kustannus on nolla eika arvaus", () => {
    const r = staffCost(employees, entries, "2026-09", AIKA, null);

    expect(r.total.totalCents).toBe(0);
    expect(r.minutes).toBe(23);
  });
});

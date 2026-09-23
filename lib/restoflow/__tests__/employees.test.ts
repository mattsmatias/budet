import { describe, expect, it } from "vitest";
import {
  estimatedPayCents,
  formatHours,
  openEntry,
  parseHourly,
  summarise,
  totalMinutes,
  totals,
  type Employee,
  type TimeEntry,
} from "../employees";

function employee(id: string, extra: Partial<Employee> = {}): Employee {
  return {
    id,
    firstName: "Anna",
    lastName: "Virtanen",
    email: null,
    jobTitle: null,
    hourlyCents: 1450,
    active: true,
    linked: true,
    ...extra,
  };
}

function entry(
  employeeId: string,
  date: string,
  minutes: number | null,
): TimeEntry {
  return {
    id: `${employeeId}-${date}-${minutes}`,
    employeeId,
    date,
    clockIn: `${date}T08:00:00Z`,
    clockOut: minutes === null ? null : `${date}T16:00:00Z`,
    minutes,
  };
}

describe("arvioitu palkka", () => {
  // Esimerkki speksistä: 7,5 h × 14,50 € = 108,75 €.
  it("laskee tunnit kertaa tuntipalkan", () => {
    expect(estimatedPayCents(450, 1450)).toBe(10875);
  });

  it("pyöristää vasta lopussa", () => {
    // 100 minuuttia 14,50 €/h = 24,1666… € → 24,17 €.
    expect(estimatedPayCents(100, 1450)).toBe(2417);
  });

  it("on nolla ilman tunteja tai palkkaa", () => {
    expect(estimatedPayCents(0, 1450)).toBe(0);
    expect(estimatedPayCents(450, 0)).toBe(0);
    expect(estimatedPayCents(-10, 1450)).toBe(0);
  });
});

describe("tunnit", () => {
  /* Kesken oleva vuoro kasvaa joka sekunti eikä kuulu summaan. */
  it("jättää keskeneräisen vuoron laskematta", () => {
    expect(
      totalMinutes([
        entry("a", "2026-09-01", 450),
        entry("a", "2026-09-02", null),
      ]),
    ).toBe(450);
  });

  it("löytää käynnissä olevan vuoron", () => {
    const entries = [
      entry("a", "2026-09-01", 450),
      entry("a", "2026-09-02", null),
    ];
    expect(openEntry(entries)?.date).toBe("2026-09-02");
    expect(openEntry([entry("a", "2026-09-01", 450)])).toBeNull();
  });

  it("näyttää tunnit ja minuutit tarkasti", () => {
    expect(formatHours(450, "fi-FI")).toBe("7 h 30 min");
    expect(formatHours(2250, "fi-FI")).toBe("37 h 30 min");
    expect(formatHours(0, "fi-FI")).toBe("0 min");
  });

  it("ei pyöristä lyhyttä vuoroa tunneiksi", () => {
    /* 23 minuuttia näkyi ennen muodossa "0,4 h" eikä täsmännyt hintaan. */
    expect(formatHours(23, "fi-FI")).toBe("23 min");
    expect(formatHours(60, "fi-FI")).toBe("1 h");
  });
});

describe("yhteenveto", () => {
  const anna = employee("a", { firstName: "Anna", hourlyCents: 1450 });
  const bertta = employee("b", { firstName: "Bertta", hourlyCents: 1600 });

  const entries = [
    entry("a", "2026-09-01", 450),
    entry("a", "2026-09-02", 450),
    entry("b", "2026-09-01", 300),
    // Edellinen kuukausi ei kuulu tähän.
    entry("a", "2026-08-30", 600),
  ];

  it("laskee kuukauden tunnit työntekijöittäin", () => {
    const rows = summarise([anna, bertta], entries, "2026-09");
    expect(rows.map((r) => r.employee.id)).toEqual(["a", "b"]);
    expect(rows[0].minutes).toBe(900);
    expect(rows[0].payCents).toBe(21750);
    expect(rows[1].minutes).toBe(300);
  });

  it("nostaa vuorossa olevan ensimmäiseksi", () => {
    const rows = summarise(
      [anna, bertta],
      [...entries, entry("b", "2026-09-03", null)],
      "2026-09",
    );
    expect(rows[0].employee.id).toBe("b");
    expect(rows[0].working).toBe(true);
  });

  /* Tehty työ ei katoa siitä että joku merkitään ei-aktiiviseksi. */
  it("pitää passiivisen mukana jos tunteja on", () => {
    const vanha = employee("c", { firstName: "Cecilia", active: false });
    const rows = summarise(
      [anna, vanha],
      [...entries, entry("c", "2026-09-05", 120)],
      "2026-09",
    );
    expect(rows.map((r) => r.employee.id)).toContain("c");
  });

  it("jättää passiivisen pois ilman tunteja", () => {
    const vanha = employee("c", { active: false });
    const rows = summarise([anna, vanha], entries, "2026-09");
    expect(rows.map((r) => r.employee.id)).not.toContain("c");
  });

  it("laskee yhteissummat", () => {
    const rows = summarise(
      [anna, bertta],
      [...entries, entry("b", "2026-09-03", null)],
      "2026-09",
    );
    const summa = totals(rows);
    expect(summa.minutes).toBe(1200);
    expect(summa.payCents).toBe(21750 + 8000);
    expect(summa.working).toBe(1);
  });
});

describe("tuntipalkan luku", () => {
  it("hyväksyy pilkun ja pisteen", () => {
    expect(parseHourly("14,50")).toBe(1450);
    expect(parseHourly("14.50")).toBe(1450);
    expect(parseHourly("14")).toBe(1400);
    expect(parseHourly(" 12,3 ")).toBe(1230);
  });

  it("hylkää kelvottoman", () => {
    expect(parseHourly("")).toBeNull();
    expect(parseHourly("abc")).toBeNull();
    expect(parseHourly("-5")).toBeNull();
    expect(parseHourly("14,555")).toBeNull();
    // Tuhat euroa tunnissa on näppäilyvirhe, ei palkka.
    expect(parseHourly("2000")).toBeNull();
  });
});

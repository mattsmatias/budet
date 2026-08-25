import { describe, expect, it } from "vitest";
import {
  findDeviations,
  LATE_TOLERANCE_MINUTES,
  OVERRUN_TOLERANCE_MINUTES,
} from "../deviations";
import type { ShiftComparison } from "../shifts";
import type { Shift, User } from "../types";

const TZ = "Europe/Helsinki";

function user(id: string, name: string): User {
  return {
    id,
    restaurantId: "r",
    name,
    initials: name.slice(0, 2).toUpperCase(),
    role: "employee",
    position: "waiter",
    hourlyRateCents: 1500,
    active: true,
  };
}

const ali = user("u1", "Ali");

function shift(partial: Partial<Shift> = {}): Shift {
  return {
    id: "s1",
    restaurantId: "r",
    userId: "u1",
    date: "2026-09-01",
    startTime: "10:00",
    endTime: "18:00",
    location: "",
    status: "accepted",
    breakMinutes: 0,
    note: null,
    publishedAt: "2026-08-20T10:00:00.000Z",
    cancelledAt: null,
    ...partial,
  };
}

/** Paikallinen kellonaika 1.9.2026 UTC-aikaleimaksi (kesäaika, UTC+3). */
function at(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const utc = h - 3;
  const day = utc < 0 ? 31 : 1;
  const month = utc < 0 ? "08" : "09";
  const hour = ((utc % 24) + 24) % 24;
  return `2026-${month}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`;
}

function comparison(partial: Partial<ShiftComparison> = {}): ShiftComparison {
  const s = partial.shift ?? shift();

  return {
    shift: s,
    user: ali,
    plannedMs: 8 * 3600000,
    actualMs: 8 * 3600000,
    varianceMs: 0,
    actualStart: at("10:00"),
    actualEnd: at("18:00"),
    plannedCostCents: 12000,
    actualCostCents: 12000,
    ...partial,
  };
}

const base = {
  clockedDates: [] as { userId: string; date: string }[],
  shifts: [shift()],
  users: [ali],
  timezone: TZ,
};

describe("findDeviations", () => {
  it("ei löydä mitään kun kaikki meni suunnitellusti", () => {
    expect(findDeviations({ ...base, comparisons: [comparison()] })).toEqual([]);
  });

  it("löytää puuttuvan sisäänleimauksen", () => {
    const d = findDeviations({
      ...base,
      comparisons: [comparison({ actualStart: null, actualEnd: null, actualMs: 0 })],
    });

    expect(d).toHaveLength(1);
    expect(d[0].kind).toBe("no_clock_in");
    expect(d[0].severity).toBe("critical");
  });

  /*
   * Sietoraja on olemassa.
   *
   * Kaksi minuuttia myöhässä ei ole myöhästyminen vaan kello. Ilman
   * rajaa lista täyttyisi kohinasta, ja kohinan seasta ei löydä sitä
   * vuoroa joka jäi kokonaan tekemättä.
   */
  it("ei pidä muutaman minuutin myöhästymistä poikkeamana", () => {
    const d = findDeviations({
      ...base,
      comparisons: [comparison({ actualStart: at("10:04") })],
    });

    expect(d).toEqual([]);
  });

  it("löytää myöhästymisen sietorajan yli", () => {
    const d = findDeviations({
      ...base,
      comparisons: [comparison({ actualStart: at("10:14") })],
    });

    expect(d).toHaveLength(1);
    expect(d[0].kind).toBe("late");
    expect(d[0].minutes).toBe(14);
    expect(LATE_TOLERANCE_MINUTES).toBeLessThanOrEqual(14);
  });

  it("löytää suunnitellun ajan ylityksen", () => {
    const d = findDeviations({
      ...base,
      comparisons: [comparison({ varianceMs: 32 * 60000 })],
    });

    expect(d).toHaveLength(1);
    expect(d[0].kind).toBe("overrun");
    expect(d[0].minutes).toBe(32);
  });

  it("ei pidä pientä ylitystä poikkeamana", () => {
    const d = findDeviations({
      ...base,
      comparisons: [comparison({ varianceMs: (OVERRUN_TOLERANCE_MINUTES - 5) * 60000 })],
    });

    expect(d).toEqual([]);
  });

  it("ei valita alituksesta", () => {
    // Lyhyeksi jäänyt vuoro ei ole poikkeama tässä listassa: se näkyy
    // suunnitellun ja toteutuneen vertailussa eikä vaadi selvitystä.
    const d = findDeviations({
      ...base,
      comparisons: [comparison({ varianceMs: -60 * 60000 })],
    });

    expect(d).toEqual([]);
  });

  it("löytää työajan ilman vuoroa", () => {
    const d = findDeviations({
      ...base,
      comparisons: [],
      shifts: [],
      clockedDates: [{ userId: "u1", date: "2026-09-03" }],
    });

    expect(d).toHaveLength(1);
    expect(d[0].kind).toBe("shift_missing");
    expect(d[0].severity).toBe("critical");
  });

  it("ei valita työajasta jolle on vuoro", () => {
    const d = findDeviations({
      ...base,
      comparisons: [comparison()],
      clockedDates: [{ userId: "u1", date: "2026-09-01" }],
    });

    expect(d).toEqual([]);
  });

  /*
   * Peruttua vuoroa ei ollut tarkoitus tehdä.
   *
   * Varoitus siitä ettei kukaan leimannut peruttuun vuoroon lähettäisi
   * selvittämään asiaa joka on jo selvä.
   */
  it("ohittaa perutut vuorot", () => {
    const cancelled = shift({ cancelledAt: "2026-08-30T08:00:00.000Z" });

    const d = findDeviations({
      ...base,
      shifts: [cancelled],
      comparisons: [comparison({ shift: cancelled, actualStart: null, actualMs: 0 })],
    });

    expect(d).toEqual([]);
  });

  it("ohittaa luonnokset", () => {
    const draft = shift({ publishedAt: null });

    const d = findDeviations({
      ...base,
      shifts: [draft],
      comparisons: [comparison({ shift: draft, actualStart: null, actualMs: 0 })],
    });

    expect(d).toEqual([]);
  });

  it("järjestää vakavimmat ensin", () => {
    const d = findDeviations({
      ...base,
      comparisons: [
        comparison({ actualStart: at("10:20") }),
        comparison({
          shift: shift({ id: "s2", date: "2026-09-02" }),
          actualStart: null,
          actualMs: 0,
        }),
      ],
      shifts: [shift(), shift({ id: "s2", date: "2026-09-02" })],
    });

    expect(d[0].severity).toBe("critical");
    expect(d[1].severity).toBe("warning");
  });
});

import { describe, expect, it } from "vitest";
import { isoWeek, monthCalendar, shiftsOn } from "../calendar";
import type { Shift } from "../types";

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
    createdAt: "2026-08-20T10:00:00.000Z",
    cancelledAt: null,
    ...partial,
  };
}

describe("isoWeek", () => {
  it("laskee viikon vuoden keskellä", () => {
    // 1.9.2026 on tiistai, viikko 36.
    expect(isoWeek("2026-09-01")).toBe(36);
  });

  /*
   * Vuodenvaihde on ainoa kohta jossa viikkonumero voi mennä väärin.
   *
   * Viikko kuuluu sille vuodelle jossa sen torstai on. Ilman sitä
   * sääntöä sama viikko saisi numeron 1 tai 53 sen mukaan mistä
   * päivästä laskee.
   */
  it("laskee vuodenvaihteen viikon torstain mukaan", () => {
    // 1.1.2026 on torstai → viikko 1.
    expect(isoWeek("2026-01-01")).toBe(1);
    // 31.12.2025 on keskiviikko, samaa viikkoa → viikko 1.
    expect(isoWeek("2025-12-31")).toBe(1);
    // 29.12.2025 on maanantai, samaa viikkoa.
    expect(isoWeek("2025-12-29")).toBe(1);
  });

  it("laskee vuoden viimeisen viikon", () => {
    // 28.12.2026 on maanantai, viikko 53.
    expect(isoWeek("2026-12-28")).toBe(53);
  });
});

describe("monthCalendar", () => {
  const weeks = monthCalendar("2026-09", "2026-09-10");

  it("antaa täydet seitsemän päivän viikot", () => {
    expect(weeks.every((w) => w.days.length === 7)).toBe(true);
  });

  it("alkaa maanantaista", () => {
    expect(weeks[0].days[0].weekday).toBe(1);
    expect(weeks.every((w) => w.days[0].weekday === 1)).toBe(true);
  });

  /*
   * Täytepäivät kuuluvat edelliseen ja seuraavaan kuuhun.
   *
   * Ilman niitä vajaa ensimmäinen viikko siirtäisi viikonpäivät
   * väärään sarakkeeseen, ja koko ruudukko olisi väärin luettavissa.
   */
  it("täyttää reunat viereisten kuukausien päivillä", () => {
    // 1.9.2026 on tiistai, joten maanantai on 31.8.
    expect(weeks[0].days[0].date).toBe("2026-08-31");
    expect(weeks[0].days[0].inMonth).toBe(false);
    expect(weeks[0].days[1].date).toBe("2026-09-01");
    expect(weeks[0].days[1].inMonth).toBe(true);
  });

  it("sisältää kuukauden jokaisen päivän", () => {
    const omat = weeks.flatMap((w) => w.days).filter((d) => d.inMonth);

    expect(omat).toHaveLength(30);
    expect(omat[0].date).toBe("2026-09-01");
    expect(omat[29].date).toBe("2026-09-30");
  });

  it("merkitsee viikonlopun ja tämän päivän", () => {
    const kaikki = weeks.flatMap((w) => w.days);

    expect(kaikki.find((d) => d.date === "2026-09-05")?.weekend).toBe(true);
    expect(kaikki.find((d) => d.date === "2026-09-07")?.weekend).toBe(false);
    expect(kaikki.filter((d) => d.isToday)).toHaveLength(1);
    expect(kaikki.find((d) => d.isToday)?.date).toBe("2026-09-10");
  });

  it("numeroi viikot", () => {
    expect(weeks[0].week).toBe(36);
    expect(weeks[1].week).toBe(37);
  });

  it("kestää kuukauden joka alkaa maanantaista", () => {
    // 1.6.2026 on maanantai: ei täytettä alussa.
    const kesa = monthCalendar("2026-06", "2026-06-01");

    expect(kesa[0].days[0].date).toBe("2026-06-01");
    expect(kesa[0].days[0].inMonth).toBe(true);
  });

  it("kestää helmikuun joka päättyy sunnuntaihin", () => {
    // 28.2.2027 on sunnuntai.
    const helmi = monthCalendar("2027-02", "2027-02-01");
    const viimeinen = helmi[helmi.length - 1].days[6];

    expect(viimeinen.date).toBe("2027-02-28");
    expect(helmi.flatMap((w) => w.days).filter((d) => d.inMonth)).toHaveLength(28);
  });

  it("kestää kelvottoman kuukauden", () => {
    expect(monthCalendar("roska", "2026-09-10")).toEqual([]);
  });
});

describe("shiftsOn", () => {
  it("antaa päivän vuorot aikajärjestyksessä", () => {
    const list = shiftsOn(
      [
        shift({ id: "a", startTime: "17:00" }),
        shift({ id: "b", startTime: "09:00" }),
        shift({ id: "c", date: "2026-09-02" }),
      ],
      "2026-09-01",
    );

    expect(list.map((s) => s.id)).toEqual(["b", "a"]);
  });

  /*
   * Peruttu ei katoa mutta jää viimeiseksi.
   *
   * Suunnittelija tarvitsee tiedon siitä että vuoro peruttiin, muttei
   * lue sitä ensimmäisenä — päivän miehitys on se mitä hän katsoo.
   */
  it("siirtää perutut viimeiseksi", () => {
    const list = shiftsOn(
      [
        shift({ id: "a", startTime: "09:00", cancelledAt: "2026-08-25T08:00:00.000Z" }),
        shift({ id: "b", startTime: "17:00" }),
      ],
      "2026-09-01",
    );

    expect(list.map((s) => s.id)).toEqual(["b", "a"]);
  });
});

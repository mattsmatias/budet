import { describe, expect, it } from "vitest";
import {
  buildRoster,
  formatPlannedHours,
  monthDays,
  shiftLabel,
  shortTime,
  weekdayName,
} from "../roster";
import type { Absence, OpenShift, Shift, ShiftStatus, User } from "../types";

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

function shift(
  userId: string,
  date: string,
  startTime: string,
  endTime: string,
  status: ShiftStatus = "accepted",
): Shift {
  return {
    id: `${userId}-${date}-${startTime}`,
    restaurantId: "r",
    userId,
    date,
    startTime,
    endTime,
    location: "",
    status,
    breakMinutes: 0,
    note: null,
    publishedAt: "2026-08-01T00:00:00.000Z",
    cancelledAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
  };
}

const anna = user("u1", "Anna");
const bertta = user("u2", "Bertta");

describe("monthDays", () => {
  it("antaa kuukauden kaikki päivät", () => {
    expect(monthDays("2026-08")).toHaveLength(31);
    expect(monthDays("2026-09")).toHaveLength(30);
  });

  it("tuntee karkausvuoden", () => {
    expect(monthDays("2024-02")).toHaveLength(29);
    expect(monthDays("2026-02")).toHaveLength(28);
  });

  /*
   * Viikonpäivä ei saa liukua.
   *
   * Päivä lasketaan UTC-keskipäivästä eikä keskiyöstä: keskiyöstä
   * laskettuna kesäaika siirtäisi päivän edelliseksi osassa
   * aikavyöhykkeitä, ja koko lista siirtyisi sarakkeen verran.
   */
  it("nimeää viikonpäivät oikein", () => {
    const days = monthDays("2026-08");

    // 1.8.2026 on lauantai.
    expect(days[0].weekday).toBe(6);
    expect(weekdayName(days[0].weekday)).toBe("la");
    expect(days[0].weekend).toBe(true);

    // 3.8.2026 on maanantai.
    expect(days[2].weekday).toBe(1);
    expect(days[2].weekend).toBe(false);
  });

  it("antaa päivämäärät ISO-muodossa", () => {
    expect(monthDays("2026-08")[0].date).toBe("2026-08-01");
    expect(monthDays("2026-08")[30].date).toBe("2026-08-31");
  });

  it("kestää kelvottoman kuukauden", () => {
    expect(monthDays("roska")).toEqual([]);
  });
});

describe("buildRoster", () => {
  const base = {
    month: "2026-08",
    users: [anna, bertta],
    openShifts: [] as OpenShift[],
    absences: [] as Absence[],
  };

  it("asettaa vuoron oikeaan ruutuun", () => {
    const roster = buildRoster({
      ...base,
      shifts: [shift("u1", "2026-08-03", "10:00", "18:00")],
    });

    expect(roster.rows).toHaveLength(1);
    expect(roster.rows[0].user?.name).toBe("Anna");
    expect(roster.rows[0].cells[2].shifts).toHaveLength(1);
    expect(shiftLabel(roster.rows[0].cells[2].shifts[0])).toBe("10–18");
    expect(roster.rows[0].cells[1].shifts).toEqual([]);
  });

  it("kestää kaksi vuoroa samana päivänä", () => {
    const roster = buildRoster({
      ...base,
      shifts: [
        shift("u1", "2026-08-03", "17:00", "22:00"),
        shift("u1", "2026-08-03", "09:00", "13:00"),
      ],
    });

    const cell = roster.rows[0].cells[2];
    expect(cell.shifts).toHaveLength(2);
    // Aikajärjestyksessä: aamu ennen iltaa.
    expect(cell.shifts[0].startTime).toBe("09:00");
    expect(roster.rows[0].plannedMinutes).toBe(4 * 60 + 5 * 60);
  });

  it("laskee yön yli menevän vuoron oikein", () => {
    const roster = buildRoster({
      ...base,
      shifts: [shift("u1", "2026-08-03", "22:00", "02:00")],
    });

    expect(roster.rows[0].plannedMinutes).toBe(4 * 60);
  });

  /*
   * Kieltäytyminen on aukko, ei työvuoro.
   *
   * Rivi näkyy listalla koska se pitää täyttää, mutta sen tunteja ei
   * lasketa kenenkään summaan — kukaan ei ole lupautunut tekemään
   * sitä.
   */
  it("näyttää kieltäytymisen muttei laske sen tunteja", () => {
    const roster = buildRoster({
      ...base,
      shifts: [
        shift("u1", "2026-08-03", "10:00", "18:00", "declined"),
        shift("u1", "2026-08-04", "10:00", "14:00"),
      ],
    });

    expect(roster.rows[0].cells[2].shifts[0].status).toBe("declined");
    expect(roster.rows[0].shiftCount).toBe(2);
    expect(roster.rows[0].plannedMinutes).toBe(4 * 60);
  });

  it("merkitsee poissaolon jokaiselle jakson päivälle", () => {
    const roster = buildRoster({
      ...base,
      shifts: [shift("u2", "2026-08-10", "10:00", "18:00")],
      absences: [
        {
          id: "a1",
          userId: "u2",
          date: "2026-08-09",
          endDate: "2026-08-11",
          kind: "sick",
          note: null,
          reportedAt: "2026-08-09T06:00:00Z",
        } as Absence,
      ],
    });

    const cells = roster.rows[0].cells;
    expect(cells[7].absence).toBeNull();
    expect(cells[8].absence).toBe("sick");
    expect(cells[9].absence).toBe("sick");
    expect(cells[10].absence).toBe("sick");
    expect(cells[11].absence).toBeNull();
  });

  /*
   * Ilmoitus ei peru vuoroa.
   *
   * Sairausilmoitus ja vuoro voivat olla samana päivänä: vuoro on yhä
   * tekijällä kunnes se siirretään. Listan on näytettävä molemmat,
   * muuten esihenkilö luulee vuoron hoituneen.
   */
  it("näyttää vuoron ja poissaolon samassa ruudussa", () => {
    const roster = buildRoster({
      ...base,
      shifts: [shift("u2", "2026-08-10", "10:00", "18:00")],
      absences: [
        {
          id: "a1",
          userId: "u2",
          date: "2026-08-10",
          endDate: "2026-08-10",
          kind: "sick",
          note: null,
          reportedAt: "2026-08-10T06:00:00Z",
        } as Absence,
      ],
    });

    const cell = roster.rows[0].cells[9];
    expect(cell.shifts).toHaveLength(1);
    expect(cell.absence).toBe("sick");
  });

  it("jättää pois muiden kuukausien vuorot", () => {
    const roster = buildRoster({
      ...base,
      shifts: [
        shift("u1", "2026-07-31", "10:00", "18:00"),
        shift("u1", "2026-09-01", "10:00", "18:00"),
      ],
    });

    expect(roster.rows).toEqual([]);
    expect(roster.plannedMinutes).toBe(0);
  });

  it("jättää pois ihmiset joilla ei ole mitään", () => {
    const roster = buildRoster({
      ...base,
      shifts: [shift("u1", "2026-08-03", "10:00", "18:00")],
    });

    expect(roster.rows.map((r) => r.user?.name)).toEqual(["Anna"]);
  });

  it("järjestää rivit nimen mukaan", () => {
    const roster = buildRoster({
      ...base,
      users: [bertta, anna],
      shifts: [
        shift("u2", "2026-08-03", "10:00", "18:00"),
        shift("u1", "2026-08-04", "10:00", "18:00"),
      ],
    });

    expect(roster.rows.map((r) => r.user?.name)).toEqual(["Anna", "Bertta"]);
  });

  it("nostaa avoimet vuorot omalle riville listan loppuun", () => {
    const roster = buildRoster({
      ...base,
      shifts: [shift("u1", "2026-08-03", "10:00", "18:00")],
      openShifts: [
        {
          id: "o1",
          restaurantId: "r",
          date: "2026-08-05",
          startTime: "16:00",
          endTime: "23:00",
          position: "waiter",
          status: "draft" as const,
          breakMinutes: 0,
          note: null,
          publishedAt: "2026-08-01T00:00:00.000Z",
          cancelledAt: null,
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    });

    const viimeinen = roster.rows[roster.rows.length - 1];
    expect(viimeinen.user).toBeNull();
    expect(viimeinen.cells[4].shifts).toHaveLength(1);

    // Avoin vuoro ei ole kenenkään tunteja.
    expect(viimeinen.plannedMinutes).toBe(0);
    expect(roster.plannedMinutes).toBe(8 * 60);
  });

  it("laskee montako ihmistä on vuorossa kunakin päivänä", () => {
    const roster = buildRoster({
      ...base,
      shifts: [
        shift("u1", "2026-08-03", "10:00", "18:00"),
        shift("u2", "2026-08-03", "16:00", "23:00"),
        shift("u2", "2026-08-04", "10:00", "18:00"),
      ],
      openShifts: [
        {
          id: "o1",
          restaurantId: "r",
          date: "2026-08-03",
          startTime: "16:00",
          endTime: "23:00",
          position: "waiter",
          status: "draft" as const,
          breakMinutes: 0,
          note: null,
          publishedAt: "2026-08-01T00:00:00.000Z",
          cancelledAt: null,
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    });

    // Avoin vuoro ei ole ihminen: sitä ei lasketa miehitykseen.
    expect(roster.perDay[2]).toBe(2);
    expect(roster.perDay[3]).toBe(1);
    expect(roster.perDay[0]).toBe(0);
  });

  it("kestää tyhjän kuukauden", () => {
    const roster = buildRoster({ ...base, shifts: [] });

    expect(roster.rows).toEqual([]);
    expect(roster.days).toHaveLength(31);
    expect(roster.perDay.every((n) => n === 0)).toBe(true);
  });
});

describe("muotoilut", () => {
  it("lyhentää tasatunnit", () => {
    expect(shortTime("10:00")).toBe("10");
    expect(shortTime("09:00")).toBe("9");
    expect(shortTime("10:30")).toBe("10.30");
  });

  it("näyttää tunnit desimaalilla", () => {
    expect(formatPlannedHours(450)).toBe("7,5 h");
    expect(formatPlannedHours(480)).toBe("8 h");
    expect(formatPlannedHours(0)).toBe("0 h");
  });
});

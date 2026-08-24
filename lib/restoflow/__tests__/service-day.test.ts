import { describe, expect, it } from "vitest";
import {
  buildServiceDay,
  clockLabel,
  hourMarks,
  positionOn,
} from "../service-day";
import type { ClockEvent, Shift, User } from "../types";

/*
 * Palvelupäivä.
 *
 * Helsinki on elokuussa UTC+3, joten paikallinen 12:00 on 09:00Z.
 * Kaikki minuutit lasketaan paikallisesta keskiyöstä.
 */

const ZONE = "Europe/Helsinki";
const DATE = "2026-08-24";

/** Paikallinen kellonaika UTC-aikaleimaksi. */
function at(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const utc = h - 3;
  const day = utc < 0 ? 23 : 24;
  const hour = ((utc % 24) + 24) % 24;
  return `2026-08-${day}T${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`;
}

const users: User[] = [
  { id: "u1", restaurantId: "r1", name: "Ali Kokki", role: "employee", position: "kitchen", hourlyRateCents: 1500, initials: "AK", active: true },
  { id: "u2", restaurantId: "r1", name: "Minna Sali", role: "employee", position: "waiter", hourlyRateCents: 1500, initials: "MS", active: true },
];

function shift(partial: Partial<Shift> = {}): Shift {
  return {
    id: "s1", restaurantId: "r1", userId: "u2", date: DATE,
    startTime: "14:00", endTime: "22:00", location: "Sali",
    status: "accepted", ...partial,
  };
}

function clock(userId: string, type: ClockEvent["type"], hhmm: string): ClockEvent {
  return { id: `${userId}-${type}-${hhmm}`, userId, type, at: at(hhmm) };
}

function day(input: {
  shifts?: Shift[];
  clockEvents?: ClockEvent[];
  now?: string;
  date?: string;
}) {
  return buildServiceDay({
    date: input.date ?? DATE,
    shifts: input.shifts ?? [shift()],
    clockEvents: input.clockEvents ?? [],
    users,
    nowIso: at(input.now ?? "12:00"),
    timezone: ZONE,
  });
}

const stateOf = (result: ReturnType<typeof day>, shiftId = "s1") =>
  result?.lanes.flatMap((l) => l.bars).find((b) => b.shiftId === shiftId)?.state;

// ---------------------------------------------------------------------------

describe("aikajanan ikkuna", () => {
  it("kattaa vuorot tunnin marginaalilla ja tasatunteina", () => {
    const result = day({ shifts: [shift()] })!;

    // 14:00 = 840 min, tunti ennen = 780, tasatunti = 780 (13:00).
    expect(result.fromMin).toBe(13 * 60);
    // 22:00 = 1320, tunti jälkeen = 1380 (23:00).
    expect(result.toMin).toBe(23 * 60);
  });

  /*
   * Tyhjä aikajana kertoisi ravintolan olevan kiinni. Se on eri asia
   * kuin se ettei vuoroja ole vielä merkitty, ja näkymän on sanottava
   * kumpi — siksi tässä palautetaan null eikä tyhjä rakenne.
   */
  it("palauttaa tyhjän kun vuoroja ei ole", () => {
    expect(day({ shifts: [] })).toBeNull();
  });

  it("ei laske hylättyä vuoroa mukaan", () => {
    expect(day({ shifts: [shift({ status: "declined" })] })).toBeNull();
  });
});

describe("kaistat", () => {
  it("ryhmittelee aseman mukaan", () => {
    const result = day({
      shifts: [
        shift({ id: "sali", userId: "u2" }),
        shift({ id: "keittio", userId: "u1", startTime: "12:00", endTime: "20:00" }),
      ],
    })!;

    expect(result.lanes.map((l) => l.position)).toEqual(["waiter", "kitchen"]);
    expect(result.lanes[0].bars.map((b) => b.shiftId)).toEqual(["sali"]);
    expect(result.lanes[1].bars.map((b) => b.shiftId)).toEqual(["keittio"]);
  });

  /*
   * Neljä kaistaa joista kaksi tyhjiä näyttäisi siltä että keittiöstä
   * puuttuu väkeä — vaikka keittiö olisi kiinni koko päivän.
   */
  it("ei näytä kaistaa jolla ei ole vuoroja", () => {
    const result = day({ shifts: [shift({ userId: "u2" })] })!;
    expect(result.lanes).toHaveLength(1);
  });

  it("järjestää saman kaistan vuorot alkuajan mukaan", () => {
    const result = day({
      shifts: [
        shift({ id: "ilta", startTime: "17:00", endTime: "23:00" }),
        shift({ id: "aamu", startTime: "10:00", endTime: "16:00" }),
      ],
    })!;

    expect(result.lanes[0].bars.map((b) => b.shiftId)).toEqual(["aamu", "ilta"]);
  });
});

describe("vuoron tila", () => {
  it("tulossa ennen alkua", () => {
    expect(stateOf(day({ now: "10:00" }))).toBe("upcoming");
  });

  // Armoaika: vartti myöhässä ei ole vielä poikkeama.
  it("tulossa vielä armoajan sisällä", () => {
    expect(stateOf(day({ now: "14:10" }))).toBe("upcoming");
  });

  it("myöhässä kun armoaika ylittyy eikä leimausta ole", () => {
    expect(stateOf(day({ now: "14:30" }))).toBe("late");
  });

  it("töissä kun sisään on leimattu", () => {
    expect(
      stateOf(day({ now: "16:00", clockEvents: [clock("u2", "in", "13:55")] })),
    ).toBe("working");
  });

  it("tauolla kun tauko on käynnissä", () => {
    expect(
      stateOf(
        day({
          now: "16:00",
          clockEvents: [
            clock("u2", "in", "13:55"),
            clock("u2", "break_start", "15:30"),
          ],
        }),
      ),
    ).toBe("break");
  });

  it("tehty kun ulos on leimattu", () => {
    expect(
      stateOf(
        day({
          now: "23:00",
          clockEvents: [clock("u2", "in", "13:55"), clock("u2", "out", "22:05")],
        }),
      ),
    ).toBe("done");
  });

  /*
   * Venynyt vuoro maksaa palkkana ellei sitä huomata. Tunti yli on
   * tavallista, kaksi tuntia yli on unohtunut uloskirjaus.
   */
  it("venynyt kun työaika on yhä auki tunti vuoron jälkeen", () => {
    expect(
      stateOf(day({ now: "23:30", clockEvents: [clock("u2", "in", "13:55")] })),
    ).toBe("overrun");
  });

  it("ei venynyt vielä armoajan sisällä", () => {
    expect(
      stateOf(day({ now: "22:30", clockEvents: [clock("u2", "in", "13:55")] })),
    ).toBe("working");
  });

  it("leimaamatta jäänyt kun vuoro on ohi eikä leimauksia ole", () => {
    expect(stateOf(day({ now: "23:00" }))).toBe("missed");
  });

  /*
   * Leimaus voittaa suunnitelman. Suunnitelma kertoo mitä piti
   * tapahtua, leimaus mitä tapahtui — ja näkymä näyttää jälkimmäisen.
   */
  it("näyttää töissä olevan vaikka vuoro ei ole vielä alkanut", () => {
    expect(
      stateOf(day({ now: "13:30", clockEvents: [clock("u2", "in", "13:20")] })),
    ).toBe("working");
  });

  it("lukee menneen päivän vain leimauksista", () => {
    const result = day({
      date: "2026-08-23",
      shifts: [shift({ date: "2026-08-23" })],
      now: "12:00",
    })!;

    expect(result.nowMin).toBeNull();
    expect(stateOf(result)).toBe("missed");
  });
});

describe("yhteenveto", () => {
  it("laskee salissa olevat, tulossa olevat ja huomiota vaativat", () => {
    const result = day({
      now: "14:40",
      shifts: [
        shift({ id: "toissa", userId: "u2" }),
        shift({ id: "myohassa", userId: "u1", startTime: "14:00", endTime: "22:00" }),
        shift({ id: "tulossa", userId: "u2", startTime: "18:00", endTime: "23:00" }),
      ],
      clockEvents: [clock("u2", "in", "13:55")],
    })!;

    expect(result.onFloor).toBe(1);
    expect(result.upcoming).toBe(1);
    expect(result.attention).toBe(1);
  });
});

describe("sijoittelu", () => {
  it("laskee osuuden aikajanalla", () => {
    const result = day({ shifts: [shift()] })!;

    expect(positionOn(result, result.fromMin)).toBe(0);
    expect(positionOn(result, result.toMin)).toBe(1);
    expect(positionOn(result, 18 * 60)).toBeCloseTo(0.5, 2);
  });

  it("rajaa ikkunan ulkopuolelle jäävän", () => {
    const result = day({ shifts: [shift()] })!;
    expect(positionOn(result, 0)).toBe(0);
    expect(positionOn(result, 2000)).toBe(1);
  });

  it("antaa tasatunnit merkeiksi", () => {
    const result = day({ shifts: [shift()] })!;
    expect(hourMarks(result, 2)).toEqual([780, 900, 1020, 1140, 1260, 1380]);
  });

  it("muotoilee kellonajan", () => {
    expect(clockLabel(840)).toBe("14.00");
    // Yön yli mennyt vuoro päättyy seuraavan päivän puolella.
    expect(clockLabel(1500)).toBe("01.00");
  });
});

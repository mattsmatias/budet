import { describe, expect, it } from "vitest";
import { defaultShiftFor, FALLBACK_SHIFT } from "../shift-defaults";
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

describe("defaultShiftFor", () => {
  it("käyttää vakioarvoa kun vuoroja ei ole", () => {
    expect(defaultShiftFor("u1", [])).toEqual(FALLBACK_SHIFT);
  });

  it("käyttää viimeisintä vuoroa", () => {
    const d = defaultShiftFor("u1", [
      shift({ id: "a", date: "2026-08-01", startTime: "08:00", endTime: "16:00" }),
      shift({ id: "b", date: "2026-09-05", startTime: "16:00", endTime: "23:00", breakMinutes: 20 }),
      shift({ id: "c", date: "2026-08-20", startTime: "12:00", endTime: "20:00" }),
    ]);

    expect(d).toEqual({ startTime: "16:00", endTime: "23:00", breakMinutes: 20 });
  });

  it("ei sekoita eri ihmisten vuoroja", () => {
    const d = defaultShiftFor("u1", [
      shift({ id: "a", userId: "u2", date: "2026-09-10", startTime: "06:00", endTime: "14:00" }),
      shift({ id: "b", userId: "u1", date: "2026-09-01", startTime: "16:00", endTime: "23:00" }),
    ]);

    expect(d.startTime).toBe("16:00");
  });

  /*
   * Peruttu vuoro on nimenomaan sellainen jota ei tehty.
   *
   * Sen toistaminen mallina veisi suunnittelun juuri siihen aikaan
   * josta oli päätetty luopua.
   */
  it("ohittaa perutut vuorot mallina", () => {
    const d = defaultShiftFor("u1", [
      shift({
        id: "a",
        date: "2026-09-10",
        startTime: "06:00",
        endTime: "14:00",
        cancelledAt: "2026-09-05T08:00:00.000Z",
      }),
      shift({ id: "b", date: "2026-09-01", startTime: "16:00", endTime: "23:00" }),
    ]);

    expect(d.startTime).toBe("16:00");
  });

  it("kelpuuttaa luonnoksen malliksi", () => {
    // Luonnos on suunnitelmaa siinä missä julkaistukin, ja se on usein
    // juuri se vuoro jota parhaillaan monistetaan.
    const d = defaultShiftFor("u1", [
      shift({ id: "a", date: "2026-09-10", startTime: "07:00", endTime: "15:00", publishedAt: null }),
    ]);

    expect(d.startTime).toBe("07:00");
  });
});

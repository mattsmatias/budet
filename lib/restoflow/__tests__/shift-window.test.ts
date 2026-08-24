import { describe, expect, it } from "vitest";
import {
  clockInState,
  formatMinuteOfDay,
  shiftBounds,
  shiftLengthMinutes,
} from "../shift-window";
import type { Shift } from "../types";

/*
 * Leimausikkuna.
 *
 * Sama sääntö on record_clock_event-funktiossa. Nämä testit kuvaavat
 * mitä käyttöliittymä lupaa; kanta on se joka lopulta ratkaisee.
 *
 * Helsinki on elokuussa UTC+3, joten paikallinen 09:45 on 06:45Z.
 */

const ZONE = "Europe/Helsinki";
const EARLY = 30;

/** Paikallinen kellonaika 24.8.2026 UTC-aikaleimaksi. */
function at(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const utc = h - 3;
  const day = utc < 0 ? 23 : 24;
  const hour = ((utc % 24) + 24) % 24;
  return `2026-08-${day}T${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`;
}

function shift(partial: Partial<Shift> = {}): Shift {
  return {
    id: "sh1",
    restaurantId: "r1",
    userId: "u1",
    date: "2026-08-24",
    startTime: "10:00",
    endTime: "18:00",
    location: "Sali",
    status: "accepted",
    ...partial,
  };
}

function state(shifts: Shift[], hhmm: string, earlyMinutes = EARLY) {
  return clockInState({
    shifts,
    userId: "u1",
    nowIso: at(hhmm),
    timezone: ZONE,
    earlyMinutes,
  });
}

// ---------------------------------------------------------------------------

describe("vuoron pituus", () => {
  it("laskee tavallisen vuoron", () => {
    expect(shiftLengthMinutes(shift())).toBe(480);
  });

  it("laskee yön yli menevän vuoron", () => {
    expect(shiftLengthMinutes(shift({ startTime: "22:00", endTime: "02:00" }))).toBe(240);
  });

  it("antaa loppuhetken yli vuorokauden yön vuorolle", () => {
    expect(shiftBounds(shift({ startTime: "22:00", endTime: "02:00" }))).toEqual({
      startMin: 22 * 60,
      endMin: 26 * 60,
    });
  });
});

describe("ei vuoroa", () => {
  it("estää leimauksen kun vuoroja ei ole", () => {
    expect(state([], "12:00").kind).toBe("no-shift");
  });

  it("estää leimauksen toisen työntekijän vuorolla", () => {
    expect(state([shift({ userId: "u2" })], "12:00").kind).toBe("no-shift");
  });

  it("estää leimauksen hylätyllä vuorolla", () => {
    expect(state([shift({ status: "declined" })], "12:00").kind).toBe("no-shift");
  });

  it("kertoo seuraavan vuoron vaikka tänään ei ole", () => {
    const tulossa = shift({ date: "2026-08-26" });
    const s = state([tulossa], "12:00");
    expect(s.kind).toBe("no-shift");
    if (s.kind === "no-shift") expect(s.next?.date).toBe("2026-08-26");
  });
});

describe("liian aikaisin", () => {
  it("ei avaa ikkunaa tuntia ennen", () => {
    const s = state([shift()], "09:00");
    expect(s.kind).toBe("too-early");
    if (s.kind === "too-early") expect(formatMinuteOfDay(s.opensAtMinutes)).toBe("09:30");
  });

  /*
   * Raja on mukaanlukeva: täsmälleen puoli tuntia ennen on jo sallittu.
   * Sekunnin päässä oleva raja tuottaisi tilanteen jossa painike vilkkuu
   * kelvottomana juuri sillä hetkellä kun sitä painetaan.
   */
  it("avaa ikkunan täsmälleen rajalla", () => {
    expect(state([shift()], "09:30").kind).toBe("open");
  });

  // 15 minuutin rajalla ikkuna avautuu 09:45 eikä 09:30.
  it("noudattaa ravintolan omaa varhaisrajaa", () => {
    expect(state([shift()], "09:40", 15).kind).toBe("too-early");
    expect(state([shift()], "09:45", 15).kind).toBe("open");
    expect(state([shift()], "09:40", 30).kind).toBe("open");
  });
});

describe("ikkuna auki", () => {
  it("sallii leimauksen vuoron alussa", () => {
    expect(state([shift()], "10:00").kind).toBe("open");
  });

  it("sallii myöhästyneen leimauksen kesken vuoron", () => {
    expect(state([shift()], "17:00").kind).toBe("open");
  });

  /*
   * Päättyneeseen vuoroon ei leimata.
   *
   * Kello käy sisäänleimauksesta eteenpäin itsestään, joten vuoron
   * jälkeen avattu työaika kerryttäisi tunteja joita kukaan ei ole
   * suunnitellut eikä valvo.
   */
  it("sulkee ikkunan vuoron loputtua", () => {
    expect(state([shift()], "18:00").kind).toBe("no-shift");
    expect(state([shift()], "19:00").kind).toBe("no-shift");
  });
});

describe("yön yli menevä vuoro", () => {
  const yo = shift({ startTime: "22:00", endTime: "02:00" });

  it("sallii leimauksen illalla", () => {
    expect(state([yo], "22:30").kind).toBe("open");
  });

  /*
   * Keskiyön jälkeen ollaan seuraavassa päivässä, mutta vuoro on yhä
   * eilisen rivillä. Ilman tätä yövuorolainen ei voisi leimata sisään
   * kello 00:30.
   */
  it("sallii leimauksen keskiyön jälkeen edellisen päivän vuorolla", () => {
    const s = clockInState({
      shifts: [shift({ date: "2026-08-23", startTime: "22:00", endTime: "02:00" })],
      userId: "u1",
      nowIso: at("00:30"),
      timezone: ZONE,
      earlyMinutes: EARLY,
    });
    expect(s.kind).toBe("open");
  });

  it("sulkee ikkunan yövuoron loputtua", () => {
    const s = clockInState({
      shifts: [shift({ date: "2026-08-23", startTime: "22:00", endTime: "02:00" })],
      userId: "u1",
      nowIso: at("02:30"),
      timezone: ZONE,
      earlyMinutes: EARLY,
    });
    expect(s.kind).toBe("no-shift");
  });
});

describe("kellonajan muotoilu", () => {
  it("muotoilee minuutit keskiyöstä", () => {
    expect(formatMinuteOfDay(9 * 60 + 30)).toBe("09:30");
    expect(formatMinuteOfDay(0)).toBe("00:00");
  });

  it("kiertää vuorokauden yli", () => {
    expect(formatMinuteOfDay(26 * 60)).toBe("02:00");
  });
});

import { describe, expect, it } from "vitest";
import {
  clockInState,
  formatMinuteOfDay,
  nextShiftFrom,
  opensInMs,
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

describe("seuraava vuoro", () => {
  /*
   * Tämä testi kuvaa vian joka näkyi työntekijälle illalla: kello 20
   * etusivu kertoi seuraavaksi vuoroksi sen aamuvuoron jonka hän oli
   * juuri tehnyt. Pelkkä päivämäärävertailu ei riitä, kun kysymys on
   * ajasta.
   */
  it("ohittaa jo päättyneen tämän päivän vuoron", () => {
    const morning = shift({ id: "aamu", startTime: "08:00", endTime: "16:00" });
    const tomorrow = shift({ id: "huomenna", date: "2026-08-25" });

    const next = nextShiftFrom([morning, tomorrow], at("20:00"), ZONE);

    expect(next?.id).toBe("huomenna");
  });

  it("pitää kesken olevan vuoron seuraavana", () => {
    const morning = shift({ startTime: "08:00", endTime: "16:00" });
    expect(nextShiftFrom([morning], at("12:00"), ZONE)?.id).toBe("sh1");
  });

  it("löytää saman päivän myöhemmän vuoron", () => {
    const morning = shift({ id: "aamu", startTime: "08:00", endTime: "12:00" });
    const evening = shift({ id: "ilta", startTime: "17:00", endTime: "22:00" });

    expect(nextShiftFrom([morning, evening], at("13:00"), ZONE)?.id).toBe("ilta");
  });

  it("järjestää saman päivän vuorot alkuajan mukaan", () => {
    // Kanta järjestää vain päivän mukaan, joten järjestys voi tulla
    // kummin päin tahansa.
    const evening = shift({ id: "ilta", startTime: "17:00", endTime: "22:00" });
    const morning = shift({ id: "aamu", startTime: "08:00", endTime: "12:00" });

    expect(nextShiftFrom([evening, morning], at("06:00"), ZONE)?.id).toBe("aamu");
  });

  it("ei palauta hylättyä vuoroa", () => {
    const declined = shift({ status: "declined" });
    expect(nextShiftFrom([declined], at("06:00"), ZONE)).toBeNull();
  });

  it("palauttaa tyhjän kun kaikki on tehty", () => {
    const morning = shift({ startTime: "08:00", endTime: "16:00" });
    expect(nextShiftFrom([morning], at("20:00"), ZONE)).toBeNull();
  });

  /*
   * Sama korjaus koskee leimauskorttia: "ei vuoroa" -tilan teksti
   * kertoo seuraavan vuoron, eikä se saa olla mennyt.
   */
  it("ei tarjoa päättynyttä vuoroa leimauskortin seuraavaksi", () => {
    const morning = shift({ startTime: "08:00", endTime: "16:00" });
    const result = state([morning], "20:00");

    expect(result.kind).toBe("no-shift");
    if (result.kind === "no-shift") expect(result.next).toBeNull();
  });
});

describe("ikkunan avautumiseen jäävä aika", () => {
  it("laskee erotuksen minuutteina päivän alusta", () => {
    // Kello 09:00 paikallista, ikkuna aukeaa 09:45 (585 min).
    expect(opensInMs(585, at("09:00"), ZONE)).toBe(45 * 60_000);
  });

  /*
   * Menneisyyteen ei odoteta. Negatiivinen viive tekisi setTimeoutista
   * välittömän silmukan: piirros → pyyntö → piirros.
   */
  it("ei palauta negatiivista aikaa", () => {
    expect(opensInMs(585, at("10:00"), ZONE)).toBe(0);
  });

  it("lukee nykyhetken ravintolan ajassa", () => {
    // 06:45Z on Helsingissä 09:45, eli ikkuna on juuri auennut.
    expect(opensInMs(585, "2026-08-24T06:45:00.000Z", ZONE)).toBe(0);
    // UTC:nä luettuna kello olisi 06:45 ja odotusta jäisi kolme tuntia.
    expect(opensInMs(585, "2026-08-24T06:45:00.000Z", "UTC")).toBe(180 * 60_000);
  });
});

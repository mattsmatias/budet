import { describe, expect, it } from "vitest";
import {
  allowedActions,
  canPerform,
  computeWorked,
  currentState,
  datesInRange,
  formatClock,
  formatDuration,
  msToHours,
  staffCostCents,
  workedOnDate,
} from "../timeclock";
import type { ClockEvent, ClockEventType } from "../types";

let seq = 0;
function ev(type: ClockEventType, at: string): ClockEvent {
  seq += 1;
  return { id: `e${seq}`, employeeId: "u1", type, at };
}

const D = "2026-08-20";
const t = (hhmm: string) => `${D}T${hhmm}:00.000Z`;

describe("currentState", () => {
  it("on off ilman tapahtumia", () => {
    expect(currentState([])).toBe("off");
  });

  it("siirtyy töihin sisäänkirjauksesta", () => {
    expect(currentState([ev("in", t("09:00"))])).toBe("working");
  });

  it("siirtyy tauolle ja takaisin", () => {
    const events = [ev("in", t("09:00")), ev("break_start", t("12:00"))];
    expect(currentState(events)).toBe("on_break");
    expect(currentState([...events, ev("break_end", t("12:30"))])).toBe("working");
  });

  it("uloskirjaus palauttaa off-tilaan myös tauolta", () => {
    const events = [ev("in", t("09:00")), ev("break_start", t("12:00")), ev("out", t("12:30"))];
    expect(currentState(events)).toBe("off");
  });

  it("ohittaa mahdottoman siirtymän eikä kaadu", () => {
    // Tauko ilman sisäänkirjausta ei tee mitään.
    expect(currentState([ev("break_start", t("09:00"))])).toBe("off");
    // Toinen sisäänkirjaus ei nollaa käynnissä olevaa jaksoa.
    expect(currentState([ev("in", t("09:00")), ev("in", t("10:00"))])).toBe("working");
  });

  it("ei riipu tapahtumien järjestyksestä syötteessä", () => {
    const a = [ev("in", t("09:00")), ev("out", t("17:00"))];
    const b = [a[1], a[0]];
    expect(currentState(b)).toBe(currentState(a));
  });
});

describe("allowedActions", () => {
  it("tarjoaa vain sisäänkirjauksen kun ei olla töissä", () => {
    expect(allowedActions("off")).toEqual(["in"]);
    expect(canPerform("off", "out")).toBe(false);
  });

  it("ei tarjoa toista sisäänkirjausta töissä ollessa", () => {
    expect(canPerform("working", "in")).toBe(false);
    expect(canPerform("working", "break_start")).toBe(true);
    expect(canPerform("working", "out")).toBe(true);
  });

  it("sallii uloskirjauksen myös tauolta", () => {
    expect(canPerform("on_break", "out")).toBe(true);
    expect(canPerform("on_break", "break_start")).toBe(false);
  });
});

describe("computeWorked", () => {
  const HOUR = 3600000;

  it("laskee suoran vuoron", () => {
    const r = computeWorked([ev("in", t("09:00")), ev("out", t("17:00"))], t("18:00"));
    expect(r.workedMs).toBe(8 * HOUR);
    expect(r.breakMs).toBe(0);
    expect(r.runningSince).toBeNull();
  });

  it("vähentää tauon työajasta", () => {
    const r = computeWorked(
      [
        ev("in", t("09:00")),
        ev("break_start", t("12:00")),
        ev("break_end", t("12:30")),
        ev("out", t("17:00")),
      ],
      t("18:00"),
    );
    expect(r.workedMs).toBe(7.5 * HOUR);
    expect(r.breakMs).toBe(0.5 * HOUR);
  });

  it("laskee keskeneräisen jakson annettuun hetkeen asti", () => {
    const r = computeWorked([ev("in", t("09:00"))], t("13:30"));
    expect(r.workedMs).toBe(4.5 * HOUR);
    expect(r.runningSince).toBe(t("09:00"));
  });

  it("ei kerrytä työaikaa tauon aikana", () => {
    const events = [ev("in", t("09:00")), ev("break_start", t("12:00"))];
    const r = computeWorked(events, t("13:00"));
    expect(r.workedMs).toBe(3 * HOUR);
    expect(r.breakMs).toBe(1 * HOUR);
    // Tauolla ei ole käynnissä olevaa työjaksoa.
    expect(r.runningSince).toBeNull();
  });

  it("laskee useamman jakson samana päivänä", () => {
    const r = computeWorked(
      [
        ev("in", t("09:00")),
        ev("out", t("11:00")),
        ev("in", t("15:00")),
        ev("out", t("18:00")),
      ],
      t("20:00"),
    );
    expect(r.workedMs).toBe(5 * HOUR);
  });

  it("ei tuota negatiivista aikaa vaikka hetki olisi ennen sisäänkirjausta", () => {
    const r = computeWorked([ev("in", t("09:00"))], t("08:00"));
    expect(r.workedMs).toBe(0);
  });

  it("ohittaa kelvottoman aikaleiman", () => {
    const r = computeWorked(
      [ev("in", t("09:00")), ev("break_start", "ei-aika"), ev("out", t("17:00"))],
      t("18:00"),
    );
    expect(r.workedMs).toBe(8 * HOUR);
  });

  it("on deterministinen", () => {
    const events = [ev("in", t("09:00")), ev("out", t("17:00"))];
    expect(computeWorked(events, t("18:00"))).toEqual(
      computeWorked(events, t("18:00")),
    );
  });
});

describe("workedOnDate", () => {
  it("rajaa laskennan yhteen päivään", () => {
    const events = [
      ev("in", "2026-08-19T09:00:00.000Z"),
      ev("out", "2026-08-19T17:00:00.000Z"),
      ev("in", t("10:00")),
      ev("out", t("14:00")),
    ];
    expect(workedOnDate(events, D, t("20:00")).workedMs).toBe(4 * 3600000);
  });
});

describe("datesInRange", () => {
  it("sisältää molemmat päät", () => {
    expect(datesInRange("2026-08-18", "2026-08-20")).toEqual([
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
    ]);
  });

  it("palauttaa yhden päivän kun alku ja loppu ovat samat", () => {
    expect(datesInRange(D, D)).toEqual([D]);
  });
});

describe("muotoilu", () => {
  it("näyttää tunnit ja minuutit", () => {
    expect(formatDuration(7 * 3600000 + 24 * 60000)).toBe("7 h 24 min");
  });

  it("jättää tunnit pois alle tunnin kestosta", () => {
    expect(formatDuration(24 * 60000)).toBe("24 min");
  });

  it("ei näytä negatiivista", () => {
    expect(formatDuration(-5000)).toBe("0 min");
  });

  it("muotoilee laskurin nollilla täytettynä", () => {
    expect(formatClock(4 * 3600000 + 37 * 60000 + 21000)).toBe("04:37:21");
    expect(formatClock(0)).toBe("00:00:00");
  });
});

describe("staffCostCents", () => {
  it("laskee palkan tunneista ja tuntihinnasta", () => {
    // 8 h × 14,50 € = 116,00 €
    expect(staffCostCents(8 * 3600000, 1450)).toBe(11600);
  });

  it("pyöristää vasta lopussa", () => {
    // 1 h 20 min = 1,3333 h × 15,00 € = 20,00 €
    expect(staffCostCents(80 * 60000, 1500)).toBe(2000);
  });

  it("on nolla ilman työaikaa", () => {
    expect(staffCostCents(0, 1500)).toBe(0);
  });

  it("muuntaa millisekunnit tunneiksi", () => {
    expect(msToHours(5400000)).toBe(1.5);
  });
});

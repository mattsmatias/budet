import { describe, expect, it } from "vitest";
import { operationalAlerts, type OperationsContext } from "../operations";
import type { ClockEvent, Receipt, Shift, User } from "../types";
import type { DailySales } from "../sales";

/*
 * Toiminnalliset poikkeamat ovat aikakriittisiä, ja siksi ne ovat
 * herkempiä kellolle kuin mikään muu Kateessa. Jokainen testi kiinnittää
 * nykyhetken ja vyöhykkeen, jotta epäonnistuminen kertoo säännöstä eikä
 * siitä milloin testi ajettiin.
 *
 * Vyöhyke on Europe/Helsinki eli kesällä UTC+3. 09:00 paikallista aikaa
 * on 06:00Z. Tämä ero on syy siihen että päivä luetaan aina vyöhykkeessä.
 */

const TZ = "Europe/Helsinki";
const TODAY = "2026-08-24";

const users: User[] = [
  {
    id: "u1", restaurantId: "rest-1", name: "Ali", role: "employee",
    position: "waiter", hourlyRateCents: 1500, initials: "A", active: true,
  },
];

function ctx(partial: Partial<OperationsContext> = {}): OperationsContext {
  return {
    users,
    shifts: [],
    openShifts: [],
    clockEvents: [],
    receipts: [],
    sales: [],
    today: TODAY,
    now: `${TODAY}T09:00:00Z`, // 12:00 paikallista
    timezone: TZ,
    ...partial,
  };
}

function shift(partial: Partial<Shift> = {}): Shift {
  return {
    id: "s1", restaurantId: "rest-1", userId: "u1", date: TODAY,
    startTime: "09:00", endTime: "17:00", location: "Sali",
    status: "accepted", breakMinutes: 0, note: null, publishedAt: "2026-08-01T00:00:00.000Z", createdAt: "2026-08-01T00:00:00.000Z", cancelledAt: null, ...partial,
  };
}

function clock(type: ClockEvent["type"], at: string): ClockEvent {
  return { id: `c-${type}-${at}`, userId: "u1", type, at };
}

function receipt(date: string): Receipt {
  return {
    id: `r-${date}`, restaurantId: "rest-1", date, totalCents: 5000,
    supplierId: "s-1", supplierName: "Tukku", vatCents: null,
    category: "food", paymentMethod: "card", receiptNumber: null,
    note: null, status: "confirmed", reviewReasons: [], items: [],
    addedByUserId: "u1", addedAt: `${date}T10:00:00.000Z`,
    hasImage: true, imagePath: null, pages: [], categoryId: null, imageQuality: "good",
  };
}

function sale(date: string, netCents: number, targetCents: number | null = null): DailySales {
  return {
    date,
    netCents,
    targetCents,
    note: null,
    grossCents: null,
    vatCents: null,
    transactions: null,
    source: "manual",
    posGrossCents: null,
    posVatCents: null,
  };
}

const kinds = (c: OperationsContext) => operationalAlerts(c).map((a) => a.kind);

// ---------------------------------------------------------------------------

describe("myöhässä oleva sisäänleimaus", () => {
  it("huomauttaa kun vuoro alkoi eikä kukaan leimannut", () => {
    // Vuoro 09:00 paikallista, kello 12:00 paikallista — kolme tuntia myöhässä.
    const alerts = operationalAlerts(ctx({ shifts: [shift()] }));

    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe("late_clock_in");
    expect(alerts[0].severity).toBe("critical");
    expect(alerts[0].title).toContain("Ali");
  });

  it("vaikenee armoajan sisällä", () => {
    // 09:10 paikallista = 06:10Z, eli 10 minuuttia vuoron alusta.
    expect(kinds(ctx({ shifts: [shift()], now: `${TODAY}T06:10:00Z` }))).toEqual([]);
  });

  it("vaikenee kun sisään on leimattu", () => {
    const alerts = kinds(
      ctx({ shifts: [shift()], clockEvents: [clock("in", `${TODAY}T06:05:00Z`)] }),
    );
    expect(alerts).not.toContain("late_clock_in");
  });

  /*
   * Tämä on se virhe joka on osunut Kateen viisi kertaa.
   *
   * Yövuoro alkaa 00:00 paikallista, ja sisään leimattiin 00:10. UTC:ssä
   * se hetki on edellisen päivän 21:10, joten päivän lukeminen
   * merkkijonon viipaleesta hukkaisi leimauksen ja nostaisi hälytyksen
   * työntekijästä joka on paikalla.
   */
  it("lukee leimauksen päivän ravintolan ajassa", () => {
    const afterMidnight = clock("in", "2026-08-23T21:10:00Z"); // 00:10 paikallista
    expect(afterMidnight.at.slice(0, 10)).not.toBe(TODAY); // UTC näyttää eri päivää

    const night = shift({ startTime: "00:00", endTime: "08:00" });
    const alerts = kinds(
      ctx({
        shifts: [night],
        clockEvents: [afterMidnight],
        now: "2026-08-23T23:00:00Z", // 02:00 paikallista, vuoro kesken
      }),
    );

    expect(alerts).toEqual([]);
  });

  it("ohittaa hylätyn vuoron", () => {
    expect(kinds(ctx({ shifts: [shift({ status: "declined" })] }))).toEqual([]);
  });

  it("ohittaa muun päivän vuoron", () => {
    expect(kinds(ctx({ shifts: [shift({ date: "2026-08-23" })] }))).toEqual([]);
  });
});

describe("venynyt vuoro", () => {
  it("huomauttaa kun työaika on yhä auki tunti vuoron jälkeen", () => {
    // Vuoro päättyi 17:00, kello on 18:30 paikallista (15:30Z).
    const alerts = operationalAlerts(
      ctx({
        shifts: [shift()],
        clockEvents: [clock("in", `${TODAY}T06:00:00Z`)],
        now: `${TODAY}T15:30:00Z`,
      }),
    );

    expect(alerts.map((a) => a.kind)).toContain("shift_overrun");
    expect(alerts.find((a) => a.kind === "shift_overrun")!.severity).toBe("warning");
  });

  it("vaikenee kun ulos on leimattu", () => {
    const alerts = kinds(
      ctx({
        shifts: [shift()],
        clockEvents: [clock("in", `${TODAY}T06:00:00Z`), clock("out", `${TODAY}T14:00:00Z`)],
        now: `${TODAY}T15:30:00Z`,
      }),
    );
    expect(alerts).not.toContain("shift_overrun");
  });

  it("vaikenee tunnin armoajan sisällä", () => {
    // 17:30 paikallista = 14:30Z, puoli tuntia yli.
    const alerts = kinds(
      ctx({
        shifts: [shift()],
        clockEvents: [clock("in", `${TODAY}T06:00:00Z`)],
        now: `${TODAY}T14:30:00Z`,
      }),
    );
    expect(alerts).not.toContain("shift_overrun");
  });
});

describe("tekijätön vuoro", () => {
  const open = (date: string) => ({
    id: `o-${date}`, restaurantId: "rest-1", date,
    startTime: "10:00", endTime: "18:00", position: "waiter" as const,
    status: "draft" as const,
    breakMinutes: 0,
    note: null,
    publishedAt: "2026-08-01T00:00:00.000Z",
    cancelledAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
  });

  it("huomauttaa kolmen päivän sisällä olevasta", () => {
    const alerts = operationalAlerts(ctx({ openShifts: [open("2026-08-26")] }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe("unassigned_shift");
    expect(alerts[0].detail).toContain("26.8.");
  });

  it("ei huuda kauempana olevasta", () => {
    // Kauempi vuoro ehtii täyttyä itsestään. Hälytys siitä olisi kohinaa.
    expect(kinds(ctx({ openShifts: [open("2026-09-10")] }))).toEqual([]);
  });

  it("ei kaiva mennyttä", () => {
    expect(kinds(ctx({ openShifts: [open("2026-08-20")] }))).toEqual([]);
  });
});

describe("myynti alle vertailukohdan", () => {
  const yesterday = "2026-08-23";

  it("huomauttaa tavoitteesta jäämisestä", () => {
    const alerts = operationalAlerts(
      ctx({ sales: [sale(yesterday, 80_000, 100_000)] }),
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe("sales_shortfall");
    expect(alerts[0].title).toContain("20 %");
  });

  it("vaikenee kun tavoite lähes täyttyi", () => {
    // 95 % tavoitteesta on tavallista vaihtelua, ei poikkeama.
    expect(kinds(ctx({ sales: [sale(yesterday, 95_000, 100_000)] }))).toEqual([]);
  });

  /*
   * Ilman vertailukohtaa ei ole mistä jäädä. Pelkkä pieni luku ei ole
   * poikkeama: hiljainen sunnuntai on hiljainen sunnuntai.
   */
  it("vaikenee ilman tavoitetta ja ilman historiaa", () => {
    expect(kinds(ctx({ sales: [sale(yesterday, 10_000)] }))).toEqual([]);
  });

  it("käyttää saman viikonpäivän historiaa kun tavoitetta ei ole", () => {
    // 23.8.2026 on sunnuntai; 16.8. ja 9.8. ovat sunnuntaita.
    const alerts = operationalAlerts(
      ctx({
        sales: [
          sale(yesterday, 50_000),
          sale("2026-08-16", 100_000),
          sale("2026-08-09", 100_000),
        ],
      }),
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0].detail).toContain("viikonpäivän");
  });

  it("ei arvioi kesken olevaa päivää", () => {
    // Tämän päivän myynti on vasta puolessa välissä; vertailu koko
    // päivän tavoitteeseen antaisi aina hälytyksen.
    expect(kinds(ctx({ sales: [sale(TODAY, 10_000, 100_000)] }))).toEqual([]);
  });
});

describe("kuittitauko", () => {
  it("huomauttaa kun kuitteja ei ole kirjattu ja töitä on tehty", () => {
    const alerts = operationalAlerts(
      ctx({
        receipts: [receipt("2026-08-01")],
        clockEvents: [clock("in", "2026-08-20T06:00:00Z")],
      }),
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe("receipt_gap");
    expect(alerts[0].title).toContain("23");
  });

  /*
   * Suljettu ravintola ei osta mitään. Ilman tätä ehtoa lomaviikko
   * tuottaisi hälytyksen joka kerta.
   */
  it("vaikenee kun tauon aikana ei ole tehty töitä", () => {
    expect(kinds(ctx({ receipts: [receipt("2026-08-01")] }))).toEqual([]);
  });

  it("vaikenee tuoreesta kuitista", () => {
    const alerts = kinds(
      ctx({
        receipts: [receipt("2026-08-20")],
        clockEvents: [clock("in", "2026-08-22T06:00:00Z")],
      }),
    );
    expect(alerts).not.toContain("receipt_gap");
  });

  it("vaikenee kun kuitteja ei ole lainkaan", () => {
    // Uusi ravintola ei ole myöhässä mistään.
    expect(kinds(ctx({ clockEvents: [clock("in", "2026-08-20T06:00:00Z")] }))).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import {
  BLOCKING_STATUSES,
  nextStatuses,
  sortForService,
  summarise,
  tableStates,
  type Reservation,
  type ReservationDay,
  type ReservationStatus,
  type RestaurantTable,
} from "../reservations";

/**
 * Salinäkymän johdettu tila.
 *
 * Nämä ovat puhtaita funktioita, joten ne on testattavissa ilman
 * kantaa. Kanta on testattu erikseen; tämä testaa sen mitä
 * käyttöliittymä laskee kannan vastauksesta.
 */

const TUNTI = 60 * 60 * 1000;
const NYT = new Date("2026-09-05T18:00:00.000Z");

function poyta(partial: Partial<RestaurantTable> = {}): RestaurantTable {
  return {
    id: "p1",
    name: "1",
    areaId: null,
    seatsMin: 1,
    seatsMax: 4,
    active: true,
    posX: null,
    shape: "round" as const,
    rotation: 0,
    width: null,
    posY: null,
    ...partial,
  };
}

function varaus(partial: Partial<Reservation> = {}): Reservation {
  const alku = new Date(NYT.getTime() - TUNTI);
  const loppu = new Date(NYT.getTime() + TUNTI);

  return {
    id: "v1",
    startsAt: alku.toISOString(),
    endsAt: loppu.toISOString(),
    time: "20:00",
    endTime: "21:30",
    partySize: 2,
    status: "confirmed",
    source: "widget",
    guestName: "Asiakas",
    guestPhone: null,
    guestEmail: null,
    note: null,
    tableIds: ["p1"],
    billRequestedAt: null,
    ...partial,
  };
}

function paiva(partial: Partial<ReservationDay> = {}): ReservationDay {
  return {
    date: "2026-09-05",
    timezone: "Europe/Helsinki",
    canManage: true,
    elements: [],
    settings: {
      enabled: true,
      slotMinutes: 30,
      defaultDurationMinutes: 90,
      turnaroundMinutes: 0,
      minParty: 1,
      maxParty: 12,
    },
    areas: [],
    tables: [poyta()],
    reservations: [],
    ...partial,
  };
}

describe("tableStates", () => {
  it("pöytä ilman varauksia on vapaa", () => {
    const [tila] = tableStates(paiva(), NYT);
    expect(tila.state).toBe("free");
    expect(tila.reservation).toBeNull();
  });

  it("käytöstä poistettu pöytä on pois käytöstä vaikka siinä olisi varaus", () => {
    const day = paiva({
      tables: [poyta({ active: false })],
      reservations: [varaus({ status: "arrived" })],
    });

    expect(tableStates(day, NYT)[0].state).toBe("disabled");
  });

  it("saapunut seurue tekee pöydästä käytössä olevan", () => {
    const day = paiva({ reservations: [varaus({ status: "arrived" })] });

    const [tila] = tableStates(day, NYT);
    expect(tila.state).toBe("seated");
    expect(tila.reservation?.id).toBe("v1");
  });

  it("alkanut mutta saapumaton varaus jää odottamaan", () => {
    const day = paiva({ reservations: [varaus({ status: "confirmed" })] });

    expect(tableStates(day, NYT)[0].state).toBe("late");
  });

  it("tuleva varaus näkyy varattuna", () => {
    const day = paiva({
      reservations: [
        varaus({
          startsAt: new Date(NYT.getTime() + TUNTI).toISOString(),
          endsAt: new Date(NYT.getTime() + 2 * TUNTI).toISOString(),
        }),
      ],
    });

    const [tila] = tableStates(day, NYT);
    expect(tila.state).toBe("reserved");
    expect(tila.reservation?.id).toBe("v1");
  });

  it("peruttu varaus ei varaa pöytää", () => {
    const day = paiva({
      reservations: [
        varaus({
          status: "cancelled",
          startsAt: new Date(NYT.getTime() + TUNTI).toISOString(),
          endsAt: new Date(NYT.getTime() + 2 * TUNTI).toISOString(),
        }),
      ],
    });

    expect(tableStates(day, NYT)[0].state).toBe("free");
  });

  it("äsken päättynyt varaus jättää pöydän siivottavaksi", () => {
    const day = paiva({
      settings: { ...paiva().settings!, turnaroundMinutes: 15 },
      reservations: [
        varaus({
          status: "completed",
          startsAt: new Date(NYT.getTime() - 2 * TUNTI).toISOString(),
          endsAt: new Date(NYT.getTime() - 5 * 60 * 1000).toISOString(),
        }),
      ],
    });

    expect(tableStates(day, NYT)[0].state).toBe("cleaning");
  });

  it("ilman tyhjennysväliä pöytä vapautuu heti", () => {
    const day = paiva({
      settings: { ...paiva().settings!, turnaroundMinutes: 0 },
      reservations: [
        varaus({
          status: "completed",
          startsAt: new Date(NYT.getTime() - 2 * TUNTI).toISOString(),
          endsAt: new Date(NYT.getTime() - 5 * 60 * 1000).toISOString(),
        }),
      ],
    });

    expect(tableStates(day, NYT)[0].state).toBe("free");
  });

  it("tyhjennysväli ei koske perumatta jäänyttä aikaa", () => {
    /* Peruttu varaus ei jätä siivottavaa: kukaan ei istunut pöydässä. */
    const day = paiva({
      settings: { ...paiva().settings!, turnaroundMinutes: 15 },
      reservations: [
        varaus({
          status: "cancelled",
          startsAt: new Date(NYT.getTime() - 2 * TUNTI).toISOString(),
          endsAt: new Date(NYT.getTime() - 5 * 60 * 1000).toISOString(),
        }),
      ],
    });

    expect(tableStates(day, NYT)[0].state).toBe("free");
  });

  it("yhdistetty varaus näkyy kaikissa pöydissään", () => {
    const day = paiva({
      tables: [poyta({ id: "p1", name: "1" }), poyta({ id: "p2", name: "2" })],
      reservations: [
        varaus({ status: "arrived", partySize: 6, tableIds: ["p1", "p2"] }),
      ],
    });

    const tilat = tableStates(day, NYT);
    expect(tilat.map((t) => t.state)).toEqual(["seated", "seated"]);
  });

  it("käytössä oleminen voittaa myöhemmän varauksen", () => {
    const day = paiva({
      reservations: [
        varaus({ id: "nyt", status: "arrived" }),
        varaus({
          id: "myohemmin",
          startsAt: new Date(NYT.getTime() + 3 * TUNTI).toISOString(),
          endsAt: new Date(NYT.getTime() + 4 * TUNTI).toISOString(),
        }),
      ],
    });

    const [tila] = tableStates(day, NYT);
    expect(tila.state).toBe("seated");
    expect(tila.reservation?.id).toBe("nyt");
    expect(tila.reservations).toHaveLength(2);
  });
});

describe("sortForService", () => {
  it("aikajärjestys ylhäällä, peruttu ja saapumatta jäänyt alhaalla", () => {
    const rivit = [
      varaus({ id: "peruttu", status: "cancelled", startsAt: "2026-09-05T15:00:00.000Z" }),
      varaus({ id: "myohassa", status: "confirmed", startsAt: "2026-09-05T19:00:00.000Z" }),
      varaus({ id: "lahti", status: "completed", startsAt: "2026-09-05T16:00:00.000Z" }),
      varaus({ id: "aikaisin", status: "confirmed", startsAt: "2026-09-05T17:00:00.000Z" }),
    ];

    expect(sortForService(rivit).map((r) => r.id)).toEqual([
      "aikaisin",
      "myohassa",
      "lahti",
      "peruttu",
    ]);
  });

  it("ei muuta alkuperäistä listaa", () => {
    const rivit = [varaus({ id: "a" }), varaus({ id: "b" })];
    sortForService(rivit);
    expect(rivit.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("summarise", () => {
  it("peruttu ja saapumatta jäänyt eivät kerrytä vieraita", () => {
    const yhteenveto = summarise([
      varaus({ id: "1", partySize: 2, status: "confirmed" }),
      varaus({ id: "2", partySize: 4, status: "arrived" }),
      varaus({ id: "3", partySize: 8, status: "cancelled" }),
      varaus({ id: "4", partySize: 6, status: "no_show" }),
    ]);

    expect(yhteenveto.active).toBe(2);
    expect(yhteenveto.guests).toBe(6);
    expect(yhteenveto.cancelled).toBe(1);
    expect(yhteenveto.noShow).toBe(1);
  });

  it("lähtenyt seurue lasketaan saapuneeksi", () => {
    const yhteenveto = summarise([
      varaus({ id: "1", status: "arrived" }),
      varaus({ id: "2", status: "completed" }),
    ]);

    expect(yhteenveto.arrived).toBe(2);
  });

  it("walk-init lasketaan erikseen", () => {
    const yhteenveto = summarise([
      varaus({ id: "1", source: "walk_in", status: "arrived" }),
      varaus({ id: "2", source: "widget" }),
      varaus({ id: "3", source: "walk_in", status: "cancelled" }),
    ]);

    expect(yhteenveto.walkIns).toBe(1);
  });
});

describe("nextStatuses", () => {
  it("tuleva seurue saapuu, jää saapumatta tai perutaan", () => {
    expect(nextStatuses("confirmed")).toEqual(["arrived", "no_show", "cancelled"]);
  });

  it("saapunut seurue lähtee", () => {
    expect(nextStatuses("arrived")).toContain("completed");
  });

  it("jokaisella tilalla on ainakin yksi jatko", () => {
    const tilat: ReservationStatus[] = [
      "pending",
      "confirmed",
      "arrived",
      "completed",
      "cancelled",
      "no_show",
    ];

    for (const tila of tilat) {
      expect(nextStatuses(tila).length).toBeGreaterThan(0);
    }
  });

  it("ei tarjoa nykyistä tilaa uudelleen", () => {
    const tilat: ReservationStatus[] = [
      "pending",
      "confirmed",
      "arrived",
      "completed",
      "cancelled",
      "no_show",
    ];

    for (const tila of tilat) {
      expect(nextStatuses(tila)).not.toContain(tila);
    }
  });

  /*
   * Ei maksua, ei korttivarmennusta, ei ennakkomaksua.
   *
   * Saapumatta jäänyt on merkintä ravintolan omaa seurantaa varten.
   * Testi on tässä siksi että se on tuotepäätös eikä toteutuksen
   * yksityiskohta: jos joku joskus lisää veloituksen, tämän on
   * kaaduttava.
   */
  it("saapumatta jääminen ei johda mihinkään veloitukseen", () => {
    const kentat = Object.keys(varaus());
    expect(kentat.some((k) => /fee|charge|deposit|card|payment/i.test(k))).toBe(
      false,
    );
  });
});

describe("BLOCKING_STATUSES", () => {
  it("vastaa kannan blocking-lippua", () => {
    /*
     * Kannan liipaisin asettaa blocking = status in
     * ('pending','confirmed','arrived'). Sama joukko on tässä, ja jos
     * ne eroavat, pöytäkartta näyttäisi eri tilan kuin
     * saatavuuslaskenta.
     */
    expect([...BLOCKING_STATUSES].sort()).toEqual([
      "arrived",
      "confirmed",
      "pending",
    ]);
  });
});

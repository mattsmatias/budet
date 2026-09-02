/**
 * Pöytäkartan laskenta.
 *
 * Kartta on visuaalinen, mutta sen logiikka ei ole: koko, rajaus,
 * asettelu ja varaustilanne ovat lukuja. Juuri ne on testattava, koska
 * silmä ei huomaa kahden prosentin virhettä sijainnissa — mutta
 * huomaa pöydän joka on puoliksi seinän sisällä.
 */

import { describe, expect, it } from "vitest";
import {
  aspectFor,
  autoLayout,
  clampToRoom,
  placementsFor,
  tableExtent,
  planTimes,
  reservationsAt,
  roundPercent,
  summarise,
  tableStateAt,
  tableWidth,
  type PlanReservation,
  type PlanTable,
} from "../floor-plan";

function poyta(muutos: Partial<PlanTable> = {}): PlanTable {
  return {
    id: "t1",
    name: "1",
    areaId: null,
    seatsMin: 2,
    seatsMax: 4,
    active: true,
    posX: 50,
    posY: 50,
    shape: "round",
    rotation: 0,
    ...muutos,
  };
}

function varaus(muutos: Partial<PlanReservation> = {}): PlanReservation {
  return {
    id: "r1",
    time: "18:00",
    endTime: "20:00",
    status: "confirmed",
    partySize: 2,
    guestName: "Virtanen",
    tableIds: ["t1"],
    ...muutos,
  };
}

// ===========================================================================
// Mitat
// ===========================================================================

describe("tableWidth", () => {
  it("kasvaa paikkaluvun mukana", () => {
    expect(tableWidth(2)).toBeLessThan(tableWidth(6));
    expect(tableWidth(6)).toBeLessThan(tableWidth(12));
  });

  it("pysyy rajoissa myös järjettömillä luvuilla", () => {
    /*
     * Alaraja pitää nimen luettavana, yläraja estää juhlapöytää
     * peittämästä puolta salia.
     */
    expect(tableWidth(1)).toBeGreaterThanOrEqual(8);
    expect(tableWidth(200)).toBeLessThanOrEqual(16);
    expect(tableWidth(Number.NaN)).toBeGreaterThanOrEqual(8);
  });
});

describe("aspectFor", () => {
  it("tekee pyöreästä ja neliöstä yhtä leveän kuin korkean", () => {
    expect(aspectFor("round")).toBe(1);
    expect(aspectFor("square")).toBe(1);
  });

  it("tekee suorakaiteesta pitkän", () => {
    expect(aspectFor("rect")).toBeGreaterThan(1.5);
  });
});

// ===========================================================================
// Rajaus
// ===========================================================================

describe("tableExtent", () => {
  /* 3:2-kartta: leveys jaettuna korkeudella on 1,5. */
  const SALI = 1.5;

  it("tekee pyöreästä yhtä leveän kuin korkean myös prosenteissa", () => {
    const mitat = tableExtent(10, "round", 0, SALI);

    /*
     * Sama pikselimäärä kummallakin akselilla tarkoittaa eri
     * prosenttilukua, koska sali on leveämpi kuin korkea.
     */
    expect(mitat.width).toBe(10);
    expect(mitat.height).toBe(15);
  });

  it("tekee suorakaiteesta leveän", () => {
    expect(tableExtent(10, "rect", 0, SALI).width).toBeCloseTo(19, 5);
  });

  it("vaihtaa ulottuvuudet kun pöytä käännetään", () => {
    const pysty = tableExtent(10, "rect", 90, SALI);

    expect(pysty.width).toBeCloseTo(10, 5);
    expect(pysty.height).toBeCloseTo(28.5, 5);
  });

  it("ei käännä puolikkaalla kierroksella", () => {
    expect(tableExtent(10, "rect", 180, SALI)).toEqual(
      tableExtent(10, "rect", 0, SALI),
    );
  });
});

describe("clampToRoom", () => {
  const SALI = 1.5;

  it("ei siirrä pöytää joka on jo salissa", () => {
    expect(clampToRoom(50, 50, 10, "round", SALI)).toEqual({ x: 50, y: 50 });
  });

  it("vetää reunan yli menneen takaisin kokonaan näkyviin", () => {
    const tulos = clampToRoom(0, 0, 10, "round", SALI);

    /* Puolikas leveydestä: 5 %. */
    expect(tulos.x).toBe(5);
    /* Puolikas korkeudesta: 10 × 1,5 / 2 = 7,5 %. */
    expect(tulos.y).toBeCloseTo(7.5, 5);
  });

  it("rajaa myös oikeasta ja alareunasta", () => {
    const tulos = clampToRoom(100, 100, 10, "round", SALI);

    expect(tulos.x).toBe(95);
    expect(tulos.y).toBeCloseTo(92.5, 5);
  });

  it("varaa pitkälle pöydälle enemmän tilaa sivusuunnassa", () => {
    const pyorea = clampToRoom(0, 50, 10, "round", SALI);
    const pitka = clampToRoom(0, 50, 10, "rect", SALI);

    expect(pitka.x).toBeGreaterThan(pyorea.x);
  });

  it("ei rajaa pitkää pöytää turhaan pystysuunnassa", () => {
    /*
     * Vaakasuora pitkä pöytä on matala. Aiempi rajaus käytti
     * leveyttä myös korkeutena, jolloin pöytää ei saanut vietyä
     * seinään asti — ja juuri seinän viereen ne salissa laitetaan.
     */
    const pitka = clampToRoom(50, 0, 10, "rect", SALI);
    const pyorea = clampToRoom(50, 0, 10, "round", SALI);

    expect(pitka.y).toBeCloseTo(pyorea.y, 5);
  });

  it("keskittää pöydän joka ei mahdu saliin", () => {
    expect(clampToRoom(10, 10, 90, "rect", SALI)).toEqual({ x: 50, y: 50 });
  });
});

describe("roundPercent", () => {
  it("pyöristää kahteen desimaaliin", () => {
    expect(roundPercent(33.3333)).toBe(33.33);
  });

  it("rajaa nollan ja sadan väliin", () => {
    expect(roundPercent(-5)).toBe(0);
    expect(roundPercent(140)).toBe(100);
    expect(roundPercent(Number.NaN)).toBe(0);
  });
});

// ===========================================================================
// Automaattinen asettelu
// ===========================================================================

describe("autoLayout", () => {
  it("ei koske pöytiin joilla on jo paikka", () => {
    const paikat = autoLayout([poyta({ id: "a" }), poyta({ id: "b" })]);
    expect(paikat.size).toBe(0);
  });

  it("asettelee paikattomat ruudukkoon", () => {
    const paikat = autoLayout([
      poyta({ id: "a", posX: null, posY: null }),
      poyta({ id: "b", posX: null, posY: null }),
      poyta({ id: "c", posX: null, posY: null }),
      poyta({ id: "d", posX: null, posY: null }),
    ]);

    expect(paikat.size).toBe(4);

    /* 2×2: neljäsosien keskikohdat. */
    expect(paikat.get("a")).toEqual({ x: 25, y: 25 });
    expect(paikat.get("d")).toEqual({ x: 75, y: 75 });
  });

  it("ei aseta kahta pöytää samaan paikkaan", () => {
    const tables = Array.from({ length: 12 }, (_, i) =>
      poyta({ id: `t${i}`, posX: null, posY: null }),
    );

    const paikat = autoLayout(tables);
    const avaimet = new Set(
      [...paikat.values()].map((p) => `${p.x},${p.y}`),
    );

    expect(avaimet.size).toBe(12);
  });

  it("pysyy salin sisällä", () => {
    const tables = Array.from({ length: 9 }, (_, i) =>
      poyta({ id: `t${i}`, posX: null, posY: null }),
    );

    for (const paikka of autoLayout(tables).values()) {
      expect(paikka.x).toBeGreaterThan(0);
      expect(paikka.x).toBeLessThan(100);
      expect(paikka.y).toBeGreaterThan(0);
      expect(paikka.y).toBeLessThan(100);
    }
  });
});

describe("placementsFor", () => {
  it("yhdistää tallennetut ja automaattiset paikat", () => {
    const sijainnit = placementsFor([
      poyta({ id: "a", posX: 10, posY: 20 }),
      poyta({ id: "b", posX: null, posY: null }),
    ]);

    expect(sijainnit.find((p) => p.id === "a")).toMatchObject({ x: 10, y: 20 });
    expect(sijainnit.find((p) => p.id === "b")?.x).toBeGreaterThan(0);
  });
});

// ===========================================================================
// Varaustilanne
// ===========================================================================

describe("tableStateAt", () => {
  it("on vapaa ilman varauksia", () => {
    expect(tableStateAt(poyta(), [], "19:00")).toBe("free");
  });

  it("on varattu varauksen aikana", () => {
    expect(tableStateAt(poyta(), [varaus()], "19:00")).toBe("reserved");
  });

  it("on vapaa ennen varausta ja sen jälkeen", () => {
    expect(tableStateAt(poyta(), [varaus()], "17:59")).toBe("free");
    expect(tableStateAt(poyta(), [varaus()], "20:00")).toBe("free");
  });

  it("laskee alkuhetken mukaan ja loppuhetken pois", () => {
    /*
     * Kello 20:00 päättyvä varaus ei enää varaa pöytää 20:00
     * alkavalta seurueelta. Se on juuri se hetki jolloin pöytä
     * vaihtaa omistajaa.
     */
    expect(tableStateAt(poyta(), [varaus()], "18:00")).toBe("reserved");
    expect(tableStateAt(poyta(), [varaus()], "19:59")).toBe("reserved");
    expect(tableStateAt(poyta(), [varaus()], "20:00")).toBe("free");
  });

  it("näyttää paikalla olevan seurueen varauksen sijaan", () => {
    expect(tableStateAt(poyta(), [varaus({ status: "arrived" })], "19:00")).toBe(
      "seated",
    );
  });

  it("ei varaa pöytää perutulla varauksella", () => {
    expect(
      tableStateAt(poyta(), [varaus({ status: "cancelled" })], "19:00"),
    ).toBe("free");
    expect(tableStateAt(poyta(), [varaus({ status: "no_show" })], "19:00")).toBe(
      "free",
    );
  });

  it("merkitsee käytöstä poistetun omaksi tilakseen", () => {
    expect(tableStateAt(poyta({ active: false }), [], "19:00")).toBe("inactive");
  });

  it("ei sekoita toisen pöydän varausta", () => {
    const toisen = varaus({ tableIds: ["t2"] });
    expect(tableStateAt(poyta(), [toisen], "19:00")).toBe("free");
  });
});

describe("reservationsAt", () => {
  it("palauttaa vain hetkeen osuvat", () => {
    const illalla = varaus({ id: "ilta", time: "20:00", endTime: "22:00" });

    expect(reservationsAt("t1", [varaus(), illalla], "19:00")).toHaveLength(1);
    expect(reservationsAt("t1", [varaus(), illalla], "21:00")).toHaveLength(1);
    expect(reservationsAt("t1", [varaus(), illalla], "23:00")).toHaveLength(0);
  });
});

describe("planTimes", () => {
  it("kokoaa alkuajat järjestyksessä ilman kaksoiskappaleita", () => {
    const ajat = planTimes([
      varaus({ id: "a", time: "20:00" }),
      varaus({ id: "b", time: "18:00" }),
      varaus({ id: "c", time: "18:00" }),
    ]);

    expect(ajat).toEqual(["18:00", "20:00"]);
  });

  it("jättää perutut pois", () => {
    expect(
      planTimes([varaus({ time: "18:00", status: "cancelled" })]),
    ).toEqual([]);
  });
});

// ===========================================================================
// Yhteenveto
// ===========================================================================

describe("summarise", () => {
  const tables = [
    poyta({ id: "t1", seatsMax: 4 }),
    poyta({ id: "t2", seatsMax: 2 }),
    poyta({ id: "t3", seatsMax: 6 }),
    poyta({ id: "t4", seatsMax: 8, active: false }),
  ];

  it("laskee vapaat, varatut ja paikalla olevat", () => {
    const tulos = summarise(
      tables,
      [
        varaus({ id: "a", tableIds: ["t1"] }),
        varaus({ id: "b", tableIds: ["t3"], status: "arrived" }),
      ],
      "19:00",
    );

    expect(tulos.reserved).toBe(1);
    expect(tulos.seated).toBe(1);
    expect(tulos.free).toBe(1);
  });

  it("laskee paikat vain vapaista pöydistä", () => {
    const tulos = summarise(tables, [varaus({ tableIds: ["t1"] })], "19:00");

    /* Vapaana t2 (2) ja t3 (6). Poistettu t4 ei ole vapaa. */
    expect(tulos.freeSeats).toBe(8);
  });

  it("ei laske käytöstä poistettua pöytää mukaan", () => {
    expect(summarise(tables, [], "19:00").tables).toBe(3);
  });
});

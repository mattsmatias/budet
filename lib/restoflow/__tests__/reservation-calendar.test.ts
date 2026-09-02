/**
 * Varauskalenterin laskenta.
 *
 * Kalenteri on visuaalinen, mutta sen logiikka ei ole: aikajanan
 * rajat, palkin sijainti ja päällekkäisyys ovat lukuja. Juuri ne on
 * testattava — silmä ei huomaa viiden minuutin virhettä palkin
 * korkeudessa, mutta huomaa varauksen joka päätyi väärään pöytään.
 */

import { describe, expect, it } from "vitest";
import {
  axisFor,
  blockPosition,
  blocks,
  columnsFor,
  conflictFor,
  durationOf,
  minutesAt,
  minutesOf,
  reservationsInColumn,
  timeOf,
  timesOverlap,
  type CalendarReservation,
  type CalendarTable,
} from "../reservation-calendar";

function varaus(muutos: Partial<CalendarReservation> = {}): CalendarReservation {
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

function poyta(muutos: Partial<CalendarTable> = {}): CalendarTable {
  return {
    id: "t1",
    name: "1",
    areaId: null,
    active: true,
    seatsMax: 4,
    ...muutos,
  };
}

// ===========================================================================
// Aika
// ===========================================================================

describe("minutesOf", () => {
  it("muuntaa kellonajan minuuteiksi", () => {
    expect(minutesOf("00:00")).toBe(0);
    expect(minutesOf("18:30")).toBe(1110);
    expect(minutesOf("23:59")).toBe(1439);
  });

  it("palauttaa nollan kelvottomasta, ei NaN:ia", () => {
    /*
     * NaN leviää joka laskutoimitukseen ja katoaa tyyliattribuuttiin
     * hiljaa. Nolla näkyy väärässä paikassa, ja se huomataan.
     */
    expect(minutesOf("")).toBe(0);
    expect(minutesOf("puoli seitsemän")).toBe(0);
    expect(Number.isNaN(minutesOf("xx:yy"))).toBe(false);
  });
});

describe("timeOf", () => {
  it("muuntaa takaisin", () => {
    expect(timeOf(0)).toBe("00:00");
    expect(timeOf(1110)).toBe("18:30");
  });

  it("kiertää vuorokauden yli", () => {
    expect(timeOf(25 * 60)).toBe("01:00");
  });
});

describe("durationOf", () => {
  it("laskee tavallisen keston", () => {
    expect(durationOf("18:00", "20:00")).toBe(120);
  });

  it("laskee keskiyön yli menevän oikein", () => {
    /* Ravintola sulkee kello 01. 23:00–01:00 on kaksi tuntia. */
    expect(durationOf("23:00", "01:00")).toBe(120);
  });
});

// ===========================================================================
// Aikajana
// ===========================================================================

describe("axisFor", () => {
  it("kattaa aukioloajan marginaaleineen", () => {
    const axis = axisFor([], { opens: "11:00", lastSeating: "21:00" });

    expect(axis.from).toBeLessThanOrEqual(10 * 60);
    /* Viimeinen istumisaika ei ole sulkemisaika: illallinen jatkuu. */
    expect(axis.to).toBeGreaterThanOrEqual(23 * 60);
  });

  it("venyy aukioloajan ulkopuolisen varauksen mukaan", () => {
    /*
     * Walk-in kirjataan usein aukioloajan ulkopuolelle. Varaus jota
     * ei näy on pahempi kuin liian pitkä aikajana.
     */
    const axis = axisFor([varaus({ time: "23:30", endTime: "23:59" })], {
      opens: "11:00",
      lastSeating: "14:00",
    });

    expect(axis.to).toBe(24 * 60);
  });

  it("antaa tavallisen illan tyhjälle päivälle", () => {
    const axis = axisFor([], null);

    expect(axis.to).toBeGreaterThan(axis.from);
    expect(axis.ticks.length).toBeGreaterThan(2);
  });

  it("asettaa tuntiviivat tasatunneille", () => {
    const axis = axisFor([], { opens: "11:00", lastSeating: "21:00" });

    for (const tick of axis.ticks) expect(tick % 60).toBe(0);
  });

  it("ei koskaan tuota nollan mittaista janaa", () => {
    const axis = axisFor([varaus({ time: "12:00", endTime: "12:00" })], null);
    expect(axis.to).toBeGreaterThan(axis.from);
  });
});

// ===========================================================================
// Palkin sijainti
// ===========================================================================

describe("blockPosition", () => {
  const axis = { from: 600, to: 1440, ticks: [] };

  it("sijoittaa palkin alkuajan kohdalle", () => {
    const { top } = blockPosition(varaus({ time: "18:00" }), axis);

    /* 1080 − 600 = 480 minuuttia 840:stä = 57,14 %. */
    expect(top).toBeCloseTo(57.14, 1);
  });

  it("antaa korkeuden kestosta", () => {
    const { height } = blockPosition(
      varaus({ time: "18:00", endTime: "20:00" }),
      axis,
    );

    /* 120 / 840 = 14,29 %. */
    expect(height).toBeCloseTo(14.29, 1);
  });

  it("leikkaa janan ulkopuolelle jäävän osan", () => {
    /*
     * Ilman leikkausta ennen janaa alkava palkki nousisi
     * otsikkorivin päälle.
     */
    const { top, height } = blockPosition(
      varaus({ time: "08:00", endTime: "11:00" }),
      axis,
    );

    expect(top).toBe(0);
    expect(height).toBeCloseTo((60 / 840) * 100, 1);
  });

  it("pitää lyhyenkin varauksen näkyvissä", () => {
    const { height } = blockPosition(
      varaus({ time: "18:00", endTime: "18:05" }),
      axis,
    );

    expect(height).toBeGreaterThanOrEqual(2);
  });
});

describe("minutesAt", () => {
  const axis = { from: 600, to: 1440, ticks: [] };

  it("muuntaa osuuden minuuteiksi", () => {
    expect(minutesAt(0, axis)).toBe(600);
    expect(minutesAt(1, axis)).toBe(1440);
  });

  it("pyöristää viiteen minuuttiin", () => {
    /* Kukaan ei varaa pöytää kello 18:47. */
    for (const osuus of [0.123, 0.456, 0.789]) {
      expect(minutesAt(osuus, axis) % 5).toBe(0);
    }
  });

  it("ei mene janan ulkopuolelle", () => {
    expect(minutesAt(-1, axis)).toBe(600);
    expect(minutesAt(2, axis)).toBe(1440);
  });
});

// ===========================================================================
// Päällekkäisyys
// ===========================================================================

describe("blocks", () => {
  it("erottaa varaavat merkinnöistä", () => {
    expect(blocks("confirmed")).toBe(true);
    expect(blocks("arrived")).toBe(true);
    expect(blocks("cancelled")).toBe(false);
    expect(blocks("no_show")).toBe(false);
  });
});

describe("timesOverlap", () => {
  it("tunnistaa päällekkäisyyden", () => {
    expect(timesOverlap(1080, 1200, 1140, 1260)).toBe(true);
  });

  it("sallii peräkkäiset varaukset", () => {
    /* 20:00 päättyvä ja 20:00 alkava ovat peräkkäin. */
    expect(timesOverlap(1080, 1200, 1200, 1320)).toBe(false);
  });

  it("ottaa tyhjennysvälin huomioon", () => {
    expect(timesOverlap(1080, 1200, 1200, 1320, 15)).toBe(true);
  });
});

describe("conflictFor", () => {
  const toinen = varaus({
    id: "r2",
    time: "20:00",
    endTime: "22:00",
    guestName: "Korhonen",
  });

  it("sallii siirron tyhjään kohtaan", () => {
    expect(
      conflictFor({
        reservation: varaus(),
        tableIds: ["t1"],
        startMinutes: minutesOf("17:00"),
        durationMinutes: 120,
        others: [toinen],
      }),
    ).toBeNull();
  });

  it("kertoo kenen kanssa siirto menee päällekkäin", () => {
    const este = conflictFor({
      reservation: varaus(),
      tableIds: ["t1"],
      startMinutes: minutesOf("21:00"),
      durationMinutes: 120,
      others: [toinen],
    });

    expect(este?.guestName).toBe("Korhonen");
    expect(este?.time).toBe("20:00");
  });

  it("ei estä varausta itsellään", () => {
    /*
     * Tämä on koko siirron tarkoitus: varaus on listalla mukana,
     * mutta se ei saa törmätä itseensä.
     *
     * Aika on sama kuin varauksella jo on, 18:00–20:00. Korhonen
     * alkaa 20:00, eikä loppuhetki ole päällekkäisyys.
     */
    const oma = varaus();

    expect(
      conflictFor({
        reservation: oma,
        tableIds: ["t1"],
        startMinutes: minutesOf("18:00"),
        durationMinutes: 120,
        others: [oma, toinen],
      }),
    ).toBeNull();
  });

  it("ei välitä toisen pöydän varauksesta", () => {
    expect(
      conflictFor({
        reservation: varaus(),
        tableIds: ["t2"],
        startMinutes: minutesOf("21:00"),
        durationMinutes: 120,
        others: [toinen],
      }),
    ).toBeNull();
  });

  it("ohittaa perutut", () => {
    expect(
      conflictFor({
        reservation: varaus(),
        tableIds: ["t1"],
        startMinutes: minutesOf("21:00"),
        durationMinutes: 120,
        others: [{ ...toinen, status: "cancelled" }],
      }),
    ).toBeNull();
  });

  it("ei estä perutun siirtoa", () => {
    expect(
      conflictFor({
        reservation: varaus({ status: "cancelled" }),
        tableIds: ["t1"],
        startMinutes: minutesOf("21:00"),
        durationMinutes: 120,
        others: [toinen],
      }),
    ).toBeNull();
  });

  it("huomioi tyhjennysvälin", () => {
    const este = conflictFor({
      reservation: varaus(),
      tableIds: ["t1"],
      startMinutes: minutesOf("18:00"),
      durationMinutes: 120,
      others: [toinen],
      turnaroundMinutes: 15,
    });

    expect(este?.guestName).toBe("Korhonen");
  });

  it("havaitsee törmäyksen yhdistetyn pöydän kummastakin puolesta", () => {
    const yhdistetty = varaus({ id: "r3", tableIds: ["t1", "t2"] });

    const este = conflictFor({
      reservation: varaus({ id: "r9", tableIds: [] }),
      tableIds: ["t2"],
      startMinutes: minutesOf("18:30"),
      durationMinutes: 60,
      others: [yhdistetty],
    });

    expect(este?.reservationId).toBe("r3");
  });
});

// ===========================================================================
// Sarakkeet
// ===========================================================================

describe("columnsFor", () => {
  const tables = [
    poyta({ id: "t2", name: "2" }),
    poyta({ id: "t10", name: "10" }),
    poyta({ id: "t1", name: "1" }),
  ];

  it("järjestää pöydät numerojärjestykseen", () => {
    const sarakkeet = columnsFor(tables, [], null);
    expect(sarakkeet.map((s) => s.name)).toEqual(["1", "2", "10"]);
  });

  it("siirtää käytöstä poistetut loppuun muttei piilota niitä", () => {
    /* Poistetussa pöydässä voi olla illan varauksia. */
    const sarakkeet = columnsFor(
      [poyta({ id: "t1", name: "1", active: false }), poyta({ id: "t2", name: "2" })],
      [],
      null,
    );

    expect(sarakkeet.map((s) => s.name)).toEqual(["2", "1"]);
  });

  it("rajaa alueeseen", () => {
    const sarakkeet = columnsFor(
      [
        poyta({ id: "t1", name: "1", areaId: "sali" }),
        poyta({ id: "t2", name: "2", areaId: "terassi" }),
      ],
      [],
      "terassi",
    );

    expect(sarakkeet).toHaveLength(1);
    expect(sarakkeet[0].name).toBe("2");
  });

  it("lisää sarakkeen sijoittamattomille varauksille", () => {
    const sarakkeet = columnsFor(tables, [varaus({ tableIds: [] })], null);

    expect(sarakkeet[sarakkeet.length - 1].id).toBeNull();
  });

  it("ei lisää tyhjää saraketta turhaan", () => {
    const sarakkeet = columnsFor(tables, [varaus()], null);
    expect(sarakkeet.every((s) => s.id !== null)).toBe(true);
  });

  it("ei lisää saraketta perutulle sijoittamattomalle", () => {
    const sarakkeet = columnsFor(
      tables,
      [varaus({ tableIds: [], status: "cancelled" })],
      null,
    );

    expect(sarakkeet.every((s) => s.id !== null)).toBe(true);
  });
});

describe("reservationsInColumn", () => {
  it("näyttää yhdistetyn pöydän molemmissa sarakkeissa", () => {
    /* Molemmat pöydät ovat varattuja, ja se on totta. */
    const yhdistetty = varaus({ tableIds: ["t1", "t2"] });

    expect(reservationsInColumn([yhdistetty], "t1")).toHaveLength(1);
    expect(reservationsInColumn([yhdistetty], "t2")).toHaveLength(1);
  });

  it("kerää sijoittamattomat tyhjään sarakkeeseen", () => {
    const sijoittamaton = varaus({ tableIds: [] });

    expect(reservationsInColumn([varaus(), sijoittamaton], null)).toEqual([
      sijoittamaton,
    ]);
  });

  it("järjestää ajan mukaan", () => {
    const ilta = varaus({ id: "b", time: "20:00" });
    const alku = varaus({ id: "a", time: "17:00" });

    expect(reservationsInColumn([ilta, alku], "t1").map((r) => r.id)).toEqual([
      "a",
      "b",
    ]);
  });
});

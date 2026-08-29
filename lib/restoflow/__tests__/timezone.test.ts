import { describe, expect, it } from "vitest";
import {
  dayIn,
  minutesOfDayIn,
  timeIn,
  weekdayIn,
  windowStartIso,
} from "../clock-context";
import { eventsOnDate, formatTimeOfDay, workedOnDate } from "../timeclock";
import type { ClockEvent } from "../types";

/*
 * Leimauksen päivä ja kellonaika ravintolan ajassa.
 *
 * Aiemmin nämä poimittiin ISO-merkkijonosta viipaloimalla, mikä on
 * UTC-aikaa. Kesto oli oikein, koska se lasketaan absoluuttisista
 * hetkistä, mutta työ kirjautui väärälle päivälle ja kello näytti
 * väärää aikaa.
 *
 * Tapaus alla on tuotantokannasta: occurred_at 2026-08-21 23:15Z on
 * Helsingissä 22. elokuuta klo 02:15.
 */

const HELSINKI = "Europe/Helsinki";

function ev(type: ClockEvent["type"], at: string): ClockEvent {
  return { id: at + type, userId: "u1", type, at };
}

describe("päivä ravintolan ajassa", () => {
  it("siirtää yöleimauksen seuraavalle päivälle", () => {
    expect(dayIn(HELSINKI, "2026-08-21T23:15:00.000Z")).toBe("2026-08-22");
  });

  it("pitää päiväleimauksen samana päivänä", () => {
    expect(dayIn(HELSINKI, "2026-08-21T07:02:00.000Z")).toBe("2026-08-21");
  });

  // Talviaika on UTC+2, kesäaika UTC+3. Sama kello eri siirtymä.
  it("huomioi talvi- ja kesäajan eron", () => {
    expect(dayIn(HELSINKI, "2026-01-15T22:30:00.000Z")).toBe("2026-01-16");
    expect(dayIn(HELSINKI, "2026-07-15T22:30:00.000Z")).toBe("2026-07-16");
    expect(dayIn(HELSINKI, "2026-01-15T21:30:00.000Z")).toBe("2026-01-15");
    expect(dayIn(HELSINKI, "2026-07-15T21:30:00.000Z")).toBe("2026-07-16");
  });
});

describe("kellonaika ravintolan ajassa", () => {
  it("näyttää paikallisen ajan eikä UTC:tä", () => {
    expect(timeIn(HELSINKI, "2026-08-21T07:02:00.000Z")).toBe("10:02");
    expect(timeIn(HELSINKI, "2026-08-21T15:01:00.000Z")).toBe("18:01");
  });

  it("näkyy myös leimauslistassa", () => {
    expect(formatTimeOfDay("2026-08-21T07:02:00.000Z", HELSINKI)).toBe("10:02");
  });

  it("näyttää keskiyön jälkeisen ajan oikein", () => {
    expect(timeIn(HELSINKI, "2026-08-21T23:15:00.000Z")).toBe("02:15");
  });
});

describe("viikonpäivä ja minuutit", () => {
  /*
   * Lauantai- ja sunnuntailisät määräytyvät paikallisesta
   * viikonpäivästä. Lauantai-illan leimaus 22:00 Helsingissä on
   * sunnuntai UTC:ssä vasta 21:00 jälkeen — väärä vuorokausi tarkoittaa
   * väärän suuruista lisää.
   */
  it("lukee viikonpäivän paikallisesti", () => {
    // 2026-08-22 on lauantai.
    expect(weekdayIn(HELSINKI, "2026-08-22T18:00:00.000Z")).toBe(6);
    // Lauantai 23:30 paikallista = sunnuntai UTC:ssä? Ei: 20:30Z.
    expect(weekdayIn(HELSINKI, "2026-08-22T20:30:00.000Z")).toBe(6);
    // Sunnuntain puolelle mennään paikallisesti vasta 21:00Z jälkeen.
    expect(weekdayIn(HELSINKI, "2026-08-22T21:30:00.000Z")).toBe(7);
  });

  it("laskee minuutit keskiyöstä paikallisesti", () => {
    expect(minutesOfDayIn(HELSINKI, "2026-08-21T07:02:00.000Z")).toBe(
      10 * 60 + 2,
    );
    expect(minutesOfDayIn(HELSINKI, "2026-08-21T23:15:00.000Z")).toBe(
      2 * 60 + 15,
    );
  });
});

describe("tapahtumien päiväkohtainen rajaus", () => {
  const events = [
    ev("in", "2026-08-21T20:00:00.000Z"), // 23:00 paikallista, 21. pv
    ev("out", "2026-08-21T23:15:00.000Z"), // 02:15 paikallista, 22. pv
  ];

  it("poimii illan leimauksen oikealle päivälle", () => {
    expect(
      eventsOnDate(events, "2026-08-21", HELSINKI).map((e) => e.type),
    ).toEqual(["in"]);
  });

  it("poimii yöleimauksen seuraavalle päivälle", () => {
    expect(
      eventsOnDate(events, "2026-08-22", HELSINKI).map((e) => e.type),
    ).toEqual(["out"]);
  });

  /*
   * Yön yli jatkuva vuoro jakautuu kahdelle päivälle.
   *
   * Tämä on tarkoituksellista: päiväkohtainen laskenta on se mikä pitää
   * palkkakauden rajat kohdallaan. Kokonaiskesto saadaan aikaväliltä,
   * ei yksittäiseltä päivältä.
   */
  it("ei laske ulos-leimausta edellisen päivän tunteihin", () => {
    const worked = workedOnDate(
      events,
      "2026-08-21",
      "2026-08-22T06:00:00.000Z",
      HELSINKI,
    );
    // Vain sisäänleimaus osuu 21. päivälle, joten jakso jää auki.
    expect(worked.workedMs).toBeGreaterThan(0);
  });
});

describe("hakuikkunan alku", () => {
  /*
   * Tämä ansa on purrut kolmesti: jaetussa kontekstissa, palkkakauden
   * latauksessa ja työajan korjauksessa.
   *
   * Kantakysely rajaa UTC-aikaleimoja, mutta päivä on paikallinen. Klo
   * 01:50 Helsingissä tehty leimaus on edellisen UTC-päivän puolella,
   * joten `${paiva}T00:00:00Z` jättää yön ensimmäiset tunnit pois.
   * Yövuorolainen ei nähnyt omaa sisäänleimaustaan.
   */
  it("alkaa vuorokautta ennen pyydettyä päivää", () => {
    expect(windowStartIso("2026-08-24")).toBe("2026-08-23T00:00:00.000Z");
  });

  it("kattaa yöleimauksen joka on edellisen UTC-päivän puolella", () => {
    const leimaus = "2026-08-23T22:50:00.000Z"; // 24.8. klo 01:50 Helsingissä

    // Päivä on paikallisesti 24., mutta naiivi raja jättäisi sen pois.
    expect(dayIn(HELSINKI, leimaus)).toBe("2026-08-24");
    expect(leimaus >= "2026-08-24T00:00:00.000Z").toBe(false);
    expect(leimaus >= windowStartIso("2026-08-24")).toBe(true);
  });

  it("toimii kuukauden vaihteessa", () => {
    expect(windowStartIso("2026-09-01")).toBe("2026-08-31T00:00:00.000Z");
  });
});

describe("muu vyöhyke", () => {
  // Moduuli ei saa olettaa Suomea: ravintolan vyöhyke tulee kannasta.
  it("noudattaa annettua vyöhykettä", () => {
    expect(dayIn("UTC", "2026-08-21T23:15:00.000Z")).toBe("2026-08-21");
    expect(timeIn("UTC", "2026-08-21T23:15:00.000Z")).toBe("23:15");
    expect(dayIn("America/New_York", "2026-08-21T03:15:00.000Z")).toBe(
      "2026-08-20",
    );
  });
});

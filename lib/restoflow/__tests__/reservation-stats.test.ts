import { describe, expect, it } from "vitest";
import {
  CANCEL_WATCH,
  MIN_DAYS_FOR_PATTERN,
  MIN_FOR_PATTERN,
  MIN_FOR_RATE,
  averageParty,
  busiestHours,
  busiestWeekdays,
  cancellationRate,
  findingsFor,
  noShowRate,
  occupancyForWeekday,
  occupancyRate,
  peakWindow,
  perOpenDay,
  quietWindow,
  type ReservationStats,
  type StatsOccupancy,
  type StatsTotals,
} from "../reservation-stats";

// ---------------------------------------------------------------------------
// Apurit
// ---------------------------------------------------------------------------

function totals(osat: Partial<StatsTotals> = {}): StatsTotals {
  return {
    reservations: 0,
    cancelled: 0,
    noShow: 0,
    realised: 0,
    upcoming: 0,
    guests: 0,
    partySum: 0,
    partyCount: 0,
    ...osat,
  };
}

function stats(osat: Partial<ReservationStats> = {}): ReservationStats {
  return {
    from: "2026-10-05",
    to: "2026-10-18",
    days: 14,
    capacity: { seats: 40, tables: 10 },
    totals: totals(),
    bySource: [],
    byHour: [],
    byWeekday: [],
    occupancy: [],
    ...osat,
  };
}

/** Täyttöasterivit yhdelle viikonpäivälle: osuus paikoista per tunti. */
function tunnit(
  weekday: number,
  osuudet: Record<number, number>,
  seats = 40,
  days = 4,
): StatsOccupancy[] {
  return Object.entries(osuudet).map(([hour, osuus]) => ({
    weekday,
    hour: Number(hour),
    seats: Math.round(osuus * seats * 100) / 100,
    days,
  }));
}

// ---------------------------------------------------------------------------
// Osuudet
// ---------------------------------------------------------------------------

describe("averageParty", () => {
  it("jakaa paikat seurueiden määrällä", () => {
    expect(averageParty(totals({ partySum: 15, partyCount: 4 }))).toBe(3.75);
  });

  it("on tyhjä ilman seurueita", () => {
    expect(averageParty(totals())).toBeNull();
  });
});

describe("cancellationRate", () => {
  it("on peruutukset kaikista varauksista", () => {
    expect(cancellationRate(totals({ reservations: 20, cancelled: 3 }))).toBe(
      0.15,
    );
  });

  it("on tyhjä ilman varauksia", () => {
    expect(cancellationRate(totals())).toBeNull();
  });
});

describe("noShowRate", () => {
  it("jättää perutut jakajan ulkopuolelle", () => {
    /*
     * 20 varausta, 10 peruttu, 1 jäi saapumatta.
     *
     * Kaikista laskien 5 %, mutta peruttu varaus ei voinut jäädä
     * saapumatta: oikea jakaja on 10 ja luku 10 %.
     */
    const t = totals({ reservations: 20, cancelled: 10, noShow: 1 });
    expect(noShowRate(t)).toBe(0.1);
  });

  it("on tyhjä kun kaikki peruttiin", () => {
    expect(noShowRate(totals({ reservations: 5, cancelled: 5 }))).toBeNull();
  });

  it("ei parane peruutuslinkin ansiosta", () => {
    /*
     * Sama määrä tyhjiä pöytiä, enemmän peruutuksia. Jos peruutukset
     * olisivat jakajassa, luku putoaisi ilman että yksikään pöytä jäi
     * tyhjäksi vähemmän.
     */
    const vahan = totals({ reservations: 20, cancelled: 2, noShow: 2 });
    const paljon = totals({ reservations: 20, cancelled: 8, noShow: 2 });

    expect(noShowRate(vahan)).toBeCloseTo(2 / 18, 10);
    expect(noShowRate(paljon)).toBeCloseTo(2 / 12, 10);
    expect(noShowRate(paljon)!).toBeGreaterThan(noShowRate(vahan)!);
  });
});

describe("occupancyRate", () => {
  it("suhteuttaa paikat salin kokoon", () => {
    const rivi: StatsOccupancy = { weekday: 5, hour: 18, seats: 36, days: 4 };
    expect(occupancyRate(rivi, { seats: 40, tables: 10 })).toBe(0.9);
  });

  it("on tyhjä ilman pöytiä", () => {
    const rivi: StatsOccupancy = { weekday: 5, hour: 18, seats: 0, days: 4 };
    expect(occupancyRate(rivi, { seats: 0, tables: 0 })).toBeNull();
  });
});

describe("perOpenDay", () => {
  it("jakaa aukiolopäivillä eikä kalenteripäivillä", () => {
    const rivi = {
      weekday: 5,
      reservations: 12,
      guests: 40,
      days: 4,
      openDays: 3,
    };
    expect(perOpenDay(rivi)).toBe(4);
  });

  it("on tyhjä kun päivä oli aina kiinni", () => {
    const rivi = {
      weekday: 1,
      reservations: 2,
      guests: 5,
      days: 4,
      openDays: 0,
    };
    expect(perOpenDay(rivi)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Järjestykset
// ---------------------------------------------------------------------------

describe("busiestHours", () => {
  const s = stats({
    byHour: [
      { hour: 17, reservations: 2, guests: 5 },
      { hour: 18, reservations: 9, guests: 30 },
      { hour: 19, reservations: 9, guests: 28 },
      { hour: 20, reservations: 4, guests: 10 },
      { hour: 21, reservations: 0, guests: 0 },
    ],
  });

  it("järjestää määrän mukaan", () => {
    expect(busiestHours(s, 2).map((row) => row.hour)).toEqual([18, 19]);
  });

  it("nostaa tasatilanteessa aikaisemman", () => {
    expect(busiestHours(s, 1)[0].hour).toBe(18);
  });

  it("jättää tyhjät tunnit pois", () => {
    expect(busiestHours(s, 10).map((row) => row.hour)).toEqual([18, 19, 20, 17]);
  });
});

describe("busiestWeekdays", () => {
  it("vertaa varauksia aukiolopäivää kohti", () => {
    /*
     * Lauantaita oli auki vain kerran mutta silloin kymmenen varausta.
     * Perjantaita neljä kertaa ja yhteensä kaksitoista. Lauantai on
     * vilkkaampi päivä, vaikka yhteismäärä sanoo toisin.
     */
    const s = stats({
      byWeekday: [
        { weekday: 5, reservations: 12, guests: 40, days: 4, openDays: 4 },
        { weekday: 6, reservations: 10, guests: 30, days: 4, openDays: 1 },
      ],
    });

    expect(busiestWeekdays(s).map((row) => row.weekday)).toEqual([6, 5]);
  });

  it("ohittaa päivät jotka olivat kiinni", () => {
    const s = stats({
      byWeekday: [
        { weekday: 1, reservations: 3, guests: 9, days: 4, openDays: 0 },
        { weekday: 5, reservations: 4, guests: 12, days: 4, openDays: 4 },
      ],
    });

    expect(busiestWeekdays(s).map((row) => row.weekday)).toEqual([5]);
  });
});

describe("occupancyForWeekday", () => {
  it("poimii yhden päivän tunnit järjestyksessä", () => {
    const s = stats({
      occupancy: [
        ...tunnit(6, { 18: 0.2 }),
        ...tunnit(5, { 20: 0.4, 18: 0.9, 19: 0.8 }),
      ],
    });

    expect(occupancyForWeekday(s, 5).map((row) => row.hour)).toEqual([
      18, 19, 20,
    ]);
  });
});

// ---------------------------------------------------------------------------
// Ruuhka
// ---------------------------------------------------------------------------

describe("peakWindow", () => {
  it("laajentaa huipun ajanjaksoksi", () => {
    /* 18 ja 19 ovat lähellä toisiaan, 20 selvästi alempi. */
    const s = stats({
      occupancy: tunnit(5, { 17: 0.3, 18: 0.92, 19: 0.88, 20: 0.4 }),
    });

    const w = peakWindow(s, 5)!;
    expect(w.fromHour).toBe(18);
    expect(w.toHour).toBe(19);
    expect(w.rate).toBeCloseTo(0.9, 2);
  });

  it("on yksi tunti kun ruuhka on yksi tunti", () => {
    const s = stats({
      occupancy: tunnit(5, { 17: 0.1, 18: 0.9, 19: 0.2 }),
    });

    const w = peakWindow(s, 5)!;
    expect(w.fromHour).toBe(18);
    expect(w.toHour).toBe(18);
  });

  it("ei kerro kuviota yhdestä päivästä", () => {
    const s = stats({
      occupancy: tunnit(5, { 18: 0.9 }, 40, MIN_DAYS_FOR_PATTERN - 1),
    });

    expect(peakWindow(s, 5)).toBeNull();
  });

  it("on tyhjä kun päivänä ei ollut ketään", () => {
    const s = stats({ occupancy: tunnit(5, { 18: 0, 19: 0 }) });
    expect(peakWindow(s, 5)).toBeNull();
  });

  it("on tyhjä kun salissa ei ole paikkoja", () => {
    const s = stats({
      capacity: { seats: 0, tables: 0 },
      occupancy: tunnit(5, { 18: 0.9 }),
    });

    expect(peakWindow(s, 5)).toBeNull();
  });

  it("on tyhjä päivälle jota ei ollut auki", () => {
    const s = stats({ occupancy: tunnit(5, { 18: 0.9 }) });
    expect(peakWindow(s, 1)).toBeNull();
  });
});

describe("quietWindow", () => {
  it("löytää ruuhkan jälkeisen tyhjän loppuillan", () => {
    const s = stats({
      occupancy: tunnit(6, { 18: 0.9, 19: 0.8, 20: 0.2, 21: 0.1 }),
    });

    const w = quietWindow(s, 6)!;
    expect(w.fromHour).toBe(20);
    expect(w.toHour).toBe(21);
    expect(w.rate).toBeCloseTo(0.15, 2);
  });

  it("ei kerro aukiolon alun hiljaisuudesta", () => {
    /*
     * Alkuilta on tyhjä ja loppuilta täysi. Se ei ole käyttämätöntä
     * kapasiteettia vaan se hetki jolloin ravintola avaa ovet.
     */
    const s = stats({
      occupancy: tunnit(6, { 16: 0.05, 17: 0.1, 18: 0.9, 19: 0.85 }),
    });

    expect(quietWindow(s, 6)).toBeNull();
  });

  it("on tyhjä kun ilta pysyy täytenä loppuun", () => {
    const s = stats({
      occupancy: tunnit(6, { 18: 0.9, 19: 0.85, 20: 0.8 }),
    });

    expect(quietWindow(s, 6)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Havainnot
// ---------------------------------------------------------------------------

describe("findingsFor", () => {
  it("ei sano mitään kolmesta varauksesta", () => {
    const s = stats({
      totals: totals({
        reservations: 3,
        guests: 8,
        partySum: 8,
        partyCount: 3,
        cancelled: 1,
      }),
    });

    expect(findingsFor(s)).toEqual([]);
  });

  it("kertoo ruuhkaisimman päivän ja ajan", () => {
    const s = stats({
      byWeekday: [
        { weekday: 5, reservations: 20, guests: 60, days: 4, openDays: 4 },
        { weekday: 6, reservations: 8, guests: 24, days: 4, openDays: 4 },
      ],
      occupancy: [
        ...tunnit(5, { 18: 0.92, 19: 0.9, 20: 0.3 }),
        ...tunnit(6, { 18: 0.4, 19: 0.35 }),
      ],
    });

    const havainto = findingsFor(s).find((h) => h.kind === "peak")!;
    expect(havainto.weekday).toBe(5);
    expect(havainto.fromHour).toBe(18);
    /* Loppu on tunnin loppu: tunnit 18 ja 19 ovat "18–20". */
    expect(havainto.toHour).toBe(20);
    expect(havainto.value).toBeCloseTo(0.91, 2);
  });

  it("ei kutsu kuvioksi yhden seurueen iltaa", () => {
    /*
     * Viisi sunnuntaita auki, kaksi varausta. Täyttöaste on laskuna
     * oikein, mutta "sunnuntaisin" väittäisi tavasta jota kahdesta
     * illasta ei näe.
     */
    const s = stats({
      byWeekday: [
        {
          weekday: 7,
          reservations: MIN_FOR_PATTERN - 1,
          guests: 11,
          days: 5,
          openDays: 5,
        },
      ],
      occupancy: tunnit(7, { 18: 0.44, 19: 0.44, 20: 0.4 }, 40, 5),
    });

    expect(findingsFor(s).some((h) => h.kind === "peak")).toBe(false);

    /* Yksi varaus lisää ja sama aineisto kelpaa. */
    const riittava = stats({
      ...s,
      byWeekday: [
        {
          weekday: 7,
          reservations: MIN_FOR_PATTERN,
          guests: 11,
          days: 5,
          openDays: 5,
        },
      ],
    });

    expect(findingsFor(riittava).some((h) => h.kind === "peak")).toBe(true);
  });

  it("kertoo hiljaisen loppuillan samasta päivästä", () => {
    const s = stats({
      byWeekday: [
        { weekday: 6, reservations: 20, guests: 60, days: 4, openDays: 4 },
      ],
      occupancy: tunnit(6, { 18: 0.9, 19: 0.85, 20: 0.15, 21: 0.1 }),
    });

    const havainto = findingsFor(s).find((h) => h.kind === "quiet")!;
    expect(havainto.weekday).toBe(6);
    expect(havainto.fromHour).toBe(20);
    expect(havainto.toHour).toBe(22);
  });

  it("nostaa no-show'n vasta riittävällä aineistolla", () => {
    const vahan = stats({
      totals: totals({
        reservations: MIN_FOR_RATE - 1,
        noShow: 2,
        partyCount: 7,
        partySum: 20,
      }),
    });
    expect(findingsFor(vahan).some((h) => h.kind === "noShow")).toBe(false);

    const riittava = stats({
      totals: totals({
        reservations: 40,
        noShow: 4,
        partyCount: 36,
        partySum: 100,
      }),
    });
    const havainto = findingsFor(riittava).find((h) => h.kind === "noShow")!;
    expect(havainto.value).toBeCloseTo(0.1, 10);
    expect(havainto.sample).toBe(40);
    expect(havainto.tone).toBe("watch");
  });

  it("vaikenee tavallisesta peruutusmäärästä", () => {
    const s = stats({
      totals: totals({
        reservations: 100,
        cancelled: Math.floor(CANCEL_WATCH * 100) - 1,
        partyCount: 90,
        partySum: 250,
      }),
    });

    expect(findingsFor(s).some((h) => h.kind === "cancelled")).toBe(false);
  });

  it("kertoo verkkovarausten osuuden", () => {
    const s = stats({
      totals: totals({
        reservations: 40,
        partyCount: 40,
        partySum: 120,
      }),
      bySource: [
        { source: "admin", count: 30 },
        { source: "widget", count: 8 },
        { source: "link", count: 2 },
      ],
    });

    const havainto = findingsFor(s).find((h) => h.kind === "online")!;
    expect(havainto.value).toBeCloseTo(0.25, 10);
  });

  it("ei mainitse verkkoa jos sitä ei käytetty", () => {
    const s = stats({
      totals: totals({ reservations: 40, partyCount: 40, partySum: 120 }),
      bySource: [{ source: "admin", count: 40 }],
    });

    expect(findingsFor(s).some((h) => h.kind === "online")).toBe(false);
  });

  it("kertoo keskimääräisen seuruekoon", () => {
    const s = stats({
      totals: totals({ reservations: 40, partyCount: 40, partySum: 130 }),
    });

    const havainto = findingsFor(s).find((h) => h.kind === "party")!;
    expect(havainto.value).toBeCloseTo(3.25, 10);
  });

  it("antaa jokaiselle havainnolle oman tunnisteen", () => {
    const s = stats({
      byWeekday: [
        { weekday: 5, reservations: 40, guests: 120, days: 4, openDays: 4 },
      ],
      occupancy: tunnit(5, { 18: 0.9, 19: 0.85, 20: 0.1 }),
      totals: totals({
        reservations: 40,
        cancelled: 10,
        noShow: 4,
        partyCount: 26,
        partySum: 80,
      }),
      bySource: [
        { source: "admin", count: 20 },
        { source: "widget", count: 20 },
      ],
    });

    const havainnot = findingsFor(s);
    const tunnisteet = havainnot.map((h) => h.id);
    expect(new Set(tunnisteet).size).toBe(tunnisteet.length);
    expect(havainnot.length).toBeGreaterThan(3);
  });
});

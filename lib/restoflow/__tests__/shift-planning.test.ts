import { describe, expect, it } from "vitest";
import {
  findOverlaps,
  formatPlanned,
  isLive,
  overlaps,
  plannedMinutes,
  planSummary,
  publicationOf,
  removalOutcome,
} from "../shift-planning";
import type { Shift, User } from "../types";

function user(id: string, name: string, rate: number | null = 1500): User {
  return {
    id,
    restaurantId: "r",
    name,
    initials: name.slice(0, 2).toUpperCase(),
    role: "employee",
    position: "waiter",
    hourlyRateCents: rate,
    active: true,
  };
}

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
    cancelledAt: null,
    ...partial,
  };
}

const ali = user("u1", "Ali");
const irem = user("u2", "Irem");

describe("publicationOf", () => {
  it("tunnistaa luonnoksen", () => {
    expect(publicationOf(shift({ publishedAt: null }))).toBe("draft");
    expect(isLive(shift({ publishedAt: null }))).toBe(false);
  });

  it("tunnistaa julkaistun", () => {
    expect(publicationOf(shift())).toBe("published");
    expect(isLive(shift())).toBe(true);
  });

  /*
   * Peruutus voittaa julkaisun.
   *
   * Peruttu vuoro on ollut julkaistu, mutta sitä ei enää tehdä.
   * Lukijalle olennaisin tieto on peruutus.
   */
  it("tunnistaa perutun myös julkaistusta", () => {
    const cancelled = shift({ cancelledAt: "2026-08-25T08:00:00.000Z" });

    expect(publicationOf(cancelled)).toBe("cancelled");
    expect(isLive(cancelled)).toBe(false);
  });
});

describe("plannedMinutes", () => {
  it("vähentää tauon", () => {
    expect(plannedMinutes(shift({ breakMinutes: 30 }))).toBe(7 * 60 + 30);
  });

  it("laskee ilman taukoa koko keston", () => {
    expect(plannedMinutes(shift())).toBe(8 * 60);
  });

  it("laskee yön yli menevän vuoron", () => {
    expect(plannedMinutes(shift({ startTime: "22:00", endTime: "02:00" }))).toBe(4 * 60);
  });

  /*
   * Kirjausvirhe ei saa levitä summiin.
   *
   * Kahdeksan tunnin tauko neljän tunnin vuorolla on virhe, ja
   * negatiivinen työaika vähentäisi muiden tunteja jokaisessa
   * yhteenvedossa.
   */
  it("ei mene negatiiviseksi liian pitkällä tauolla", () => {
    expect(plannedMinutes(shift({ endTime: "14:00", breakMinutes: 600 }))).toBe(0);
  });
});

describe("overlaps", () => {
  it("tunnistaa saman päivän päällekkäisyyden", () => {
    const a = shift({ id: "a", startTime: "10:00", endTime: "18:00" });
    const b = shift({ id: "b", startTime: "16:00", endTime: "22:00" });

    expect(overlaps(a, b)).toBe(true);
    expect(overlaps(b, a)).toBe(true);
  });

  /*
   * Peräkkäiset vuorot eivät ole päällekkäisiä.
   *
   * 10–18 ja 18–22 tehdään joka ilta. Varoitus niistä opettaisi
   * ohittamaan varoitukset.
   */
  it("ei pidä peräkkäisiä vuoroja päällekkäisinä", () => {
    const a = shift({ id: "a", startTime: "10:00", endTime: "18:00" });
    const b = shift({ id: "b", startTime: "18:00", endTime: "22:00" });

    expect(overlaps(a, b)).toBe(false);
  });

  /*
   * Keskiyön yli menevä vuoro törmää seuraavan päivän aamuvuoroon.
   *
   * Päivän sisällä vertailtuna 22–02 ja 01–09 näyttäisivät eri
   * päivien vuoroilta eivätkä osuisi toisiinsa lainkaan.
   */
  it("tunnistaa yövuoron ja seuraavan aamun päällekkäisyyden", () => {
    const yo = shift({ id: "a", date: "2026-09-01", startTime: "22:00", endTime: "02:00" });
    const aamu = shift({ id: "b", date: "2026-09-02", startTime: "01:00", endTime: "09:00" });

    expect(overlaps(yo, aamu)).toBe(true);
  });

  it("ei näe päällekkäisyyttä yövuoron jälkeisessä myöhemmässä vuorossa", () => {
    const yo = shift({ id: "a", date: "2026-09-01", startTime: "22:00", endTime: "02:00" });
    const paiva = shift({ id: "b", date: "2026-09-02", startTime: "10:00", endTime: "18:00" });

    expect(overlaps(yo, paiva)).toBe(false);
  });

  it("ei vertaa kaukaisia päiviä", () => {
    const a = shift({ id: "a", date: "2026-09-01" });
    const b = shift({ id: "b", date: "2026-09-20" });

    expect(overlaps(a, b)).toBe(false);
  });
});

describe("findOverlaps", () => {
  it("löytää saman ihmisen päällekkäiset vuorot", () => {
    const pairs = findOverlaps(
      [
        shift({ id: "a", startTime: "10:00", endTime: "18:00" }),
        shift({ id: "b", startTime: "16:00", endTime: "22:00" }),
      ],
      [ali],
    );

    expect(pairs).toHaveLength(1);
    expect(pairs[0].user?.name).toBe("Ali");
  });

  it("ei sekoita eri ihmisiä", () => {
    const pairs = findOverlaps(
      [
        shift({ id: "a", userId: "u1", startTime: "10:00", endTime: "18:00" }),
        shift({ id: "b", userId: "u2", startTime: "16:00", endTime: "22:00" }),
      ],
      [ali, irem],
    );

    expect(pairs).toEqual([]);
  });

  it("ohittaa perutut vuorot", () => {
    const pairs = findOverlaps(
      [
        shift({ id: "a", startTime: "10:00", endTime: "18:00" }),
        shift({
          id: "b",
          startTime: "16:00",
          endTime: "22:00",
          cancelledAt: "2026-08-25T08:00:00.000Z",
        }),
      ],
      [ali],
    );

    expect(pairs).toEqual([]);
  });

  it("ohittaa avoimet vuorot", () => {
    const pairs = findOverlaps(
      [
        shift({ id: "a", userId: "", startTime: "10:00", endTime: "18:00" }),
        shift({ id: "b", userId: "", startTime: "16:00", endTime: "22:00" }),
      ],
      [ali],
    );

    expect(pairs).toEqual([]);
  });

  it("varoittaa myös luonnoksesta", () => {
    // Luonnos on jo suunnitelmaa: päällekkäisyys korjataan ennen
    // julkaisua, ei sen jälkeen.
    const pairs = findOverlaps(
      [
        shift({ id: "a", startTime: "10:00", endTime: "18:00", publishedAt: null }),
        shift({ id: "b", startTime: "16:00", endTime: "22:00", publishedAt: null }),
      ],
      [ali],
    );

    expect(pairs).toHaveLength(1);
  });
});

describe("planSummary", () => {
  it("laskee ihmiset, vuorot ja tunnit", () => {
    const s = planSummary({
      shifts: [
        shift({ id: "a", userId: "u1" }),
        shift({ id: "b", userId: "u1", date: "2026-09-02" }),
        shift({ id: "c", userId: "u2" }),
      ],
      users: [ali, irem],
    });

    expect(s.people).toBe(2);
    expect(s.shiftCount).toBe(3);
    expect(s.plannedMinutes).toBe(24 * 60);
  });

  it("erottelee luonnokset, julkaistut ja perutut", () => {
    const s = planSummary({
      shifts: [
        shift({ id: "a", publishedAt: null }),
        shift({ id: "b" }),
        shift({ id: "c", cancelledAt: "2026-08-25T08:00:00.000Z" }),
      ],
      users: [ali],
    });

    expect(s.draftCount).toBe(1);
    expect(s.publishedCount).toBe(1);
    expect(s.cancelledCount).toBe(1);
  });

  it("ei laske peruttua tunteihin", () => {
    const s = planSummary({
      shifts: [
        shift({ id: "a" }),
        shift({ id: "b", date: "2026-09-02", cancelledAt: "2026-08-25T08:00:00.000Z" }),
      ],
      users: [ali],
    });

    expect(s.plannedMinutes).toBe(8 * 60);
  });

  it("laskee työvoimakustannuksen tuntipalkasta ja tauon jälkeen", () => {
    const s = planSummary({
      shifts: [shift({ breakMinutes: 30 })],
      users: [ali],
    });

    // 7,5 h × 15,00 € = 112,50 €
    expect(s.labourCostCents).toBe(11250);
    expect(s.missingRates).toBe(0);
  });

  /*
   * Vajaa arvio on kerrottava.
   *
   * Ilman tuntipalkkaa oleva ei kerrytä kustannusta, ja luku
   * näyttäisi täydeltä vaikka siitä puuttuisi puolet henkilöstöstä.
   */
  it("kertoo montako on ilman tuntipalkkaa", () => {
    const s = planSummary({
      shifts: [shift({ userId: "u1" }), shift({ id: "b", userId: "u2" })],
      users: [ali, user("u2", "Irem", null)],
    });

    expect(s.labourCostCents).toBe(12000);
    expect(s.missingRates).toBe(1);
  });

  it("laskee avoimet vuorot omaksi luvukseen", () => {
    const s = planSummary({
      shifts: [shift({ id: "a" }), shift({ id: "b", userId: "" })],
      users: [ali],
    });

    expect(s.openCount).toBe(1);
    expect(s.people).toBe(1);
  });

  it("kestää tyhjän kuukauden", () => {
    const s = planSummary({ shifts: [], users: [ali] });

    expect(s.people).toBe(0);
    expect(s.plannedMinutes).toBe(0);
    expect(s.labourCostCents).toBe(0);
  });
});

describe("formatPlanned", () => {
  it("näyttää tunnit ja minuutit", () => {
    expect(formatPlanned(450)).toBe("7 h 30 min");
    expect(formatPlanned(480)).toBe("8 h");
    expect(formatPlanned(45)).toBe("45 min");
    expect(formatPlanned(0)).toBe("0 min");
  });
});

/*
 * Poiston säännöt ovat samat yksittäin ja joukossa.
 *
 * Vahvistus lupaa mitä tapahtuu, ja juuri sen lupauksen takia
 * painiketta painetaan. Kanta noudattaa samoja sääntöjä.
 */
describe("removalOutcome", () => {
  const TANAAN = "2026-09-15";

  it("poistaa luonnoksen", () => {
    expect(removalOutcome([shift({ publishedAt: null, date: "2026-09-20" })], TANAAN))
      .toEqual({ removed: 1, cancelled: 0, blocked: 0 });
  });

  it("peruu julkaistun", () => {
    expect(removalOutcome([shift({ date: "2026-09-20" })], TANAAN))
      .toEqual({ removed: 0, cancelled: 1, blocked: 0 });
  });

  it("peruu julkaistun myös menneeltä päivältä", () => {
    // Peruutus ei pyyhi mitään: rivi säilyy peruttuna historiassa.
    expect(removalOutcome([shift({ date: "2026-09-01" })], TANAAN))
      .toEqual({ removed: 0, cancelled: 1, blocked: 0 });
  });

  it("suojaa menneen nimetyn luonnoksen", () => {
    expect(
      removalOutcome([shift({ publishedAt: null, date: "2026-09-01" })], TANAAN),
    ).toEqual({ removed: 0, cancelled: 0, blocked: 1 });
  });

  /*
   * Tekijätön vuoro ei ole kenenkään tehtyä työtä.
   *
   * Menneen päivän suoja on olemassa työn suojaksi, eikä avoimeen
   * vuoroon voi liittyä leimauksia.
   */
  it("poistaa menneen avoimen luonnoksen", () => {
    expect(
      removalOutcome(
        [shift({ publishedAt: null, date: "2026-09-01", userId: "" })],
        TANAAN,
      ),
    ).toEqual({ removed: 1, cancelled: 0, blocked: 0 });
  });

  it("ohittaa jo perutun", () => {
    expect(
      removalOutcome(
        [shift({ date: "2026-09-20", cancelledAt: "2026-09-10T08:00:00.000Z" })],
        TANAAN,
      ),
    ).toEqual({ removed: 0, cancelled: 0, blocked: 1 });
  });

  it("laskee sekalaisen valinnan oikein", () => {
    const outcome = removalOutcome(
      [
        shift({ id: "a", publishedAt: null, date: "2026-09-20" }),
        shift({ id: "b", publishedAt: null, date: "2026-09-21" }),
        shift({ id: "c", date: "2026-09-22" }),
        shift({ id: "d", publishedAt: null, date: "2026-09-01" }),
        shift({ id: "e", date: "2026-09-20", cancelledAt: "2026-09-10T08:00:00.000Z" }),
      ],
      TANAAN,
    );

    expect(outcome).toEqual({ removed: 2, cancelled: 1, blocked: 2 });
  });

  it("kestää tyhjän valinnan", () => {
    expect(removalOutcome([], TANAAN)).toEqual({ removed: 0, cancelled: 0, blocked: 0 });
  });
});

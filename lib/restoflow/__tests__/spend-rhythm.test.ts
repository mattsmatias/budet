import { describe, expect, it } from "vitest";
import { spendRhythm } from "../spend-rhythm";
import type { Receipt } from "../types";

/*
 * Kulurytmi.
 *
 * Elokuu 2026: 1.8. on lauantai, 3.8. maanantai, 6.8. torstai.
 */

const MONTH = "2026-08";
const TODAY = "2026-08-24";

let n = 0;

function receipt(date: string, totalCents: number): Receipt {
  n += 1;
  return {
    id: `r${n}`,
    restaurantId: "rest-1",
    date,
    totalCents,
    supplierId: "s-1",
    supplierName: "Tukku",
    vatCents: null,
    category: "food",
    paymentMethod: "card",
    receiptNumber: null,
    note: null,
    status: "confirmed",
    reviewReasons: [],
    items: [],
    addedByUserId: "u1",
    addedAt: `${date}T10:00:00.000Z`,
    hasImage: true,
    imagePath: null,
    pages: [],
    categoryId: null,
    imageQuality: "good",
  };
}

const rhythm = (receipts: Receipt[], today = TODAY) =>
  spendRhythm(receipts, MONTH, today, "fi");

// ---------------------------------------------------------------------------

describe("päivät", () => {
  it("antaa kuukauden jokaisen päivän", () => {
    const result = rhythm([]);
    expect(result.days).toHaveLength(31);
    expect(result.days[0].date).toBe("2026-08-01");
    expect(result.days[30].date).toBe("2026-08-31");
  });

  it("laskee päivän kulut ja kuittimäärän", () => {
    const result = rhythm([
      receipt("2026-08-06", 10_000),
      receipt("2026-08-06", 5_000),
    ]);
    const day = result.days.find((d) => d.date === "2026-08-06")!;

    expect(day.cents).toBe(15_000);
    expect(day.receipts).toBe(2);
  });

  /*
   * Kuluvan kuukauden loput päivät eivät ole kuluttomia vaan
   * tulematta. Ilman tätä eroa kuukauden loppu näyttäisi
   * romahdukselta joka kerta.
   */
  it("erottaa tulevan päivän kuluttomasta", () => {
    const result = rhythm([]);

    expect(result.days.find((d) => d.date === "2026-08-20")!.isFuture).toBe(
      false,
    );
    expect(result.days.find((d) => d.date === "2026-08-25")!.isFuture).toBe(
      true,
    );
    expect(result.days.find((d) => d.date === TODAY)!.isToday).toBe(true);
  });

  it("lukee viikonpäivän oikein", () => {
    const result = rhythm([]);
    // 3.8.2026 on maanantai, 9.8. sunnuntai.
    expect(result.days.find((d) => d.date === "2026-08-03")!.weekday).toBe(1);
    expect(result.days.find((d) => d.date === "2026-08-09")!.weekday).toBe(7);
  });

  it("ei laske tulevaa päivää aktiiviseksi", () => {
    const result = rhythm([receipt("2026-08-06", 10_000)]);
    expect(result.activeDays).toBe(1);
  });
});

describe("mittakaava", () => {
  it("antaa suurimman päivän ja summan", () => {
    const result = rhythm([
      receipt("2026-08-03", 20_000),
      receipt("2026-08-06", 50_000),
      receipt("2026-08-10", 10_000),
    ]);

    expect(result.maxCents).toBe(50_000);
    expect(result.totalCents).toBe(80_000);
    expect(result.busiestDay?.date).toBe("2026-08-06");
  });

  it("kestää tyhjän kuukauden", () => {
    const result = rhythm([]);
    expect(result.maxCents).toBe(0);
    expect(result.totalCents).toBe(0);
    expect(result.busiestDay).toBeNull();
    expect(result.peakWeekday).toBeNull();
  });
});

describe("viikonpäivän rytmi", () => {
  /*
   * Torstai 6.8., 13.8. ja 20.8. — kolme havaintoa ja selvä kasauma.
   */
  it("tunnistaa viikonpäivän jolle kulut kasautuvat", () => {
    const result = rhythm([
      receipt("2026-08-06", 100_000),
      receipt("2026-08-13", 100_000),
      receipt("2026-08-20", 100_000),
      receipt("2026-08-04", 5_000),
      receipt("2026-08-11", 5_000),
    ]);

    expect(result.peakWeekday?.label).toBe("torstai");
    expect(result.peakWeekday?.share).toBeGreaterThan(0.9);
  });

  /*
   * Yksi suurtilaus ei tee päivästä sääntöä. Ilman havaintorajaa
   * "torstait ovat kalleimmat" olisi arvaus joka näyttää tiedolta.
   */
  it("ei tee sääntöä yhdestä havainnosta", () => {
    const result = rhythm([
      receipt("2026-08-06", 100_000),
      receipt("2026-08-04", 5_000),
      receipt("2026-08-11", 5_000),
    ]);

    expect(result.peakWeekday).toBeNull();
  });

  /*
   * Seitsemästä viikonpäivästä yksi on aina suurin. Se ei tarkoita
   * mitään ellei ero ole selvä.
   */
  it("vaikenee kun kulut jakautuvat tasaisesti", () => {
    const result = rhythm([
      receipt("2026-08-03", 10_000),
      receipt("2026-08-04", 10_500),
      receipt("2026-08-05", 9_800),
      receipt("2026-08-06", 10_200),
      receipt("2026-08-10", 10_000),
      receipt("2026-08-11", 10_100),
      receipt("2026-08-12", 9_900),
      receipt("2026-08-13", 10_300),
    ]);

    expect(result.peakWeekday).toBeNull();
  });

  it("vaikenee kun kuluja on vain yhtenä viikonpäivänä", () => {
    // Yksi viikonpäivä ei ole rytmi vaan ainoa havainto.
    const result = rhythm([
      receipt("2026-08-06", 50_000),
      receipt("2026-08-13", 50_000),
    ]);

    expect(result.peakWeekday).toBeNull();
  });

  it("ei laske tulevia päiviä rytmiin", () => {
    const result = rhythm(
      [
        receipt("2026-08-06", 100_000),
        receipt("2026-08-13", 100_000),
        receipt("2026-08-27", 900_000),
        receipt("2026-08-04", 5_000),
        receipt("2026-08-11", 5_000),
      ],
      TODAY,
    );

    // 27.8. on tulevaisuudessa, joten se ei saa kääntää rytmiä torstailta.
    expect(result.peakWeekday?.label).toBe("torstai");
  });
});

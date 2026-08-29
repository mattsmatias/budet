import { describe, expect, it } from "vitest";
import {
  expenseObservation,
  greeting,
  salesObservation,
  shiftObservation,
} from "./briefing";
import { addDays } from "@/lib/restoflow/dates";
import type { Receipt, Shift } from "@/lib/restoflow/types";
import type { DailySales } from "@/lib/restoflow/sales";

const TANAAN = "2026-08-26";

function kuitti(date: string, totalCents: number): Receipt {
  return {
    id: `r-${date}-${totalCents}`,
    restaurantId: "x",
    supplierId: "s",
    supplierName: "Tukku",
    date,
    totalCents,
    vatCents: null,
    category: "food",
    categoryId: null,
    paymentMethod: "card",
    receiptNumber: null,
    note: null,
    status: "accepted",
    reviewReasons: [],
  } as unknown as Receipt;
}

function myynti(date: string, netCents: number): DailySales {
  return {
    date,
    netCents,
    targetCents: null,
    note: null,
    grossCents: null,
    vatCents: null,
  } as unknown as DailySales;
}

function vuoro(date: string, n: number): Shift {
  return {
    id: `s-${date}-${n}`,
    restaurantId: "x",
    userId: "u",
    date,
    startTime: "10:00",
    endTime: "18:00",
    location: "sali",
    status: "published",
  } as unknown as Shift;
}

/** n kuittia jokaiselle päivälle välillä [alku, alku+7). */
function viikonKuitit(alku: string, summaPerPaiva: number): Receipt[] {
  return Array.from({ length: 7 }, (_, i) => kuitti(addDays(alku, i), summaPerPaiva));
}

describe("expenseObservation", () => {
  /*
   * Vaikenee kun historiaa ei ole.
   *
   * Tämä on tärkein testi: keksitty havainto on pahempi kuin
   * puuttuva, koska sen perusteella tehdään päätöksiä.
   */
  it("ei sano mitään ilman neljää vertailuviikkoa", () => {
    const receipts = viikonKuitit(addDays(TANAAN, -7), 10_000);
    expect(expenseObservation(receipts, TANAAN)).toBeNull();
  });

  it("ei sano mitään jos yksikin vertailuviikko on tyhjä", () => {
    const receipts = [
      ...viikonKuitit(addDays(TANAAN, -7), 20_000),
      ...viikonKuitit(addDays(TANAAN, -14), 10_000),
      // −21…−28 puuttuu tarkoituksella
      ...viikonKuitit(addDays(TANAAN, -28), 10_000),
      ...viikonKuitit(addDays(TANAAN, -35), 10_000),
    ];
    expect(expenseObservation(receipts, TANAAN)).toBeNull();
  });

  it("vaikenee pienestä heilahduksesta", () => {
    const receipts = [
      ...viikonKuitit(addDays(TANAAN, -7), 10_500),
      ...viikonKuitit(addDays(TANAAN, -14), 10_000),
      ...viikonKuitit(addDays(TANAAN, -21), 10_000),
      ...viikonKuitit(addDays(TANAAN, -28), 10_000),
      ...viikonKuitit(addDays(TANAAN, -35), 10_000),
    ];
    expect(expenseObservation(receipts, TANAAN)).toBeNull();
  });

  it("huomaa selvän nousun ja kertoo suunnan", () => {
    const receipts = [
      ...viikonKuitit(addDays(TANAAN, -7), 15_000),
      ...viikonKuitit(addDays(TANAAN, -14), 10_000),
      ...viikonKuitit(addDays(TANAAN, -21), 10_000),
      ...viikonKuitit(addDays(TANAAN, -28), 10_000),
      ...viikonKuitit(addDays(TANAAN, -35), 10_000),
    ];

    const havainto = expenseObservation(receipts, TANAAN);
    expect(havainto).not.toBeNull();
    expect(havainto?.text).toContain("korkeammat");
    expect(havainto?.text).toContain("50 %");
    expect(havainto?.tone).toBe("warn");
  });

  it("ei pidä laskevia kuluja hälyttävinä", () => {
    const receipts = [
      ...viikonKuitit(addDays(TANAAN, -7), 5_000),
      ...viikonKuitit(addDays(TANAAN, -14), 10_000),
      ...viikonKuitit(addDays(TANAAN, -21), 10_000),
      ...viikonKuitit(addDays(TANAAN, -28), 10_000),
      ...viikonKuitit(addDays(TANAAN, -35), 10_000),
    ];

    const havainto = expenseObservation(receipts, TANAAN);
    expect(havainto?.text).toContain("matalammat");
    expect(havainto?.tone).toBe("neutral");
  });
});

describe("salesObservation", () => {
  it("vaatii kolme kirjattua päivää molemmilta viikoilta", () => {
    const sales = [
      myynti(addDays(TANAAN, -1), 100_000),
      myynti(addDays(TANAAN, -2), 100_000),
      myynti(addDays(TANAAN, -8), 50_000),
      myynti(addDays(TANAAN, -9), 50_000),
      myynti(addDays(TANAAN, -10), 50_000),
    ];
    expect(salesObservation(sales, TANAAN)).toBeNull();
  });

  it("huomaa myynnin laskun ja pitää sitä huomionarvoisena", () => {
    const sales = [
      ...[1, 2, 3, 4].map((i) => myynti(addDays(TANAAN, -i), 50_000)),
      ...[8, 9, 10, 11].map((i) => myynti(addDays(TANAAN, -i), 100_000)),
    ];

    const havainto = salesObservation(sales, TANAAN);
    expect(havainto?.text).toContain("matalampi");
    expect(havainto?.tone).toBe("warn");
  });

  it("ei pidä myynnin kasvua ongelmana", () => {
    const sales = [
      ...[1, 2, 3, 4].map((i) => myynti(addDays(TANAAN, -i), 100_000)),
      ...[8, 9, 10, 11].map((i) => myynti(addDays(TANAAN, -i), 50_000)),
    ];

    expect(salesObservation(sales, TANAAN)?.tone).toBe("neutral");
  });
});

describe("shiftObservation", () => {
  it("ei sano mitään ilman neljän viikon historiaa", () => {
    const shifts = [vuoro(addDays(TANAAN, 8), 1), vuoro(addDays(TANAAN, 9), 2)];
    expect(shiftObservation(shifts, TANAAN)).toBeNull();
  });

  /*
   * Kynnys on vuoroina eikä prosentteina.
   *
   * Pienessä ravintolassa yksi vuoro on kymmenen prosenttia, ja
   * prosenttikynnys nostaisi havainnon joka viikko.
   */
  it("vaikenee yhden vuoron erosta", () => {
    const shifts = [
      ...[1, 2, 3].map((i) => vuoro(addDays(TANAAN, 7 + i), i)),
      ...[1, 2, 3, 4].flatMap((viikko) =>
        [1, 2].map((i) => vuoro(addDays(TANAAN, -7 * viikko + i), i)),
      ),
    ];
    expect(shiftObservation(shifts, TANAAN)).toBeNull();
  });

  it("huomaa kun ensi viikolle on suunniteltu selvästi enemmän", () => {
    const shifts = [
      ...[1, 2, 3, 4, 5, 6].map((i) => vuoro(addDays(TANAAN, 7 + i), i)),
      ...[1, 2, 3, 4].flatMap((viikko) =>
        [1, 2].map((i) => vuoro(addDays(TANAAN, -7 * viikko + i), i)),
      ),
    ];

    const havainto = shiftObservation(shifts, TANAAN);
    expect(havainto?.text).toContain("enemmän");
    expect(havainto?.text).toContain("4 vuoroa");
  });
});

describe("greeting", () => {
  /*
   * Ravintolan aikavyöhykkeellä.
   *
   * Esihenkilö voi katsoa Katea toisessa maassa, eikä "hyvää yötä"
   * ole silloin totta ravintolassa.
   */
  it("kertoo ravintolan ajan eikä katsojan", () => {
    // 22:00 UTC = Helsingissä 01:00 seuraavaa vuorokautta, New Yorkissa 18:00.
    const klo = new Date("2026-08-26T22:00:00Z");
    expect(greeting(klo, "Europe/Helsinki")).toBe("Hyvää yötä");
    expect(greeting(klo, "America/New_York")).toBe("Hyvää iltaa");
  });

  it("vaihtaa tervehdyksen vuorokauden mukaan", () => {
    const hki = "Europe/Helsinki";
    expect(greeting(new Date("2026-08-26T04:00:00Z"), hki)).toBe("Hyvää huomenta");
    expect(greeting(new Date("2026-08-26T18:00:00Z"), hki)).toBe("Hyvää iltaa");
  });
});

import { describe, expect, it } from "vitest";
import { findTool, toolsFor } from "../tools";
import { formatMoney } from "@/lib/money";
import type { MattiContext } from "../context";
import type { RestaurantData } from "@/lib/restoflow/queries";
import type { DailySales } from "@/lib/restoflow/sales";
import type { Receipt } from "@/lib/restoflow/types";

/**
 * Päivän ohjaustyökalujen testit.
 *
 * Kolme viidestä työkalusta lukee vain kontekstin dataa, ja ne
 * ajetaan tässä oikeasti. Kaksi (briefing, työvoima) hakevat
 * palkkamoottorin kannasta, joten niistä tarkistetaan vain rakenne ja
 * oikeus — kannan takana oleva laskenta on todennettu payroll-testeissä.
 *
 * Tärkein yksittäinen väite tässä tiedostossa on se, ettei puuttuva
 * myynti muutu nollaksi missään kohtaa matkaa.
 */

const TZ = "Europe/Helsinki";
const TODAY = "2026-08-24";

function emptyData(partial: Partial<RestaurantData> = {}): RestaurantData {
  return {
    receipts: [], openShifts: [], users: [], suppliers: [], budgets: [],
    shifts: [], clockEvents: [], absences: [], closedMonths: [],
    categories: [], merchants: [], merchantCategories: [], sales: [],
    ...partial,
  };
}

function ctx(partial: Partial<RestaurantData> = {}): MattiContext {
  return {
    restaurantId: "rest-1",
    restaurantName: "Cafe Testi",
    role: "owner",
    userName: "Oktay",
    month: "2026-08",
    today: TODAY,
    now: `${TODAY}T09:00:00Z`,
    timezone: TZ,
    currentPage: null,
    data: emptyData(partial),
    lunchWeek: async () => null,
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
  };
}

function receipt(date: string, totalCents: number): Receipt {
  return {
    id: `r-${date}`, restaurantId: "rest-1", date, totalCents,
    supplierId: "s-1", supplierName: "Tukku", vatCents: null,
    category: "food", paymentMethod: "card", receiptNumber: null,
    note: null, status: "confirmed", reviewReasons: [], items: [],
    addedByUserId: "u1", addedAt: `${date}T10:00:00.000Z`,
    hasImage: true, imagePath: null, categoryId: null, imageQuality: "good",
  };
}

const run = (name: string, data: Partial<RestaurantData>, input: unknown = {}) =>
  findTool(name)!.run(ctx(data), input);

// ---------------------------------------------------------------------------

describe("työkalujen rekisteröinti", () => {
  it("tuntee kaikki viisi uutta työkalua", () => {
    for (const name of [
      "get_daily_briefing",
      "get_alerts",
      "get_sales",
      "get_labour_cost",
      "get_trends",
    ]) {
      expect(findTool(name), name).not.toBeNull();
      expect(findTool(name)!.level).toBe("read");
    }
  });

  /*
   * Kirjanpitäjä näkee myynnin muttei palkkoja: tuntipalkat ovat
   * henkilötietoa. Jos tämä testi kaatuu, rooliportissa on reikä.
   */
  it("ei anna kirjanpitäjälle työvoimakustannusta", () => {
    const names = toolsFor("accountant").map((t) => t.name);
    expect(names).toContain("get_sales");
    expect(names).toContain("get_alerts");
    expect(names).not.toContain("get_labour_cost");
  });

  it("ei anna työntekijälle mitään näistä", () => {
    expect(toolsFor("employee")).toEqual([]);
  });

  it("hylkää kelvottoman päivän myyntikyselystä", () => {
    const tool = findTool("get_sales")!;
    expect(tool.schema.safeParse({ from: "24.8.2026" }).success).toBe(false);
    expect(tool.schema.safeParse({ from: "2026-08-24" }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("get_sales", () => {
  it("kertoo päivän myynnin ja vertaa tavoitteeseen", async () => {
    const result = await run("get_sales", { sales: [sale(TODAY, 120_000, 100_000)] });

    expect(result.summary).toContain(formatMoney(120_000));
    expect(result.summary).toContain("20 % yli");
    expect(result.card?.value).toContain(formatMoney(120_000));
  });

  /*
   * Tämä on koko tiedoston tärkein testi. Puuttuva merkintä ei ole
   * nollamyynti, ja ero on se joka ratkaisee menikö päivä hyvin vai
   * eikö kukaan ehtinyt kirjata lukua.
   */
  it("ei muuta puuttuvaa myyntiä nollaksi", async () => {
    const result = await run("get_sales", {});

    expect(result.summary).toContain("ei ole kirjattu");
    expect(result.summary).not.toContain(formatMoney(0));
    expect((result.data as { totalCents: number | null }).totalCents).toBeNull();
  });

  it("laskee aikavälin yhteen", async () => {
    const result = await run(
      "get_sales",
      { sales: [sale("2026-08-20", 100_000), sale("2026-08-21", 50_000)] },
      { from: "2026-08-20", to: "2026-08-21" },
    );

    expect(result.summary).toContain(formatMoney(150_000));
    expect((result.data as { dayCount: number }).dayCount).toBe(2);
  });

  // Aikavälillä vertailukohtia olisi yhtä monta kuin päiviä, eikä
  // niistä synny yhtä vastausta. Vertailu kuuluu vain yhdelle päivälle.
  it("ei vertaa aikaväliä", async () => {
    const result = await run(
      "get_sales",
      { sales: [sale("2026-08-20", 100_000, 200_000), sale("2026-08-21", 50_000)] },
      { from: "2026-08-20", to: "2026-08-21" },
    );

    expect((result.data as { comparison: unknown }).comparison).toBeNull();
  });

  it("huomaa väärinpäin annetun aikavälin", async () => {
    const result = await run("get_sales", {}, { from: "2026-08-21", to: "2026-08-20" });
    expect(result.summary).toContain("väärinpäin");
  });

  it("kertoo kun vertailukohtaa ei ole", async () => {
    const result = await run("get_sales", { sales: [sale(TODAY, 80_000)] });
    expect(result.summary).toContain("Vertailukohtaa ei ole");
  });
});

// ---------------------------------------------------------------------------

describe("get_alerts", () => {
  /*
   * Tyhjä aineisto ei ole hyvä uutinen. Jos Matti vastaisi "ei
   * poikkeamia" tyhjään kantaan, hän vakuuttaisi että kaikki on
   * tarkastettu — vaikka mitään ei voitu tarkastaa.
   */
  it("erottaa arvioimattomuuden puhtaasta tilanteesta", async () => {
    const result = await run("get_alerts", {});

    expect(result.summary).toContain("ei voi arvioida");
    expect(result.summary).not.toContain("Avoimia poikkeamia ei ole");
  });

  it("listaa poikkeamat kun aineistoa on", async () => {
    const dup = receipt("2026-08-18", 8_720);
    const result = await run("get_alerts", {
      receipts: [dup, { ...dup, id: "r-toinen" }],
    });

    const data = result.data as { alerts: { kind: string }[] };
    expect(data.alerts.length).toBeGreaterThan(0);
    expect(result.card?.href).toBe("/admin/havainnot");
  });
});

// ---------------------------------------------------------------------------

describe("get_trends", () => {
  it("kertoo suoraan kun kuukausi on tyhjä", async () => {
    const result = await run("get_trends", {});
    expect(result.summary).toContain("ei sisällä yhtään kuittia");
  });

  it("kertoo kulujen muutoksen kun vertailukuukausi on olemassa", async () => {
    const result = await run("get_trends", {
      receipts: [
        receipt("2026-07-05", 30_000),
        receipt("2026-07-12", 30_000),
        receipt("2026-07-19", 30_000),
        receipt("2026-08-05", 90_000),
        receipt("2026-08-12", 90_000),
        receipt("2026-08-19", 90_000),
      ],
    });

    const data = result.data as { insights: { title: string }[] };
    expect(data.insights.length).toBeGreaterThan(0);
  });
});

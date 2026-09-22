import type { BusinessType } from "./business";
import type { ExpenseCategory, Receipt } from "./types";
import type { DailySales } from "./sales";
import { monthOf, previousMonth } from "./expenses";
import { addDays, monthRange } from "./dates";

/**
 * Toimialan tunnusluvut.
 *
 * MATTI EI SAA OLLA YLEISNEUVOJA.
 *
 * "Seuraa kulujasi" pätee jokaiseen yritykseen eikä auta yhtäkään.
 * Ravintoloitsija ohjaa raaka-aineprosentilla, kahvila tuotekatteella
 * ja keskiostoksella, parturi asiakasmäärällä ja hiljaisilla päivillä.
 * Tämä moduuli laskee ne luvut yrityksen omasta datasta, jotta Matti
 * voi vastata juuri siihen kysymykseen jota sen alan yrittäjä kysyy.
 *
 * KAIKKI LASKETAAN, MITÄÄN EI ARVATA.
 *
 * Jokainen luku tulee kuiteista ja myynnistä. Jos luvun laskemiseen ei
 * ole dataa, funktio palauttaa nullin ja syyn — ei arviota.
 *
 * VEROTON VEROTONTA VASTAAN.
 *
 * Myynti kirjataan verottomana, kuitit verollisina. Osuus lasketaan
 * kuittien verottomasta summasta, muuten 25,5 %:n ALV näkyisi
 * raaka-aineprosentissa neljänneksen liian suurena.
 */

// ---------------------------------------------------------------------------
// Verottomat kulut kategorioittain
// ---------------------------------------------------------------------------

function netOf(totalCents: number, vatCents: number | null, vatRate: number | null): number {
  if (vatCents !== null) return totalCents - vatCents;
  if (vatRate !== null && vatRate > 0) return Math.round(totalCents / (1 + vatRate));
  return totalCents;
}

/**
 * Verottomat kulut kategorioittain.
 *
 * Rivikohtaisesti kun rivejä on, kuten totalsByCategory: sekakuitin
 * ruoka ja pesuaine menevät eri luokkiin.
 */
export function netCostsByCategory(
  receipts: Receipt[],
): Map<ExpenseCategory, number> {
  const totals = new Map<ExpenseCategory, number>();
  const add = (category: ExpenseCategory, cents: number) =>
    totals.set(category, (totals.get(category) ?? 0) + cents);

  for (const receipt of receipts) {
    const itemsSum = receipt.items.reduce((s, i) => s + i.totalCents, 0);
    if (receipt.items.length > 0 && itemsSum > 0) {
      for (const item of receipt.items) {
        add(item.category, netOf(item.totalCents, item.vatCents, item.vatRate));
      }
    } else {
      add(receipt.category, netOf(receipt.totalCents, receipt.vatCents, null));
    }
  }
  return totals;
}

// ---------------------------------------------------------------------------
// Tunnusluvut
// ---------------------------------------------------------------------------

export type RatioKey = "goods" | "staff" | "prime" | "products" | "rent";

/**
 * Nyrkkisääntö, ei tavoite.
 *
 * Vain alan yleisesti käyttämät vaihteluvälit: ravintolan ja kahvilan
 * raaka-aine- ja henkilöstöosuus sekä niiden summa (prime cost).
 * Parturille ei anneta ulkoista väliä — palkkiomallit ja vuokrasopimukset
 * vaihtelevat niin paljon, että yleinen luku johtaisi harhaan. Siellä
 * vertailukohta on yrityksen oma historia.
 *
 * Matti esittää nämä aina "tyypillisesti"-sanalla eikä yrityksen
 * tavoitteena.
 */
export interface RuleOfThumb {
  low: number | null;
  high: number;
}

interface RatioDefinition {
  key: RatioKey;
  categories: ExpenseCategory[];
  rule: RuleOfThumb | null;
}

const GOODS_RULE: RuleOfThumb = { low: 0.25, high: 0.35 };
const STAFF_RULE: RuleOfThumb = { low: 0.25, high: 0.35 };
const PRIME_RULE: RuleOfThumb = { low: null, high: 0.65 };

const RATIOS: Record<BusinessType, RatioDefinition[]> = {
  restaurant: [
    { key: "goods", categories: ["food", "alcohol", "soft_drinks"], rule: GOODS_RULE },
    { key: "staff", categories: ["staff"], rule: STAFF_RULE },
    {
      key: "prime",
      categories: ["food", "alcohol", "soft_drinks", "staff"],
      rule: PRIME_RULE,
    },
  ],
  /* Kahvilassa take away -mukit ja kannet ovat osa tuotteen hintaa. */
  cafe: [
    { key: "goods", categories: ["food", "soft_drinks", "packaging"], rule: GOODS_RULE },
    { key: "staff", categories: ["staff"], rule: STAFF_RULE },
    {
      key: "prime",
      categories: ["food", "soft_drinks", "packaging", "staff"],
      rule: PRIME_RULE,
    },
  ],
  barber: [
    { key: "products", categories: ["products"], rule: null },
    { key: "staff", categories: ["staff"], rule: null },
    { key: "rent", categories: ["rent"], rule: null },
  ],
};

export interface Ratio {
  key: RatioKey;
  categories: ExpenseCategory[];
  costCents: number;
  /** Osuus kuukauden myynnistä, null jos myyntiä ei ole. */
  share: number | null;
  /**
   * Kolmen kuukauden osuus.
   *
   * Ostot eivät ole sama kuin käyttö: iso tukkutilaus kuun lopussa
   * nostaa yhden kuukauden prosenttia ja laskee seuraavan. Kolmen
   * kuukauden luku tasoittaa varaston heilunnan.
   */
  threeMonthShare: number | null;
  previous: { month: string; share: number | null }[];
  rule: RuleOfThumb | null;
  /** Suhde nyrkkisääntöön, jos sellainen on. */
  position: "below" | "within" | "above" | null;
}

export interface KeyRatios {
  month: string;
  /** Kuluva kuukausi on kesken: myynti ja ostot vain tähän päivään. */
  partial: boolean;
  netSalesCents: number;
  salesDays: number;
  ratios: Ratio[];
}

function salesIn(sales: DailySales[], from: string, to: string): DailySales[] {
  return sales.filter((s) => s.date >= from && s.date <= to);
}

function share(cost: number, salesCents: number): number | null {
  return salesCents > 0 ? cost / salesCents : null;
}

function sumCategories(
  costs: Map<ExpenseCategory, number>,
  categories: ExpenseCategory[],
): number {
  return categories.reduce((sum, c) => sum + (costs.get(c) ?? 0), 0);
}

function monthSales(sales: DailySales[], month: string, today: string) {
  const { from, to } = monthRange(month);
  const end = to > today ? today : to;
  return salesIn(sales, from, end);
}

export function keyRatios(input: {
  type: BusinessType;
  receipts: Receipt[];
  sales: DailySales[];
  month: string;
  today: string;
}): KeyRatios {
  const { type, receipts, sales, month, today } = input;
  const months = [month, previousMonth(month), previousMonth(previousMonth(month))];

  const costsFor = (m: string) =>
    netCostsByCategory(receipts.filter((r) => monthOf(r.date) === m));
  const salesFor = (m: string) =>
    monthSales(sales, m, today).reduce((s, d) => s + d.netCents, 0);

  const monthCosts = months.map(costsFor);
  const monthSalesCents = months.map(salesFor);
  const threeSales = monthSalesCents.reduce((a, b) => a + b, 0);

  const ratios = (RATIOS[type] ?? RATIOS.restaurant).map((def) => {
    const perMonth = monthCosts.map((c) => sumCategories(c, def.categories));
    const current = share(perMonth[0], monthSalesCents[0]);
    const three = share(
      perMonth.reduce((a, b) => a + b, 0),
      threeSales,
    );
    const basis = three ?? current;

    let position: Ratio["position"] = null;
    if (def.rule && basis !== null) {
      position =
        basis > def.rule.high
          ? "above"
          : def.rule.low !== null && basis < def.rule.low
            ? "below"
            : "within";
    }

    return {
      key: def.key,
      categories: def.categories,
      costCents: perMonth[0],
      share: current,
      threeMonthShare: three,
      previous: months.slice(1).map((m, i) => ({
        month: m,
        share: share(perMonth[i + 1], monthSalesCents[i + 1]),
      })),
      rule: def.rule,
      position,
    };
  });

  return {
    month,
    partial: monthRange(month).to > today,
    netSalesCents: monthSalesCents[0],
    salesDays: monthSales(sales, month, today).length,
    ratios,
  };
}

// ---------------------------------------------------------------------------
// Viikonpäivät ja keskiostos
// ---------------------------------------------------------------------------

export interface WeekdayStat {
  /** 0 = maanantai … 6 = sunnuntai. */
  weekday: number;
  days: number;
  averageNetCents: number | null;
  /** Keskimäärin asiakkaita (kuitteja) päivässä, jos kassa kertoo sen. */
  averageTransactions: number | null;
  averageTicketCents: number | null;
}

export interface WeekdayPattern {
  from: string;
  to: string;
  days: number;
  weekdays: WeekdayStat[];
  best: number | null;
  worst: number | null;
  averageTicketCents: number | null;
  averageTransactionsPerDay: number | null;
}

/** Maanantai 0, sunnuntai 6: suomalainen viikko alkaa maanantaista. */
export function weekdayOf(isoDate: string): number {
  return (new Date(`${isoDate}T12:00:00Z`).getUTCDay() + 6) % 7;
}

/**
 * Myynti viikonpäivittäin.
 *
 * Keskiostos lasketaan vain päivistä joilla kassa kertoo kuittien
 * määrän. Käsin kirjattu päivä ilman kuittimäärää ei laske keskiostosta
 * alas eikä ylös.
 */
export function weekdayPattern(
  sales: DailySales[],
  today: string,
  weeks = 8,
): WeekdayPattern {
  const from = addDays(today, -7 * weeks + 1);
  const rows = salesIn(sales, from, today);

  const weekdays: WeekdayStat[] = Array.from({ length: 7 }, (_, weekday) => {
    const own = rows.filter((r) => weekdayOf(r.date) === weekday);
    const counted = own.filter((r) => (r.transactions ?? 0) > 0);
    const transactions = counted.reduce((s, r) => s + (r.transactions ?? 0), 0);
    const countedNet = counted.reduce((s, r) => s + r.netCents, 0);
    return {
      weekday,
      days: own.length,
      averageNetCents:
        own.length > 0
          ? Math.round(own.reduce((s, r) => s + r.netCents, 0) / own.length)
          : null,
      averageTransactions:
        counted.length > 0 ? transactions / counted.length : null,
      averageTicketCents:
        transactions > 0 ? Math.round(countedNet / transactions) : null,
    };
  });

  /* Yksi havainto ei ole kuvio: vähintään kaksi samaa viikonpäivää. */
  const comparable = weekdays.filter(
    (w) => w.days >= 2 && w.averageNetCents !== null,
  );
  const sorted = [...comparable].sort(
    (a, b) => (b.averageNetCents ?? 0) - (a.averageNetCents ?? 0),
  );

  const counted = rows.filter((r) => (r.transactions ?? 0) > 0);
  const allTransactions = counted.reduce((s, r) => s + (r.transactions ?? 0), 0);

  return {
    from,
    to: today,
    days: rows.length,
    weekdays,
    best: sorted.length >= 2 ? sorted[0].weekday : null,
    worst: sorted.length >= 2 ? sorted[sorted.length - 1].weekday : null,
    averageTicketCents:
      allTransactions > 0
        ? Math.round(counted.reduce((s, r) => s + r.netCents, 0) / allTransactions)
        : null,
    averageTransactionsPerDay:
      counted.length > 0 ? allTransactions / counted.length : null,
  };
}

// ---------------------------------------------------------------------------
// Ostohintojen nousut
// ---------------------------------------------------------------------------

export interface PriceChange {
  description: string;
  supplierName: string;
  previousDate: string;
  latestDate: string;
  previousUnitCents: number;
  latestUnitCents: number;
  change: number;
  unit: string | null;
}

/** Sama tuote kahdella kuitilla: pienet kirjaimet, välit yhdeksi. */
function productKey(supplierId: string, description: string): string {
  return `${supplierId}::${description.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

/**
 * Tuotteet joiden ostohinta on noussut.
 *
 * Vertaa saman toimittajan saman tuotteen viimeisintä yksikköhintaa
 * edelliseen ostoon. Yksikköhinta on rivin summa jaettuna määrällä;
 * ilman määrää rivi lasketaan yhdeksi kappaleeksi vain jos yksikköä ei
 * ole merkitty — "2,5 kg" ilman määrää ei ole kappalehinta.
 *
 * Kynnys 5 % ja 5 senttiä: pyöristyserot ja tarjoushinnan loppuminen
 * sentillä eivät ole hinnannousu josta kannattaa kertoa.
 */
export function priceChanges(
  receipts: Receipt[],
  today: string,
  months = 6,
): { increases: PriceChange[]; decreases: number; compared: number } {
  const from = addDays(today, -31 * months);
  const purchases = new Map<
    string,
    { date: string; receiptId: string; unit: number; unitLabel: string | null; description: string; supplier: string }[]
  >();

  for (const receipt of receipts) {
    if (receipt.date < from || receipt.date > today) continue;
    for (const item of receipt.items) {
      if (!item.description.trim() || item.totalCents <= 0) continue;
      const quantity =
        item.quantity !== null && item.quantity > 0
          ? item.quantity
          : item.unit === null
            ? 1
            : null;
      if (quantity === null) continue;

      const key = productKey(receipt.supplierId, item.description);
      const list = purchases.get(key) ?? [];
      list.push({
        date: receipt.date,
        receiptId: receipt.id,
        unit: item.totalCents / quantity,
        unitLabel: item.unit,
        description: item.description,
        supplier: receipt.supplierName,
      });
      purchases.set(key, list);
    }
  }

  const increases: PriceChange[] = [];
  let decreases = 0;
  let compared = 0;

  for (const list of purchases.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
    const latest = list[list.length - 1];
    const previous = [...list]
      .reverse()
      .find((p) => p.receiptId !== latest.receiptId && p.date < latest.date);
    if (!previous) continue;

    compared += 1;
    const change = latest.unit / previous.unit - 1;
    const diff = latest.unit - previous.unit;

    if (change >= 0.05 && diff >= 5) {
      increases.push({
        description: latest.description,
        supplierName: latest.supplier,
        previousDate: previous.date,
        latestDate: latest.date,
        previousUnitCents: Math.round(previous.unit),
        latestUnitCents: Math.round(latest.unit),
        change,
        unit: latest.unitLabel,
      });
    } else if (change <= -0.05) {
      decreases += 1;
    }
  }

  increases.sort((a, b) => b.change - a.change);
  return { increases, decreases, compared };
}

// ---------------------------------------------------------------------------
// Päivämyynti joka kattaa kulut
// ---------------------------------------------------------------------------

export interface BreakEven {
  /** Kokonaiset kuukaudet joista laskettiin. */
  months: string[];
  averageMonthlyCostCents: number;
  averageSalesDaysPerMonth: number;
  /** Veroton myynti jota tarvitaan aukiolopäivää kohden. */
  requiredDailyNetCents: number;
  actualDailyNetCents: number;
  averageTicketCents: number | null;
  /** Asiakasta päivässä kattamaan kulut, jos keskiostos tiedetään. */
  requiredCustomersPerDay: number | null;
  actualCustomersPerDay: number | null;
}

/**
 * Paljonko pitää myydä päivässä, jotta Katen kautta kulkevat kulut
 * katetaan.
 *
 * Kolme viimeistä kokonaista kuukautta, joilla on sekä kuluja että
 * myyntiä. Kuluva kuukausi jää pois, koska se on kesken ja vääristäisi
 * molemmat puolet. Aukiolopäivät ovat päiviä joille myynti on kirjattu:
 * Kate ei tiedä aukioloaikoja, mutta kirjattu päivä on auki ollut päivä.
 *
 * Luku kattaa vain sen mikä kulkee Katen läpi. Jos vuokraa tai palkkoja
 * ei kirjata Kateen, todellinen raja on korkeampi — Matti sanoo sen.
 */
export function breakEven(input: {
  receipts: Receipt[];
  sales: DailySales[];
  today: string;
}): BreakEven | null {
  const { receipts, sales, today } = input;
  const current = monthOf(today);
  const candidates: string[] = [];
  let m = previousMonth(current);
  for (let i = 0; i < 12 && candidates.length < 3; i++) {
    const { from, to } = monthRange(m);
    const hasSales = sales.some((s) => s.date >= from && s.date <= to);
    const hasCosts = receipts.some((r) => monthOf(r.date) === m);
    if (hasSales && hasCosts) candidates.push(m);
    m = previousMonth(m);
  }
  if (candidates.length === 0) return null;

  let cost = 0;
  let salesDays = 0;
  let salesCents = 0;
  let transactions = 0;
  let countedNet = 0;
  let countedDays = 0;

  for (const month of candidates) {
    const costs = netCostsByCategory(receipts.filter((r) => monthOf(r.date) === month));
    cost += [...costs.values()].reduce((a, b) => a + b, 0);
    const { from, to } = monthRange(month);
    const rows = salesIn(sales, from, to);
    salesDays += rows.length;
    salesCents += rows.reduce((s, r) => s + r.netCents, 0);
    for (const r of rows) {
      if ((r.transactions ?? 0) > 0) {
        transactions += r.transactions ?? 0;
        countedNet += r.netCents;
        countedDays += 1;
      }
    }
  }

  const averageMonthlyCostCents = Math.round(cost / candidates.length);
  const averageSalesDaysPerMonth = salesDays / candidates.length;
  const requiredDailyNetCents = Math.round(averageMonthlyCostCents / averageSalesDaysPerMonth);
  const averageTicketCents = transactions > 0 ? Math.round(countedNet / transactions) : null;

  return {
    months: candidates,
    averageMonthlyCostCents,
    averageSalesDaysPerMonth,
    requiredDailyNetCents,
    actualDailyNetCents: Math.round(salesCents / salesDays),
    averageTicketCents,
    requiredCustomersPerDay:
      averageTicketCents !== null && averageTicketCents > 0
        ? requiredDailyNetCents / averageTicketCents
        : null,
    actualCustomersPerDay: countedDays > 0 ? transactions / countedDays : null,
  };
}

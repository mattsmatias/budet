/**
 * Päivän tilanne yhtenä lukuna kerrallaan.
 *
 * Yleiskuvan kärki vastaa kysymykseen "miten tänään menee". Tämä
 * tiedosto laskee vastauksen ja päättää mitä siitä voi rehellisesti
 * sanoa.
 *
 * KAKSI SÄÄNTÖÄ.
 *
 * 1. Puuttuva luku on eri asia kuin nolla. Kirjaamaton myynti ei ole
 *    nollan euron päivä, ja jos ne näyttävät samalta, ruutu valehtelee
 *    joka aamu ennen illan kirjausta.
 *
 * 2. Tulosta ei lasketa päivälle. Kuitit kirjataan erissä eikä
 *    päivittäin, joten päivän kuluista laskettu tulos heilahtelisi sen
 *    mukaan milloin kuitteja sattuu syötetyksi. Kuukausi tähän asti on
 *    luku jonka voi laskea.
 */

import { receiptsInMonth } from "./expenses";
import {
  compareSales,
  isClosedOn,
  roughResult,
  salesBetween,
  totalSalesCents,
  type DailySales,
  type SalesComparison,
} from "./sales";
import type { Receipt } from "./types";

export interface Pulse {
  /** Tämän päivän myynti. Null jos ei kirjattu. */
  sales: { cents: number | null; comparison: SalesComparison };

  /** Tänään kirjatut kuitit. Ei vertailua — ks. tiedoston alku. */
  expenses: { cents: number; receiptCount: number };

  /** Kuukausi tähän asti. Tulos lasketaan vain tästä. */
  monthToDate: {
    salesCents: number;
    expenseCents: number;
    /** Null jos myyntiä ei ole kirjattu kuukaudelle lainkaan. */
    resultCents: number | null;
    /** Monelta kuukauden menneeltä päivältä myynti puuttuu. */
    missingSalesDays: number;
  };
}

export function todayPulse(input: {
  today: string;
  month: string;
  receipts: Receipt[];
  sales: DailySales[];
  /** Viikonpaivat jolloin yritys on kiinni: 1 = maanantai ... 7 = su. */
  closedWeekdays?: readonly number[];
}): Pulse {
  const { today, month, receipts, sales, closedWeekdays } = input;

  const todaySales = sales.find((s) => s.date === today) ?? null;
  const salesCents = todaySales?.netCents ?? null;

  const comparison: SalesComparison = todaySales
    ? compareSales(todaySales, sales)
    : { kind: "none" };

  const todayReceipts = receipts.filter((r) => r.date === today);
  const expenseCents = todayReceipts.reduce((sum, r) => sum + r.totalCents, 0);

  // --- Kuukausi tähän asti -------------------------------------------------

  const monthSales = salesBetween(sales, `${month}-01`, today);
  const monthSalesCents = totalSalesCents(monthSales);
  const kuukaudenKuitit = receiptsInMonth(receipts, month).filter(
    (r) => r.date <= today,
  );
  const monthExpenseCents = kuukaudenKuitit.reduce(
    (sum, r) => sum + r.totalCents,
    0,
  );

  /*
   * Tulokseen kulut ilman ALV:tä.
   *
   * Myynti on veroton, joten verollinen kulu vertaisi eri lukuja
   * keskenään ja tulos eroaisi kirjanpidon tuloksesta. Kuluriville jää
   * verollinen summa: se on se raha joka lähti tililtä.
   */
  const monthNetExpenseCents = kuukaudenKuitit.reduce(
    (sum, r) => sum + r.totalCents - (r.vatCents ?? 0),
    0,
  );

  /*
   * Tulos vain jos myyntiä on kirjattu.
   *
   * Ilman myyntiä laskutoimitus antaisi suuren negatiivisen luvun, joka
   * näyttäisi tappiolta mutta tarkoittaisi vain ettei myyntiä ole
   * syötetty.
   */
  const resultCents =
    monthSales.length === 0
      ? null
      : roughResult({
          netSalesCents: monthSalesCents,
          expenseCents: monthNetExpenseCents,
        });

  return {
    sales: { cents: salesCents, comparison },
    expenses: { cents: expenseCents, receiptCount: todayReceipts.length },
    monthToDate: {
      salesCents: monthSalesCents,
      expenseCents: monthExpenseCents,
      resultCents,
      missingSalesDays: countMissing(month, today, sales, closedWeekdays),
    },
  };
}

/**
 * Kuukauden menneet päivät joilta myynti puuttuu.
 *
 * Vain ensimmäisen kirjatun myyntipäivän jälkeen. Ennen sitä ravintola
 * ei ole vielä ottanut ominaisuutta käyttöön, eikä koko historia ole
 * "puuttuvaa" vaan käyttämätöntä.
 */
function countMissing(
  month: string,
  today: string,
  sales: DailySales[],
  closedWeekdays: readonly number[] = [],
): number {
  const inMonth = sales.filter((s) => s.date.startsWith(month));
  if (inMonth.length === 0) return 0;

  const first = inMonth.reduce(
    (min, s) => (s.date < min ? s.date : min),
    today,
  );
  const known = new Set(inMonth.map((s) => s.date));

  let missing = 0;
  for (const date of datesBetween(first, today)) {
    if (date >= today) break;
    // Kiinni ollut paiva ei ole unohtunut merkinta.
    if (isClosedOn(date, closedWeekdays)) continue;
    if (!known.has(date)) missing += 1;
  }

  return missing;
}

function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);

  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return out;
}

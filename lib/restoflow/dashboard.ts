/**
 * Yleiskuvan päättely.
 *
 * Yksi sääntö ohjaa kaikkea täällä: **"kaikki kunnossa" saa sanoa vain
 * jos jotain on oikeasti tarkastettu.** Tyhjä tietokanta ei ole hyvä
 * uutinen — se on tieto siitä ettei arviota voi tehdä. Sama koskee
 * vertailulukuja: prosenttia ei näytetä ilman vertailujaksoa.
 *
 * Tämä on erotettu näkymästä, jotta säännöt ovat testattavissa. Väärä
 * "kaikki kunnossa" on pahempi kuin puuttuva tieto: se saa omistajan
 * lopettamaan katsomisen.
 */

import { alertCounts, buildAlerts } from "./alerts";
import { budgetProgress } from "./budgets";
import { findDuplicates } from "./duplicates";
import type { Insight } from "./insights";
import {
  needsReview,
  periodTotals,
  previousMonth,
  receiptsInMonth,
  relativeChange,
} from "./expenses";
import type {
  Absence,
  Alert,
  Budget,
  ClockEvent,
  OpenShift,
  Receipt,
  Shift,
  User,
} from "./types";
import type { DailySales } from "./sales";

export interface DashboardInput {
  receipts: Receipt[];
  budgets: Budget[];
  shifts: Shift[];
  users: User[];
  clockEvents: ClockEvent[];
  absences: Absence[];
  month: string;
  today: string;

  /*
   * Toiminnalliset poikkeamat tarvitsevat nykyhetken ja vyöhykkeen:
   * "vuoro alkoi 20 minuuttia sitten" ei ole pääteltävissä päivästä.
   * Avoimet vuorot ja myynti kulkevat samassa paketissa.
   */
  now: string;
  timezone: string;
  openShifts?: OpenShift[];
  sales?: DailySales[];
}

// ---------------------------------------------------------------------------
// Arvioitavuus
// ---------------------------------------------------------------------------

export interface Evaluability {
  /** Voidaanko poikkeamista sanoa mitään? */
  canJudge: boolean;
  /** Mitä tarkastuksia aineisto ylipäätään mahdollisti. */
  performed: string[];
}

/**
 * Mitä pystyimme tarkastamaan tällä aineistolla.
 *
 * Ilman kuitteja ei voi etsiä kaksoiskappaleita, ilman budjetteja ei voi
 * havaita ylityksiä, ilman vuoroja ei voi huomata sulkematonta vuoroa.
 * Jos yhtään tarkastusta ei voitu tehdä, tulos ei ole "ei ongelmia" vaan
 * "ei arviota".
 */
export function evaluability(input: DashboardInput): Evaluability {
  const inMonth = receiptsInMonth(input.receipts, input.month);
  const performed: string[] = [];

  if (inMonth.length > 0) performed.push("receipts");
  if (inMonth.length >= 2) performed.push("duplicates");
  if (input.budgets.length > 0 && inMonth.length > 0) performed.push("budgets");
  if (input.shifts.length > 0) performed.push("shifts");

  const before = receiptsInMonth(input.receipts, previousMonth(input.month));
  if (before.length > 0 && inMonth.length > 0) performed.push("trend");

  return { canJudge: performed.length > 0, performed };
}

export type AttentionState = "no-data" | "attention" | "clear";

export interface Attention {
  state: AttentionState;
  alerts: Alert[];
  counts: ReturnType<typeof alertCounts>;
}

/**
 * Kolme tilaa, ei kahta.
 *
 * "Ei huomioita" ja "ei arvioitavaa" ovat eri asioita, ja niiden
 * sekoittaminen on juuri se virhe jota tämä moduuli estää.
 */
export function attention(input: DashboardInput): Attention {
  const alerts = buildAlerts({
    receipts: input.receipts,
    budgets: input.budgets,
    shifts: input.shifts,
    users: input.users,
    clockEvents: input.clockEvents,
    absences: input.absences,
    month: input.month,
    today: input.today,
    now: input.now,
    timezone: input.timezone,
    openShifts: input.openShifts,
    sales: input.sales,
  });

  const counts = alertCounts(alerts);

  if (alerts.length > 0) return { state: "attention", alerts, counts };

  return {
    state: evaluability(input).canJudge ? "clear" : "no-data",
    alerts,
    counts,
  };
}

// ---------------------------------------------------------------------------
// Vertailu
// ---------------------------------------------------------------------------

export interface Comparison {
  /** Suhteellinen muutos, tai null jos vertailukohtaa ei ole. */
  change: number | null;
  /** Vertailukuukausi "2026-07", tai null. */
  baseMonth: string | null;
}

/**
 * Kuukausivertailu.
 *
 * Palauttaa null jos edellisessä kuukaudessa ei ole aineistoa. Nollasta
 * kasvaminen on aina "+∞ %", mikä ei kerro mitään — ja keksitty
 * vertailuluku on pahempi kuin puuttuva.
 */
export function compareToPreviousMonth(
  receipts: Receipt[],
  month: string,
): Comparison {
  const base = previousMonth(month);
  const before = periodTotals(receipts, base);

  if (before.receiptCount === 0) return { change: null, baseMonth: null };

  const current = periodTotals(receipts, month);
  return {
    change: relativeChange(current.totalCents, before.totalCents),
    baseMonth: base,
  };
}

/** Sama vertailu tunneille. Null jos edellistä kuukautta ei ole mitattu. */
export function compareHours(
  currentHours: number,
  previousHours: number | null,
): number | null {
  if (previousHours === null || previousHours === 0) return null;
  return (currentHours - previousHours) / previousHours;
}

// ---------------------------------------------------------------------------
// KPI-korttien selitteet
// ---------------------------------------------------------------------------

export interface ReceiptSplit {
  total: number;
  reviewed: number;
  pending: number;
  /** Valmis lause korttiin. */
  label: string;
}

/**
 * Kuittien tila yhtenä lauseena.
 *
 * "13" ei kerro onko työ tehty. "12 tarkistettu · 1 odottaa" kertoo.
 */
export function receiptSplit(receipts: Receipt[], month: string): ReceiptSplit {
  const inMonth = receiptsInMonth(receipts, month);
  const pending = needsReview(inMonth).length;
  const reviewed = inMonth.length - pending;

  const label =
    inMonth.length === 0
      ? "Ei vielä kuitteja"
      : pending === 0
        ? "Kaikki tarkistettu"
        : `${reviewed} tarkistettu · ${pending} odottaa`;

  return { total: inMonth.length, reviewed, pending, label };
}

/**
 * Henkilöstökulun osuus kirjatuista kuluista.
 *
 * Null jos kuluja ei ole: nollalla jakaminen antaisi joko äärettömän tai
 * nollan, ja kumpikin näyttäisi tiedolta. Null jos henkilöstökulu on
 * nolla mutta tunteja on — silloin tuntipalkkoja ei ole asetettu, eikä
 * osuus kerro mitään.
 */
export function staffCostShare(
  staffCostCents: number,
  expenseTotalCents: number,
): number | null {
  if (expenseTotalCents <= 0) return null;
  if (staffCostCents <= 0) return null;
  return staffCostCents / expenseTotalCents;
}

// ---------------------------------------------------------------------------
// Budjettien tekstimuotoinen tila
// ---------------------------------------------------------------------------

export type BudgetTone = "normal" | "warning" | "critical" | "over";

export interface BudgetLine {
  category: Budget["category"];
  spentCents: number;
  budgetCents: number;
  ratio: number;
  percent: number;
  tone: BudgetTone;
  /** Tila sanoina — väri yksin ei riitä saavutettavuuteen. */
  label: string;
}

const TONE_LABELS: Record<BudgetTone, string> = {
  normal: "Tahdissa",
  warning: "Varoitus",
  critical: "Kriittinen",
  over: "Ylitetty",
};

export function budgetTone(ratio: number): BudgetTone {
  if (ratio >= 1) return "over";
  if (ratio >= 0.9) return "critical";
  if (ratio >= 0.7) return "warning";
  return "normal";
}

export function budgetLines(
  receipts: Receipt[],
  budgets: Budget[],
  month: string,
): BudgetLine[] {
  return budgetProgress(receipts, budgets, month)
    .filter((row) => row.budgetCents !== null && row.ratio !== null)
    .map((row) => {
      const ratio = row.ratio as number;
      const tone = budgetTone(ratio);

      return {
        category: row.category,
        spentCents: row.spentCents,
        budgetCents: row.budgetCents as number,
        ratio,
        percent: Math.round(ratio * 100),
        tone,
        label: TONE_LABELS[tone],
      };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

// ---------------------------------------------------------------------------
// Kaavion aineisto
// ---------------------------------------------------------------------------

/**
 * Riittääkö historia kaavioon?
 *
 * Yhden pylvään kaavio ei ole kaavio. Kolme kuukautta on vähin määrä
 * josta suunnan voi lukea.
 */
export function hasChartHistory(receipts: Receipt[], month: string): boolean {
  const months = new Set(
    receipts.map((receipt) => receipt.date.slice(0, 7)).filter((m) => m <= month),
  );
  return months.size >= 3;
}

/** Kaksoiskappaleiden määrä yhteenvetoon. */
export function duplicateCount(receipts: Receipt[]): number {
  return findDuplicates(receipts).length;
}

// ---------------------------------------------------------------------------
// Yhdistetty huomiolista
// ---------------------------------------------------------------------------

export type FocusSeverity = "critical" | "warning" | "info";

export interface FocusItem {
  id: string;
  severity: FocusSeverity;
  title: string;
  detail: string;
  href: string;
}

/**
 * Hälytykset ja havainnot yhtenä listana.
 *
 * Käyttäjän kannalta ero on keinotekoinen: "kuitti odottaa tarkistusta"
 * ja "ruokakulut nousivat 18 %" ovat molemmat asioita joihin pitää
 * reagoida. Kaksi erillistä näkymää pakottaisi katsomaan kahdesta
 * paikasta, ja toinen niistä jäisi katsomatta.
 *
 * Hälytykset ensin: ne ovat todettuja puutteita. Havainnot ovat
 * suuntia, ja suunta on harvoin yhtä kiireellinen kuin puuttuva ALV.
 */
export function focusItems(
  input: DashboardInput,
  insights: Insight[],
): FocusItem[] {
  const alerts = attention(input).alerts.map((alert) => ({
    id: alert.id,
    severity: alert.severity as FocusSeverity,
    title: alert.title,
    detail: alert.detail,
    href: alert.href,
  }));

  // Vain seurattavat havainnot: "budjetit pysyvät tahdissa" on hyvä
  // uutinen eikä kuulu listaan jonka otsikko on "vaatii huomiota".
  const watch = insights
    .filter((insight) => insight.tone === "watch")
    .map((insight) => ({
      id: insight.id,
      severity: "info" as const,
      title: insight.title,
      detail: insight.detail,
      href: insight.href ?? "/admin/kulut",
    }));

  const order: Record<FocusSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return [...alerts, ...watch].sort(
    (a, b) => order[a.severity] - order[b.severity],
  );
}

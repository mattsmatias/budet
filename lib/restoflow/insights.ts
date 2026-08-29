/**
 * Havainnot.
 *
 * Ero hälytyksiin: hälytys kertoo että jokin on pielessä nyt. Havainto
 * kertoo mihin suuntaan asiat menevät, ja se voi olla hyvä uutinen.
 *
 * Havainto sanoo aina mihin lukuun se perustuu. "Ruokakulut nousivat"
 * ilman euromäärää ja vertailukohtaa on mielipide, ei havainto — ja
 * mielipiteen perusteella kukaan ei muuta mitään.
 *
 * Kuten hälytykset, nämä lasketaan tilasta joka kerta eikä tallenneta.
 */

import { budgetProgress } from "./budgets";
import { labels } from "@/lib/i18n/labels";
import type { AppLocale } from "@/lib/i18n/app-locales";
import type { IconName } from "@/components/restoflow/icons";
import { formatMoney } from "../money";
import {
  monthlySeries,
  periodTotals,
  previousMonth,
  receiptsInMonth,
  relativeChange,
  totalsByCategory,
} from "./expenses";
import { supplierTotalsInMonth } from "./suppliers";
import { compareShifts, labourSummary } from "./shifts";
import {
  type Budget,
  type ClockEvent,
  type Receipt,
  type Shift,
  type User,
} from "./types";

export type InsightTone = "good" | "neutral" | "watch";

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  /** Perustelu lukuineen. Ilman lukua havainto on mielipide. */
  detail: string;
  href?: string;
  /**
   * Aiheen ikoni.
   *
   * Pakollinen eikä oletusarvoinen: havainnot päätyvät yleiskuvan
   * huomiolistaan hälytysten rinnalle, ja siellä ikoni kertoo mistä
   * rivi on. Uusi havainto ei käänny ennen kuin joku on päättänyt
   * onko se kuitti, vuoro vai kulusuunta.
   */
  icon: IconName;
}

export interface InsightContext {
  receipts: Receipt[];
  budgets: Budget[];
  shifts: Shift[];
  users: User[];
  clockEvents: ClockEvent[];
  month: string;
  today: string;
  now: string;
  /** Ravintolan aikavyöhyke: leimauksen päivä luetaan siinä ajassa. */
  timezone: string;
  /** Käyttöliittymän kieli: havaintojen teksti kirjoitetaan sillä. */
  locale: AppLocale;
}

/** Kuluvertailu jätetään tekemättä, jos vertailukuukausi on lähes tyhjä. */
const MIN_RECEIPTS_FOR_TREND = 3;

/** Alle tämän euromäärän muutokset eivät ole havainnon arvoisia. */
const MIN_CHANGE_CENTS = 5000;

export function buildInsights(ctx: InsightContext): Insight[] {
  return [
    ...spendTrend(ctx),
    ...categoryShift(ctx),
    ...supplierConcentration(ctx),
    ...budgetPace(ctx),
    ...labourShare(ctx),
    ...reviewDiscipline(ctx),
  ];
}

// ---------------------------------------------------------------------------

function spendTrend(ctx: InsightContext): Insight[] {
  const current = periodTotals(ctx.receipts, ctx.month);
  const before = periodTotals(ctx.receipts, previousMonth(ctx.month));

  if (before.receiptCount < MIN_RECEIPTS_FOR_TREND) return [];

  const diff = current.totalCents - before.totalCents;
  if (Math.abs(diff) < MIN_CHANGE_CENTS) {
    return [
      {
        id: "spend-flat",
        icon: "trend",
        tone: "good",
        title: "Kulut pysyivät ennallaan",
        detail: `${formatMoney(current.totalCents)} tässä kuussa, ${formatMoney(before.totalCents)} edellisessä.`,
        href: "/admin/kulut",
      },
    ];
  }

  const change = relativeChange(current.totalCents, before.totalCents);
  const percent = change === null ? null : Math.round(Math.abs(change) * 100);

  return [
    {
      id: "spend-trend",
      icon: "trend",
      tone: diff > 0 ? "watch" : "good",
      title: diff > 0 ? "Kulut nousivat" : "Kulut laskivat",
      detail:
        `${diff > 0 ? "+" : "−"}${formatMoney(Math.abs(diff))}` +
        `${percent === null ? "" : ` (${percent} %)`} edelliseen kuukauteen. ` +
        `Kuitteja ${current.receiptCount}, edellisessä ${before.receiptCount}.`,
      href: "/admin/kulut",
    },
  ];
}

function categoryShift(ctx: InsightContext): Insight[] {
  const current = totalsByCategory(receiptsInMonth(ctx.receipts, ctx.month));
  const before = totalsByCategory(
    receiptsInMonth(ctx.receipts, previousMonth(ctx.month)),
  );

  if (before.length === 0) return [];

  const beforeById = new Map(before.map((c) => [c.category, c.totalCents]));

  const biggest = current
    .map((c) => ({
      category: c.category,
      diff: c.totalCents - (beforeById.get(c.category) ?? 0),
      total: c.totalCents,
    }))
    .filter((c) => Math.abs(c.diff) >= MIN_CHANGE_CENTS)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];

  if (!biggest) return [];

  return [
    {
      id: `category-${biggest.category}`,
      icon: "expenses",
      tone: biggest.diff > 0 ? "watch" : "good",
      title: `${labels(ctx.locale).categories[biggest.category]} ${biggest.diff > 0 ? "kasvoi" : "pieneni"}`,
      detail:
        `${biggest.diff > 0 ? "+" : "−"}${formatMoney(Math.abs(biggest.diff))} edelliseen kuukauteen. ` +
        `Yhteensä ${formatMoney(biggest.total)}.`,
      href: "/admin/kulut",
    },
  ];
}

function supplierConcentration(ctx: InsightContext): Insight[] {
  const totals = supplierTotalsInMonth(ctx.receipts, ctx.month);
  if (totals.length < 2) return [];

  const biggest = totals[0];
  if (biggest.share < 0.5) return [];

  return [
    {
      id: "supplier-concentration",
      icon: "suppliers",
      tone: "watch",
      title: "Yksi toimittaja hallitsee kuluja",
      detail:
        `${biggest.name} on ${Math.round(biggest.share * 100)} % kuukauden kuluista ` +
        `(${formatMoney(biggest.totalCents)}). Keskittymä on riski hinnoittelussa ja saatavuudessa.`,
      href: "/admin/toimittajat",
    },
  ];
}

function budgetPace(ctx: InsightContext): Insight[] {
  const rows = budgetProgress(ctx.receipts, ctx.budgets, ctx.month).filter(
    (row) => row.budgetCents !== null && row.ratio !== null,
  );

  if (rows.length === 0) return [];

  // Kuinka suuri osa kuukaudesta on kulunut. Ilman tätä 60 %:n käyttö
  // kuukauden alussa ja lopussa näyttäisivät samalta.
  const day = Number(ctx.today.slice(8, 10));
  const daysInMonth = new Date(
    Date.UTC(Number(ctx.month.slice(0, 4)), Number(ctx.month.slice(5, 7)), 0),
  ).getUTCDate();
  const elapsed = day / daysInMonth;

  const ahead = rows
    .filter((row) => (row.ratio as number) > elapsed + 0.2)
    .sort((a, b) => (b.ratio as number) - (a.ratio as number))[0];

  if (!ahead) {
    return [
      {
        id: "budget-pace-ok",
        icon: "budget",
        tone: "good",
        title: "Budjetit pysyvät tahdissa",
        detail:
          `Kuukaudesta on kulunut ${Math.round(elapsed * 100)} %, eikä yksikään ` +
          `${rows.length} budjetista ole selvästi edellä.`,
        href: "/admin/budjetit",
      },
    ];
  }

  return [
    {
      id: `budget-pace-${ahead.category}`,
      icon: "budget",
      tone: "watch",
      title: `${labels(ctx.locale).categories[ahead.category]} kuluu etuajassa`,
      detail:
        `${Math.round((ahead.ratio as number) * 100)} % budjetista käytetty, ` +
        `kun kuukaudesta on kulunut ${Math.round(elapsed * 100)} %. ` +
        `Käytetty ${formatMoney(ahead.spentCents)} / ${formatMoney(ahead.budgetCents ?? 0)}.`,
      href: "/admin/budjetit",
    },
  ];
}

function labourShare(ctx: InsightContext): Insight[] {
  const past = ctx.shifts.filter(
    (s) => s.date < ctx.today && s.date.startsWith(ctx.month),
  );
  if (past.length === 0) return [];

  const summary = labourSummary(
    compareShifts(past, ctx.users, ctx.clockEvents, ctx.now, ctx.timezone),
  );

  if (summary.actualMs === 0) return [];

  const overtimeHours = summary.varianceMs / 3600000;
  if (Math.abs(overtimeHours) < 2) return [];

  return [
    {
      id: "labour-variance",
      icon: "clock",
      tone: overtimeHours > 0 ? "watch" : "neutral",
      title:
        overtimeHours > 0
          ? "Toteutunut työaika ylittää suunnitellun"
          : "Toteutunut työaika jää suunnitellusta",
      detail:
        `${overtimeHours > 0 ? "+" : "−"}${Math.abs(Math.round(overtimeHours * 10) / 10)} h ` +
        `${summary.shiftCount} vuorossa. Ero on laskennallisesti ` +
        `${summary.varianceCostCents >= 0 ? "+" : "−"}${formatMoney(Math.abs(summary.varianceCostCents))}.`,
      href: "/admin/tyovuorot",
    },
  ];
}

function reviewDiscipline(ctx: InsightContext): Insight[] {
  const inMonth = receiptsInMonth(ctx.receipts, ctx.month);
  if (inMonth.length < MIN_RECEIPTS_FOR_TREND) return [];

  const pending = inMonth.filter((r) => r.status === "needs_review").length;
  const share = pending / inMonth.length;

  if (pending === 0) {
    return [
      {
        id: "review-clean",
        icon: "receipt",
        tone: "good",
        title: "Kaikki kuukauden kuitit on tarkistettu",
        detail: `${inMonth.length} kuittia, ei yhtään jonossa.`,
        href: "/admin/kuitit",
      },
    ];
  }

  if (share < 0.25) return [];

  return [
    {
      id: "review-backlog",
      icon: "receipt",
      tone: "watch",
      title: "Tarkistusjono kasvaa",
      detail:
        `${pending} / ${inMonth.length} kuukauden kuitista odottaa tarkistusta ` +
        `(${Math.round(share * 100)} %). Ne ovat mukana summissa, joten luvut voivat vielä muuttua.`,
      href: "/admin/kuitit?suodatin=needs_review",
    },
  ];
}

/** Havainnot vakavimmat ensin: seurattavat, sitten neutraalit, sitten hyvät. */
export function sortInsights(insights: Insight[]): Insight[] {
  const order: Record<InsightTone, number> = { watch: 0, neutral: 1, good: 2 };
  return [...insights].sort((a, b) => order[a.tone] - order[b.tone]);
}

/** Kuukausisarja pikkugraafiin. Sama lähde kuin kulunäkymässä. */
export function insightSeries(receipts: Receipt[], month: string) {
  return monthlySeries(receipts, month, 6);
}

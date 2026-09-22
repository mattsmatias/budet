/**
 * Poikkeamien tunnistus.
 *
 * Tämä on Kate'n varsinainen arvo. "Tekoäly tunnistaa kuitin" on
 * kirjaustyön poistamista; poikkeamien löytäminen on sitä työtä jota
 * manageri ei ehdi tehdä itse.
 *
 * Kaikki hälytykset johdetaan aineiston tilasta. Mitään ei tallenneta:
 * tallennettu hälytys jäisi roikkumaan senkin jälkeen kun asia on hoidettu,
 * ja väärä hälytys on pahempi kuin puuttuva.
 */

import { budgetProgress, WARNING_THRESHOLD } from "./budgets";
import { fill } from "@/lib/i18n/auth-text";
import { adminText } from "@/lib/i18n/admin-text";
import { formatDayShortIn, labels } from "@/lib/i18n/labels";
import type { AppLocale } from "@/lib/i18n/app-locales";
import { findDuplicates } from "./duplicates";
import { formatMoney } from "../money";
import { needsReview, receiptsInMonth } from "./expenses";
import { supplierTrends } from "./suppliers";
import { checkVat } from "./vat";
import { daysLate, statusOf, type Task } from "./tasks";
import type { Alert, Budget, Receipt } from "./types";
import { addDays, daysBetween } from "./dates";
import {
  compareSales,
  missingSalesDays,
  type DailySales,
} from "./sales";

/** Toimittajan kulunousu joka ylittää tämän nostaa hälytyksen. */
const SUPPLIER_SPIKE_THRESHOLD = 0.25;

/** Alle tämän summan nousut eivät hälytä — pieni euromäärä, iso prosentti. */
const SUPPLIER_SPIKE_MIN_CENTS = 20000;

/** Näin monen päivän kuittitauko huomautetaan. */
const RECEIPT_GAP_DAYS = 14;

/** Myynti tämän verran alle vertailukohdan nostaa huomautuksen. */
const SALES_SHORTFALL = 0.1;

/** Montako päivää taaksepäin puuttuvasta myynnistä muistutetaan. */
const SALES_MISSING_WINDOW = 7;

export interface AlertContext {
  receipts: Receipt[];
  budgets: Budget[];
  month: string;
  today: string;
  /*
   * Myynti on valinnainen vain siksi että se lisättiin myöhemmin; se
   * kulkee samassa datapaketissa kuin muutkin, joten käytännössä se on
   * aina mukana.
   */
  sales?: DailySales[];
  /*
   * Tehtävät samassa paketissa muiden kanssa.
   *
   * "Onko jotain hoitamatta" on yksi kysymys. Erillinen tehtävälista
   * yleiskuvassa tarkoittaisi kahta paikkaa joista molemmat pitää
   * muistaa katsoa.
   */
  tasks?: Task[];
  /** Käyttöliittymän kieli: hälytysten teksti kirjoitetaan sillä. */
  locale: AppLocale;
}

/**
 * Kaikki hälytykset, vakavimmat ensin.
 *
 * Järjestys on merkityksellinen: manageri lukee listan ylhäältä ja
 * lopettaa kun kiinnostus loppuu.
 */
export function buildAlerts(ctx: AlertContext): Alert[] {
  return [
    ...duplicateAlerts(ctx),
    ...budgetAlerts(ctx),
    ...supplierSpikeAlerts(ctx),
    ...vatMismatchAlerts(ctx),
    ...receiptReviewAlerts(ctx),
    ...salesShortfall(ctx),
    ...salesMissing(ctx),
    ...receiptGap(ctx),
    ...taskDeadlines(ctx),
  ].sort((a, b) => severityRank(a) - severityRank(b));
}

function severityRank(alert: Alert): number {
  return alert.severity === "critical"
    ? 0
    : alert.severity === "warning"
      ? 1
      : 2;
}

// ---------------------------------------------------------------------------

function duplicateAlerts(ctx: AlertContext): Alert[] {
  const t = adminText(ctx.locale);
  return findDuplicates(
    receiptsInMonth(ctx.receipts, ctx.month),
    adminText(ctx.locale),
  ).map((group) => ({
    id: `dup-${group.receipts[0].id}`,
    kind: "duplicate_receipt" as const,
    severity: "critical" as const,
    title: fill(t.havainto.possibleDuplicateNamed, {
      nimi: group.supplierName,
    }),
    detail: fill(t.havainto.amountAndReason, {
      summa: formatMoney(group.totalCents),
      syy: group.reason,
    }),
    href: `/admin/kuitit?korosta=${group.receipts[0].id}`,
    entityId: group.receipts[0].id,
  }));
}

function budgetAlerts(ctx: AlertContext): Alert[] {
  const t = adminText(ctx.locale);
  const progress = budgetProgress(ctx.receipts, ctx.budgets, ctx.month);

  return progress
    .filter((p) => p.status === "exceeded" || p.status === "warning")
    .map((p) => {
      const label = labels(ctx.locale).categories[p.category];
      const pct = Math.round((p.ratio ?? 0) * 100);

      return p.status === "exceeded"
        ? {
            id: `budget-${p.category}`,
            kind: "budget_exceeded" as const,
            severity: "critical" as const,
            title: fill(t.halytys.budgetExceeded, { nimi: label }),
            detail: fill(t.halytys.budgetExceededBody, {
              kaytetty: formatMoney(p.spentCents),
              budjetti: formatMoney(p.budgetCents ?? 0),
              osuus: String(pct),
            }),
            href: "/admin/budjetit",
            entityId: p.category,
          }
        : {
            id: `budget-${p.category}`,
            kind: "budget_warning" as const,
            severity: "warning" as const,
            title: fill(t.halytys.budgetShare, {
              nimi: label,
              osuus: String(pct),
            }),
            detail: fill(t.havainto.remainingThisMonth, {
              summa: formatMoney(p.remainingCents ?? 0),
            }),
            href: "/admin/budjetit",
            entityId: p.category,
          };
    });
}

function supplierSpikeAlerts(ctx: AlertContext): Alert[] {
  const teksti = adminText(ctx.locale);
  return supplierTrends(ctx.receipts, ctx.month)
    .filter(
      (t) =>
        t.change !== null &&
        t.change >= SUPPLIER_SPIKE_THRESHOLD &&
        t.currentCents >= SUPPLIER_SPIKE_MIN_CENTS,
    )
    .map((t) => ({
      id: `spike-${t.supplierId}`,
      kind: "supplier_spike" as const,
      severity: "warning" as const,
      title: fill(teksti.havainto.supplierRose, {
        nimi: t.name,
        osuus: String(Math.round((t.change ?? 0) * 100)),
      }),
      detail: fill(teksti.halytys.comparedToPrevious, {
        ennen: formatMoney(t.previousCents),
        nyt: formatMoney(t.currentCents),
      }),
      href: `/admin/toimittajat/${t.supplierId}`,
      entityId: t.supplierId,
    }));
}

function vatMismatchAlerts(ctx: AlertContext): Alert[] {
  const t = adminText(ctx.locale);
  return receiptsInMonth(ctx.receipts, ctx.month)
    .filter((r) => r.vatCents !== null)
    .map((r) => ({
      receipt: r,
      check: checkVat(r.totalCents, r.vatCents, r.category, r.items),
    }))
    .filter(({ check }) => !check.matches && check.explanation)
    .map(({ receipt, check }) => ({
      id: `vat-${receipt.id}`,
      kind: "vat_mismatch" as const,
      severity: "warning" as const,
      title: fill(t.havainto.vatMismatchNamed, {
        nimi: receipt.supplierName,
      }),
      detail: check.explanation ?? "",
      href: `/admin/kuitit?korosta=${receipt.id}`,
      entityId: receipt.id,
    }));
}

function receiptReviewAlerts(ctx: AlertContext): Alert[] {
  const t = adminText(ctx.locale);
  const inMonth = needsReview(receiptsInMonth(ctx.receipts, ctx.month));

  // ALV-ristiriidat ja duplikaatit on jo raportoitu omina hälytyksinään.
  const alreadyReported = new Set(["vat_mismatch", "duplicate_suspected"]);

  return inMonth
    .filter((r) => r.reviewReasons.some((x) => !alreadyReported.has(x)))
    .map((receipt) => {
      const reasons = receipt.reviewReasons
        .filter((x) => !alreadyReported.has(x))
        .map((x) => labels(ctx.locale).reviewReasons[x]);

      return {
        id: `review-${receipt.id}`,
        kind: "receipt_needs_review" as const,
        severity: "warning" as const,
        title: fill(t.havainto.awaitsReview, {
          nimi: receipt.supplierName,
        }),
        detail: fill(t.havainto.amountAndReason, {
          summa: formatMoney(receipt.totalCents),
          syy: reasons.join(" · "),
        }),
        href: `/admin/kuitit?korosta=${receipt.id}`,
        entityId: receipt.id,
      };
    });
}

/**
 * Päivän myynti on kirjaamatta.
 *
 * Kassaraportti kuvataan illan päätteeksi, ja unohtuminen huomataan
 * vasta kun jotain lasketaan sen varassa. Ilman päivää viikon vertailut,
 * keskiostos ja kuukauden tulos jäävät vajaiksi — eikä puuttuva päivä
 * näy missään ennen kuin joku etsii sitä.
 *
 * Ikkuna on viikko: vanhemmat päivät ovat historiaa, ja niitä
 * täydennetään myyntisivun listalta. Ennen ensimmäistä kirjattua päivää
 * ei muistuteta — silloin yritys ei vielä käyttänyt Katea.
 *
 * Tämä päivä ei ole myöhässä: se kirjataan illalla.
 */
function salesMissing(ctx: AlertContext): Alert[] {
  const t = adminText(ctx.locale);
  const sales = ctx.sales ?? [];
  if (sales.length === 0) return [];

  const first = sales.reduce((min, s) => (s.date < min ? s.date : min), sales[0].date);

  const days: string[] = [];
  for (let i = 1; i <= SALES_MISSING_WINDOW; i++) {
    const day = addDays(ctx.today, -i);
    if (day >= first) days.push(day);
  }

  const missing = missingSalesDays(days, sales, ctx.today);
  if (missing.length === 0) return [];

  // Uusin puuttuva ensin: se on se joka juuri unohtui.
  const latest = missing.reduce((max, d) => (d > max ? d : max), missing[0]);

  return [
    {
      id: `sales-missing-${latest}`,
      kind: "sales_missing",
      severity: "warning",
      title:
        missing.length === 1
          ? fill(t.havainto.salesMissingOne, {
              paiva: formatDate(latest, ctx.locale),
            })
          : fill(t.havainto.salesMissingMany, { maara: String(missing.length) }),
      detail: t.havainto.salesMissingBody,
      href: "/admin/myynti",
      entityId: latest,
    },
  ];
}

/**
 * Myynti jäi selvästi vertailukohdasta.
 *
 * Vain kun vertailukohta on olemassa: oma tavoite tai saman viikonpäivän
 * historia. Ilman kumpaakaan ei ole mitään mistä jäädä.
 *
 * Eilinen eikä tämä päivä: kesken olevaa päivää ei voi verrata koko
 * päivän lukuun.
 */
function salesShortfall(ctx: AlertContext): Alert[] {
  const t = adminText(ctx.locale);
  const sales = ctx.sales ?? [];
  const yesterday = addDays(ctx.today, -1);
  const day = sales.find((s) => s.date === yesterday);
  if (!day) return [];

  const comparison = compareSales(day, sales);
  if (comparison.kind === "none") return [];
  if (comparison.ratio >= 1 - SALES_SHORTFALL) return [];

  const shortfall = Math.round((1 - comparison.ratio) * 100);
  const benchmark =
    comparison.kind === "target"
      ? fill(t.havainto.fromTarget, {
          summa: formatMoney(comparison.targetCents),
        })
      : fill(t.havainto.fromWeekdayAverage, {
          summa: formatMoney(comparison.averageCents),
        });

  return [
    {
      id: `sales-short-${yesterday}`,
      kind: "sales_shortfall",
      severity: "warning",
      title: fill(t.havainto.yesterdayShortfall, {
        osuus: String(shortfall),
      }),
      detail: fill(t.havainto.yesterdayShortfallBody, {
        summa: formatMoney(day.netCents),
        osuus: String(shortfall),
        vertailu: benchmark,
      }),
      href: "/admin/myynti",
      entityId: yesterday,
    },
  ];
}

/**
 * Kuitteja ei ole kirjattu pitkään aikaan.
 *
 * Vain jos ravintola on selvästi toiminnassa: myyntiä on kirjattu tauon
 * aikana. Suljettu ravintola ei osta mitään, eikä hiljaisuus silloin ole
 * poikkeama. Myynti on tähän parempi merkki kuin mikään muu — se on
 * täsmälleen se raha jonka rinnalla kulut puuttuvat.
 */
function receiptGap(ctx: AlertContext): Alert[] {
  const t = adminText(ctx.locale);
  if (ctx.receipts.length === 0) return [];

  const latest = ctx.receipts.reduce(
    (max, r) => (r.date > max ? r.date : max),
    "",
  );
  const gap = daysBetween(latest, ctx.today);
  if (gap < RECEIPT_GAP_DAYS) return [];

  const operating = (ctx.sales ?? []).some((s) => s.date > latest);
  if (!operating) return [];

  return [
    {
      id: `receipt-gap-${latest}`,
      kind: "receipt_gap",
      severity: "warning",
      title: fill(t.havainto.noReceiptsForDays, { maara: String(gap) }),
      detail: fill(t.havainto.noReceiptsBody, {
        paiva: formatDate(latest, ctx.locale),
      }),
      href: "/admin/kuitit/uusi",
      entityId: latest,
    },
  ];
}

/**
 * Määräaika tänään tai jo mennyt.
 *
 * Myöhässä oleva on kriittinen: eräpäivä on ohi eikä kukaan ole
 * tehnyt mitään. Tänään erääntyvä on huomautus — päivä on vielä
 * edessä.
 *
 * Tulevat eivät ole hälytyksiä. Tehtävä jonka eräpäivä on ensi
 * viikolla ei vaadi tänään mitään, ja hälytys siitä opettaisi
 * ohittamaan hälytykset.
 */
function taskDeadlines(ctx: AlertContext): Alert[] {
  const t = adminText(ctx.locale);
  const alerts: Alert[] = [];

  for (const task of ctx.tasks ?? []) {
    const status = statusOf(task, ctx.today);

    if (status === "overdue") {
      const late = daysLate(task, ctx.today);

      alerts.push({
        id: `task-overdue-${task.id}`,
        kind: "task_overdue",
        severity: "critical",
        title: task.title,
        detail:
          late === 0
            ? fill(t.havainto.dueTodayAt, { aika: task.dueTime ?? "" })
            : fill(late === 1 ? t.havainto.lateByOne : t.havainto.lateByMany, {
                maara: String(late),
              }),
        href: "/admin/tehtavat?suodatin=myohassa",
        entityId: task.id,
      });
      continue;
    }

    if (status === "due_today") {
      alerts.push({
        id: `task-due-${task.id}`,
        kind: "task_due",
        severity: task.priority === "critical" ? "critical" : "warning",
        title: task.title,
        detail: task.dueTime
          ? fill(t.havainto.dueTodayAtTime, { aika: task.dueTime })
          : t.havainto.dueToday,
        href: "/admin/tehtavat?suodatin=tanaan",
        entityId: task.id,
      });
    }
  }

  return alerts;
}

// ---------------------------------------------------------------------------

export function alertCounts(alerts: Alert[]): {
  critical: number;
  warning: number;
  info: number;
  total: number;
} {
  return {
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length,
    total: alerts.length,
  };
}

export { WARNING_THRESHOLD };

function formatDate(isoDate: string, locale: AppLocale): string {
  return formatDayShortIn(isoDate, locale);
}

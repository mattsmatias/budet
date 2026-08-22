/**
 * Poikkeamien tunnistus.
 *
 * Tämä on Budet'n varsinainen arvo. "Tekoäly tunnistaa kuitin" on
 * kirjaustyön poistamista; poikkeamien löytäminen on sitä työtä jota
 * manageri ei ehdi tehdä itse.
 *
 * Kaikki hälytykset johdetaan aineiston tilasta. Mitään ei tallenneta:
 * tallennettu hälytys jäisi roikkumaan senkin jälkeen kun asia on hoidettu,
 * ja väärä hälytys on pahempi kuin puuttuva.
 */

import { budgetProgress, WARNING_THRESHOLD } from "./budgets";
import { findDuplicates } from "./duplicates";
import { formatMoney } from "../money";
import { needsReview, receiptsInMonth } from "./expenses";
import { supplierTrends } from "./suppliers";
import { checkVat } from "./vat";
import {
  CATEGORY_LABELS,
  REVIEW_REASON_LABELS,
  type Alert,
  type Budget,
  type ClockEvent,
  type Receipt,
  type Shift,
  type User,
} from "./types";
import { currentState } from "./timeclock";

/** Toimittajan kulunousu joka ylittää tämän nostaa hälytyksen. */
const SUPPLIER_SPIKE_THRESHOLD = 0.25;

/** Alle tämän summan nousut eivät hälytä — pieni euromäärä, iso prosentti. */
const SUPPLIER_SPIKE_MIN_CENTS = 20000;

export interface AlertContext {
  receipts: Receipt[];
  budgets: Budget[];
  shifts: Shift[];
  users: User[];
  clockEvents: ClockEvent[];
  month: string;
  today: string;
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
    ...unclosedShiftAlerts(ctx),
    ...shiftAlerts(ctx),
  ].sort((a, b) => severityRank(a) - severityRank(b));
}

function severityRank(alert: Alert): number {
  return alert.severity === "critical" ? 0 : alert.severity === "warning" ? 1 : 2;
}

// ---------------------------------------------------------------------------

function duplicateAlerts(ctx: AlertContext): Alert[] {
  return findDuplicates(receiptsInMonth(ctx.receipts, ctx.month)).map((group) => ({
    id: `dup-${group.receipts[0].id}`,
    kind: "duplicate_receipt" as const,
    severity: "critical" as const,
    title: `Mahdollinen kaksoiskappale · ${group.supplierName}`,
    detail: `${formatMoney(group.totalCents)} · ${group.reason}`,
    href: `/admin/kuitit?korosta=${group.receipts[0].id}`,
    entityId: group.receipts[0].id,
  }));
}

function budgetAlerts(ctx: AlertContext): Alert[] {
  const progress = budgetProgress(ctx.receipts, ctx.budgets, ctx.month);

  return progress
    .filter((p) => p.status === "exceeded" || p.status === "warning")
    .map((p) => {
      const label = CATEGORY_LABELS[p.category];
      const pct = Math.round((p.ratio ?? 0) * 100);

      return p.status === "exceeded"
        ? {
            id: `budget-${p.category}`,
            kind: "budget_exceeded" as const,
            severity: "critical" as const,
            title: `${label} ylitti kuukausibudjetin`,
            detail:
              `${formatMoney(p.spentCents)} / ${formatMoney(p.budgetCents ?? 0)} ` +
              `· ${pct} %`,
            href: "/admin/budjetit",
            entityId: p.category,
          }
        : {
            id: `budget-${p.category}`,
            kind: "budget_warning" as const,
            severity: "warning" as const,
            title: `${label} ${pct} % budjetista`,
            detail: `${formatMoney(p.remainingCents ?? 0)} jäljellä kuukaudesta`,
            href: "/admin/budjetit",
            entityId: p.category,
          };
    });
}

function supplierSpikeAlerts(ctx: AlertContext): Alert[] {
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
      title: `${t.name}: kulut nousivat ${Math.round((t.change ?? 0) * 100)} %`,
      detail:
        `${formatMoney(t.previousCents)} → ${formatMoney(t.currentCents)} ` +
        "edelliseen kuukauteen verrattuna",
      href: `/admin/toimittajat/${t.supplierId}`,
      entityId: t.supplierId,
    }));
}

function vatMismatchAlerts(ctx: AlertContext): Alert[] {
  return receiptsInMonth(ctx.receipts, ctx.month)
    .filter((r) => r.vatCents !== null)
    .map((r) => ({ receipt: r, check: checkVat(r.totalCents, r.vatCents, r.category) }))
    .filter(({ check }) => !check.matches && check.explanation)
    .map(({ receipt, check }) => ({
      id: `vat-${receipt.id}`,
      kind: "vat_mismatch" as const,
      severity: "warning" as const,
      title: `ALV-tieto ei täsmää · ${receipt.supplierName}`,
      detail: check.explanation ?? "",
      href: `/admin/kuitit?korosta=${receipt.id}`,
      entityId: receipt.id,
    }));
}

function receiptReviewAlerts(ctx: AlertContext): Alert[] {
  const inMonth = needsReview(receiptsInMonth(ctx.receipts, ctx.month));

  // ALV-ristiriidat ja duplikaatit on jo raportoitu omina hälytyksinään.
  const alreadyReported = new Set(["vat_mismatch", "duplicate_suspected"]);

  return inMonth
    .filter((r) => r.reviewReasons.some((x) => !alreadyReported.has(x)))
    .map((receipt) => {
      const reasons = receipt.reviewReasons
        .filter((x) => !alreadyReported.has(x))
        .map((x) => REVIEW_REASON_LABELS[x]);

      return {
        id: `review-${receipt.id}`,
        kind: "receipt_needs_review" as const,
        severity: "warning" as const,
        title: `${receipt.supplierName} odottaa tarkistusta`,
        detail: `${formatMoney(receipt.totalCents)} · ${reasons.join(" · ")}`,
        href: `/admin/kuitit?korosta=${receipt.id}`,
        entityId: receipt.id,
      };
    });
}

/**
 * Sulkematon työaika.
 *
 * Jos työntekijä on unohtanut leimata ulos, tunnit kertyvät loputtomiin ja
 * palkka on väärin. Tämä on tyypillisin työaikaseurannan virhe.
 */
function unclosedShiftAlerts(ctx: AlertContext): Alert[] {
  const alerts: Alert[] = [];

  for (const user of ctx.users) {
    const events = ctx.clockEvents.filter((e) => e.userId === user.id);

    // Vain eiliseen tai vanhempaan jäänyt avoin leimaus on ongelma —
    // tänään käynnissä oleva vuoro on normaali tila.
    const older = events.filter((e) => e.at.slice(0, 10) < ctx.today);
    if (older.length === 0) continue;

    const lastDay = older[older.length - 1].at.slice(0, 10);
    const dayEvents = older.filter((e) => e.at.slice(0, 10) === lastDay);

    if (currentState(dayEvents) !== "off") {
      alerts.push({
        id: `unclosed-${user.id}-${lastDay}`,
        kind: "unclosed_shift",
        severity: "warning",
        title: `${user.name}: työaika jäi sulkematta`,
        detail: `${formatDate(lastDay)} · leimaus on yhä auki`,
        href: "/admin/tyontekijat",
        entityId: user.id,
      });
    }
  }

  return alerts;
}

function shiftAlerts(ctx: AlertContext): Alert[] {
  const alerts: Alert[] = [];

  const pending = ctx.shifts.filter(
    (s) => s.status === "pending" && s.date >= ctx.today,
  );

  if (pending.length > 0) {
    alerts.push({
      id: "shift-pending",
      kind: "shift_pending",
      severity: "info",
      title: `${pending.length} työvuoroa odottaa vastausta`,
      detail: "Työntekijä ei ole vielä hyväksynyt tai kieltäytynyt",
      href: "/admin/tyovuorot",
    });
  }

  const declined = ctx.shifts.filter(
    (s) => s.status === "declined" && s.date >= ctx.today,
  );

  for (const shift of declined) {
    const user = ctx.users.find((u) => u.id === shift.userId);
    alerts.push({
      id: `declined-${shift.id}`,
      kind: "shift_pending",
      severity: "critical",
      title: `${user?.name ?? "Työntekijä"} ei pääse vuoroon`,
      detail: `${formatDate(shift.date)} · ${shift.startTime}–${shift.endTime} — vuoro on auki`,
      href: "/admin/tyovuorot",
      entityId: shift.id,
    });
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

function formatDate(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(d)}.${Number(m)}.`;
}

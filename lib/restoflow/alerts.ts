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
  type Absence,
  type Alert,
  type Budget,
  type ClockEvent,
  type Receipt,
  type OpenShift,
  type Shift,
  type User,
} from "./types";
import { currentState } from "./timeclock";
import { dayIn } from "./clock-context";
import { operationalAlerts } from "./operations";
import type { DailySales } from "./sales";

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
  absences: Absence[];
  month: string;
  today: string;

  /*
   * Toiminnallisten poikkeamien lisätiedot.
   *
   * Nykyhetki ja vyöhyke ovat pakollisia: "vuoro alkoi 20 minuuttia
   * sitten" ei ole pääteltävissä päivämäärästä.
   *
   * Avoimet vuorot ja myynti ovat valinnaisia vain siksi että ne
   * lisättiin myöhemmin; molemmat kulkevat samassa datapaketissa kuin
   * muutkin, joten käytännössä ne ovat aina mukana.
   */
  now: string;
  timezone: string;
  openShifts?: OpenShift[];
  sales?: DailySales[];
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
    ...operationalAlerts({
      users: ctx.users,
      shifts: ctx.shifts,
      openShifts: ctx.openShifts ?? [],
      clockEvents: ctx.clockEvents,
      receipts: ctx.receipts,
      sales: ctx.sales ?? [],
      today: ctx.today,
      now: ctx.now,
      timezone: ctx.timezone,
    }),
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
    .map((r) => ({
      receipt: r,
      check: checkVat(r.totalCents, r.vatCents, r.category, r.items),
    }))
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
    // Päivä ravintolan ajassa. Merkkijonon viipale on UTC:tä, jolloin
    // yöllä tehty leimaus osuisi väärälle päivälle.
    const older = events.filter((e) => dayIn(ctx.timezone, e.at) < ctx.today);
    if (older.length === 0) continue;

    const lastDay = dayIn(ctx.timezone, older[older.length - 1].at);
    const dayEvents = older.filter((e) => dayIn(ctx.timezone, e.at) === lastDay);

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

  // Poissaoloilmoitus on kriittinen: vuoro on yhä tekijällä, mutta
  // tekijä on kertonut ettei tule. Jos tämä ei nouse esiin, asia
  // huomataan vasta kun vuoro alkaa eikä kukaan ole paikalla.
  //
  // Tämä oli aiemmin sidottu vuoron declined-tilaan. Kun vuoroa ei enää
  // kuitata, tila ei voi syntyä — mutta itse asia ei kadonnut mihinkään,
  // joten ilmoitus luetaan nyt suoraan poissaoloista.
  // Loppupäivä ratkaisee: kesken oleva sairausloma on yhä voimassa,
  // vaikka se olisi alkanut viime viikolla.
  const upcoming = ctx.absences.filter((absence) => absence.endDate >= ctx.today);

  for (const absence of upcoming) {
    const user = ctx.users.find((u) => u.id === absence.userId);
    const shift = ctx.shifts.find(
      (s) =>
        s.userId === absence.userId &&
        s.date >= absence.date &&
        s.date <= absence.endDate,
    );

    const period =
      absence.date === absence.endDate
        ? formatDate(absence.date)
        : `${formatDate(absence.date)}–${formatDate(absence.endDate)}`;

    alerts.push({
      id: `absence-${absence.id}`,
      kind: "absence_reported",
      severity: "critical",
      title: `${user?.name ?? "Työntekijä"} ei pääse`,
      detail: shift
        ? `${period} · ${shift.startTime}–${shift.endTime} — vuoro on yhä hänellä`
        : `${period} — ei vuoroa jaksolle`,
      href: "/admin/tyovuorot",
      entityId: absence.id,
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

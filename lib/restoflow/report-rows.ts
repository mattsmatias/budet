/**
 * Raporttien rivit.
 *
 * Yksi lähde sekä CSV- että Excel-vientiin. Jos kumpikin rakentaisi
 * rivinsä itse, ne erkanisivat ensimmäisessä muutoksessa ja sama
 * raportti antaisi kaksi eri lukua kahdessa muodossa.
 */

import { can } from "@/lib/restoflow/permissions";
import {
  fetchBudgets,
  fetchClockEvents,
  fetchReceipts,
  fetchUsers,
} from "@/lib/restoflow/queries";
import {
  receiptsInMonth,
  sortByDateDesc,
  totalsByCategory,
} from "@/lib/restoflow/expenses";
import { budgetProgress } from "@/lib/restoflow/budgets";
import { totalsBySupplier } from "@/lib/restoflow/suppliers";
import { staffCostCents, workedBetween } from "@/lib/restoflow/timeclock";
import {
  CATEGORY_LABELS,
  PAYMENT_LABELS,
  POSITION_LABELS,
  REVIEW_REASON_LABELS,
} from "@/lib/restoflow/types";

export type ReportKind =
  | "kulut"
  | "kategoriat"
  | "kuitit"
  | "toimittajat"
  | "budjetit"
  | "tyoaika"
  | "henkilostokulut";

export const REPORT_KINDS: ReportKind[] = [
  "kulut",
  "kategoriat",
  "kuitit",
  "toimittajat",
  "budjetit",
  "tyoaika",
  "henkilostokulut",
];

export async function buildReportRows(
  kind: ReportKind,
  restaurantId: string,
  month: string,
  role: Parameters<typeof can>[0],
  timezone: string,
): Promise<string[][]> {
  // Tuntipalkat ovat henkilötietoa: kirjanpitäjä saa tunnit muttei palkkoja.
  const showsRates = can(role, "staff.rates.view");

  if (kind === "tyoaika" || kind === "henkilostokulut") {
    const [users, events] = await Promise.all([
      fetchUsers(restaurantId),
      fetchClockEvents(restaurantId, `${month}-01T00:00:00.000Z`),
    ]);

    const now = new Date().toISOString();
    const [year, m] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);

    const rows = users.map((u) => {
      const worked = workedBetween(
        events.filter((e) => e.userId === u.id),
        `${month}-01`,
        lastDay,
        now,
        timezone,
      );
      const hours = Math.round((worked.workedMs / 3600000) * 100) / 100;
      return {
        user: u,
        hours,
        cost: staffCostCents(worked.workedMs, u.hourlyRateCents ?? 0),
      };
    });

    if (kind === "tyoaika") {
      return [
        ["Työntekijä", "Tehtävä", "Tunnit"],
        ...rows.map((r) => [
          r.user.name,
          r.user.position ? POSITION_LABELS[r.user.position] : "—",
          money(Math.round(r.hours * 100)),
        ]),
        [],
        ["Yhteensä", "", money(Math.round(rows.reduce((s, r) => s + r.hours, 0) * 100))],
      ];
    }

    if (!showsRates) {
      return [
        ["Budet — henkilöstökuluraportti"],
        ["Huom", "Roolisi ei salli tuntipalkkojen tarkastelua"],
      ];
    }

    return [
      ["Budet — henkilöstökuluraportti"],
      ["Kuukausi", month],
      ["Huom", "Laskennallinen. Ei sisällä lisiä, lomakorvauksia eikä sivukuluja"],
      [],
      ["Työntekijä", "Tehtävä", "Tunnit", "Tuntipalkka", "Kulu"],
      ...rows.map((r) => [
        r.user.name,
        r.user.position ? POSITION_LABELS[r.user.position] : "—",
        money(Math.round(r.hours * 100)),
        money(r.user.hourlyRateCents ?? 0),
        money(r.cost),
      ]),
      [],
      [
        "Yhteensä",
        "",
        money(Math.round(rows.reduce((s, r) => s + r.hours, 0) * 100)),
        "",
        money(rows.reduce((s, r) => s + r.cost, 0)),
      ],
    ];
  }

  const receipts = await fetchReceipts(restaurantId);
  const inMonth = sortByDateDesc(receiptsInMonth(receipts, month));

  switch (kind) {
    case "kuitit": {
      const users = await fetchUsers(restaurantId);
      return [
        ["Päivä", "Toimittaja", "Kategoria", "Maksutapa", "Kuittinumero", "Netto", "ALV", "Yhteensä", "Tila", "Syyt", "Lisännyt"],
        ...inMonth.map((r) => [
          r.date,
          r.supplierName,
          CATEGORY_LABELS[r.category],
          PAYMENT_LABELS[r.paymentMethod],
          r.receiptNumber ?? "",
          money(r.totalCents - (r.vatCents ?? 0)),
          r.vatCents === null ? "" : money(r.vatCents),
          money(r.totalCents),
          r.status === "needs_review" ? "Tarkistettava" : "Tarkistettu",
          r.reviewReasons.map((x) => REVIEW_REASON_LABELS[x]).join(", "),
          users.find((u) => u.id === r.addedByUserId)?.name ?? "",
        ]),
      ];
    }

    case "kategoriat": {
      const totals = totalsByCategory(inMonth);
      const grand = inMonth.reduce((s, r) => s + r.totalCents, 0);
      return [
        ["Kategoria", "Kuitteja", "Osuus", "Yhteensä"],
        ...totals.map((t) => [
          CATEGORY_LABELS[t.category],
          String(t.receiptCount),
          `${Math.round(t.share * 100)} %`,
          money(t.totalCents),
        ]),
        [],
        ["Yhteensä", String(inMonth.length), "100 %", money(grand)],
      ];
    }

    case "toimittajat": {
      const totals = totalsBySupplier(inMonth);
      return [
        ["Toimittaja", "Kuitteja", "Keskiarvo", "Osuus", "Yhteensä"],
        ...totals.map((t) => [
          t.name,
          String(t.receiptCount),
          money(t.averageCents),
          `${Math.round(t.share * 100)} %`,
          money(t.totalCents),
        ]),
      ];
    }

    case "budjetit": {
      const budgets = await fetchBudgets(restaurantId);
      const progress = budgetProgress(receipts, budgets, month);
      return [
        ["Kategoria", "Budjetti", "Käytetty", "Jäljellä", "Osuus", "Tila"],
        ...progress.map((p) => [
          CATEGORY_LABELS[p.category],
          p.budgetCents === null ? "" : money(p.budgetCents),
          money(p.spentCents),
          p.remainingCents === null ? "" : money(p.remainingCents),
          p.ratio === null ? "" : `${Math.round(p.ratio * 100)} %`,
          STATUS_LABELS[p.status],
        ]),
      ];
    }

    case "kulut": {
      const totals = totalsByCategory(inMonth);
      const grand = inMonth.reduce((s, r) => s + r.totalCents, 0);
      const vat = inMonth.reduce((s, r) => s + (r.vatCents ?? 0), 0);

      return [
        ["Budet — kuluraportti"],
        ["Kuukausi", month],
        ["Huom", "Luvut ovat järjestelmään kirjattuja kuluja, eivät pankkitilin tapahtumia"],
        [],
        ["Kategoria", "Kuitteja", "Yhteensä"],
        ...totals.map((t) => [
          CATEGORY_LABELS[t.category],
          String(t.receiptCount),
          money(t.totalCents),
        ]),
        [],
        ["Kirjatut kulut yhteensä", "", money(grand)],
        ["Josta ALV", "", money(vat)],
        ["Kuitteja", String(inMonth.length), ""],
        ["Tarkistettavia", String(inMonth.filter((r) => r.status === "needs_review").length), ""],
      ];
    }
  }

  return [];
}

const STATUS_LABELS: Record<string, string> = {
  ok: "OK",
  warning: "Lähestyy rajaa",
  exceeded: "Ylitetty",
  none: "Ei budjettia",
};

/** Sentit euroiksi desimaalipilkulla, ilman valuuttamerkkiä. */
function money(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}


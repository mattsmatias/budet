/**
 * Raporttien rivit.
 *
 * Yksi lähde sekä CSV- että Excel-vientiin. Jos kumpikin rakentaisi
 * rivinsä itse, ne erkanisivat ensimmäisessä muutoksessa ja sama
 * raportti antaisi kaksi eri lukua kahdessa muodossa.
 */

import { can } from "@/lib/restoflow/permissions";
import { adminText } from "@/lib/i18n/admin-text";
import type { AdminText } from "@/lib/i18n/admin-text";
import { labels } from "@/lib/i18n/labels";
import type { AppLocale } from "@/lib/i18n/app-locales";
import { formatRate } from "@/lib/money";
import { summarise } from "./sales-vat";
import {
  fetchBudgets,
  fetchClockEvents,
  fetchDailySales,
  fetchReceipts,
  fetchSalesGroups,
  fetchSalesLinesBetween,
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
import { windowStartIso } from "@/lib/restoflow/clock-context";
import {} from "@/lib/restoflow/types";

export type ReportKind =
  | "kulut"
  | "kategoriat"
  | "kuitit"
  | "toimittajat"
  | "budjetit"
  | "tyoaika"
  | "henkilostokulut"
  | "alv"
  /*
   * Kirjanpidon raportit samaan koneistoon.
   *
   * Nama tulevat kirjanpidon tauluista eivatka kuiteista, mutta ne
   * viedaan samalla CSV- ja Excel-reitilla. Oma vientireitti olisi
   * tarkoittanut toista puolipiste- ja BOM-kasittelya joka ehtii
   * ajautua erilleen tasta.
   */
  | "paivakirja"
  | "paakirja"
  | "tuloslaskelma"
  | "tase";

export const REPORT_KINDS: ReportKind[] = [
  "kulut",
  "kategoriat",
  "kuitit",
  "toimittajat",
  "budjetit",
  "tyoaika",
  "henkilostokulut",
  "alv",
  "paivakirja",
  "paakirja",
  "tuloslaskelma",
  "tase",
];

/** Kirjanpidon raportit vaativat oman oikeutensa. */
export const ACCOUNTING_KINDS: ReportKind[] = [
  "paivakirja",
  "paakirja",
  "tuloslaskelma",
  "tase",
];

export async function buildReportRows(
  kind: ReportKind,
  restaurantId: string,
  month: string,
  role: Parameters<typeof can>[0],
  timezone: string,
  locale: AppLocale,
): Promise<string[][]> {
  const nimet = labels(locale);
  const t = adminText(locale);
  // Tuntipalkat ovat henkilötietoa: kirjanpitäjä saa tunnit muttei palkkoja.
  const showsRates = can(role, "staff.rates.view");

  /*
   * ALV-raportti lukee myyntiä eikä kuitteja.
   *
   * Oma haaransa ennen kuittien hakua: kuukauden kuittien lataaminen
   * ALV-raporttia varten olisi turhaa työtä, ja myynti tulee eri
   * tauluista.
   */
  if (kind === "alv") {
    return vatReportRows(restaurantId, month, t);
  }

  if (ACCOUNTING_KINDS.includes(kind)) {
    return accountingReportRows(kind, restaurantId, month, t);
  }

  if (kind === "tyoaika" || kind === "henkilostokulut") {
    const [users, events] = await Promise.all([
      fetchUsers(restaurantId),
      fetchClockEvents(restaurantId, windowStartIso(`${month}-01`)),
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
        [t.vienti.employee, t.vienti.position, t.vienti.hours],
        ...rows.map((r) => [
          r.user.name,
          r.user.position ? nimet.positions[r.user.position] : "—",
          money(Math.round(r.hours * 100)),
        ]),
        [],
        [
          t.vienti.total,
          "",
          money(Math.round(rows.reduce((s, r) => s + r.hours, 0) * 100)),
        ],
      ];
    }

    if (!showsRates) {
      return [[t.vienti.labourReport], [t.vienti.note, t.vienti.noRateAccess]];
    }

    return [
      [t.vienti.labourReport],
      [t.vienti.month, month],
      [t.vienti.note, t.vienti.calculatedNote],
      [],
      [
        t.vienti.employee,
        t.vienti.position,
        t.vienti.hours,
        t.vienti.hourlyRate,
        t.vienti.cost,
      ],
      ...rows.map((r) => [
        r.user.name,
        r.user.position ? nimet.positions[r.user.position] : "—",
        money(Math.round(r.hours * 100)),
        money(r.user.hourlyRateCents ?? 0),
        money(r.cost),
      ]),
      [],
      [
        t.vienti.total,
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
        [
          t.vienti.day,
          t.vienti.supplier,
          t.vienti.category,
          t.vienti.paymentMethod,
          t.vienti.receiptNumber,
          t.vienti.net,
          "ALV",
          t.vienti.total,
          t.vienti.status,
          t.vienti.reasons,
          t.vienti.addedBy,
        ],
        ...inMonth.map((r) => [
          r.date,
          r.supplierName,
          nimet.categories[r.category],
          nimet.payments[r.paymentMethod],
          r.receiptNumber ?? "",
          money(r.totalCents - (r.vatCents ?? 0)),
          r.vatCents === null ? "" : money(r.vatCents),
          money(r.totalCents),
          r.status === "needs_review" ? t.vienti.toCheck : t.vienti.checked,
          r.reviewReasons.map((x) => nimet.reviewReasons[x]).join(", "),
          users.find((u) => u.id === r.addedByUserId)?.name ?? "",
        ]),
      ];
    }

    case "kategoriat": {
      const totals = totalsByCategory(inMonth);
      const grand = inMonth.reduce((s, r) => s + r.totalCents, 0);
      return [
        [
          t.vienti.category,
          t.vienti.receiptCount,
          t.vienti.share,
          t.vienti.total,
        ],
        ...totals.map((t) => [
          nimet.categories[t.category],
          String(t.receiptCount),
          `${Math.round(t.share * 100)} %`,
          money(t.totalCents),
        ]),
        [],
        [t.vienti.total, String(inMonth.length), "100 %", money(grand)],
      ];
    }

    case "toimittajat": {
      const totals = totalsBySupplier(inMonth);
      return [
        [
          t.vienti.supplier,
          t.vienti.receiptCount,
          t.vienti.average,
          t.vienti.share,
          t.vienti.total,
        ],
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
        [
          t.vienti.category,
          t.vienti.budget,
          t.vienti.used,
          t.vienti.remaining,
          t.vienti.share,
          t.vienti.status,
        ],
        ...progress.map((p) => [
          nimet.categories[p.category],
          p.budgetCents === null ? "" : money(p.budgetCents),
          money(p.spentCents),
          p.remainingCents === null ? "" : money(p.remainingCents),
          p.ratio === null ? "" : `${Math.round(p.ratio * 100)} %`,
          nimet.budgetStatus[p.status],
        ]),
      ];
    }

    case "kulut": {
      const totals = totalsByCategory(inMonth);
      const grand = inMonth.reduce((s, r) => s + r.totalCents, 0);
      const vat = inMonth.reduce((s, r) => s + (r.vatCents ?? 0), 0);

      return [
        [t.vienti.expenseReport],
        [t.vienti.month, month],
        [t.vienti.note, t.vienti.scopeNote],
        [],
        [t.vienti.category, t.vienti.receiptCount, t.vienti.total],
        ...totals.map((t) => [
          nimet.categories[t.category],
          String(t.receiptCount),
          money(t.totalCents),
        ]),
        [],
        [t.vienti.recordedTotal, "", money(grand)],
        [t.vienti.ofWhichVat, "", money(vat)],
        [t.vienti.receiptCount, String(inMonth.length), ""],
        [
          t.vienti.toCheckCount,
          String(inMonth.filter((r) => r.status === "needs_review").length),
          "",
        ],
      ];
    }
  }

  return [];
}

/** Sentit euroiksi desimaalipilkulla, ilman valuuttamerkkiä. */
function money(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

// ---------------------------------------------------------------------------

/**
 * Myynnin ALV kannoittain.
 *
 * KANTA TULEE RIVILTÄ, EI ASETUKSESTA.
 *
 * Raportti kertoo mitä kuukaudessa tapahtui, ja tapahtumaan kuuluu se
 * verokanta joka silloin oli voimassa. Nykyisestä asetuksesta laskettu
 * raportti muuttuisi takautuvasti kun kantaa muutetaan — ja
 * kirjanpitoon lähetetty kuukausi ei saa muuttua jälkikäteen.
 *
 * ERITTELEMÄTÖN PÄIVÄ EI HUKU SUMMIIN.
 *
 * Käsin kirjattu päivä on yksi luku jota ei voi jakaa kannoittain
 * jälkikäteen tuntematta myynnin rakennetta. Se on omassa
 * osiossaan, jottei kannoittainen summa väittäisi kattavansa koko
 * kuukautta.
 */
async function vatReportRows(
  restaurantId: string,
  month: string,
  t: AdminText,
): Promise<string[][]> {
  const [year, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);

  const [sales, groups] = await Promise.all([
    fetchDailySales(restaurantId, 400),
    fetchSalesGroups(restaurantId),
  ]);

  const inMonth = sales
    .filter((day) => day.date >= `${month}-01` && day.date <= lastDay)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Yksi kysely koko kuukaudelle. Päivä ja sen rivit pysyvät yhdessä:
  // rivillä ei ole omaa päivää.
  const linesByDate = await fetchSalesLinesBetween(
    restaurantId,
    `${month}-01`,
    lastDay,
  );

  const perDay = inMonth.map((day) => ({
    day,
    lines: linesByDate.get(day.date) ?? [],
  }));

  const allLines = perDay.flatMap((entry) => entry.lines);
  const summary = summarise(allLines);

  const nameOf = (id: string) =>
    groups.find((g) => g.id === id)?.name ?? t.vienti.unknownGroup;
  const unspecified = perDay.filter((entry) => entry.lines.length === 0);

  return [
    [t.vienti.vatReport],
    [t.vienti.month, month],
    [t.vienti.note, t.vienti.vatRateNote],
    [],

    [t.vienti.vatRate, t.vienti.withTax, "ALV", t.vienti.withoutTax],
    ...summary.byRate.map((rate) => [
      formatRate(rate.vatRate),
      money(rate.grossCents),
      money(rate.vatCents),
      money(rate.netCents),
    ]),
    [
      t.vienti.total,
      money(summary.grossCents),
      money(summary.vatCents),
      money(summary.netCents),
    ],
    [],

    [
      t.vienti.day,
      t.vienti.salesGroup,
      t.vienti.vatRate,
      t.vienti.withTax,
      "ALV",
      t.vienti.withoutTax,
    ],
    ...perDay.flatMap((entry) =>
      entry.lines.map((line) => [
        entry.day.date,
        nameOf(line.salesGroupId),
        formatRate(line.vatRate),
        money(line.grossCents),
        money(line.vatCents),
        money(line.netCents),
      ]),
    ),

    ...(unspecified.length > 0
      ? [
          [],
          [t.vienti.unbrokenDays],
          [t.vienti.note, t.vienti.unbrokenNote],
          [t.vienti.day, t.vienti.netSales],
          ...unspecified.map((entry) => [
            entry.day.date,
            money(entry.day.netCents),
          ]),
        ]
      : []),
  ];
}

// ---------------------------------------------------------------------------
// Kirjanpidon raportit
// ---------------------------------------------------------------------------

/**
 * Päiväkirja, pääkirja, tuloslaskelma ja tase riveinä.
 *
 * LUVUT TULEVAT KANNASTA SELLAISINAAN.
 *
 * Nämä eivät laske mitään uudelleen: ne pyytävät saman funktion jonka
 * käyttöliittymäkin näyttää. Jos vienti laskisi omansa, tiedosto ja
 * ruutu voisivat erota — ja tiedosto on se joka menee kirjanpitäjälle.
 *
 * VIENTI NÄYTTÄÄ VAIN KIRJATUT.
 *
 * Kirjausesitys ei ole kirjanpitoa. Tiedosto joka lähtee ulos ei saa
 * sisältää rivejä joita kukaan ei ole hyväksynyt.
 */
async function accountingReportRows(
  kind: ReportKind,
  restaurantId: string,
  month: string,
  t: AdminText,
): Promise<string[][]> {
  const {
    fetchBalanceSheet,
    fetchGeneralLedger,
    fetchIncomeStatement,
    fetchJournal,
  } = await import("./accounting-queries");

  if (kind === "paivakirja") {
    const entries = await fetchJournal(restaurantId, month, false);

    return [
      [
        t.vienti.day,
        t.vienti.voucher,
        t.vienti.explanation,
        t.vienti.account,
        t.vienti.accountName,
        t.vienti.debit,
        t.vienti.credit,
        "ALV %",
        t.vienti.source,
      ],
      ...entries.flatMap((entry) =>
        entry.lines.map((line) => [
          entry.entryDate,
          String(entry.entryNumber),
          entry.description,
          line.accountNumber,
          line.accountName,
          line.debitCents > 0 ? money(line.debitCents) : "",
          line.creditCents > 0 ? money(line.creditCents) : "",
          line.vatRate !== null ? String(line.vatRate * 100) : "",
          entry.sourceType,
        ]),
      ),
    ];
  }

  if (kind === "paakirja") {
    const accounts = await fetchGeneralLedger(restaurantId, month, false);

    return [
      [
        t.vienti.account,
        t.vienti.name,
        t.vienti.kind,
        t.vienti.day,
        t.vienti.voucher,
        t.vienti.explanation,
        t.vienti.debit,
        t.vienti.credit,
      ],
      ...accounts
        .filter((a) => a.lineCount > 0)
        .flatMap((account) =>
          account.lines.map((line) => [
            account.number,
            account.name,
            account.type,
            line.date,
            String(line.entryNumber),
            line.description,
            line.debitCents > 0 ? money(line.debitCents) : "",
            line.creditCents > 0 ? money(line.creditCents) : "",
          ]),
        ),
    ];
  }

  if (kind === "tuloslaskelma") {
    const income = await fetchIncomeStatement(restaurantId, month, false);
    if (!income) return [[t.vienti.incomeStatement], [t.vienti.noData]];

    return [
      [t.vienti.item, t.vienti.account, t.vienti.name, t.vienti.amount],
      ...income.revenue.map((r) => [
        t.vienti.revenue,
        r.number,
        r.name,
        money(r.amountCents),
      ]),
      [t.vienti.revenueTotal, "", "", money(income.revenueTotalCents)],
      ...income.expenses.map((r) => [
        t.vienti.expenses,
        r.number,
        r.name,
        money(r.amountCents),
      ]),
      [t.vienti.expensesTotal, "", "", money(income.expenseTotalCents)],
      [t.vienti.result, "", "", money(income.resultCents)],
    ];
  }

  // tase
  const balance = await fetchBalanceSheet(restaurantId, month, false);
  if (!balance) return [[t.vienti.balanceSheet], [t.vienti.noData]];

  return [
    [t.vienti.item, t.vienti.account, t.vienti.name, t.vienti.amount],
    ...balance.assets.map((r) => [
      t.vienti.assets,
      r.number,
      r.name,
      money(r.amountCents),
    ]),
    [t.vienti.assetsTotal, "", "", money(balance.assetsTotalCents)],
    ...balance.liabilities.map((r) => [
      t.vienti.liabilities,
      r.number,
      r.name,
      money(r.amountCents),
    ]),
    [t.vienti.periodResult, "", "", money(balance.resultCents)],
    [t.vienti.liabilitiesTotal, "", "", money(balance.balancesTotalCents)],
    [t.vienti.balances, "", "", balance.balanced ? "kyllä" : "ei"],
  ];
}

import { z } from "zod";
import { fill } from "@/lib/i18n/auth-text";
import { adminText } from "@/lib/i18n/admin-text";
import type { Role } from "@/lib/restoflow/types";
import { can } from "@/lib/restoflow/permissions";
import { formatMoney } from "@/lib/money";
import {
  needsReview,
  periodTotals,
  previousMonth,
  receiptsInMonth,
  sortByDateDesc,
  formatMonth,
  totalsByCategory,
} from "@/lib/restoflow/expenses";
import { supplierTotalsInMonth } from "@/lib/restoflow/suppliers";
import { budgetLines } from "@/lib/restoflow/dashboard";
import { labels } from "@/lib/i18n/labels";
import { DAILY_TOOLS } from "./tools-daily";
import { VAT_TOOLS } from "./tools-vat";
import { TASK_TOOLS } from "./tools-tasks";
import { INDUSTRY_TOOLS } from "./tools-industry";
import { defineTool, monthSchema, type ToolDefinition } from "./tool-kit";

/**
 * Matin työkalut.
 *
 * Malli ei näe tietokantaa. Se näkee tämän luettelon, ja jokainen
 * työkalu tekee kolme asiaa ennen kuin se koskee mihinkään:
 * tarkistaa oikeuden, validoi syötteen ja hakee datan käyttäjän omalla
 * istunnolla. Sama RLS joka suojaa käyttöliittymää suojaa Mattia.
 *
 * KAKSI TASOA, EI KOLMEA.
 *
 * Lukevat työkalut suorittavat heti. Kirjoittavat työkalut EIVÄT
 * kirjoita — ne palauttavat esikatselun ja tallentavat ehdotuksen
 * odottamaan ihmisen hyväksyntää. Malli ei voi suorittaa muutosta
 * missään tilanteessa, ei edes yrittämällä.
 *
 * Tämä on koko turvallisuuden ydin. Jos malli harhautetaan kuittiin
 * piilotetulla tekstillä, se saa aikaan korkeintaan ehdotuksen jonka
 * käyttäjä näkee ja hylkää.
 */

export {
  defineTool,
  dateSchema,
  monthSchema,
  type ActionPreview,
  type Capability,
  type ToolCard,
  type ToolDefinition,
  type ToolLevel,
  type ToolResult,
} from "./tool-kit";

// ---------------------------------------------------------------------------
// Lukevat työkalut
// ---------------------------------------------------------------------------

const getDashboard = defineTool({
  name: "get_dashboard_summary",
  description:
    "Kuukauden yhteenveto: kirjatut kulut, kuittien määrä, ALV, tarkistettavien määrä. " +
    "Käytä tätä ensin kun käyttäjä kysyy yleisesti miten menee.",
  level: "read",
  requires: "expenses.view",
  schema: z.object({
    month: monthSchema.optional().describe("Oletus: kuluva kuukausi"),
  }),
  async run(ctx, input) {
    const month = input.month ?? ctx.month;
    const totals = periodTotals(ctx.data.receipts, month);
    const previous = periodTotals(ctx.data.receipts, previousMonth(month));

    return {
      summary:
        `${month}: kirjattuja kuluja ${formatMoney(totals.totalCents)}, ` +
        `${totals.receiptCount} kuittia, ALV ${formatMoney(totals.vatCents)}, ` +
        `${totals.needsReviewCount} tarkistettavaa. ` +
        `Edellinen kuukausi ${formatMoney(previous.totalCents)}.`,
      data: {
        month,
        totalCents: totals.totalCents,
        receiptCount: totals.receiptCount,
        vatCents: totals.vatCents,
        needsReviewCount: totals.needsReviewCount,
        previousMonthTotalCents: previous.totalCents,
      },
      card: {
        title: formatMonth(month, ctx.locale),
        value: formatMoney(totals.totalCents),
        meta: [
          `${totals.receiptCount} kuittia`,
          `ALV ${formatMoney(totals.vatCents)}`,
          ...(totals.needsReviewCount > 0
            ? [`${totals.needsReviewCount} tarkistettavaa`]
            : []),
        ],
        href: `/admin/kulut?kuukausi=${month}`,
        linkLabel: adminText(ctx.locale).korttiLinkki.showExpenses,
      },
    };
  },
});

const getExpensesByCategory = defineTool({
  name: "get_expenses_by_category",
  description:
    "Kuukauden kulut kategorioittain. Käytä kun kysytään mihin raha meni tai " +
    "paljonko johonkin kategoriaan kului.",
  level: "read",
  requires: "expenses.view",
  schema: z.object({ month: monthSchema.optional() }),
  async run(ctx, input) {
    const month = input.month ?? ctx.month;
    const totals = totalsByCategory(receiptsInMonth(ctx.data.receipts, month));

    if (totals.length === 0) {
      return {
        summary: `${month}: ei kirjattuja kuluja.`,
        data: { month, categories: [] },
      };
    }

    return {
      summary:
        `${month} kategorioittain: ` +
        totals
          .map(
            (t) =>
              `${labels(ctx.locale).categories[t.category]} ${formatMoney(t.totalCents)}`,
          )
          .join(", "),
      data: {
        month,
        categories: totals.map((t) => ({
          category: t.category,
          label: labels(ctx.locale).categories[t.category],
          totalCents: t.totalCents,
        })),
      },
      card: {
        title: fill(adminText(ctx.locale).kortti.byCategoryTitle, {
          kuukausi: formatMonth(month, ctx.locale),
        }),
        value: formatMoney(totals.reduce((sum, t) => sum + t.totalCents, 0)),
        bars: totals.slice(0, 5).map((t) => ({
          label: labels(ctx.locale).categories[t.category],
          value: formatMoney(t.totalCents),
          percent: Math.round(t.share * 100),
        })),
        href: `/admin/kulut?kuukausi=${month}`,
        linkLabel: adminText(ctx.locale).korttiLinkki.showExpenses,
      },
    };
  },
});

const getSuppliers = defineTool({
  name: "get_top_suppliers",
  description:
    "Kuukauden suurimmat toimittajat euroittain. Käytä kun kysytään keneltä " +
    "ostettiin tai paljonko tietylle toimittajalle meni.",
  level: "read",
  requires: "expenses.view",
  schema: z.object({
    month: monthSchema.optional(),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  async run(ctx, input) {
    const month = input.month ?? ctx.month;
    const suppliers = supplierTotalsInMonth(ctx.data.receipts, month).slice(
      0,
      input.limit ?? 5,
    );

    if (suppliers.length === 0) {
      return {
        summary: `${month}: ei ostoja.`,
        data: { month, suppliers: [] },
      };
    }

    return {
      summary:
        `${month} suurimmat toimittajat: ` +
        suppliers
          .map((s) => `${s.name} ${formatMoney(s.totalCents)}`)
          .join(", "),
      data: {
        month,
        suppliers: suppliers.map((s) => ({
          name: s.name,
          totalCents: s.totalCents,
          receiptCount: s.receiptCount,
        })),
      },
      card: {
        title: fill(adminText(ctx.locale).kortti.topSuppliersTitle, {
          kuukausi: formatMonth(month, ctx.locale),
        }),
        value: formatMoney(suppliers.reduce((sum, x) => sum + x.totalCents, 0)),
        bars: suppliers.map((x) => ({
          label: x.name,
          value: formatMoney(x.totalCents),
          percent: Math.round(x.share * 100),
        })),
        href: "/admin/toimittajat",
        linkLabel: adminText(ctx.locale).korttiLinkki.allSuppliers,
      },
    };
  },
});

const searchReceipts = defineTool({
  name: "search_receipts",
  description:
    "Etsii kuitteja. Voit rajata kuukaudella, toimittajan nimellä tai " +
    "vähimmäissummalla. Palauttaa enintään 25 kuittia.",
  level: "read",
  requires: "receipts.view",
  schema: z.object({
    month: monthSchema.optional(),
    supplier: z
      .string()
      .max(120)
      .optional()
      .describe("Osa toimittajan nimestä"),
    minEuros: z.number().min(0).optional(),
    onlyNeedsReview: z.boolean().optional(),
  }),
  async run(ctx, input) {
    let rows = input.month
      ? receiptsInMonth(ctx.data.receipts, input.month)
      : ctx.data.receipts;

    if (input.supplier) {
      const needle = input.supplier.toLowerCase();
      rows = rows.filter((r) => r.supplierName.toLowerCase().includes(needle));
    }

    if (typeof input.minEuros === "number") {
      const cents = Math.round(input.minEuros * 100);
      rows = rows.filter((r) => r.totalCents >= cents);
    }

    if (input.onlyNeedsReview) rows = needsReview(rows);

    const found = sortByDateDesc(rows);
    const shown = found.slice(0, 25);
    const total = found.reduce((s, r) => s + r.totalCents, 0);

    return {
      card:
        found.length === 0
          ? undefined
          : {
              title: adminText(ctx.locale).kortti.searchResult,
              value: formatMoney(total),
              meta: [
                `${found.length} kuittia`,
                ...(input.supplier ? [input.supplier] : []),
                ...(input.month ? [input.month] : []),
              ],
              href: "/admin/kuitit",
              linkLabel: adminText(ctx.locale).korttiLinkki.openReceipts,
            },
      summary:
        found.length === 0
          ? "Ei osumia."
          : `${found.length} kuittia, yhteensä ${formatMoney(total)}.` +
            (found.length > shown.length
              ? ` Näytetään ${shown.length} uusinta.`
              : ""),
      data: {
        matchCount: found.length,
        totalCents: total,
        receipts: shown.map((r) => ({
          id: r.id,
          date: r.date,
          supplier: r.supplierName,
          totalCents: r.totalCents,
          category: r.category,
          status: r.status,
        })),
      },
    };
  },
});

const getBudgets = defineTool({
  name: "get_budget_status",
  description:
    "Budjettien tilanne kuukaudelta: raja, käytetty, jäljellä ja käyttöaste " +
    "kategorioittain.",
  level: "read",
  requires: "budgets.view",
  schema: z.object({ month: monthSchema.optional() }),
  async run(ctx, input) {
    const month = input.month ?? ctx.month;
    const lines = budgetLines(
      adminText(ctx.locale),
      ctx.data.receipts,
      ctx.data.budgets,
      month,
    );

    if (lines.length === 0) {
      return {
        summary: "Budjetteja ei ole määritetty.",
        data: { month, budgets: [] },
      };
    }

    return {
      summary:
        `${month} budjetit: ` +
        lines
          .map(
            (l) =>
              `${labels(ctx.locale).categories[l.category]} ${formatMoney(l.spentCents)}/${formatMoney(l.budgetCents)}` +
              ` (${l.percent} %)`,
          )
          .join(", "),
      data: {
        month,
        budgets: lines.map((l) => ({
          category: l.category,
          label: labels(ctx.locale).categories[l.category],
          budgetCents: l.budgetCents,
          spentCents: l.spentCents,
          remainingCents: l.budgetCents - l.spentCents,
          usedPercent: l.percent,
        })),
      },
      card: {
        title: fill(adminText(ctx.locale).kortti.budgetsTitle, {
          kuukausi: formatMonth(month, ctx.locale),
        }),
        value: formatMoney(lines.reduce((sum, l) => sum + l.spentCents, 0)),
        meta: [
          `${formatMoney(lines.reduce((sum, l) => sum + l.budgetCents, 0))} budjetoitu`,
        ],
        bars: lines.slice(0, 5).map((l) => ({
          label: labels(ctx.locale).categories[l.category],
          value: `${l.percent} %`,
          percent: Math.min(100, l.percent),
        })),
        href: `/admin/budjetit?kuukausi=${month}`,
        linkLabel: adminText(ctx.locale).korttiLinkki.showBudgets,
      },
    };
  },
});

// ---------------------------------------------------------------------------
// Kirjoittavat työkalut — nämä eivät kirjoita
// ---------------------------------------------------------------------------
//
// Jokainen palauttaa esikatselun ja tallentaa ehdotuksen. Suoritus
// tapahtuu vasta erillisessä palvelintoiminnossa jonka ihminen
// laukaisee, ja se lukee argumentit kannasta eikä selaimesta.

// ---------------------------------------------------------------------------

export const TOOLS: ToolDefinition[] = [
  ...DAILY_TOOLS,
  ...VAT_TOOLS,
  ...TASK_TOOLS,
  ...INDUSTRY_TOOLS,
  getDashboard,
  getExpensesByCategory,
  getSuppliers,
  searchReceipts,
  getBudgets,
];

/** Työkalut jotka rooli saa käyttää. */
export function toolsFor(role: Role): ToolDefinition[] {
  return TOOLS.filter((tool) => can(role, tool.requires));
}

export function findTool(name: string): ToolDefinition | null {
  return TOOLS.find((tool) => tool.name === name) ?? null;
}

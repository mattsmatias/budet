import { z } from "zod";
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
import {
  LUNCH_STATUS_LABELS,
  formatWeekRange,
  includedExtras,
  inheritedIncludes,
  previousWeek,
  hasContent,
  hasUnpublishedChanges,
  isoWeekNumber,
  weekStartOf,
  weekdayName,
} from "@/lib/restoflow/lunch";
import { DAILY_TOOLS } from "./tools-daily";
import { VAT_TOOLS } from "./tools-vat";
import { TASK_TOOLS } from "./tools-tasks";
import { PLANNING_TOOLS } from "./tools-planning";
import {
  defineTool,
  dateSchema,
  monthSchema,
  type ActionPreview,
  type ToolDefinition,
} from "./tool-kit";

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
        linkLabel: "Näytä kulut",
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
        title: `${formatMonth(month, ctx.locale)} kategorioittain`,
        value: formatMoney(totals.reduce((sum, t) => sum + t.totalCents, 0)),
        bars: totals.slice(0, 5).map((t) => ({
          label: labels(ctx.locale).categories[t.category],
          value: formatMoney(t.totalCents),
          percent: Math.round(t.share * 100),
        })),
        href: `/admin/kulut?kuukausi=${month}`,
        linkLabel: "Näytä kulut",
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
        title: `Suurimmat toimittajat · ${formatMonth(month, ctx.locale)}`,
        value: formatMoney(suppliers.reduce((sum, x) => sum + x.totalCents, 0)),
        bars: suppliers.map((x) => ({
          label: x.name,
          value: formatMoney(x.totalCents),
          percent: Math.round(x.share * 100),
        })),
        href: "/admin/toimittajat",
        linkLabel: "Kaikki toimittajat",
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
              title: "Hakutulos",
              value: formatMoney(total),
              meta: [
                `${found.length} kuittia`,
                ...(input.supplier ? [input.supplier] : []),
                ...(input.month ? [input.month] : []),
              ],
              href: "/admin/kuitit",
              linkLabel: "Avaa kuitit",
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
    const lines = budgetLines(ctx.data.receipts, ctx.data.budgets, month);

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
        title: `Budjetit · ${formatMonth(month, ctx.locale)}`,
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
        linkLabel: "Näytä budjetit",
      },
    };
  },
});

const getLunchWeek = defineTool({
  name: "get_lunch_week",
  description:
    "Yhden viikon lounaslista: tila, päivät, hinnat ja ruoat. " +
    "weekStart on viikon maanantai; ilman sitä kuluva viikko.",
  level: "read",
  requires: "lunch.view",
  schema: z.object({ weekStart: dateSchema.optional() }),
  async run(ctx, input) {
    const week = weekStartOf(input.weekStart ?? ctx.today);
    const menu = await ctx.lunchWeek(week);

    if (!menu) {
      return {
        summary: `Viikolle ${isoWeekNumber(week)} (${formatWeekRange(week, ctx.locale)}) ei ole lounaslistaa.`,
        data: { weekStart: week, exists: false },
      };
    }

    const days = menu.days
      .filter((d) => d.items.length > 0)
      .map((d) => ({
        date: d.date,
        weekday: weekdayName(d.date, ctx.locale),
        items: d.items.map((i) => i.name),
      }));

    // Hinta on viikossa, ei päivässä.
    const lunchPrice = menu.prices.find((p) => p.name === "Lounas") ?? null;
    const priceRange = lunchPrice ? formatMoney(lunchPrice.cents) : null;

    return {
      card: {
        title: `Viikko ${isoWeekNumber(week)} · ${formatWeekRange(week, ctx.locale)}`,
        value: LUNCH_STATUS_LABELS[menu.status],
        meta: [
          `${days.length} päivää`,
          `${menu.days.reduce((n, d) => n + d.items.length, 0)} ruokaa`,
          ...(priceRange ? [`Lounas ${priceRange}`] : []),
          ...(includedExtras(menu).length > 0
            ? [`sis. ${includedExtras(menu).join(" ja ")}`]
            : []),
        ],
        href: `/admin/lounas?viikko=${week}`,
        linkLabel: "Avaa lounaslista",
      },
      summary:
        `Viikko ${isoWeekNumber(week)} (${formatWeekRange(week, ctx.locale)}): tila ${menu.status}` +
        (hasUnpublishedChanges(menu) ? ", julkaisemattomia muutoksia" : "") +
        `. ${days.length} päivää joilla sisältöä.`,
      data: {
        weekStart: week,
        exists: true,
        status: menu.status,
        hasUnpublishedChanges: hasUnpublishedChanges(menu),
        prices: menu.prices.map((p) => ({ name: p.name, cents: p.cents })),
        includesDessert: menu.includesDessert,
        includesCoffee: menu.includesCoffee,
        days,
      },
    };
  },
});

const getStaff = defineTool({
  name: "get_staff",
  description: "Ravintolan aktiiviset työntekijät ja heidän roolinsa.",
  level: "read",
  requires: "staff.view",
  schema: z.object({}),
  async run(ctx) {
    const active = ctx.data.users.filter((u) => u.active);

    return {
      summary: `${active.length} aktiivista työntekijää.`,
      data: {
        // Tuntipalkkoja ei anneta mallille. Ne ovat henkilötietoa jota
        // tähän ei tarvita, ja mitä ei lähetetä sitä ei voi vuotaa.
        staff: active.map((u) => ({
          name: u.name,
          role: u.role,
          position: u.position,
        })),
      },
    };
  },
});

const getShifts = defineTool({
  name: "get_shifts",
  description:
    "Työvuorot aikaväliltä. Käytä kun kysytään kuka on töissä tiettynä päivänä.",
  level: "read",
  requires: "shifts.view.all",
  schema: z.object({
    from: dateSchema,
    to: dateSchema,
  }),
  async run(ctx, input) {
    const rows = ctx.data.shifts
      .filter((s) => s.date >= input.from && s.date <= input.to)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.startTime.localeCompare(b.startTime),
      );

    const names = new Map(ctx.data.users.map((u) => [u.id, u.name]));

    return {
      summary:
        rows.length === 0
          ? `Ei vuoroja välillä ${input.from}–${input.to}.`
          : `${rows.length} vuoroa välillä ${input.from}–${input.to}.`,
      data: {
        shifts: rows.map((s) => ({
          date: s.date,
          weekday: weekdayName(s.date, ctx.locale),
          employee: s.userId ? (names.get(s.userId) ?? "Tuntematon") : null,
          start: s.startTime,
          end: s.endTime,
          status: s.status,
        })),
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

/**
 * Lounaslistan laatiminen.
 *
 * Yksi työkalu sekä yhdelle päivälle että koko viikolle: malli antaa
 * yhden päivän tai viisi. Erilliset työkalut ajautuisivat erilleen
 * juuri siinä mikä on hankalaa — hinnan ja ruokien yhteispelissä.
 *
 * Ruokien nimet ovat mallin ehdotus, eivät haettua dataa. Se on
 * hyväksyttävää tässä ja vain tässä: käyttäjä on pyytänyt ehdotusta ja
 * näkee jokaisen rivin ennen kuin mitään tallentuu. Sama vapaus ei
 * koske lukuja — euro on aina haettu, ei keksitty.
 */
const proposeLunchItems = defineTool({
  name: "propose_lunch_items",
  description:
    "Ehdottaa lounaslistan ruokia yhdelle tai useammalle päivälle. EI tallenna " +
    "mitään — käyttäjä hyväksyy ehdotuksen itse. Anna yksi päivä kun kyse on " +
    "yhdestä päivästä ja viisi päivää kun kyse on koko työviikosta. Voit antaa " +
    "päivälle myös hinnan. Jos viikkoa ei ole vielä olemassa, se luodaan " +
    "hyväksynnän yhteydessä.",
  level: "write",
  requires: "lunch.manage",
  schema: z.object({
    days: z
      .array(
        z.object({
          date: dateSchema,
          items: z
            .array(
              z.object({
                name: z.string().min(1).max(120),
                description: z.string().max(400).optional(),
                diets: z
                  .array(z.string())
                  .optional()
                  .describe(
                    "vegetarian, vegan, gluten_free, lactose_free, milk_free",
                  ),
                allergens: z
                  .array(z.string())
                  .optional()
                  .describe(
                    "gluten, milk, egg, fish, shellfish, soy, nuts, celery, mustard, sesame",
                  ),
              }),
            )
            .min(1)
            .max(20),
        }),
      )
      .min(1)
      .max(7),
    priceEuros: z
      .number()
      .min(0)
      .max(1000)
      .optional()
      .describe(
        "Koko viikon lounashinta. Sama kaikille päiville. Jätä pois jos " +
          "käyttäjä ei kertonut hintaa tai se on jo oikein.",
      ),
    includesDessert: z
      .boolean()
      .optional()
      .describe(
        "Sisältyykö jälkiruoka hintaan. Anna vain jos käyttäjä sanoo sen. " +
          "Muuten jätä pois — edellisen viikon asetus peritään itsestään.",
      ),
    includesCoffee: z
      .boolean()
      .optional()
      .describe(
        "Sisältyykö kahvi hintaan. Anna vain jos käyttäjä sanoo sen. " +
          "Muuten jätä pois — edellisen viikon asetus peritään itsestään.",
      ),
    replace: z
      .boolean()
      .optional()
      .describe(
        "true korvaa päivien nykyiset ruoat, false lisää perään. Oletus false.",
      ),
  }),
  async run(ctx, input) {
    // Sama päivä kahdesti olisi kaksi ristiriitaista ohjetta samalle
    // riville, eikä kumpikaan olisi selvästi oikea.
    const dates = input.days.map((d) => d.date);
    if (new Set(dates).size !== dates.length) {
      return {
        summary: "Sama päivä on listassa kahdesti. Anna jokainen päivä kerran.",
      };
    }

    const changes: ActionPreview["changes"] = [];

    // Hinta ja sisältyvät ovat viikon ominaisuuksia, joten ne ovat
    // esikatselussa kerran eivätkä joka päivän kohdalla.
    const menu = await ctx.lunchWeek(weekStartOf(input.days[0].date));

    if (input.priceEuros !== undefined) {
      const current = menu?.prices.find((p) => p.name === "Lounas");

      changes.push({
        label: "Lounas · koko viikko",
        from: current ? formatMoney(current.cents) : undefined,
        to: formatMoney(Math.round(input.priceEuros * 100)),
      });
    }

    /*
     * Sisältyvät näytetään aina, myös kun ne peritään.
     *
     * Perintö on hiljainen sääntö, ja hiljainen sääntö on vaarallinen
     * juuri hinnan yhteydessä. Esikatselussa se on näkyvä rivi jonka
     * käyttäjä joko hyväksyy tai korjaa.
     */
    const week = weekStartOf(input.days[0].date);
    const previous = menu ?? (await ctx.lunchWeek(previousWeek(week)));

    const includes = inheritedIncludes(
      {
        includesDessert: input.includesDessert,
        includesCoffee: input.includesCoffee,
      },
      previous
        ? {
            includesDessert: previous.includesDessert,
            includesCoffee: previous.includesCoffee,
          }
        : null,
    );

    const after = includedExtras(includes);
    const before = menu ? includedExtras(menu) : [];

    changes.push({
      label: "Hintaan sisältyy",
      from:
        menu && before.join() !== after.join()
          ? before.length > 0
            ? before.join(" ja ")
            : "ei mitään"
          : undefined,
      to: after.length > 0 ? after.join(" ja ") : "ei jälkiruokaa eikä kahvia",
    });

    for (const day of [...input.days].sort((a, b) =>
      a.date.localeCompare(b.date),
    )) {
      const existing = (await ctx.lunchWeek(weekStartOf(day.date)))?.days.find(
        (d) => d.date === day.date,
      );

      const label = `${weekdayName(day.date, ctx.locale)} ${day.date}`;

      changes.push({
        label,
        from:
          input.replace && existing && existing.items.length > 0
            ? `${existing.items.length} ruokaa`
            : undefined,
        to: day.items.map((i) => i.name).join(", "),
      });
    }

    const total = input.days.reduce((sum, d) => sum + d.items.length, 0);

    return {
      summary:
        `Valmis ehdotus: ${total} ruokaa ${input.days.length} päivälle. ` +
        "Käyttäjä hyväksyy sen itse.",
      preview: {
        title:
          input.days.length === 1 ? "Päivän lounaslista" : "Viikon lounaslista",
        changes,
        warning: input.replace
          ? "Näiden päivien nykyiset ruoat korvataan."
          : undefined,
      },
    };
  },
});

const proposeLunchPrice = defineTool({
  name: "propose_lunch_price",
  description:
    "Ehdottaa viikon lounashinnan muuttamista. EI muuta hintaa — käyttäjä " +
    "vahvistaa muutoksen itse. Hinta koskee koko viikkoa ja kaikkia sen " +
    "ruokia; päiväkohtaista tai ruokakohtaista hintaa ei ole.",
  level: "write",
  requires: "lunch.manage",
  schema: z.object({
    weekStart: dateSchema.describe(
      "Viikon maanantai. Anna mikä tahansa viikon päivä, se pyöristetään.",
    ),
    euros: z
      .number()
      .min(0)
      .max(1000)
      .describe("Uusi hinta euroina, esim. 16.5"),
    priceName: z.string().max(40).optional().describe("Oletus: Lounas"),
  }),
  async run(ctx, input) {
    const week = weekStartOf(input.weekStart);
    const menu = await ctx.lunchWeek(week);

    if (!menu) {
      return {
        summary:
          `Viikolle ${formatWeekRange(week, ctx.locale)} ei ole lounaslistaa. ` +
          "Viikko pitää avata ensin.",
      };
    }

    const name = input.priceName ?? "Lounas";
    const current = menu.prices.find((p) => p.name === name);
    const cents = Math.round(input.euros * 100);

    if (current?.cents === cents) {
      return { summary: `Hinta on jo ${formatMoney(cents)}. Ei muutettavaa.` };
    }

    return {
      summary: `Valmis ehdotus: ${name} ${formatMoney(cents)} viikolle ${formatWeekRange(week, ctx.locale)}.`,
      preview: {
        title: "Lounashinnan muutos",
        changes: [
          {
            label: `${name} · ${formatWeekRange(week, ctx.locale)}`,
            from: current ? formatMoney(current.cents) : "ei hintaa",
            to: formatMoney(cents),
          },
        ],
      },
      data: { menuId: menu.id, priceName: name, cents },
    };
  },
});

const proposeCopyLunchWeek = defineTool({
  name: "propose_copy_lunch_week",
  description:
    "Ehdottaa lounaslistan kopiointia viikolta toiselle. EI kopioi — " +
    "käyttäjä vahvistaa. Kohdeviikon nykyinen sisältö korvataan ja kopio " +
    "on aina luonnos.",
  level: "write",
  requires: "lunch.manage",
  schema: z.object({
    fromWeekStart: dateSchema.describe("Kopioitavan viikon maanantai"),
    toWeekStart: dateSchema.describe("Kohdeviikon maanantai"),
  }),
  async run(ctx, input) {
    const from = weekStartOf(input.fromWeekStart);
    const to = weekStartOf(input.toWeekStart);

    if (from === to) return { summary: "Viikkoa ei voi kopioida itseensä." };

    const source = await ctx.lunchWeek(from);
    if (!source || !hasContent(source)) {
      return {
        summary: `Viikolla ${formatWeekRange(from, ctx.locale)} ei ole lounaslistaa kopioitavaksi.`,
      };
    }

    const target = await ctx.lunchWeek(to);
    const itemCount = source.days.reduce((s, d) => s + d.items.length, 0);

    return {
      summary: `Valmis ehdotus: kopioidaan ${formatWeekRange(from, ctx.locale)} → ${formatWeekRange(to, ctx.locale)}.`,
      preview: {
        title: "Lounaslistan kopiointi",
        changes: [
          {
            label: "Lähde",
            to: `${formatWeekRange(from, ctx.locale)} · ${itemCount} ruokaa`,
          },
          { label: "Kohde", to: formatWeekRange(to, ctx.locale) },
          { label: "Tila kopioinnin jälkeen", to: "Luonnos" },
        ],
        warning:
          target && hasContent(target)
            ? "Kohdeviikolla on jo sisältöä. Se korvataan."
            : undefined,
      },
      data: { fromWeek: from, toWeek: to },
    };
  },
});

const proposePublishLunch = defineTool({
  name: "propose_publish_lunch_week",
  description:
    "Ehdottaa viikon lounaslistan julkaisua. EI julkaise — käyttäjä " +
    "vahvistaa. Julkaisu muuttaa sitä mitä asiakkaat näkevät.",
  level: "write",
  requires: "lunch.manage",
  schema: z.object({ weekStart: dateSchema }),
  async run(ctx, input) {
    const week = weekStartOf(input.weekStart);
    const menu = await ctx.lunchWeek(week);

    if (!menu)
      return {
        summary: `Viikolle ${formatWeekRange(week, ctx.locale)} ei ole lounaslistaa.`,
      };
    if (!hasContent(menu)) {
      return {
        summary: "Tyhjää lounaslistaa ei voi julkaista. Lisää ensin ruokia.",
      };
    }

    const dayCount = menu.days.filter((d) => d.items.length > 0).length;
    const itemCount = menu.days.reduce((s, d) => s + d.items.length, 0);

    return {
      summary: `Valmis ehdotus: julkaistaan ${formatWeekRange(week, ctx.locale)}.`,
      preview: {
        title: "Lounaslistan julkaisu",
        changes: [
          {
            label: "Viikko",
            to: `${formatWeekRange(week, ctx.locale)} · ${dayCount} päivää, ${itemCount} ruokaa`,
          },
          {
            label: "Tila",
            from: menu.status === "published" ? "Julkaistu" : "Luonnos",
            to: "Julkaistu",
          },
        ],
        warning:
          "Julkaisun jälkeen lista näkyy asiakkaille julkisella sivulla.",
      },
      data: { menuId: menu.id, weekStart: week },
    };
  },
});

// ---------------------------------------------------------------------------

export const TOOLS: ToolDefinition[] = [
  ...DAILY_TOOLS,
  ...VAT_TOOLS,
  ...TASK_TOOLS,
  ...PLANNING_TOOLS,
  getDashboard,
  getExpensesByCategory,
  getSuppliers,
  searchReceipts,
  getBudgets,
  getLunchWeek,
  getStaff,
  getShifts,
  proposeLunchItems,
  proposeLunchPrice,
  proposeCopyLunchWeek,
  proposePublishLunch,
];

/** Työkalut jotka rooli saa käyttää. */
export function toolsFor(role: Role): ToolDefinition[] {
  return TOOLS.filter((tool) => can(role, tool.requires));
}

export function findTool(name: string): ToolDefinition | null {
  return TOOLS.find((tool) => tool.name === name) ?? null;
}

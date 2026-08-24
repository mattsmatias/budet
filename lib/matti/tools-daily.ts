import { z } from "zod";
import { formatMoney } from "@/lib/money";
import { formatMonth, periodTotals, receiptsInMonth } from "@/lib/restoflow/expenses";
import { monthStartDate } from "@/lib/restoflow/clock-context";
import { attention, evaluability, focusItems } from "@/lib/restoflow/dashboard";
import { buildInsights } from "@/lib/restoflow/insights";
import { formatHours, labourCost, loadPayroll, summarise } from "@/lib/restoflow/payroll-data";
import { monthPeriod } from "@/lib/restoflow/payroll";
import { todayPulse } from "@/lib/restoflow/pulse";
import {
  compareSales,
  labourShareOfSales,
  salesBetween,
  totalSalesCents,
} from "@/lib/restoflow/sales";
import { overallStatus } from "@/lib/restoflow/status";
import { defineTool, dateSchema, monthSchema, type ToolDefinition } from "./tool-kit";
import type { MattiContext } from "./context";

/**
 * Päivän ohjaustyökalut.
 *
 * Matin ensimmäiset kahdeksan työkalua osasivat kertoa kuluista,
 * toimittajista ja lounaslistasta. Yksikään ei osannut vastata siihen
 * mitä ravintoloitsija oikeasti kysyy aamulla: onko kaikki kunnossa,
 * paljonko eilen myytiin, mihin työvoimakustannus asettui.
 *
 * Nämä viisi lukevat samasta laskennasta kuin yleiskuva. Se on
 * tarkoituksellista: jos Matti laskisi luvun itse, hän ja näyttö
 * voisivat antaa kaksi eri vastausta samaan kysymykseen, eikä
 * kumpaakaan voisi luottaa.
 */

/** Yleiskuvan syöte Matin kontekstista. Sama muoto kuin /admin-sivulla. */
function dashboardInput(ctx: MattiContext, month: string) {
  return {
    receipts: ctx.data.receipts,
    budgets: ctx.data.budgets,
    shifts: ctx.data.shifts,
    users: ctx.data.users,
    clockEvents: ctx.data.clockEvents,
    absences: ctx.data.absences,
    openShifts: ctx.data.openShifts,
    sales: ctx.data.sales,
    month,
    today: ctx.today,
    now: ctx.now,
    timezone: ctx.timezone,
  };
}

// ---------------------------------------------------------------------------

const getBriefing = defineTool({
  name: "get_daily_briefing",
  description:
    "Päivän tilannekatsaus: kokonaistila, tärkeimmät huomiota vaativat asiat, " +
    "tämän päivän myynti, työvoimakustannus ja kulut sekä kuukauden karkea tulos. " +
    "Käytä tätä kun käyttäjä kysyy miten menee, mitä pitäisi tehdä tai " +
    "pyytää päivän yhteenvedon.",
  level: "read",
  requires: "alerts.view",
  schema: z.object({}),
  async run(ctx) {
    const input = dashboardInput(ctx, ctx.month);
    const insights = buildInsights({
      receipts: ctx.data.receipts,
      budgets: ctx.data.budgets,
      shifts: ctx.data.shifts,
      users: ctx.data.users,
      clockEvents: ctx.data.clockEvents,
      month: ctx.month,
      today: ctx.today,
      now: ctx.now,
      timezone: ctx.timezone,
    });

    const items = focusItems(input, insights);
    const status = overallStatus(items, evaluability(input).canJudge);

    const [today, month] = await Promise.all([
      labourCost(ctx.restaurantId, ctx.timezone, ctx.today, ctx.today, ctx.now),
      labourCost(
        ctx.restaurantId,
        ctx.timezone,
        monthStartDate(ctx.month),
        ctx.today,
        ctx.now,
      ),
    ]);

    const pulse = todayPulse({
      today: ctx.today,
      month: ctx.month,
      receipts: ctx.data.receipts,
      sales: ctx.data.sales,
      labourTodayCents: today.cents,
      labourTodayMinutes: today.minutes,
      labourMonthCents: month.cents,
    });

    /*
     * Malli saa saman neljän kohdan rajauksen kuin näyttö. Viidentoista
     * kohdan luettelo ei ole priorisointia, ja Matin vastauksessa se
     * olisi vielä pahempi kuin listassa: teksti kasvaisi sivun
     * mittaiseksi eikä kärki erottuisi.
     */
    const top = items.slice(0, 4);

    return {
      summary:
        `${status.headline}. ` +
        (status.detail ? `${status.detail} ` : "") +
        (top.length > 0
          ? `Kärjessä: ${top.map((i) => i.title).join("; ")}. `
          : "") +
        `Tänään: myynti ${pulse.sales.cents === null ? "ei kirjattu" : formatMoney(pulse.sales.cents)}, ` +
        `työvoima ${formatMoney(pulse.labour.cents)}, ` +
        `kulut ${formatMoney(pulse.expenses.cents)}. ` +
        (pulse.monthToDate.resultCents === null
          ? "Kuukauden tulosta ei voi laskea ilman myyntitietoja."
          : `Kuukausi tähän asti ${formatMoney(pulse.monthToDate.resultCents)} (karkea: vain Budetin läpi kulkeva).`),
      data: {
        status: { tone: status.tone, headline: status.headline, counts: status.counts },
        focus: top.map((i) => ({
          severity: i.severity,
          title: i.title,
          detail: i.detail,
          href: i.href,
        })),
        moreCount: Math.max(0, items.length - top.length),
        today: {
          salesCents: pulse.sales.cents,
          labourCents: pulse.labour.cents,
          labourMinutes: pulse.labour.minutes,
          expenseCents: pulse.expenses.cents,
          receiptCount: pulse.expenses.receiptCount,
        },
        monthToDate: pulse.monthToDate,
      },
      card: {
        title: status.headline,
        value:
          pulse.monthToDate.resultCents === null
            ? "—"
            : formatMoney(pulse.monthToDate.resultCents),
        meta: [
          pulse.sales.cents === null
            ? "Myyntiä ei kirjattu tänään"
            : `Myynti tänään ${formatMoney(pulse.sales.cents)}`,
          `Työvoima tänään ${formatMoney(pulse.labour.cents)}`,
          pulse.monthToDate.resultCents === null
            ? "Kuukauden tulos vaatii myyntitiedon"
            : "Kuukauden karkea tulos",
        ],
        href: "/admin",
        linkLabel: "Avaa yleiskuva",
      },
    };
  },
});

// ---------------------------------------------------------------------------

const getAlerts = defineTool({
  name: "get_alerts",
  description:
    "Kaikki tällä hetkellä avoimet poikkeamat ja huomiot: kaksoiskappaleet, " +
    "budjetin ylitykset, sulkematon vuoro, myöhässä oleva leimaus, tekijätön " +
    "vuoro, myynti alle tavoitteen, kuittitauko. Käytä kun kysytään mikä on " +
    "vialla tai mihin pitää reagoida.",
  level: "read",
  requires: "alerts.view",
  schema: z.object({}),
  async run(ctx) {
    const result = attention(dashboardInput(ctx, ctx.month));

    if (result.state === "no-data") {
      return {
        summary:
          "Poikkeamia ei voi arvioida: kuukaudelta ei ole tarpeeksi aineistoa. " +
          "Tämä ei tarkoita että kaikki on kunnossa.",
        data: { state: result.state, alerts: [] },
      };
    }

    if (result.alerts.length === 0) {
      return {
        summary: "Avoimia poikkeamia ei ole.",
        data: { state: result.state, alerts: [] },
      };
    }

    return {
      summary:
        `${result.counts.critical} kriittistä, ${result.counts.warning} huomautusta. ` +
        result.alerts
          .slice(0, 8)
          .map((a) => `${a.title} (${a.detail})`)
          .join(" · "),
      data: {
        state: result.state,
        counts: result.counts,
        alerts: result.alerts.map((a) => ({
          kind: a.kind,
          severity: a.severity,
          title: a.title,
          detail: a.detail,
          href: a.href,
        })),
      },
      card: {
        title: "Avoimet poikkeamat",
        value: String(result.alerts.length),
        meta: [
          `${result.counts.critical} kriittistä`,
          `${result.counts.warning} huomautusta`,
        ],
        href: "/admin/havainnot",
        linkLabel: "Näytä kaikki",
      },
    };
  },
});

// ---------------------------------------------------------------------------

const getSales = defineTool({
  name: "get_sales",
  description:
    "Myynti päivältä tai aikaväliltä, ja vertailu tavoitteeseen tai saman " +
    "viikonpäivän keskiarvoon. Käytä kun kysytään paljonko myytiin, " +
    "päästiinkö tavoitteeseen tai miten viikko meni.",
  level: "read",
  requires: "sales.view",
  schema: z.object({
    from: dateSchema.optional().describe("Oletus: kuluva päivä"),
    to: dateSchema.optional().describe("Oletus: sama kuin from"),
  }),
  async run(ctx, input) {
    const from = input.from ?? ctx.today;
    const to = input.to ?? from;

    if (to < from) {
      return { summary: "Aikaväli on väärinpäin: loppupäivä on alkupäivää aiemmin." };
    }

    const days = salesBetween(ctx.data.sales, from, to);

    if (days.length === 0) {
      /*
       * Puuttuva ei ole nolla. "0 €" väittäisi ettei myyty mitään, ja
       * se on eri asia kuin se ettei kukaan ole vielä kirjannut lukua.
       */
      return {
        summary:
          from === to
            ? `Myyntiä ei ole kirjattu päivälle ${from}. Puuttuva merkintä ei tarkoita nollamyyntiä.`
            : `Myyntiä ei ole kirjattu välillä ${from}–${to}.`,
        data: { from, to, days: [], totalCents: null },
      };
    }

    const total = totalSalesCents(days);

    // Yhden päivän kysymykseen kuuluu vertailu; aikavälillä vertailukohtia
    // olisi yhtä monta kuin päiviä, eikä niistä syntyisi yhtä vastausta.
    const comparison = from === to ? compareSales(days[0], ctx.data.sales) : null;

    return {
      summary:
        (from === to
          ? `${from}: myynti ${formatMoney(total)}`
          : `${from}–${to}: myynti ${formatMoney(total)} (${days.length} päivää)`) +
        (comparison ? `. ${comparisonSentence(comparison)}` : "") +
        ".",
      data: {
        from,
        to,
        totalCents: total,
        dayCount: days.length,
        comparison,
        days: days.map((d) => ({
          date: d.date,
          netCents: d.netCents,
          targetCents: d.targetCents,
        })),
      },
      card: {
        title: from === to ? `Myynti ${formatDay(from)}` : `Myynti ${formatDay(from)}–${formatDay(to)}`,
        value: formatMoney(total),
        meta: [
          ...(comparison ? [comparisonSentence(comparison)] : []),
          ...(from === to ? [] : [`${days.length} päivää`]),
        ],
        href: "/admin/myynti",
        linkLabel: "Avaa myynti",
      },
    };
  },
});

// ---------------------------------------------------------------------------

const getLabourCost = defineTool({
  name: "get_labour_cost",
  description:
    "Työvoimakustannus ja tehdyt tunnit kuukaudelta palkkamoottorista, sekä " +
    "osuus myynnistä jos myynti on kirjattu. Käytä kun kysytään paljonko " +
    "palkat maksavat tai onko työvoimakustannus liian suuri.",
  level: "read",
  requires: "payroll.view",
  schema: z.object({
    month: monthSchema.optional().describe("Oletus: kuluva kuukausi"),
  }),
  async run(ctx, input) {
    const month = input.month ?? ctx.month;
    const period = monthPeriod(month);

    /*
     * Kuluva kuukausi lasketaan vain tähän päivään asti. Koko kuun
     * loppuun laskettu luku näyttäisi pieneltä keskeneräisenä ja
     * vertailu myyntiin menisi pieleen samasta syystä.
     */
    const endsOn = month === ctx.month ? ctx.today : period.endsOn;

    const data = await loadPayroll(
      ctx.restaurantId,
      ctx.timezone,
      { startsOn: period.startsOn, endsOn },
      ctx.now,
    );
    const totals = summarise(data);

    const sales = totalSalesCents(salesBetween(ctx.data.sales, period.startsOn, endsOn));
    const share = labourShareOfSales(totals.grossCents, sales);

    return {
      summary:
        `${month}: työvoima ${formatMoney(totals.grossCents)}, ` +
        `${formatHours(totals.workedMinutes)}, ${totals.staffCount} henkilöä` +
        (share === null
          ? ". Osuutta myynnistä ei voi laskea, koska myyntiä ei ole kirjattu."
          : `, ${Math.round(share * 100)} % myynnistä`) +
        (totals.needsReview > 0
          ? `. ${totals.needsReview} laskelmassa on tarkistettavaa.`
          : "."),
      data: {
        month,
        from: period.startsOn,
        to: endsOn,
        grossCents: totals.grossCents,
        workedMinutes: totals.workedMinutes,
        staffCount: totals.staffCount,
        needsReview: totals.needsReview,
        netSalesCents: sales > 0 ? sales : null,
        shareOfSales: share,
      },
      card: {
        title: `Työvoima ${formatMonth(month)}`,
        value: formatMoney(totals.grossCents),
        meta: [
          formatHours(totals.workedMinutes),
          `${totals.staffCount} henkilöä`,
          share === null ? "Myyntiä ei kirjattu" : `${Math.round(share * 100)} % myynnistä`,
        ],
        href: `/admin/palkat?kuukausi=${month}`,
        linkLabel: "Avaa palkat",
      },
    };
  },
});

// ---------------------------------------------------------------------------

const getTrends = defineTool({
  name: "get_trends",
  description:
    "Kehityssuunnat: kulujen muutos edelliseen kuukauteen, kategoriasiirtymät, " +
    "toimittajakeskittymä, budjetin tahti ja työvoiman osuus. Käytä kun " +
    "kysytään mihin suuntaan ollaan menossa tai mikä on muuttunut.",
  level: "read",
  requires: "expenses.view",
  schema: z.object({
    month: monthSchema.optional().describe("Oletus: kuluva kuukausi"),
  }),
  async run(ctx, input) {
    const month = input.month ?? ctx.month;

    const insights = buildInsights({
      receipts: ctx.data.receipts,
      budgets: ctx.data.budgets,
      shifts: ctx.data.shifts,
      users: ctx.data.users,
      clockEvents: ctx.data.clockEvents,
      month,
      today: ctx.today,
      now: ctx.now,
      timezone: ctx.timezone,
    });

    if (insights.length === 0) {
      const totals = periodTotals(ctx.data.receipts, month);
      return {
        summary:
          receiptsInMonth(ctx.data.receipts, month).length === 0
            ? `${month} ei sisällä yhtään kuittia, joten kehityssuuntia ei voi arvioida.`
            : `${month}: ${totals.receiptCount} kuittia, ${formatMoney(totals.totalCents)}. ` +
              "Vertailukelpoisia muutoksia ei löytynyt.",
        data: { month, insights: [] },
      };
    }

    return {
      summary:
        `${month}: ` +
        insights.map((i) => `${i.title} — ${i.detail}`).join(" · "),
      data: {
        month,
        insights: insights.map((i) => ({
          tone: i.tone,
          title: i.title,
          detail: i.detail,
          href: i.href,
        })),
      },
    };
  },
});

// ---------------------------------------------------------------------------

function comparisonSentence(comparison: ReturnType<typeof compareSales>): string {
  if (comparison.kind === "none") return "Vertailukohtaa ei ole";

  const change = Math.round((comparison.ratio - 1) * 100);
  const direction = change > 0 ? "yli" : change < 0 ? "alle" : "tasan";

  if (change === 0) {
    return comparison.kind === "target"
      ? "Tasan tavoitteessa"
      : "Tasan saman viikonpäivän keskiarvossa";
  }

  return comparison.kind === "target"
    ? `${Math.abs(change)} % ${direction} tavoitteen (${formatMoney(comparison.targetCents)})`
    : `${Math.abs(change)} % ${direction} saman viikonpäivän keskiarvon (${formatMoney(comparison.averageCents)}, ${comparison.samples} päivää)`;
}

/** "24.8." — kortin otsikkoon, jossa vuosi olisi turhaa kohinaa. */
function formatDay(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(d)}.${Number(m)}.`;
}

// ---------------------------------------------------------------------------

export const DAILY_TOOLS: ToolDefinition[] = [
  getBriefing,
  getAlerts,
  getSales,
  getLabourCost,
  getTrends,
];

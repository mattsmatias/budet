import { z } from "zod";
import { formatMoney } from "@/lib/money";
import {
  findOverlaps,
  formatPlanned,
  planSummary,
  publicationOf,
} from "@/lib/restoflow/shift-planning";
import { buildRoster, formatPlannedHours } from "@/lib/restoflow/roster";
import { defineTool, type ToolDefinition } from "./tool-kit";

/**
 * Työvuorosuunnittelu Matille.
 *
 * MATTI EI EHDOTA MIEHITYSTÄ ILMAN DATAA.
 *
 * "Perjantaina on kolme liikaa" on väite joka vaatii sekä myynti- että
 * työvoimahistorian. Jos niitä ei ole tarpeeksi, työkalu sanoo sen
 * ääneen sen sijaan että antaisi luvun joka näyttää lasketulta.
 *
 * SUUNNITELTU EI OLE TOTEUTUNUT.
 *
 * Kaikki tässä on suunnitelmaa: mitä on luvattu ja mitä se maksaisi.
 * Toteutunut aika tulee leimauksista ja on oma työkalunsa.
 */

const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .describe("Kuukausi muodossa 2026-09. Oletus: kuluva kuukausi.");

const getShiftPlan = defineTool({
  name: "get_shift_plan",
  description:
    "Kuukauden työvuorosuunnitelma: montako työntekijää, montako vuoroa, " +
    "suunnitellut tunnit, arvioitu palkkakulu ja paljonko siitä on vielä " +
    "julkaisematta. Käytä kun kysytään työvuoroista, miehityksestä tai " +
    "työvoiman kustannuksesta tulevalle kuukaudelle.",
  level: "read",
  requires: "shifts.view.all",
  schema: z.object({ month: monthSchema.optional() }),
  async run(ctx, input) {
    const month = input.month ?? ctx.month;
    const shifts = ctx.data.shifts.filter((shift) => shift.date.startsWith(month));

    if (shifts.length === 0) {
      return {
        summary: `Kuukaudelle ${month} ei ole suunniteltu yhtään työvuoroa.`,
        data: { month, shiftCount: 0 },
      };
    }

    const plan = planSummary({ shifts, users: ctx.data.users });
    const drafts = shifts.filter((shift) => publicationOf(shift) === "draft").length;

    /*
     * Henkilöstöbudjetti on kulubudjetti kategorialle staff.
     * Kuukausikohtainen voittaa toistuvan.
     */
    const budget =
      ctx.data.budgets.find((b) => b.category === "staff" && b.month === month) ??
      ctx.data.budgets.find((b) => b.category === "staff" && b.month === null) ??
      null;

    const overBy =
      budget === null ? null : plan.labourCostCents - budget.amountCents;

    const parts = [
      `${month}: ${plan.people} työntekijää, ${plan.shiftCount} vuoroa, ` +
        `${formatPlanned(plan.plannedMinutes)} suunniteltua työaikaa.`,
      `Arvioitu palkkakulu ${formatMoney(plan.labourCostCents)}.`,
    ];

    if (plan.missingRates > 0) {
      parts.push(
        `Arvio on vajaa: ${plan.missingRates} työntekijältä puuttuu tuntipalkka.`,
      );
    }

    if (budget === null) {
      parts.push("Henkilöstöbudjettia ei ole asetettu, joten vertailukohtaa ei ole.");
    } else if (overBy !== null && overBy > 0) {
      parts.push(
        `Suunnitelma YLITTÄÄ henkilöstöbudjetin ${formatMoney(overBy)} ` +
          `(budjetti ${formatMoney(budget.amountCents)}).`,
      );
    } else if (overBy !== null) {
      parts.push(
        `Suunnitelma mahtuu budjettiin: jäljellä ${formatMoney(Math.abs(overBy))}.`,
      );
    }

    if (drafts > 0) {
      parts.push(
        `${drafts} vuoroa on yhä luonnoksena eikä näy työntekijöille.`,
      );
    }

    return {
      summary: parts.join(" "),
      data: {
        month,
        people: plan.people,
        shiftCount: plan.shiftCount,
        plannedMinutes: plan.plannedMinutes,
        plannedHoursLabel: formatPlanned(plan.plannedMinutes),
        labourCostCents: plan.labourCostCents,
        missingRates: plan.missingRates,
        draftCount: drafts,
        openCount: plan.openCount,
        cancelledCount: plan.cancelledCount,
        budgetCents: budget?.amountCents ?? null,
        overBudgetCents: overBy !== null && overBy > 0 ? overBy : null,
      },
    };
  },
});

const getStaffingByDay = defineTool({
  name: "get_staffing_by_day",
  description:
    "Kuukauden miehitys päivittäin: montako ihmistä on vuorossa kunakin " +
    "päivänä ja kuka. Käytä kun kysytään onko jokin päivä vajaa tai " +
    "ylimiehitetty, tai kuka on töissä tiettynä päivänä.",
  level: "read",
  requires: "shifts.view.all",
  schema: z.object({ month: monthSchema.optional() }),
  async run(ctx, input) {
    const month = input.month ?? ctx.month;

    const roster = buildRoster({
      month,
      users: ctx.data.users,
      shifts: ctx.data.shifts,
      openShifts: ctx.data.openShifts,
      absences: ctx.data.absences,
    });

    if (roster.rows.length === 0) {
      return {
        summary: `Kuukaudelle ${month} ei ole suunniteltu yhtään työvuoroa.`,
        data: { month, days: [] },
      };
    }

    const days = roster.days.map((day, index) => ({
      date: day.date,
      weekend: day.weekend,
      people: roster.perDay[index],
      who: roster.rows
        .filter((row) => row.user !== null && row.cells[index].shifts.length > 0)
        .map((row) => ({
          name: row.user!.name,
          times: row.cells[index].shifts.map((s) => `${s.startTime}–${s.endTime}`),
        })),
    }));

    const empty = days.filter((day) => day.people === 0);
    const busiest = [...days].sort((a, b) => b.people - a.people)[0];

    return {
      summary:
        `${month}: miehitys 0–${busiest?.people ?? 0} henkeä päivässä. ` +
        (empty.length > 0
          ? `${empty.length} päivää ilman ketään: ${empty.slice(0, 5).map((d) => d.date).join(", ")}${empty.length > 5 ? " ja muita" : ""}.`
          : "Jokaisena päivänä on vähintään yksi vuorossa.") +
        ` Yhteensä ${formatPlannedHours(roster.plannedMinutes)} suunniteltua työaikaa.`,
      data: { month, days },
    };
  },
});

const getShiftProblems = defineTool({
  name: "get_shift_problems",
  description:
    "Työvuorosuunnitelman ongelmat: päällekkäiset vuorot, avoimet vuorot " +
    "ilman tekijää ja julkaisemattomat luonnokset. Käytä kun kysytään onko " +
    "suunnitelmassa jotain korjattavaa ennen julkaisua.",
  level: "read",
  requires: "shifts.view.all",
  schema: z.object({ month: monthSchema.optional() }),
  async run(ctx, input) {
    const month = input.month ?? ctx.month;
    const shifts = ctx.data.shifts.filter((shift) => shift.date.startsWith(month));

    const overlaps = findOverlaps(shifts, ctx.data.users);
    const open = ctx.data.openShifts.filter((shift) => shift.date.startsWith(month));
    const drafts = shifts.filter((shift) => publicationOf(shift) === "draft");

    if (overlaps.length === 0 && open.length === 0 && drafts.length === 0) {
      return {
        summary: `Kuukauden ${month} työvuorosuunnitelmassa ei ole korjattavaa.`,
        data: { month, overlaps: [], openShifts: [], draftCount: 0 },
      };
    }

    const parts: string[] = [];

    if (overlaps.length > 0) {
      parts.push(
        `${overlaps.length} päällekkäistä vuoroa: ` +
          overlaps
            .slice(0, 5)
            .map(
              (pair) =>
                `${pair.user?.name ?? "tuntematon"} ${pair.a.date} ` +
                `${pair.a.startTime}–${pair.a.endTime} ja ${pair.b.startTime}–${pair.b.endTime}`,
            )
            .join("; ") +
          ".",
      );
    }

    if (open.length > 0) {
      parts.push(`${open.length} avointa vuoroa ilman tekijää.`);
    }

    if (drafts.length > 0) {
      parts.push(`${drafts.length} vuoroa on julkaisematta.`);
    }

    return {
      summary: parts.join(" "),
      data: {
        month,
        overlaps: overlaps.map((pair) => ({
          user: pair.user?.name ?? null,
          first: { date: pair.a.date, start: pair.a.startTime, end: pair.a.endTime },
          second: { date: pair.b.date, start: pair.b.startTime, end: pair.b.endTime },
        })),
        openShifts: open.map((shift) => ({
          date: shift.date,
          start: shift.startTime,
          end: shift.endTime,
        })),
        draftCount: drafts.length,
      },
    };
  },
});

export const PLANNING_TOOLS: ToolDefinition[] = [
  getShiftPlan,
  getStaffingByDay,
  getShiftProblems,
];

import { z } from "zod";
import { formatMoney } from "@/lib/money";
import { formatMonth } from "@/lib/restoflow/expenses";
import type { BusinessType } from "@/lib/restoflow/business";
import {
  breakEven,
  keyRatios,
  priceChanges,
  weekdayPattern,
  type RatioKey,
  type RuleOfThumb,
} from "@/lib/restoflow/industry";
import { defineTool, monthSchema, type ToolDefinition } from "./tool-kit";

/**
 * Toimialan työkalut.
 *
 * Nämä vastaavat kysymyksiin joita alan yrittäjä oikeasti kysyy:
 * ravintoloitsija raaka-aineprosentista, kahvila keskiostoksesta,
 * parturi siitä montako asiakasta päivässä tarvitaan. Laskenta on
 * lib/restoflow/industry.ts:ssä ja testattu siellä; tässä vain muoto
 * mallille ja kortille.
 */

const WEEKDAYS = [
  "maanantai",
  "tiistai",
  "keskiviikko",
  "torstai",
  "perjantai",
  "lauantai",
  "sunnuntai",
];

function ratioName(key: RatioKey, type: BusinessType): string {
  switch (key) {
    case "goods":
      return type === "cafe" ? "Raaka-aineet ja pakkaukset" : "Raaka-aineet";
    case "staff":
      return "Henkilöstökulut";
    case "prime":
      return "Raaka-aineet + henkilöstö";
    case "products":
      return "Hoitotuotteet ja tarvikkeet";
    case "rent":
      return "Vuokra";
  }
}

const pct = (value: number | null) =>
  value === null ? "—" : `${(value * 100).toFixed(1).replace(".", ",")} %`;

function ruleText(rule: RuleOfThumb | null): string | null {
  if (!rule) return null;
  return rule.low === null
    ? `tyypillisesti alle ${Math.round(rule.high * 100)} %`
    : `tyypillisesti ${Math.round(rule.low * 100)}–${Math.round(rule.high * 100)} %`;
}

// ---------------------------------------------------------------------------

const getKeyRatios = defineTool({
  name: "get_key_ratios",
  description:
    "Toimialan tärkeimmät tunnusluvut osuutena verottomasta myynnistä: " +
    "ravintolalle ja kahvilalle raaka-aineprosentti, henkilöstökulut ja " +
    "niiden summa (prime cost); parturille hoitotuotteet, henkilöstö ja " +
    "vuokra. Mukana kolmen kuukauden luku ja edelliset kuukaudet. Käytä " +
    "kun kysytään kannattavuudesta, katteesta, raaka-aineprosentista tai " +
    "ovatko kulut kohdallaan suhteessa myyntiin.",
  level: "read",
  requires: "expenses.view",
  schema: z.object({
    month: monthSchema.optional().describe("Oletus: kuluva kuukausi"),
  }),
  async run(ctx, input) {
    const month = input.month ?? ctx.month;
    const result = keyRatios({
      type: ctx.businessType,
      receipts: ctx.data.receipts,
      sales: ctx.data.sales,
      month,
      today: ctx.today,
    });

    if (result.netSalesCents === 0) {
      return {
        summary:
          `${month}: myyntiä ei ole kirjattu, joten osuuksia myynnistä ei voi laskea. ` +
          "Tunnusluvut tarvitsevat sekä kulut että myynnin.",
        data: result,
      };
    }

    const lines = result.ratios.map((r) => {
      const history = r.previous
        .map((p) => `${p.month} ${pct(p.share)}`)
        .join(", ");
      const rule = ruleText(r.rule);
      return (
        `${ratioName(r.key, ctx.businessType)}: ${pct(r.share)} ` +
        `(${formatMoney(r.costCents)}), 3 kk ${pct(r.threeMonthShare)}` +
        (history ? `; aiemmin ${history}` : "") +
        (rule ? `; nyrkkisääntö ${rule}` : "")
      );
    });

    return {
      summary:
        `${month}${result.partial ? " (kesken, tähän päivään)" : ""}: veroton myynti ` +
        `${formatMoney(result.netSalesCents)} ${result.salesDays} päivältä. ` +
        lines.join(" · ") +
        ". Ostot eivät ole sama kuin käyttö: yksittäisen kuun luku heiluu varaston mukana, " +
        "kolmen kuukauden luku on luotettavampi.",
      data: result,
      card: {
        title: `Tunnusluvut ${formatMonth(month, ctx.locale)}`,
        value: pct(result.ratios[0].threeMonthShare ?? result.ratios[0].share),
        meta: [
          `${ratioName(result.ratios[0].key, ctx.businessType)}, 3 kk`,
          `Myynti ${formatMoney(result.netSalesCents)}`,
        ],
        bars: result.ratios.map((r) => ({
          label: ratioName(r.key, ctx.businessType),
          value: pct(r.share),
          percent: Math.min(100, Math.round((r.share ?? 0) * 100)),
        })),
        href: `/admin/kulut?kuukausi=${month}`,
        linkLabel: "Näytä kulut",
      },
    };
  },
});

// ---------------------------------------------------------------------------

const getWeekdayPattern = defineTool({
  name: "get_weekday_pattern",
  description:
    "Myynti viikonpäivittäin viime viikoilta: keskimyynti, asiakkaita " +
    "(kuitteja) päivässä ja keskiostos jos kassaraportti kertoo kuittien " +
    "määrän. Paras ja hiljaisin päivä. Käytä kun kysytään mikä päivä myy, " +
    "milloin on hiljaista, aukioloajoista, vuorosuunnittelusta, " +
    "kampanjoista tai keskiostoksesta.",
  level: "read",
  requires: "sales.view",
  schema: z.object({
    weeks: z
      .number()
      .int()
      .min(2)
      .max(26)
      .optional()
      .describe("Montako viikkoa taaksepäin. Oletus 8."),
  }),
  async run(ctx, input) {
    const result = weekdayPattern(ctx.data.sales, ctx.today, input.weeks ?? 8);

    if (result.days === 0) {
      return {
        summary: `Myyntiä ei ole kirjattu välillä ${result.from}–${result.to}.`,
        data: result,
      };
    }

    const lines = result.weekdays
      .filter((w) => w.days > 0)
      .map(
        (w) =>
          `${WEEKDAYS[w.weekday]} ${formatMoney(w.averageNetCents ?? 0)} (${w.days} pv` +
          (w.averageTransactions !== null
            ? `, ${w.averageTransactions.toFixed(1).replace(".", ",")} asiakasta`
            : "") +
          ")",
      );

    const max = Math.max(...result.weekdays.map((w) => w.averageNetCents ?? 0));

    return {
      summary:
        `${result.from}–${result.to}, ${result.days} kirjattua päivää. Keskimyynti: ` +
        lines.join(", ") +
        ". " +
        (result.best !== null
          ? `Paras ${WEEKDAYS[result.best]}, hiljaisin ${WEEKDAYS[result.worst!]}. `
          : "Liian vähän päiviä viikonpäivien vertailuun (vähintään kaksi samaa päivää). ") +
        (result.averageTicketCents !== null
          ? `Keskiostos ${formatMoney(result.averageTicketCents)} verottomana, ` +
            `keskimäärin ${result.averageTransactionsPerDay!.toFixed(1).replace(".", ",")} asiakasta päivässä.`
          : "Kuittien määrää ei ole kirjattu, joten keskiostosta ei voi laskea."),
      data: result,
      card: {
        title: "Myynti viikonpäivittäin",
        value:
          result.averageTicketCents !== null
            ? formatMoney(result.averageTicketCents)
            : `${result.days} päivää`,
        meta: [
          ...(result.averageTicketCents !== null ? ["Keskiostos"] : []),
          ...(result.best !== null
            ? [`Paras ${WEEKDAYS[result.best]}, hiljaisin ${WEEKDAYS[result.worst!]}`]
            : []),
        ],
        bars: result.weekdays
          .filter((w) => w.days > 0)
          .map((w) => ({
            label: WEEKDAYS[w.weekday].slice(0, 2),
            value: formatMoney(w.averageNetCents ?? 0),
            percent: max > 0 ? Math.round(((w.averageNetCents ?? 0) / max) * 100) : 0,
          })),
        href: "/admin/myynti",
        linkLabel: "Avaa myynti",
      },
    };
  },
});

// ---------------------------------------------------------------------------

const getPriceChanges = defineTool({
  name: "get_price_changes",
  description:
    "Tuotteet joiden ostohinta on noussut: saman toimittajan saman tuotteen " +
    "viimeisin yksikköhinta verrattuna edelliseen ostoon kuittiriveiltä. " +
    "Käytä kun kysytään hinnannousuista, miksi raaka-aineet tai tuotteet " +
    "maksavat enemmän, tai pitäisikö myyntihintoja tarkistaa.",
  level: "read",
  requires: "expenses.view",
  schema: z.object({
    months: z
      .number()
      .int()
      .min(1)
      .max(12)
      .optional()
      .describe("Montako kuukautta taaksepäin. Oletus 6."),
  }),
  async run(ctx, input) {
    const result = priceChanges(ctx.data.receipts, ctx.today, input.months ?? 6);

    if (result.compared === 0) {
      return {
        summary:
          "Vertailukelpoisia ostoja ei löytynyt: sama tuote samalta toimittajalta " +
          "pitää olla ostettu vähintään kahdesti, ja kuitissa pitää olla rivit.",
        data: result,
      };
    }

    if (result.increases.length === 0) {
      return {
        summary:
          `${result.compared} tuotetta verrattu. Yhdenkään hinta ei ole noussut ` +
          `vähintään 5 %` +
          (result.decreases > 0 ? `; ${result.decreases} tuotteen hinta laski.` : "."),
        data: result,
      };
    }

    const top = result.increases.slice(0, 8);
    return {
      summary:
        `${result.compared} tuotetta verrattu, ${result.increases.length} kallistunut vähintään 5 %: ` +
        top
          .map(
            (p) =>
              `${p.description} (${p.supplierName}) ${formatMoney(p.previousUnitCents)} → ` +
              `${formatMoney(p.latestUnitCents)} +${Math.round(p.change * 100)} % ` +
              `(${p.previousDate} → ${p.latestDate})`,
          )
          .join("; ") +
        ". Hinnat ovat verollisia yksikköhintoja kuittiriveiltä.",
      data: { ...result, increases: top },
      card: {
        title: "Kallistuneet ostot",
        value: `${result.increases.length} tuotetta`,
        meta: [`${result.compared} tuotetta verrattu`],
        bars: top.slice(0, 5).map((p) => ({
          label: p.description,
          value: `+${Math.round(p.change * 100)} %`,
          percent: Math.min(100, Math.round(p.change * 100)),
        })),
        href: "/admin/kuitit",
        linkLabel: "Avaa kuitit",
      },
    };
  },
});

// ---------------------------------------------------------------------------

const getBreakEven = defineTool({
  name: "get_break_even",
  description:
    "Paljonko pitää myydä aukiolopäivässä, jotta Kateen kirjatut kulut " +
    "katetaan, ja montako asiakasta se tarkoittaa keskiostoksella. Verrattuna " +
    "toteutuneeseen päivämyyntiin. Käytä kun kysytään kannattaako, paljonko " +
    "pitää myydä, montako asiakasta tarvitaan tai mikä on nollaraja.",
  level: "read",
  requires: "expenses.view",
  schema: z.object({}),
  async run(ctx) {
    const result = breakEven({
      receipts: ctx.data.receipts,
      sales: ctx.data.sales,
      today: ctx.today,
    });

    if (!result) {
      return {
        summary:
          "Nollarajaa ei voi laskea: tarvitaan vähintään yksi kokonainen kuukausi, " +
          "jolle on kirjattu sekä kuluja että myyntiä.",
        data: null,
      };
    }

    const covered = result.actualDailyNetCents >= result.requiredDailyNetCents;
    const gap = result.actualDailyNetCents - result.requiredDailyNetCents;

    return {
      summary:
        `Kuukaudet ${result.months.join(", ")}: kulut keskimäärin ` +
        `${formatMoney(result.averageMonthlyCostCents)}/kk verottomana, ` +
        `${result.averageSalesDaysPerMonth.toFixed(1).replace(".", ",")} myyntipäivää/kk. ` +
        `Kulujen kattamiseen tarvitaan ${formatMoney(result.requiredDailyNetCents)} ` +
        `verotonta myyntiä päivässä; toteutunut ${formatMoney(result.actualDailyNetCents)} ` +
        `(${covered ? "yli" : "alle"} rajan ${formatMoney(Math.abs(gap))}). ` +
        (result.requiredCustomersPerDay !== null
          ? `Keskiostoksella ${formatMoney(result.averageTicketCents!)} se on ` +
            `${Math.ceil(result.requiredCustomersPerDay)} asiakasta päivässä` +
            (result.actualCustomersPerDay !== null
              ? `, toteutunut ${result.actualCustomersPerDay.toFixed(1).replace(".", ",")}. `
              : ". ")
          : "Asiakasmäärää ei voi laskea, koska kuittien määrää ei ole kirjattu. ") +
        "Raja kattaa vain Kateen kirjatut kulut: jos vuokraa tai palkkoja ei kirjata Kateen, todellinen raja on korkeampi.",
      data: result,
      card: {
        title: "Päivämyynti joka kattaa kulut",
        value: formatMoney(result.requiredDailyNetCents),
        meta: [
          `Toteutunut ${formatMoney(result.actualDailyNetCents)}/pv`,
          ...(result.requiredCustomersPerDay !== null
            ? [`${Math.ceil(result.requiredCustomersPerDay)} asiakasta/pv`]
            : []),
        ],
        href: "/admin/myynti",
        linkLabel: "Avaa myynti",
      },
    };
  },
});

export const INDUSTRY_TOOLS: ToolDefinition[] = [
  getKeyRatios,
  getWeekdayPattern,
  getPriceChanges,
  getBreakEven,
];

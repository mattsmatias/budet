import { z } from "zod";
import { formatMoney, formatRate } from "@/lib/money";
import { fetchSalesLines } from "@/lib/restoflow/queries";
import { reconcile, summarise } from "@/lib/restoflow/sales-vat";
import { defineTool, dateSchema, type ToolDefinition } from "./tool-kit";

/**
 * Verokannat ja kassan täsmäytys Matille.
 *
 * MATTI EI KEKSI VEROPROSENTTIA.
 *
 * Kanta tulee ravintolan asetuksista ja myyntirivin oma kanta siitä
 * mikä kirjattiin. Kumpaakaan ei lasketa mallissa. Keksitty
 * veroprosentti näyttäisi tiedolta ja johtaisi päätöksiin joita ei voi
 * perua — ja väärä ALV löytyy vasta kirjanpidosta.
 *
 * SAMA LASKENTA KUIN NÄYTÖLLÄ.
 *
 * Työkalut lukevat samat funktiot kuin täsmäytysnäkymä. Jos Matti
 * laskisi luvun itse, hän ja näyttö voisivat antaa kaksi eri vastausta
 * samaan kysymykseen, eikä kumpaakaan voisi luottaa.
 */

const getVatSettings = defineTool({
  name: "get_vat_settings",
  description:
    "Ravintolan myyntiryhmät ja niiden ALV-kannat sekä kassajärjestelmän " +
    "ryhmien kohdistukset. Käytä AINA kun tarvitset verokantaa — älä koskaan " +
    "oleta tai laske veroprosenttia itse.",
  level: "read",
  requires: "sales.view",
  schema: z.object({}),
  async run(ctx) {
    const groups = ctx.data.salesGroups;

    if (groups.length === 0) {
      return {
        summary:
          "Myyntiryhmiä ei ole määritetty. Verokantaa ei voi kertoa ilman " +
          "asetusta — ne lisätään Asetukset → Verotus.",
        data: { groups: [] },
      };
    }

    const rows = groups.map((g) => ({
      name: g.name,
      vatRate: g.vatRate,
      vatRateLabel: formatRate(g.vatRate),
      active: g.active,
      isDefault: g.isDefault,
      posNames: ctx.data.posMappings
        .filter((m) => m.salesGroupId === g.id)
        .map((m) => m.posName),
    }));

    return {
      summary: rows
        .filter((r) => r.active)
        .map((r) => `${r.name} ${r.vatRateLabel}`)
        .join(", "),
      data: { groups: rows },
    };
  },
});

const getReconciliation = defineTool({
  name: "get_sales_reconciliation",
  description:
    "Päivän myynnin täsmäytys kassajärjestelmän päiväraporttiin: verollinen " +
    "myynti, ALV kannoittain, veroton myynti sekä ero kassan ilmoittamiin " +
    "lukuihin. Käytä kun kysytään täsmääkö myynti, mistä ero syntyy tai " +
    "paljonko ALV oli.",
  level: "read",
  requires: "sales.view",
  schema: z.object({
    date: dateSchema.optional().describe("Oletus: kuluva päivä"),
  }),
  async run(ctx, input) {
    const date = input.date ?? ctx.today;
    const day = ctx.data.sales.find((s) => s.date === date) ?? null;

    if (!day) {
      return {
        summary: `Myyntiä ei ole kirjattu päivälle ${date}. Puuttuva merkintä ei tarkoita nollamyyntiä.`,
        data: { date, recorded: false },
      };
    }

    const lines = await fetchSalesLines(ctx.restaurantId, date);

    /*
     * Ilman rivejä ei ole kannoittaista tietoa.
     *
     * Käsin kirjattu päivä on yksi luku. Sen ALV:tä ei voi eritellä
     * kannoittain jälkikäteen tuntematta myynnin rakennetta, eikä
     * arvaus ole tässä sallittu.
     */
    if (lines.length === 0) {
      return {
        summary:
          `${date}: veroton myynti ${formatMoney(day.netCents)}. Päivä on kirjattu ` +
          `käsin eikä sitä ole eritelty myyntiryhmiin, joten ALV:tä ei voi ` +
          `eritellä kannoittain eikä päivää voi täsmäyttää kassaan.`,
        data: {
          date,
          recorded: true,
          netCents: day.netCents,
          grossCents: day.grossCents,
          vatCents: day.vatCents,
          lines: [],
          reconciled: false,
        },
      };
    }

    const summary = summarise(lines);
    const check = reconcile({
      posGrossCents: day.posGrossCents,
      posVatCents: day.posVatCents,
      lines,
    });

    const rates = summary.byRate
      .map((r) => `${formatRate(r.vatRate)} ${formatMoney(r.vatCents)}`)
      .join(", ");

    const verdict =
      check.status === "match"
        ? "Täsmää kassan päiväraporttiin."
        : check.status === "mismatch"
          ? `EI TÄSMÄÄ. ${check.explanation ?? ""}`
          : "Kassan lukuja ei ole tallennettu, joten päivää ei ole täsmäytetty.";

    return {
      summary:
        `${date}: verollinen myynti ${formatMoney(summary.grossCents)}, ` +
        `ALV ${formatMoney(summary.vatCents)} (${rates}), ` +
        `veroton myynti ${formatMoney(summary.netCents)}. ${verdict}`,
      data: {
        date,
        recorded: true,
        status: check.status,
        explanation: check.explanation,
        grossCents: summary.grossCents,
        vatCents: summary.vatCents,
        netCents: summary.netCents,
        byRate: summary.byRate.map((r) => ({
          vatRate: r.vatRate,
          vatRateLabel: formatRate(r.vatRate),
          grossCents: r.grossCents,
          vatCents: r.vatCents,
          netCents: r.netCents,
        })),
        pos: {
          grossCents: day.posGrossCents,
          vatCents: day.posVatCents,
        },
        diff: {
          grossCents: check.total.diffCents,
          vatCents: check.vat.diffCents,
        },
      },
    };
  },
});

export const VAT_TOOLS: ToolDefinition[] = [getVatSettings, getReconciliation];

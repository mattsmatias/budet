import { adminContext } from "@/lib/restoflow/page-context";
import { RfIcon } from "@/components/restoflow/icons";
import { ISO_MONTH } from "@/lib/restoflow/dates";
import {
  changeTone,
  formatChange,
  formatMonth,
  monthlySeries,
  periodTotals,
  previousMonth,
  receiptCountLabel,
  receiptsInMonth,
  relativeChange,
  totalsByCategory,
} from "@/lib/restoflow/expenses";
import { CATEGORY_LABELS } from "@/lib/restoflow/types";
import { formatMoney } from "@/lib/money";
import {
  BarRow,
  Card,
  CardHeader,
  MetricCard,
  TrendBadge,
} from "@/components/restoflow/ui";

export const metadata = { title: "Kulut" };


export default async function ExpensesPage({
  searchParams,
}: PageProps<"/admin/kulut">) {
  const {
    receipts, month,
  } = await adminContext("/admin/kulut");

  const params = await searchParams;
  const requested = typeof params.kuukausi === "string" ? params.kuukausi : month;
  const viewMonth = ISO_MONTH.test(requested) ? requested : month;

  const current = periodTotals(receipts, viewMonth);
  const previous = periodTotals(receipts, previousMonth(viewMonth));
  const change = relativeChange(current.totalCents, previous.totalCents);

  const categories = totalsByCategory(receiptsInMonth(receipts, viewMonth));
  const series = monthlySeries(receipts, viewMonth, 4);

  return (
    <div className="rf-enter space-y-5 md:space-y-6">
      {/*
        Sivu alkaa luvuista.

        Tässä oli tunnuslause "Mihin rahat menevät?" ja oma
        edellinen/seuraava-kuukausinavi. Lause ei kertonut mitään mitä
        sivu ei näytä, ja navin vieressä yläpalkissa oli toinen säädin
        joka näytti samaa kuukautta — askellus siirtyi sinne.
      */}
      <section aria-label="Yhteenveto" className="grid gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-4">
        <MetricCard
          label="Kirjatut kulut"
          icon={<RfIcon name="receipt" size={17} />}
          tileTone="brand"
          value={formatMoney(current.totalCents)}
          trend={
            <TrendBadge
              text={`${formatChange(change)} edelliseen`}
              direction={changeTone(change)}
            />
          }
          hint="Kuittien summa, ei pankkitili"
        />
        <MetricCard
          label="Kuitteja"
          value={String(current.receiptCount)}
          icon={<RfIcon name="receipt" size={17} />}
          tileTone="green"
        />
        <MetricCard
          label="ALV yhteensä"
          icon={<RfIcon name="report" size={17} />}
          tileTone="violet"
          value={formatMoney(current.vatCents)}
          hint="Vain kuitit joissa ALV on tiedossa"
        />
        <MetricCard
          label="Tarkistettavia"
          icon={<RfIcon name="alert" size={17} />}
          tileTone="blue"
          value={String(current.needsReviewCount)}
          hint={current.needsReviewCount > 0 ? "Puuttuvia tai epävarmoja tietoja" : undefined}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Kategorioittain"
            subtitle={`${formatMonth(viewMonth)} · ${categories.length} kategoriaa`}
          />
          {categories.length === 0 ? (
            <p className="text-[14px]" style={{ color: "var(--rf-text-2)" }}>
              Ei kuitteja tältä kuukaudelta.
            </p>
          ) : (
            <div className="space-y-4">
              {categories.map((c) => (
                <BarRow
                  key={c.category}
                  label={CATEGORY_LABELS[c.category]}
                  valueCents={c.totalCents}
                  share={c.share}
                  meta={receiptCountLabel(c.receiptCount)}
                />
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Kulujen kehitys"
            subtitle="Neljä kuukautta · kirjatut kulut"
          />
          <table className="rf-table w-full text-[14px]">
            <caption className="sr-only">Kirjatut kulut kuukausittain</caption>
            <tbody>
              {series.map((point) => {
                const isCurrent = point.month === viewMonth;
                return (
                  <tr key={point.month}>
                    <td
                      className="py-3 font-medium"
                      style={{ color: isCurrent ? "var(--rf-text)" : "var(--rf-text-2)" }}
                    >
                      {formatMonth(point.month)}
                    </td>
                    <td
                      className="rf-tabular py-3 text-right"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      {receiptCountLabel(point.receiptCount)}
                    </td>
                    <td className="rf-tabular py-3 text-right font-semibold">
                      {formatMoney(point.totalCents)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-4 text-[12px]" style={{ color: "var(--rf-text-3)" }}>
            Tämä ei ole myyntigraafi. Se kertoo vain kuinka paljon kuluja on
            kirjattu järjestelmään.
          </p>
        </Card>
      </div>
    </div>
  );
}


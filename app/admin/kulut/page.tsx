import { adminContext } from "@/lib/restoflow/page-context";
import { resolveLocale } from "@/lib/i18n/resolve";
import { adminText } from "@/lib/i18n/admin-text";
import { RfIcon } from "@/components/restoflow/icons";
import { ISO_MONTH } from "@/lib/restoflow/dates";
import {
  formatChange,
  formatMonth,
  monthWord,
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
} from "@/components/restoflow/ui";
import { Sparkline } from "@/components/restoflow/dashboard-ui";
import { CountUp } from "@/components/restoflow/count-up";

export const metadata = { title: "Kulut" };


export default async function ExpensesPage({
  searchParams,
}: PageProps<"/admin/kulut">) {
  const {
    receipts, month,
  } = await adminContext("/admin/kulut");
  const t = adminText(await resolveLocale());

  const params = await searchParams;
  const requested = typeof params.kuukausi === "string" ? params.kuukausi : month;
  const viewMonth = ISO_MONTH.test(requested) ? requested : month;

  const current = periodTotals(receipts, viewMonth);
  const previous = periodTotals(receipts, previousMonth(viewMonth));
  const change = relativeChange(current.totalCents, previous.totalCents);

  const categories = totalsByCategory(receiptsInMonth(receipts, viewMonth));
  const series = monthlySeries(receipts, viewMonth, 4);

  /*
   * Trendiviiva kuudelta kuukaudelta, kuten yleiskuvassa.
   *
   * Neljän kuukauden palkit alempana ovat eri asia: ne ovat luettava
   * vertailu, viiva on silmäys suuntaan. Viiva piirretään vain jos
   * kuukausia on kolme joissa on kuluja — kahdesta ei näe suuntaa.
   */
  const trend = monthlySeries(receipts, viewMonth, 6).map((point) => point.totalCents);
  const hasTrend = trend.filter((value) => value > 0).length >= 3;

  return (
    <div className="rf-enter space-y-5 md:space-y-6">
      {/*
        Sivu alkaa luvuista.

        Tässä oli tunnuslause "Mihin rahat menevät?" ja oma
        edellinen/seuraava-kuukausinavi. Lause ei kertonut mitään mitä
        sivu ei näytä, ja navin vieressä yläpalkissa oli toinen säädin
        joka näytti samaa kuukautta — askellus siirtyi sinne.

        SAMAT KORTIT KUIN YLEISKUVASSA.

        Kortti oli sama komponentti mutta eri tavalla käytetty: luku ei
        noussut paikalleen, muutos oli jalassa merkkinä eikä luvun
        vieressä pillerinä, eikä ruudukko venyttänyt kortteja samaan
        korkeuteen. Sama kortti kahdella sivulla kahdennäköisenä saa
        saman luvun näyttämään kahdelta eri luvulta.
      */}
      <section
        aria-label="Avainluvut"
        className="grid auto-rows-fr grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          label="Kirjatut kulut"
          icon={<RfIcon name="receipt" size={17} />}
          tileTone="brand"
          value={<CountUp to={current.totalCents} format="money" />}
          /*
           * Tyhjä kuukausi ei ole lasku.
           *
           * Nolla kuittia tuottaa aina −100 % edelliseen kuuhun, ja
           * alaspäin osoittava nuoli väittäisi kulujen pienentyneen.
           */
          tone={
            current.receiptCount === 0 || change === null
              ? "muted"
              : change > 0
                ? "up"
                : change < 0
                  ? "down"
                  : "neutral"
          }
          delta={
            current.receiptCount > 0 && change !== null
              ? { text: formatChange(change) }
              : undefined
          }
          conclusion={
            current.receiptCount === 0
              ? t.yleiskatsaus.noReceiptsThisMonth
              : change === null
                ? t.yleiskatsaus.noComparison
                : `${formatMoney(previous.totalCents)} ${monthWord(previousMonth(viewMonth))}ssa`
          }
          /*
           * Ei erillistä "kuittien summa, ei pankkitili" -riviä.
           *
           * Se oli ainoa asia joka teki tästä kortista muita
           * korkeamman, ja auto-rows-fr venytti koko rivin sen mukaan.
           * Otsikko sanoo saman: kirjatut kulut on kirjattujen
           * kuittien summa, ja jalka kertoo vertailun.
           */
          trend={hasTrend ? <Sparkline values={trend} width={64} height={20} /> : undefined}
        />

        <MetricCard
          label="Kuitteja"
          value={<CountUp to={current.receiptCount} format="integer" />}
          icon={<RfIcon name="receipt" size={17} />}
          tileTone="green"
          tone="muted"
          conclusion={
            previous.receiptCount === 0
              ? t.yleiskatsaus.noComparison
              : `${receiptCountLabel(previous.receiptCount)} ${monthWord(previousMonth(viewMonth))}ssa`
          }
          href="/admin/kuitit"
          linkLabel="Kuitit"
        />

        <MetricCard
          label={t.kulut.vatTotal}
          icon={<RfIcon name="report" size={17} />}
          tileTone="violet"
          value={<CountUp to={current.vatCents} format="money" />}
          tone="muted"
          conclusion={t.kulut.onlyKnownVat}
        />

        <MetricCard
          label="Tarkistettavia"
          icon={<RfIcon name="alert" size={17} />}
          tileTone="blue"
          value={<CountUp to={current.needsReviewCount} format="integer" />}
          tone={current.needsReviewCount > 0 ? "warn" : "muted"}
          conclusion={
            current.needsReviewCount > 0
              ? t.kulut.missingOrUncertain
              : t.kulut.allChecked
          }
          /*
           * Linkki vie suoraan suodatettuun listaan.
           *
           * "Tarkistettavia 3" ilman tietä niiden luo on luku jota
           * katsotaan mutta jolle ei tehdä mitään.
           */
          href={
            current.needsReviewCount > 0
              ? "/admin/kuitit?suodatin=needs_review"
              : undefined
          }
          linkLabel="Tarkista"
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Kategorioittain"
            subtitle={`${formatMonth(viewMonth)} · ${categories.length} kategoriaa`}
          />
          {categories.length === 0 ? (
            <p className="text-[14px]" style={{ color: "var(--rf-text-2)" }}>{t.kulut.noneThisMonth}</p>
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
            subtitle={t.kulut.fourMonths}
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
          <p className="mt-4 text-[12px]" style={{ color: "var(--rf-text-3)" }}>{t.kulut.notSalesChart}</p>
        </Card>
      </div>
    </div>
  );
}


import { adminContext } from "@/lib/restoflow/page-context";
import { monthFromParams } from "@/lib/restoflow/dates";
import { RfIcon } from "@/components/restoflow/icons";
import Link from "next/link";
import {
  formatChange,
  formatMonth,
  receiptCountLabel,
  receiptsInMonth,
} from "@/lib/restoflow/expenses";
import { supplierTotalsInMonth, supplierTrends } from "@/lib/restoflow/suppliers";
import { CATEGORY_LABELS } from "@/lib/restoflow/types";
import { CategoryIcon } from "@/components/restoflow/icons";
import { formatMoney } from "@/lib/money";
import {
  Card,
  CardHeader,
  EmptyState,
  MetricCard,
  Pill,
} from "@/components/restoflow/ui";
import { CountUp } from "@/components/restoflow/count-up";

export const metadata = { title: "Toimittajat" };

/**
 * Toimittajanäkymä.
 *
 * Kategoriajakauma kertoo mihin rahat menevät, tämä kenelle. Ne ovat eri
 * kysymyksiä — ja neuvotteluvoima syntyy jälkimmäisestä.
 */
export default async function SuppliersPage({
  searchParams,
}: PageProps<"/admin/toimittajat">) {
  const {
    receipts, month: nykyinen,
  } = await adminContext("/admin/toimittajat");

  const month = monthFromParams(await searchParams, nykyinen);

  const totals = supplierTotalsInMonth(receipts, month);
  const trends = new Map(supplierTrends(receipts, month).map((t) => [t.supplierId, t]));

  const grandTotal = totals.reduce((s, t) => s + t.totalCents, 0);
  const inMonth = receiptsInMonth(receipts, month);
  const biggest = totals[0];

  return (
    <div className="rf-enter space-y-5 md:space-y-6">
      <div>
        <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          Kenelle rahamme menevät? · {formatMonth(month)}
        </p>
      </div>

      {/*
        Samat kortit kuin yleiskuvassa, kuluissa ja palkoissa.

        Kolme korttia neljän sijaan, joten sarakkeita on kolme — muuten
        kokoonpano on sama: laatan väri paikkansa mukaan, luku nousee
        paikalleen ja jalka kertoo mitä luku tarkoittaa.

        Katkaisukohdat ovat samat kuin muilla sivuilla: yksi sarake
        puhelimessa, kaksi siitä ylöspäin ja kaikki kolme vasta
        leveällä ruudulla. Kolmijako heti kahden jälkeen jättäisi
        toimittajan nimelle reilut kaksisataa pikseliä, ja nimi on
        tässä se mitä luetaan.
      */}
      <section
        aria-label="Avainluvut"
        className="grid auto-rows-fr grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3"
      >
        <MetricCard
          label="Toimittajia"
          value={<CountUp to={totals.length} format="integer" />}
          icon={<RfIcon name="suppliers" size={17} />}
          tileTone="brand"
          tone="muted"
          conclusion={
            totals.length === 0
              ? "Toimittajat syntyvät kuiteista"
              : "Joilta on kirjattu kuitteja"
          }
        />

        <MetricCard
          label="Kirjatut kulut"
          icon={<RfIcon name="receipt" size={17} />}
          tileTone="green"
          value={<CountUp to={grandTotal} format="money" />}
          tone="muted"
          conclusion={receiptCountLabel(inMonth.length)}
          href="/admin/kulut"
          linkLabel="Kulut"
        />

        <MetricCard
          label="Suurin toimittaja"
          icon={<RfIcon name="trend" size={17} />}
          tileTone="violet"
          /*
           * Nimi katkaistaan yhdelle riville.
           *
           * Muiden korttien arvo on luku ja mahtuu aina. Pitkä
           * toimittajanimi kietoutuisi kahdelle riville, ja
           * auto-rows-fr venyttäisi koko rivin sen mukaan — yksi
           * pitkänimien toimittaja tekisi kaikista korteista
           * korkeampia. Koko nimi on rivin otsikkona ja alla olevassa
           * listassa.
           */
          value={
            biggest ? (
              <span className="block truncate" title={biggest.name}>
                {biggest.name}
              </span>
            ) : (
              "—"
            )
          }
          tone="muted"
          conclusion={
            biggest
              ? `${formatMoney(biggest.totalCents)} · ${Math.round(biggest.share * 100)} % kuluista`
              : "Ei kuitteja tässä kuussa"
          }
          href={biggest ? `/admin/toimittajat/${biggest.supplierId}` : undefined}
          linkLabel="Avaa"
        />
      </section>

      {totals.length === 0 ? (
        <EmptyState
          title="Ei toimittajia"
          description="Toimittajat syntyvät kuiteista. Lisää kuitteja niin näkymä täyttyy."
        />
      ) : (
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title="Kaikki toimittajat"
              subtitle="Suurin ensin · muutos edelliseen kuukauteen"
            />
          </div>
          <ul className="space-y-3 px-5 pb-5 md:hidden">
            {totals.map((s) => {
              const trend = trends.get(s.supplierId);
              const spike = trend?.change !== null && (trend?.change ?? 0) >= 0.25;

              return (
                <li key={s.supplierId}>
                  <Link
                    href={`/admin/toimittajat/${s.supplierId}`}
                    className="rf-press flex items-start gap-3 py-1"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[15px] font-semibold">{s.name}</span>
                        <span className="rf-tabular shrink-0 text-[16px] font-semibold">
                          {formatMoney(s.totalCents)}
                        </span>
                      </span>

                      <span
                        className="rf-tabular mt-0.5 block text-[12px]"
                        style={{ color: "var(--rf-text-3)" }}
                      >
                        {receiptCountLabel(s.receiptCount)} · ka.{" "}
                        {formatMoney(s.averageCents)} · {Math.round(s.share * 100)} %
                      </span>

                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {s.categories.slice(0, 2).map((c) => (
                          <span
                            key={c.category}
                            className="inline-flex items-center gap-1 text-[12px]"
                            style={{ color: "var(--rf-text-2)" }}
                          >
                            <CategoryIcon category={c.category} size={13} />
                            {CATEGORY_LABELS[c.category]}
                          </span>
                        ))}

                        {trend?.change === null || trend === undefined ? (
                          <span className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                            uusi
                          </span>
                        ) : spike ? (
                          <Pill tone="warn" dot>
                            {formatChange(trend.change)}
                          </Pill>
                        ) : (
                          <span className="text-[12px]" style={{ color: "var(--rf-text-2)" }}>
                            {formatChange(trend.change)}
                          </span>
                        )}
                      </span>
                    </span>

                    <span className="mt-1 shrink-0" style={{ color: "var(--rf-text-3)" }}>
                      <RfIcon name="chevron" size={16} />
                    </span>
                  </Link>
                </li>
              );
            })}

            <li
              className="flex items-baseline justify-between gap-3 border-t pt-3 text-[15px] font-semibold"
              style={{ borderColor: "var(--rf-line-strong)" }}
            >
              <span>Yhteensä</span>
              <span className="rf-tabular">{formatMoney(grandTotal)}</span>
            </li>
          </ul>

          {/*
            Alakulmat pyöreiksi tässä eikä kortissa.

            Summarivillä on tausta, ja se on kortin alin asia. Card ei
            leikkaa lapsiaan — overflow: hidden siellä leikkaisi myös
            avautuvat valikot ja kohdistusreunukset muilla sivuilla —
            joten neliskulmainen rivi maalasi kortin pyöristetyn
            alareunan yli.

            Tämä kääre on jo vierityskonteksti overflow-x:n takia,
            joten pelkkä kulmasäde riittää.
          */}
          <div
            className="hidden overflow-x-auto md:block"
            style={{
              borderBottomLeftRadius: "var(--rf-r-card)",
              borderBottomRightRadius: "var(--rf-r-card)",
            }}
          >
            <table className="rf-table w-full min-w-[52rem] text-[14px]">
              <caption className="sr-only">Toimittajat ja kulut</caption>
              <thead>
                <tr>
                  <th scope="col">Toimittaja</th>
                  <th scope="col">Kategoriat</th>
                  <th scope="col" className="text-right">Kuitteja</th>
                  <th scope="col" className="text-right">Keskiarvo</th>
                  <th scope="col" className="text-right">Muutos</th>
                  <th scope="col" className="text-right">Yhteensä</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {totals.map((s) => {
                  const trend = trends.get(s.supplierId);
                  const spike = trend?.change !== null && (trend?.change ?? 0) >= 0.25;

                  return (
                    <tr key={s.supplierId}>
                      <td>
                        <Link
                          href={`/admin/toimittajat/${s.supplierId}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {s.name}
                        </Link>
                        <p className="rf-tabular text-[12px]" style={{ color: "var(--rf-text-3)" }}>
                          {Math.round(s.share * 100)} % kaikista kuluista
                        </p>
                      </td>
                      <td>
                        <span className="flex flex-wrap gap-1.5">
                          {s.categories.slice(0, 3).map((c) => (
                            <span
                              key={c.category}
                              className="text-[12px]"
                              style={{ color: "var(--rf-text-2)" }}
                              title={CATEGORY_LABELS[c.category]}
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <CategoryIcon category={c.category} size={14} />
                                {CATEGORY_LABELS[c.category]}
                              </span>
                            </span>
                          ))}
                        </span>
                      </td>
                      <td className="num">{s.receiptCount}</td>
                      <td
                        className="rf-tabular px-5 py-3 text-right"
                        style={{ color: "var(--rf-text-2)" }}
                      >
                        {formatMoney(s.averageCents)}
                      </td>
                      <td className="num">
                        {trend?.change === null || trend === undefined ? (
                          <span style={{ color: "var(--rf-text-3)" }}>uusi</span>
                        ) : spike ? (
                          <Pill tone="warn" dot>
                            {formatChange(trend.change)}
                          </Pill>
                        ) : (
                          <span style={{ color: "var(--rf-text-2)" }}>
                            {formatChange(trend.change)}
                          </span>
                        )}
                      </td>
                      <td className="num">
                        {formatMoney(s.totalCents)}
                      </td>
                      <td className="num">
                        <Link
                          href={`/admin/toimittajat/${s.supplierId}`}
                          aria-label={`Avaa ${s.name}`}
                          style={{ color: "var(--rf-text-3)" }}
                        >
                          <RfIcon name="chevron" size={16} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>Yhteensä</td>
                  <td />
                  <td className="num">{inMonth.length}</td>
                  <td />
                  <td />
                  <td className="num">{formatMoney(grandTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

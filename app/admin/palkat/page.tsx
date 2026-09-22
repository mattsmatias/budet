import Link from "next/link";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { adminContext } from "@/lib/restoflow/page-context";
import { monthFromParams } from "@/lib/restoflow/dates";
import {
  formatMonth,
  previousMonth,
  receiptsInMonth,
  sortByDateDesc,
} from "@/lib/restoflow/expenses";
import {
  labourShareOfSales,
  salesBetween,
  totalSalesCents,
} from "@/lib/restoflow/sales";
import { monthRange } from "@/lib/restoflow/dates";
import { formatMoney } from "@/lib/money";
import { formatDayIn } from "@/lib/i18n/labels";
import { CountUp } from "@/components/restoflow/count-up";
import { RfIcon } from "@/components/restoflow/icons";
import {
  Card,
  CardHeader,
  EmptyState,
  MetricCard,
} from "@/components/restoflow/ui";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.palkat.title };
}

/**
 * Palkat.
 *
 * Henkilöstökulu on yksi kululuokka muiden joukossa, mutta se on ainoa
 * jota ei osteta kaupasta: siitä ei ole kuittia, se kirjataan kerran
 * kuussa, ja sen osuus myynnistä on alan tärkein tunnusluku. Siksi
 * sillä on oma nimensä ja oma näkymänsä — kuittilistassa se oli rivi
 * joka ei muistuttanut mitään muuta riviä.
 *
 * KATE EI LASKE PALKKOJA.
 *
 * Palkanlaskenta on oma järjestelmänsä. Tänne kirjataan mitä se maksoi,
 * ja Kate kertoo mitä se tarkoittaa suhteessa myyntiin. Työntekijä-,
 * tunti- ja vuorotiedot eivät kuulu tänne eikä niitä ole.
 */
export default async function WagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const {
    receipts,
    sales,
    restaurant,
    month: nykyinen,
  } = await adminContext("/admin/palkat");

  const locale = await resolveLocale();
  const t = adminText(locale);
  const month = monthFromParams(await searchParams, nykyinen);

  const staffIn = (kuukausi: string) =>
    receiptsInMonth(receipts, kuukausi)
      .filter((r) => r.category === "staff")
      .reduce((sum, r) => sum + r.totalCents, 0);

  const entries = sortByDateDesc(
    receiptsInMonth(receipts, month).filter((r) => r.category === "staff"),
  );
  const totalCents = staffIn(month);

  const { from, to } = monthRange(month);
  const salesCents = totalSalesCents(salesBetween(sales, from, to));
  const share =
    totalCents > 0 ? labourShareOfSales(totalCents, salesCents) : null;

  /* Kuusi kuukautta taaksepäin, vanhin ensin. */
  const history: { month: string; cents: number }[] = [];
  let cursor = month;
  for (let i = 0; i < 6; i += 1) {
    history.unshift({ month: cursor, cents: staffIn(cursor) });
    cursor = previousMonth(cursor);
  }
  const maxCents = Math.max(...history.map((h) => h.cents), 1);

  /*
   * Ohjearvo vain sille jolle se sopii.
   *
   * Ravintolan ja kahvilan 25–35 % on alan yleinen väli. Parturin
   * palkkio- ja tuolivuokramallit vaihtelevat niin paljon, ettei
   * yleinen luku kerro siellä mitään — sama sääntö kuin Matin
   * tunnusluvuissa.
   */
  const typical =
    restaurant.businessType === "barber"
      ? t.palkat.ownHistoryNote
      : t.palkat.typicalNote;

  return (
    <div className="rf-enter space-y-5 md:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {t.palkat.lead} · {formatMonth(month, locale)}
        </p>

        <Link
          href="/admin/kuitit/uusi?luokka=staff"
          className="rf-press inline-flex items-center gap-2 px-[15px] py-[9px] text-[13px] font-bold"
          style={{
            background: "var(--rf-accent)",
            color: "var(--rf-on-accent)",
            borderRadius: "var(--rf-r-control)",
            minHeight: 36,
          }}
        >
          <RfIcon name="plus" size={16} />
          {t.palkat.record}
        </Link>
      </div>

      <section
        aria-label={t.sanat.keyFigures}
        className="grid auto-rows-fr rf-stat-grid grid-cols-2 gap-2.5 sm:gap-3.5"
      >
        <MetricCard
          label={t.palkat.monthTotal}
          value={<CountUp to={totalCents} format="money" />}
          icon={<RfIcon name="staff" size={17} />}
          tileTone="blue"
          tone="muted"
          conclusion={formatMonth(month, locale)}
        />

        <MetricCard
          label={t.palkat.share}
          value={share === null ? "—" : `${Math.round(share * 100)} %`}
          icon={<RfIcon name="trend" size={17} />}
          tileTone="violet"
          tone="muted"
          /*
           * Puuttuva osuus on kaksi eri asiaa.
           *
           * Ilman palkkakirjausta osuutta ei ole vielä olemassa; ilman
           * myyntiä sitä ei voi laskea. Sama teksti molemmille väittäisi
           * myynnin puuttuvan silloinkin kun se on kirjattu.
           */
          conclusion={
            totalCents === 0
              ? t.palkat.none
              : share === null
                ? t.palkat.noSales
                : t.palkat.shareNote
          }
        />
      </section>

      <p
        className="px-1 text-[12.5px] leading-relaxed"
        style={{ color: "var(--rf-text-3)" }}
      >
        {typical}
      </p>

      <Card>
        <CardHeader title={t.palkat.history} />
        <ul className="mt-3 space-y-2.5">
          {history.map((row) => (
            <li key={row.month}>
              <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                <span>{formatMonth(row.month, locale)}</span>
                <span className="rf-tabular font-semibold">
                  {formatMoney(row.cents)}
                </span>
              </div>
              {/* Palkki on suhde, ei koriste: kuukaudet ovat vertailukelpoisia
                  vain kun ne on mitattu samalla asteikolla. */}
              <div
                className="mt-1 h-1.5 w-full overflow-hidden"
                style={{ background: "var(--rf-inset)", borderRadius: 999 }}
              >
                <div
                  className="h-full"
                  style={{
                    width: `${Math.round((row.cents / maxCents) * 100)}%`,
                    background: "var(--rf-blue)",
                    borderRadius: 999,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {entries.length === 0 ? (
        <EmptyState title={t.palkat.none} description={t.palkat.noneHint} />
      ) : (
        <Card padded={false}>
          <div className="px-5 pt-5">
            <CardHeader
              title={t.palkat.entries}
              subtitle={t.palkat.entriesHint}
            />
          </div>

          <ul className="space-y-3 px-5 pb-5">
            {entries.map((receipt) => (
              <li key={receipt.id}>
                <Link
                  href={`/admin/kuitit/${receipt.id}`}
                  className="rf-press flex items-baseline justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold">
                      {receipt.supplierName}
                    </span>
                    <span
                      className="rf-tabular block text-[12px]"
                      style={{ color: "var(--rf-text-3)" }}
                    >
                      {formatDayIn(receipt.date, locale)}
                    </span>
                  </span>
                  <span className="rf-tabular shrink-0 text-[16px] font-semibold">
                    {formatMoney(receipt.totalCents)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

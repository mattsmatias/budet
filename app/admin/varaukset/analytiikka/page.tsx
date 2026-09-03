import Link from "next/link";
import { adminText } from "@/lib/i18n/admin-text";
import type { AdminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { fill } from "@/lib/i18n/auth-text";
import { decimal, integer, percent } from "@/lib/i18n/format";
import { formatDayIn, formatMonthIn } from "@/lib/i18n/labels";
import {
  monthFromParams,
  rangeForMonth,
  type RangeKind,
} from "@/lib/restoflow/dates";
import { adminContext } from "@/lib/restoflow/page-context";
import { loadReservationStats } from "@/lib/restoflow/reservation-queries";
import {
  averageParty,
  cancellationRate,
  change,
  findingsFor,
  noShowRate,
} from "@/lib/restoflow/reservation-stats";
import { Card, CardHeader, MetricCard } from "@/components/restoflow/ui";
import { ReservationTabs } from "../tabs";
import {
  Findings,
  HourBars,
  OccupancyGrid,
  SourceBars,
  TrendChart,
  WeekdayBars,
} from "./panels";

const RANGES: RangeKind[] = ["viikko", "kuukausi", "vuosi"];

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.varausTilasto.title };
}

/**
 * Varausanalytiikka.
 *
 * KYSYMYS ON MITÄ TEHDÄ ENSI VIIKOLLA, EI MITÄ TAPAHTUI.
 *
 * Siksi järjestys on tämä: ensin luvut jotka kertovat kuukauden koon,
 * sitten havainnot jotka kertovat mitä niistä seuraa, ja vasta sitten
 * jakaumat joista havainnot on laskettu. Kuka tahansa voi tarkistaa
 * havainnon alempaa — mutta kenenkään ei tarvitse laskea sitä itse.
 *
 * KUUKAUSI TULEE YLÄPALKISTA.
 *
 * Sama valitsin kuin Kuluilla, Palkoilla ja Raportoinnissa. Oma
 * aikavälivalitsin olisi toinen tapa tehdä sama asia, ja kaksi tapaa
 * tarkoittaa että toinen niistä on jossain väärin.
 */
export default async function ReservationStatsPage({
  searchParams,
}: PageProps<"/admin/varaukset/analytiikka">) {
  const locale = await resolveLocale();
  const t = adminText(locale);
  const {
    restaurant,
    month: nykyinen,
    today,
  } = await adminContext("/admin/varaukset/analytiikka");

  const params = await searchParams;
  const month = monthFromParams(params, nykyinen);

  const jaksoParam = typeof params.jakso === "string" ? params.jakso : "";
  const range: RangeKind = (RANGES as string[]).includes(jaksoParam)
    ? (jaksoParam as RangeKind)
    : "kuukausi";

  const { from, to } = rangeForMonth(range, month, today);

  const stats = await loadReservationStats(restaurant.id, from, to);

  const jakso =
    range === "kuukausi"
      ? formatMonthIn(month, locale)
      : `${formatDayIn(from, locale)} – ${formatDayIn(to, locale)}`;

  const otsikko = (
    <>
      <ReservationTabs t={t} current="analytiikka" />

      <header>
        <h1 className="text-[22px] font-bold tracking-[-0.01em]">
          {t.varausTilasto.title}
        </h1>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {jakso} · {t.varausTilasto.intro}
        </p>
      </header>

      <RangeTabs t={t} current={range} month={month} />
    </>
  );

  /*
   * Haku epäonnistui.
   *
   * Eri asia kuin tyhjä kuukausi, ja sanotaan eri sanoin: "ei
   * varauksia" olisi valhe silloin kun niitä on eikä niitä saatu
   * haettua.
   */
  if (!stats) {
    return (
      <div className="rf-enter space-y-5">
        {otsikko}
        <Card>
          <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            {t.varausTilasto.failed}
          </p>
        </Card>
      </div>
    );
  }

  const totals = stats.totals;
  const tyhja = totals.reservations === 0;

  const seurue = averageParty(totals);
  const peruutus = cancellationRate(totals);
  const eiSaapunut = noShowRate(totals);
  const havainnot = findingsFor(stats);

  /*
   * Muutos edelliseen jaksoon.
   *
   * Null kun edellinen jakso oli tyhjä: nollasta kasvamiselle ei ole
   * prosenttilukua, ja "+300 %" kolmesta varauksesta olisi tarkkuutta
   * jota luvussa ei ole. Silloin pilleri jätetään pois eikä keksitä.
   */
  const previous = stats.previous;
  const muutos = {
    reservations: previous
      ? change(totals.reservations, previous.reservations)
      : null,
    guests: previous ? change(totals.guests, previous.guests) : null,
    cancelled: previous ? change(totals.cancelled, previous.cancelled) : null,
    noShow: previous ? change(totals.noShow, previous.noShow) : null,
  };

  const delta = (arvo: number | null) =>
    arvo === null
      ? undefined
      : {
          text: `${arvo > 0 ? "+" : arvo < 0 ? "−" : ""}${percent(
            Math.abs(arvo),
            locale,
            0,
          )}`,
        };

  return (
    <div className="rf-enter space-y-5">
      {otsikko}

      {tyhja ? (
        <Card>
          <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            {t.varausTilasto.empty}
          </p>
        </Card>
      ) : (
        <>
          {/* --- 1. Kuukauden koko --- */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard
              label={t.varausTilasto.reservations}
              value={integer(totals.reservations, locale)}
              delta={delta(muutos.reservations)}
              hint={
                muutos.reservations === null
                  ? undefined
                  : t.varausTilasto.vsPrevious
              }
              highlight
            />
            <MetricCard
              label={t.varausTilasto.guests}
              value={integer(totals.guests, locale)}
              delta={delta(muutos.guests)}
              hint={
                seurue === null
                  ? undefined
                  : fill(t.varausTilasto.people, {
                      maara: decimal(seurue, locale, 1),
                    })
              }
            />
            <MetricCard
              label={t.varausTilasto.cancelled}
              value={integer(totals.cancelled, locale)}
              delta={delta(muutos.cancelled)}
              hint={
                peruutus === null ? undefined : percent(peruutus, locale, 0)
              }
            />
            <MetricCard
              label={t.varausTilasto.noShow}
              value={integer(totals.noShow, locale)}
              /*
               * Pelkkä prosentti, jakaja alempana omalla rivillään.
               *
               * Kortin jalka on yksi rivi ja katkeaa kolmeen pisteeseen.
               * Siihen mahtui prosentti muttei jakajaa — ja katkennut
               * lause piilotti juuri sen sanan jonka takia se oli
               * kirjoitettu.
               */
              delta={delta(muutos.noShow)}
              hint={
                eiSaapunut === null ? undefined : percent(eiSaapunut, locale, 0)
              }
            />
          </div>

          <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
            {t.varausTilasto.rateBasis}
          </p>

          {/* --- Kehitys --- */}
          <Card>
            <CardHeader
              title={t.varausTilasto.trendTitle}
              subtitle={t.varausTilasto.trendHint}
            />
            <TrendChart t={t} locale={locale} stats={stats} />
          </Card>

          {/* --- 2. Havainnot --- */}
          <Card>
            <CardHeader
              title={t.varausTilasto.findingsTitle}
              subtitle={t.varausTilasto.findingsHint}
            />
            <Findings t={t} locale={locale} findings={havainnot} />
          </Card>

          {/* --- 3. Täyttöaste --- */}
          <Card>
            <CardHeader
              title={t.varausTilasto.occupancyTitle}
              subtitle={t.varausTilasto.occupancyHint}
            />
            <OccupancyGrid t={t} locale={locale} stats={stats} />
            {stats.capacity.seats > 0 ? (
              <p
                className="mt-3 text-[12px]"
                style={{ color: "var(--rf-text-3)" }}
              >
                {fill(t.varausTilasto.occupancyBasis, {
                  paikat: integer(stats.capacity.seats, locale),
                })}
              </p>
            ) : null}
          </Card>

          {/* --- 4. Jakaumat --- */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader
                title={t.varausTilasto.hoursTitle}
                subtitle={t.varausTilasto.hoursHint}
              />
              <HourBars locale={locale} stats={stats} />
            </Card>

            <Card>
              <CardHeader
                title={t.varausTilasto.weekdaysTitle}
                subtitle={t.varausTilasto.weekdaysHint}
              />
              <WeekdayBars t={t} locale={locale} stats={stats} />
            </Card>
          </div>

          <Card>
            <CardHeader title={t.varausTilasto.sourceTitle} />
            <SourceBars t={t} locale={locale} stats={stats} />
          </Card>
        </>
      )}
    </div>
  );
}

/**
 * Viikko, kuukausi, vuosi.
 *
 * Linkkejä eikä painikkeita: valinta on osoitteessa, joten näkymän voi
 * linkittää ja paluunappi vie edelliseen jaksoon. Sama ratkaisu kuin
 * varausten välilehdissä.
 *
 * Kuukausi kulkee mukana, koska se on yläpalkin valinta eikä tämän
 * sivun — ilman sitä jakson vaihtaminen hyppäisi takaisin kuluvaan
 * kuukauteen.
 */
function RangeTabs({
  t,
  current,
  month,
}: {
  t: AdminText;
  current: RangeKind;
  month: string;
}) {
  const kohdat: { id: RangeKind; label: string }[] = [
    { id: "viikko", label: t.varausTilasto.rangeWeek },
    { id: "kuukausi", label: t.varausTilasto.rangeMonth },
    { id: "vuosi", label: t.varausTilasto.rangeYear },
  ];

  return (
    <nav
      aria-label={t.varausTilasto.rangeLabel}
      className="flex flex-wrap gap-1.5"
    >
      {kohdat.map((kohta) => {
        const valittu = kohta.id === current;

        return (
          <Link
            key={kohta.id}
            href={`/admin/varaukset/analytiikka?jakso=${kohta.id}&kuukausi=${month}`}
            aria-current={valittu ? "page" : undefined}
            className="rf-press px-3.5 py-2 text-[13px] font-bold"
            style={{
              background: valittu ? "var(--rf-accent-bg)" : "var(--rf-card)",
              color: valittu ? "var(--rf-accent-strong)" : "var(--rf-text-2)",
              border: "1px solid var(--rf-line)",
              borderRadius: 999,
            }}
          >
            {kohta.label}
          </Link>
        );
      })}
    </nav>
  );
}

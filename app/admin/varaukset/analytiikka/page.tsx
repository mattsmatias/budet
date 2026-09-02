import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { fill } from "@/lib/i18n/auth-text";
import { decimal, integer, percent } from "@/lib/i18n/format";
import { formatMonthIn } from "@/lib/i18n/labels";
import { monthFromParams, monthRange } from "@/lib/restoflow/dates";
import { adminContext } from "@/lib/restoflow/page-context";
import { loadReservationStats } from "@/lib/restoflow/reservation-queries";
import {
  averageParty,
  cancellationRate,
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
  WeekdayBars,
} from "./panels";

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
  const { restaurant, month: nykyinen } = await adminContext(
    "/admin/varaukset/analytiikka",
  );

  const month = monthFromParams(await searchParams, nykyinen);
  const { from, to } = monthRange(month);

  const stats = await loadReservationStats(restaurant.id, from, to);

  const otsikko = (
    <>
      <ReservationTabs t={t} current="analytiikka" />

      <header>
        <h1 className="text-[22px] font-bold tracking-[-0.01em]">
          {t.varausTilasto.title}
        </h1>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {formatMonthIn(month, locale)} · {t.varausTilasto.intro}
        </p>
      </header>
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
              highlight
            />
            <MetricCard
              label={t.varausTilasto.guests}
              value={integer(totals.guests, locale)}
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
              hint={
                eiSaapunut === null ? undefined : percent(eiSaapunut, locale, 0)
              }
            />
          </div>

          <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
            {t.varausTilasto.rateBasis}
          </p>

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

import Link from "next/link";
import { adminText } from "@/lib/i18n/admin-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import { formatDayIn, weekdayByNumberIn } from "@/lib/i18n/labels";
import { adminContext } from "@/lib/restoflow/page-context";
import { loadReservationSetup } from "@/lib/restoflow/reservation-queries";
import { siteOrigin } from "@/lib/restoflow/site-origin";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, CardHeader } from "@/components/restoflow/ui";
import {
  AreaList,
  CombinationList,
  DurationList,
  ExceptionList,
  HoursForm,
  SettingsForm,
  TableList,
} from "./forms";
import { EmbedPanel } from "./embed";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.nav.reservations };
}

/**
 * Varausasetukset.
 *
 * Oma sivunsa eikä asetusten osasto, koska tässä on seitsemän eri
 * asiaa: käyttöönotto, aukiolo, kestot, poikkeukset, sali, yhdistelmät
 * ja upotuskoodi. Osastona se olisi asetussivun sisällä oleva toinen
 * asetussivu.
 *
 * Järjestys on käyttöönoton järjestys eikä tärkeysjärjestys: pöydät
 * ennen aukioloja olisi loogisempi, mutta ravintoloitsija tulee tänne
 * kytkeäkseen varaukset päälle — ja se on ensimmäinen asia jonka hän
 * näkee.
 */
export default async function ReservationSettingsPage() {
  const locale = await resolveLocale();
  const t = adminText(locale);
  const { restaurant } = await adminContext("/admin/asetukset/varaukset");

  const setup = await loadReservationSetup(restaurant.id);
  const origin = await siteOrigin();

  const weekdayNames = [1, 2, 3, 4, 5, 6, 7].map((n) =>
    weekdayByNumberIn(n, locale, "long"),
  );

  return (
    <div className="rf-enter space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.01em]">
            {t.nav.reservations}
          </h1>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            {t.varausAsetus.intro}
          </p>
        </div>

        <Link
          href="/admin/varaukset"
          className="rf-press inline-flex items-center gap-2 px-4 py-2.5 text-[14px] font-semibold"
          style={{
            background: "var(--rf-card)",
            color: "var(--rf-text)",
            border: "1px solid var(--rf-line)",
            borderRadius: "var(--rf-r-control)",
          }}
        >
          <RfIcon name="tables" size={16} />
          {t.varausAsetus.openDay}
        </Link>
      </header>

      <Card>
        <CardHeader
          title={t.varausAsetus.basicsTitle}
          subtitle={t.varausAsetus.basicsHint}
        />
        <SettingsForm t={t} settings={setup.settings} />
      </Card>

      <Card>
        <CardHeader
          title={t.varausAsetus.hoursTitle}
          subtitle={t.varausAsetus.hoursSubtitle}
        />
        <HoursForm t={t} hours={setup.hours} weekdayNames={weekdayNames} />
      </Card>

      <Card>
        <CardHeader title={t.varausAsetus.durationTitle} />
        <DurationList t={t} durations={setup.durations} />
      </Card>

      <Card>
        <CardHeader title={t.varausAsetus.exceptionTitle} />
        {/*
          Päivämäärät muotoillaan tässä eikä komponentissa: funktiota
          ei voi välittää palvelimelta clientille, ja selaimessa Intl
          käyttäisi selaimen kieltä eikä käyttäjän valitsemaa.
        */}
        <ExceptionList
          t={t}
          exceptions={setup.exceptions.map((row) => ({
            ...row,
            label: formatDayIn(row.date, locale),
          }))}
        />
      </Card>

      <Card>
        <CardHeader title={t.varausAsetus.areaTitle} />
        <AreaList t={t} areas={setup.areas} />
      </Card>

      <Card>
        <CardHeader title={t.varausAsetus.tableTitle} />
        <TableList t={t} tables={setup.tables} areas={setup.areas} />
      </Card>

      <Card>
        <CardHeader title={t.varausAsetus.combinationTitle} />
        <CombinationList
          t={t}
          combinations={setup.combinations}
          tables={setup.tables}
        />
      </Card>

      <Card>
        <CardHeader
          title={t.varausAsetus.embedTitle}
          subtitle={t.varausAsetus.embedSubtitle}
        />
        <EmbedPanel t={t} origin={origin} slug={restaurant.slug} />
      </Card>
    </div>
  );
}

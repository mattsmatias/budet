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
 * JÄRJESTYS ON TYÖJÄRJESTYS.
 *
 * Pöydät, aukioloajat, käyttöönotto. Sivu alkoi aiemmin
 * käyttöönotosta, mikä oli väärinpäin: varauksia ei voi ottaa ennen
 * kuin on pöytiä joihin istuttaa ja aikoja jolloin ollaan auki.
 * Ensimmäinen kortti on nyt se josta oikeasti aloitetaan.
 *
 * KOLME KORTTIA, EI KAHDEKSAA.
 *
 * Alueet, kestosäännöt, poikkeuspäivät ja pöytien yhdistelmät ovat
 * avattavan osion takana. Ne eivät ole turhia — poikkeuspäivä
 * tarvitaan juhannuksena ja yhdistelmä silloin kun kuuden hengen
 * seurue soittaa — mutta ne eivät kuulu siihen mitä ravintola tekee
 * ottaessaan varaukset käyttöön.
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

      {/* --- 1. Pöydät --- */}
      <Card>
        <CardHeader
          title={t.varausAsetus.tableTitle}
          subtitle={t.varausAsetus.tableSubtitle}
        />
        <TableList t={t} tables={setup.tables} areas={setup.areas} />
      </Card>

      {/* --- 2. Milloin otetaan varauksia --- */}
      <Card>
        <CardHeader
          title={t.varausAsetus.hoursTitle}
          subtitle={t.varausAsetus.hoursSubtitle}
        />
        <HoursForm t={t} hours={setup.hours} weekdayNames={weekdayNames} />
      </Card>

      {/*
        --- 3. Käyttöönotto ja verkkosivu ---

        Yksi kortti, ei kahta. Käyttöönotto ja upotuskoodi olivat
        erillään, vaikka ne ovat sama työ: ravintola kytkee varaukset
        päälle ja vie koodin sivulleen samalla istumalla. Kahtena
        korttina toinen jää helposti huomaamatta.
      */}
      <Card>
        <CardHeader
          title={t.varausAsetus.basicsTitle}
          subtitle={t.varausAsetus.basicsHint}
        />
        <SettingsForm t={t} settings={setup.settings} />

        <div
          className="mt-6 pt-5"
          style={{ borderTop: "1px solid var(--rf-line)" }}
        >
          <p className="text-[14px] font-bold">{t.varausAsetus.embedTitle}</p>
          <p
            className="mb-4 mt-0.5 text-[12.5px]"
            style={{ color: "var(--rf-text-2)" }}
          >
            {t.varausAsetus.embedSubtitle}
          </p>
          <EmbedPanel t={t} origin={origin} slug={restaurant.slug} />
        </div>
      </Card>

      {/* --- Harvoin tarvittavat --- */}
      <details>
        <summary
          className="cursor-pointer px-1 py-2 text-[13px] font-semibold"
          style={{ color: "var(--rf-text-2)" }}
        >
          {t.varausAsetus.rarely}
        </summary>

        <div className="mt-3 space-y-5">
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
            <CardHeader title={t.varausAsetus.combinationTitle} />
            <CombinationList
              t={t}
              combinations={setup.combinations}
              tables={setup.tables}
            />
          </Card>

          <Card>
            <CardHeader title={t.varausAsetus.durationTitle} />
            <DurationList t={t} durations={setup.durations} />
          </Card>

          <Card>
            <CardHeader title={t.varausAsetus.areaTitle} />
            <AreaList t={t} areas={setup.areas} />
          </Card>
        </div>
      </details>
    </div>
  );
}

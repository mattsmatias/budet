import Link from "next/link";
import { adminText } from "@/lib/i18n/admin-text";
import type { AdminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import { resolveLocale } from "@/lib/i18n/resolve";
import type { AppLocale } from "@/lib/i18n/app-locales";
import { formatDayIn, weekdayLongIn } from "@/lib/i18n/labels";
import { ISO_DATE } from "@/lib/restoflow/dates";
import { adminContext } from "@/lib/restoflow/page-context";
import { can } from "@/lib/restoflow/permissions";
import {
  loadReservationSearch,
  type SearchRow,
  type SearchScope,
} from "@/lib/restoflow/reservation-queries";
import type { ReservationStatus } from "@/lib/restoflow/reservations";
import { Card, EmptyState, Pill, type Tone } from "@/components/restoflow/ui";
import { ReservationTabs } from "../tabs";
import { SearchForm } from "./search-form";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.varausLista.title };
}

/** Montako riviä kerralla. Sivutus on linkkejä, ei loputonta vieritystä. */
const PAGE_SIZE = 50;

const SCOPES: SearchScope[] = ["upcoming", "past", "day", "all"];

/**
 * Varauslista.
 *
 * SALINÄKYMÄ VASTAA KYSYMYKSEEN "KUKA TULEE TÄNÄÄN". TÄMÄ VASTAA
 * KAIKKIIN MUIHIN.
 *
 * Puhelimessa kysytään "varasin joskus ensi viikolle", ja päivä
 * kerrallaan selattava kalenteri on siihen väärä työkalu: vastaus
 * vaatisi seitsemän sivunlatausta ja muistin siitä mitä edellisellä
 * sivulla luki. Nimi on se mitä soittaja tietää, joten nimi on se millä
 * haetaan.
 *
 * Suodatus ja haku ovat osoitteessa eivätkä komponentin tilassa: listan
 * voi linkittää, selaimen paluunappi toimii, ja sivunlataus säilyttää
 * sen mitä katsottiin.
 */
export default async function ReservationListPage({
  searchParams,
}: PageProps<"/admin/varaukset/lista">) {
  const locale = await resolveLocale();
  const t = adminText(locale);
  const { restaurant, role, today } = await adminContext(
    "/admin/varaukset/lista",
  );

  const params = await searchParams;

  const scopeParam = typeof params.nakyma === "string" ? params.nakyma : "";
  const scope: SearchScope = (SCOPES as string[]).includes(scopeParam)
    ? (scopeParam as SearchScope)
    : "upcoming";

  const dateParam = typeof params.pvm === "string" ? params.pvm : "";
  const date = ISO_DATE.test(dateParam) ? dateParam : today;

  const query = typeof params.haku === "string" ? params.haku.slice(0, 80) : "";

  const sivu = Math.max(1, Number(params.sivu ?? 1) || 1);

  const result = await loadReservationSearch(restaurant.id, {
    scope,
    date: scope === "day" ? date : null,
    query: query || null,
    limit: PAGE_SIZE,
    offset: (sivu - 1) * PAGE_SIZE,
  });

  const canManage = can(role, "reservations.manage");

  const otsikko = (
    <>
      <ReservationTabs t={t} current="lista" />

      <header>
        <h1 className="text-[22px] font-bold tracking-[-0.01em]">
          {t.varausLista.title}
        </h1>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--rf-text-2)" }}>
          {t.varausLista.intro}
        </p>
      </header>

      <SearchForm t={t} scope={scope} date={date} query={query} />
    </>
  );

  /*
   * Haku epäonnistui.
   *
   * Eri asia kuin tyhjä tulos, ja sanotaan eri sanoin: "ei varauksia"
   * olisi valhe silloin kun niitä on eikä niitä saatu haettua.
   */
  if (!result) {
    return (
      <div className="rf-enter space-y-5">
        {otsikko}
        <Card>
          <p className="text-[13px]" style={{ color: "var(--rf-text-2)" }}>
            {t.varaus.loadFailed}
          </p>
        </Card>
      </div>
    );
  }

  const sivuja = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <div className="rf-enter space-y-5">
      {otsikko}

      <p className="text-[12.5px]" style={{ color: "var(--rf-text-3)" }}>
        {fill(t.varausLista.count, { maara: String(result.total) })}
      </p>

      {result.rows.length === 0 ? (
        <EmptyState
          title={t.varausLista.emptyTitle}
          description={
            query ? t.varausLista.emptySearch : t.varausLista.emptyBody
          }
        />
      ) : (
        <Card padded={false}>
          <ul>
            {result.rows.map((row, index) => (
              <li
                key={row.id}
                style={{
                  borderTop:
                    index === 0 ? undefined : "1px solid var(--rf-line)",
                }}
              >
                <Row
                  t={t}
                  locale={locale}
                  row={row}
                  today={today}
                  canManage={canManage}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {sivuja > 1 ? (
        <Pages
          t={t}
          page={sivu}
          pages={sivuja}
          scope={scope}
          date={date}
          query={query}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rivi
// ---------------------------------------------------------------------------

/**
 * Yksi varaus listassa.
 *
 * Päivä on rivillä eikä otsikossa: lista kattaa monta päivää, ja
 * ryhmäotsikot tekisivät hausta jossa on kolme osumaa kolmelta eri
 * viikolta kolme otsikkoa ja kolme riviä.
 *
 * Rivi ei ole napattava: muokkaus tapahtuu salinäkymässä, jossa on
 * pöydät ja vapaat ajat. Linkki vie sinne oikealle päivälle.
 */
function Row({
  t,
  locale,
  row,
  today,
  canManage,
}: {
  t: AdminText;
  locale: AppLocale;
  row: SearchRow;
  today: string;
  canManage: boolean;
}) {
  const spent = row.status === "cancelled" || row.status === "no_show";

  return (
    <div
      className="flex flex-wrap items-start gap-x-4 gap-y-2 px-[18px] py-3.5"
      style={{ opacity: spent ? 0.55 : 1 }}
    >
      <div className="w-[104px] shrink-0">
        <p className="text-[12.5px] font-semibold">
          {row.date === today
            ? t.varaus.todayLabel
            : `${weekdayLongIn(row.date, locale).slice(0, 2)} ${formatDayIn(row.date, locale)}`}
        </p>
        <p className="rf-num text-[15px] font-bold tabular-nums">{row.time}</p>
      </div>

      <div className="min-w-[10rem] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[14px] font-semibold">{row.guestName}</p>
          <Pill tone={STATUS_TONE[row.status as ReservationStatus] ?? "neutral"} dot>
            {statusLabel(row.status, t)}
          </Pill>
          {row.source === "walk_in" ? (
            <Pill tone="neutral">{t.varaus.sourceWalkIn}</Pill>
          ) : null}
        </div>

        <p
          className="mt-0.5 text-[12.5px]"
          style={{ color: "var(--rf-text-2)" }}
        >
          {fill(t.varaus.rowGuests, { maara: String(row.partySize) })}
          {" · "}
          {row.tables.length > 0 ? row.tables.join(", ") : t.varaus.unassigned}
          {row.guestPhone ? (
            <>
              {" · "}
              <a
                href={`tel:${row.guestPhone.replace(/[^+\d]/g, "")}`}
                className="underline decoration-dotted underline-offset-2"
                style={{ color: "var(--rf-text-2)" }}
              >
                {row.guestPhone}
              </a>
            </>
          ) : null}
        </p>

        {row.allergies ? (
          <p
            className="mt-1 text-[12.5px] font-semibold"
            style={{ color: "var(--rf-amber-text)" }}
          >
            {`⚠ ${row.allergies}`}
          </p>
        ) : null}

        {row.note ? (
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--rf-text-2)" }}>
            {row.note}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col items-end gap-1">
        {row.reference ? (
          <span
            className="rf-num text-[11.5px] tracking-wide"
            style={{ color: "var(--rf-text-3)" }}
          >
            {row.reference}
          </span>
        ) : null}

        {canManage ? (
          <Link
            href={`/admin/varaukset?pvm=${row.date}#varaus-${row.id}`}
            className="text-[12.5px] font-semibold"
            style={{ color: "var(--rf-accent)" }}
          >
            {t.varausLista.openDay}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sivutus
// ---------------------------------------------------------------------------

function Pages({
  t,
  page,
  pages,
  scope,
  date,
  query,
}: {
  t: AdminText;
  page: number;
  pages: number;
  scope: SearchScope;
  date: string;
  query: string;
}) {
  const href = (sivu: number) => {
    const params = new URLSearchParams({ nakyma: scope, sivu: String(sivu) });
    if (scope === "day") params.set("pvm", date);
    if (query) params.set("haku", query);
    return `/admin/varaukset/lista?${params.toString()}`;
  };

  return (
    <nav className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          className="text-[13px] font-semibold"
          style={{ color: "var(--rf-accent)" }}
        >
          {t.varausLista.previous}
        </Link>
      ) : (
        <span />
      )}

      <span className="text-[12.5px]" style={{ color: "var(--rf-text-3)" }}>
        {fill(t.varausLista.page, {
          sivu: String(page),
          sivuja: String(pages),
        })}
      </span>

      {page < pages ? (
        <Link
          href={href(page + 1)}
          className="text-[13px] font-semibold"
          style={{ color: "var(--rf-accent)" }}
        >
          {t.varausLista.next}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

const STATUS_TONE: Record<ReservationStatus, Tone> = {
  pending: "warn",
  confirmed: "info",
  arrived: "ok",
  completed: "neutral",
  cancelled: "neutral",
  no_show: "risk",
};

function statusLabel(status: string, t: AdminText): string {
  const map: Record<string, string> = {
    pending: t.varaus.statePending,
    confirmed: t.varaus.stateConfirmed,
    arrived: t.varaus.stateArrived,
    completed: t.varaus.stateCompleted,
    cancelled: t.varaus.stateCancelled,
    no_show: t.varaus.stateNoShow,
  };
  return map[status] ?? status;
}

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
  loadAdminSlots,
  loadReservationDay,
} from "@/lib/restoflow/reservation-queries";
import {
  OLETUS_SEURUE,
  sortForService,
  summarise,
  tableStates,
  type Reservation,
  type ReservationDay,
  type ReservationStatus,
  type TableState,
} from "@/lib/restoflow/reservations";
import { RfIcon } from "@/components/restoflow/icons";
import {
  Card,
  CardHeader,
  EmptyState,
  Pill,
  type Tone,
} from "@/components/restoflow/ui";
import { ReservationDialog, StatusActions } from "./list";
import { ReservationTabs } from "./tabs";
import { TableMark, ROOM_BACKGROUND } from "@/components/restoflow/table-mark";
import { ElementMark } from "@/components/restoflow/element-mark";
import {
  chairSpots,
  placementsFor,
  tableWidth,
  type FloorElement,
  type PlanTable,
} from "@/lib/restoflow/floor-plan";
import { DayPicker, LiveRefresh } from "./live";

export async function generateMetadata() {
  const t = adminText(await resolveLocale());
  return { title: t.nav.reservations };
}

/**
 * Illan salinäkymä.
 *
 * Yksi päivä kerrallaan. Viikkonäkymä olisi selailtava muttei
 * käytettävä: vuoropäällikkö katsoo tätä sivua kesken vuoron ja etsii
 * seuraavan seurueen, ei ensi torstain varaustilannetta.
 *
 * Järjestys on palvelujärjestys eikä aakkosjärjestys: peruttu ja
 * saapumatta jäänyt painuvat alas, koska ne eivät vaikuta iltaan
 * mutta niiden on näyttävä.
 */
export default async function ReservationsPage({
  searchParams,
}: PageProps<"/admin/varaukset">) {
  const locale = await resolveLocale();
  const t = adminText(locale);
  const params = await searchParams;
  const { restaurant, role, today } = await adminContext("/admin/varaukset");

  const requested = typeof params.pvm === "string" ? params.pvm : today;
  const date = ISO_DATE.test(requested) ? requested : today;

  const day = await loadReservationDay(restaurant.id, date);

  if (!day) {
    return (
      <EmptyState
        title={t.varaus.errGeneric}
        description={t.varaus.loadFailed}
      />
    );
  }

  const canManage = can(role, "reservations.manage") && day.canManage;

  /*
   * Vapaat ajat haetaan vain jos varauksia voi lisätä.
   *
   * Kutsu käy koko päivän aikavälit läpi ja kysyy jokaisesta onko
   * pöytää. Se on halpa mutta ei ilmainen, eikä tarjoilijan
   * lukunäkymässä tarvita sitä lainkaan.
   */
  const slots = canManage
    ? await loadAdminSlots(restaurant.id, date, OLETUS_SEURUE)
    : [];

  const now = new Date();
  const ordered = sortForService(day.reservations);
  const summary = summarise(day.reservations);
  const states = tableStates(day, now);

  /*
   * Seuraavaksi vuorossa oleva seurue.
   *
   * Vuoron aikana tätä sivua katsotaan yhden kysymyksen takia: kuka
   * tulee seuraavaksi. Vastaus on listassa, mutta se pitää etsiä
   * riveistä — merkintä kertoo sen ilman lukemista.
   *
   * Saapunut seurue ei ole "seuraavaksi": se on jo täällä.
   */
  const nextUp = ordered.find(
    (r) =>
      (r.status === "confirmed" || r.status === "pending") &&
      Date.parse(r.endsAt) > now.getTime(),
  );

  /* Vain ne luvut jotka eivät ole nollia. Nolla ei kerro mitään. */
  const stats = [
    { label: t.varaus.statArrived, value: summary.arrived },
    { label: t.varaus.statWalkIns, value: summary.walkIns },
    { label: t.varaus.statCancelled, value: summary.cancelled },
    { label: t.varaus.statNoShow, value: summary.noShow },
  ].filter((row) => row.value > 0);

  const enabled = day.settings?.enabled ?? false;

  return (
    <div className="rf-enter space-y-5">
      {/*
        Salinäkymä on auki koko vuoron. Ilman päivitystä pöytäkartan
        "juuri nyt" tarkoittaa hetkeä jolloin sivu avattiin.
      */}
      {date === today ? <LiveRefresh seconds={60} /> : null}

      <ReservationTabs t={t} current="sali" />

      {/* --- Otsikko ja päivän vaihto --- */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.01em]">
            {dayHeading(date, today, locale, t)}
          </h1>
          <p
            className="mt-0.5 text-[13px]"
            style={{ color: "var(--rf-text-2)" }}
          >
            {fill(t.varaus.summary, {
              varaukset: String(summary.active),
              vieraat: String(summary.guests),
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DayNav date={date} today={today} t={t} />

          {canManage ? (
            <>
              <ReservationDialog
                t={t}
                date={date}
                tables={day.tables}
                slots={[]}
                walkIn
                trigger="walkIn"
              />
              <ReservationDialog
                t={t}
                date={date}
                tables={day.tables}
                slots={slots}
                trigger="add"
              />
            </>
          ) : null}
        </div>
      </header>

      {/* --- Verkkovaraus pois päältä --- */}
      {canManage && !enabled ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold">
                {t.varaus.notEnabledTitle}
              </p>
              <p
                className="mt-0.5 text-[13px]"
                style={{ color: "var(--rf-text-2)" }}
              >
                {t.varaus.notEnabledBody}
              </p>
            </div>
            <Link
              href="/admin/varaukset/asetukset"
              className="text-[13px] font-semibold"
              style={{ color: "var(--rf-accent)" }}
            >
              {t.varaus.openSettings}
            </Link>
          </div>
        </Card>
      ) : null}

      {/* --- Yhteenveto --- */}
      {stats.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {stats.map((row) => (
            <Stat key={row.label} label={row.label} value={row.value} />
          ))}
        </div>
      ) : null}

      {/* --- Varaukset --- */}
      {ordered.length === 0 ? (
        <EmptyState
          title={t.varaus.emptyTitle}
          description={t.varaus.emptyBody}
        />
      ) : (
        <Card padded={false}>
          <ul>
            {ordered.map((reservation, index) => (
              <li
                key={reservation.id}
                style={{
                  borderTop:
                    index === 0 ? undefined : "1px solid var(--rf-line)",
                }}
              >
                <ReservationRow
                  t={t}
                  day={day}
                  date={date}
                  reservation={reservation}
                  canManage={canManage}
                  next={reservation.id === nextUp?.id}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* --- Pöytäkartta --- */}
      {day.tables.length > 0 ? (
        <Card>
          <CardHeader
            title={t.varaus.tableMap}
            subtitle={t.varaus.tableMapHint}
          />
          <TableMap
            states={states}
            elements={day.elements}
            areas={day.areas}
            t={t}
          />
        </Card>
      ) : canManage ? (
        <EmptyState
          title={t.varaus.noTablesTitle}
          description={t.varaus.noTablesBody}
          action={
            <Link
              href="/admin/varaukset/asetukset"
              className="text-[13px] font-semibold"
              style={{ color: "var(--rf-accent)" }}
            >
              {t.varaus.addTablesLink}
            </Link>
          }
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rivi
// ---------------------------------------------------------------------------

function ReservationRow({
  t,
  day,
  date,
  reservation,
  canManage,
  next,
}: {
  t: AdminText;
  day: ReservationDay;
  date: string;
  reservation: Reservation;
  canManage: boolean;
  /** Seuraavaksi vuorossa oleva seurue. Yksi rivi päivässä. */
  next?: boolean;
}) {
  const tables = reservation.tableIds
    .map((id) => day.tables.find((table) => table.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  /* Peruttu rivi himmennetään: se on historiaa eikä illan työtä. */
  const spent =
    reservation.status === "cancelled" || reservation.status === "no_show";

  return (
    <div
      className="flex flex-wrap items-start gap-x-4 gap-y-2 px-[18px] py-3.5"
      style={{
        opacity: spent ? 0.55 : 1,
        background: next ? "var(--rf-accent-bg)" : undefined,
      }}
    >
      <div className="w-[52px] shrink-0">
        <p className="rf-num text-[15px] font-bold tabular-nums">
          {reservation.time}
        </p>
        <p className="text-[11px]" style={{ color: "var(--rf-text-3)" }}>
          {reservation.endTime}
        </p>
      </div>

      <div className="min-w-[10rem] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[14px] font-semibold">{reservation.guestName}</p>
          {next ? <Pill tone="info">{t.varaus.nextUp}</Pill> : null}
          <Pill tone={statusTone(reservation.status)} dot>
            {statusLabel(reservation.status, t)}
          </Pill>
          {reservation.source === "walk_in" ? (
            <Pill tone="neutral">{t.varaus.sourceWalkIn}</Pill>
          ) : null}
        </div>

        <p
          className="mt-0.5 text-[12.5px]"
          style={{ color: "var(--rf-text-2)" }}
        >
          {fill(t.varaus.rowGuests, { maara: String(reservation.partySize) })}
          {" · "}
          {tables.length > 0 ? tables.join(", ") : t.varaus.unassigned}

          {/*
            Numero on soitettava linkki.

            Sitä tarvitaan silloin kun ilta muuttuu: pöytä myöhästyy
            tai seurue ei saavu. Silloin numero kaivetaan ruudulta ja
            näpytellään puhelimeen — yksi painallus riittää.
          */}
          {reservation.guestPhone ? (
            <>
              {" · "}
              <a
                href={`tel:${reservation.guestPhone.replace(/[^+\d]/g, "")}`}
                className="underline decoration-dotted underline-offset-2"
                style={{ color: "var(--rf-text-2)" }}
              >
                {reservation.guestPhone}
              </a>
            </>
          ) : null}
        </p>

        {reservation.note ? (
          <p
            className="mt-1 text-[12.5px]"
            style={{ color: "var(--rf-text-2)" }}
          >
            {reservation.note}
          </p>
        ) : null}
      </div>

      {canManage ? (
        <div className="flex items-center gap-2">
          <StatusActions t={t} reservation={reservation} />
          <ReservationDialog
            t={t}
            date={date}
            tables={day.tables}
            slots={[]}
            reservation={reservation}
            trigger="edit"
          />
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pöytäkartta
// ---------------------------------------------------------------------------

/**
 * Kaksiulotteinen kartta, ei pohjapiirustusta.
 *
 * Pöydät piirtyvät ruudukkoon alueittain, ja jos pöydälle on annettu
 * paikka, se piirtyy siihen. Tarkka pohjapiirustus vaatisi editorin
 * jolla salin muoto piirretään — ja se on oma tuotteensa, ei tämän
 * näkymän osa.
 *
 * Kartta on tässä sen yhden kysymyksen takia joka listasta ei näy:
 * mikä pöytä on vapaana juuri nyt.
 */
function TableMap({
  states,
  elements,
  areas,
  t,
}: {
  states: ReturnType<typeof tableStates>;
  elements: FloorElement[];
  areas: { id: string; name: string }[];
  t: AdminText;
}) {
  const groups = [
    ...areas.map((area) => ({
      id: area.id,
      name: area.name,
      items: states.filter((s) => s.table.areaId === area.id),
      elements: elements.filter((e) => e.areaId === area.id),
    })),
    {
      id: "none",
      name: areas.length > 0 ? t.varaus.noArea : "",
      items: states.filter((s) => s.table.areaId === null),
      elements: elements.filter((e) => e.areaId === null),
    },
  ].filter((group) => group.items.length > 0 || group.elements.length > 0);

  /*
   * Onko karttaa järjestetty.
   *
   * Ilman järjestelyä pöydät piirretään ruudukkoon. Se toimii, muttei
   * ole sali — ja jos siitä ei kerrota, ravintoloitsija luulee Katen
   * arvanneen salin muodon väärin.
   */
  const arranged = states.some(
    (s) => s.table.posX !== null && s.table.posY !== null,
  );

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const sijainnit = new Map(
          placementsFor(group.items.map((s) => s.table) as PlanTable[]).map(
            (p) => [p.id, p],
          ),
        );

        return (
          <div key={group.id}>
            {group.name ? (
              <p
                className="mb-2 text-[12px] font-semibold uppercase tracking-[0.04em]"
                style={{ color: "var(--rf-text-3)" }}
              >
                {group.name}
              </p>
            ) : null}

            {/*
              Sali eikä lista.

              Sama kartta kuin asetuksissa järjestetty, samat mitat ja
              sama piirtotapa. Vuoron aikana katsotaan mikä pöytä on
              vapaa, ja siihen vastaa sijainti — ei aakkosjärjestys.
            */}
            <div
              className="relative w-full"
              style={{
                aspectRatio: "1.5",
                background: ROOM_BACKGROUND,
                backgroundColor: "var(--rf-inset)",
                border: "1px solid var(--rf-line)",
                borderRadius: "var(--rf-r-card)",
                overflow: "hidden",
              }}
            >
              {/*
                Kalusteet pöytien alla.

                Baaritiski ja keittiön ovi ovat ne kiintopisteet
                joiden avulla ihminen lukee tilaa. Ne ovat harmaita ja
                taustalla: kartalta luetaan pöytiä, ja värikäs
                baaritiski veisi huomion siltä.
              */}
              {group.elements.map((element) => (
                <span
                  key={element.id}
                  aria-hidden="true"
                  className="absolute"
                  style={{
                    left: `${element.posX}%`,
                    top: `${element.posY}%`,
                    width: `${element.width}%`,
                    height: `${element.height}%`,
                    transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
                  }}
                >
                  <ElementMark
                    kind={element.kind}
                    label={element.label}
                    rotation={element.rotation}
                  />
                </span>
              ))}

              {group.items.map(({ table, state, reservation }) => {
                const paikka = sijainnit.get(table.id);
                if (!paikka) return null;

                const colors = STATE_COLORS[state];

                return (
                  <span
                    key={table.id}
                    className="absolute flex items-center justify-center"
                    style={{
                      left: `${paikka.x}%`,
                      top: `${paikka.y}%`,
                      width: `${table.width ?? tableWidth(table.seatsMax)}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                    /*
                     * Vieraan nimi ja kello osoittimen alle.
                     *
                     * Kartalle ne eivät mahdu, ja listassa ne ovat jo.
                     * Kartta vastaa kysymykseen "mikä pöytä", lista
                     * kysymykseen "kuka ja milloin".
                     */
                    title={
                      reservation
                        ? `${table.name} · ${reservation.time} ${reservation.guestName} · ${stateLabel(state, t)}`
                        : `${table.name} · ${stateLabel(state, t)}`
                    }
                  >
                    {/*
                      Tuolit kertovat paikkaluvun ilman lukua.

                      Sama piirros kuin muokkaimessa: kartan on
                      näytettävä samalta siellä missä se järjestettiin.
                    */}
                    {chairSpots(table.seatsMax, table.shape).map((spot, i) => (
                      <span
                        key={i}
                        aria-hidden="true"
                        className="absolute"
                        style={{
                          left: `${spot.x}%`,
                          top: `${spot.y}%`,
                          width: "17%",
                          aspectRatio: "1",
                          transform: "translate(-50%, -50%)",
                          background: "var(--rf-line-strong)",
                          borderRadius: "50%",
                          opacity: 0.45,
                        }}
                      />
                    ))}

                    <TableMark
                      name={table.name}
                      shape={table.shape}
                      rotation={table.rotation}
                      widthPercent={100}
                      colors={{
                        bg: colors.bg,
                        border: colors.border,
                        text: colors.text,
                        dashed: state === "disabled",
                      }}
                    />
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}

      {arranged ? null : (
        <p className="text-[12px]" style={{ color: "var(--rf-text-3)" }}>
          {t.poytakartta.noPlan}
        </p>
      )}

      {/*
        Selite vain niistä tiloista jotka kartalla ovat.

        Väri ei kerro mitään ilman selitettä, mutta selite tilasta jota
        ei näy on yhtä lailla luettavaa jota ei tarvita. Kuuden rivin
        selite yhden pöydän kartan alla oli enemmän kuin kartta.
      */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
        {LEGEND_ORDER.filter((state) =>
          states.some((s) => s.state === state),
        ).map((state) => (
          <span
            key={state}
            className="inline-flex items-center gap-1.5 text-[11.5px]"
            style={{ color: "var(--rf-text-2)" }}
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ background: STATE_COLORS[state].border }}
            />
            {stateLabel(state, t)}
          </span>
        ))}
      </div>
    </div>
  );
}
/* Selitteen järjestys: vapaasta käytössä olevaan, lopuksi poissa. */
const LEGEND_ORDER = [
  "free",
  "reserved",
  "late",
  "seated",
  "cleaning",
  "disabled",
] as const;

const STATE_COLORS: Record<
  TableState,
  { bg: string; text: string; border: string }
> = {
  free: {
    bg: "var(--rf-green-bg)",
    text: "var(--rf-green-text)",
    border: "var(--rf-green)",
  },
  reserved: {
    bg: "var(--rf-blue-bg)",
    text: "var(--rf-blue-text)",
    border: "var(--rf-blue)",
  },
  late: {
    bg: "var(--rf-amber-bg)",
    text: "var(--rf-amber-text)",
    border: "var(--rf-amber)",
  },
  seated: {
    bg: "var(--rf-accent-bg)",
    text: "var(--rf-text)",
    border: "var(--rf-accent)",
  },
  cleaning: {
    bg: "var(--rf-inset)",
    text: "var(--rf-text-2)",
    border: "var(--rf-text-3)",
  },
  disabled: {
    bg: "transparent",
    text: "var(--rf-text-3)",
    border: "var(--rf-line)",
  },
};

function stateLabel(state: TableState, t: AdminText): string {
  const map: Record<TableState, string> = {
    free: t.varaus.stateFree,
    reserved: t.varaus.stateReserved,
    late: t.varaus.stateLate,
    seated: t.varaus.stateSeated,
    cleaning: t.varaus.stateCleaning,
    disabled: t.varaus.stateDisabled,
  };
  return map[state];
}

// ---------------------------------------------------------------------------
// Pienet osat
// ---------------------------------------------------------------------------

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span
      className="inline-flex items-baseline gap-1.5 px-3 py-1.5 text-[12.5px]"
      style={{
        background: "var(--rf-inset)",
        color: "var(--rf-text-2)",
        borderRadius: "var(--rf-r-pill)",
      }}
    >
      <span
        className="rf-num text-[14px] font-bold tabular-nums"
        style={{ color: "var(--rf-text)" }}
      >
        {value}
      </span>
      {label}
    </span>
  );
}

function DayNav({
  date,
  today,
  t,
}: {
  date: string;
  today: string;
  t: AdminText;
}) {
  const shift = (days: number) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  return (
    <div
      className="inline-flex items-center"
      style={{
        border: "1px solid var(--rf-line)",
        borderRadius: "var(--rf-r-control)",
      }}
    >
      <Link
        href={`/admin/varaukset?pvm=${shift(-1)}`}
        aria-label={t.varaus.previousDay}
        className="rf-press flex h-[42px] w-10 items-center justify-center"
        style={{ color: "var(--rf-text-2)" }}
      >
        <RfIcon name="back" size={16} />
      </Link>

      <Link
        href="/admin/varaukset"
        className="rf-press px-3 text-[13px] font-semibold"
        style={{
          color: date === today ? "var(--rf-text-3)" : "var(--rf-text)",
        }}
        aria-current={date === today ? "page" : undefined}
      >
        {t.varaus.todayLabel}
      </Link>

      <Link
        href={`/admin/varaukset?pvm=${shift(1)}`}
        aria-label={t.varaus.nextDay}
        className="rf-press flex h-[42px] w-10 items-center justify-center"
        style={{ color: "var(--rf-text-2)" }}
      >
        <span className="rotate-180">
          <RfIcon name="back" size={16} />
        </span>
      </Link>

      {/*
        Suora päivänvalinta nuolien viereen.

        Nuolilla ensi lauantaihin on kuusi painallusta, ja se on
        tavallisin syy vaihtaa päivää: puhelimessa kysytään ajasta
        joka on viikon päässä.
      */}
      <DayPicker date={date} label={t.varaus.pickDay} />
    </div>
  );
}

function dayHeading(
  date: string,
  today: string,
  locale: AppLocale,
  t: AdminText,
): string {
  if (date === today) return t.varaus.todayHeading;

  const weekday = weekdayLongIn(date, locale);
  return `${weekday} ${formatDayIn(date, locale)}`;
}

const STATUS_TONE: Record<ReservationStatus, Tone> = {
  pending: "warn",
  confirmed: "info",
  arrived: "ok",
  completed: "neutral",
  cancelled: "neutral",
  no_show: "risk",
};

function statusTone(status: ReservationStatus): Tone {
  return STATUS_TONE[status];
}

function statusLabel(status: ReservationStatus, t: AdminText): string {
  const map: Record<ReservationStatus, string> = {
    pending: t.varaus.statePending,
    confirmed: t.varaus.stateConfirmed,
    arrived: t.varaus.stateArrived,
    completed: t.varaus.stateCompleted,
    cancelled: t.varaus.stateCancelled,
    no_show: t.varaus.stateNoShow,
  };
  return map[status];
}

/**
 * Toiminnalliset poikkeamat.
 *
 * Kulupoikkeamat kertovat mitä eilen tapahtui. Nämä kertovat mitä juuri
 * nyt on menossa pieleen: kukaan ei tullut vuoroon, joku on ollut
 * töissä kahdeksan tuntia yli, ensi-illalle ei ole tekijää.
 *
 * Nämä ovat aikakriittisiä, ja siksi ne ovat aina listan kärjessä
 * riippumatta siitä kuinka suuria euromäärät ovat.
 *
 * KYNNYKSET OVAT ARMOAIKOJA, EIVÄT ARVAUKSIA.
 *
 * Jokainen luku alla on aika jonka kuluttua asia on varmasti poikkeama
 * eikä tavallista viivettä. Ne ovat harkittuja mutta eivät pyhiä; ne
 * ovat tässä yhdessä paikassa jotta niitä voi muuttaa tietäen mitä
 * muuttaa.
 */

import { dayIn, minutesOfDayIn } from "./clock-context";
import { formatDayShortIn } from "@/lib/i18n/labels";
import { adminText } from "@/lib/i18n/admin-text";
import { fill } from "@/lib/i18n/auth-text";
import type { AppLocale } from "@/lib/i18n/app-locales";
import { formatMoney } from "../money";
import { compareSales, type DailySales } from "./sales";
import { shiftBounds } from "./shift-window";
import { currentState, eventsOnDate } from "./timeclock";
import type {
  Alert,
  ClockEvent,
  OpenShift,
  Receipt,
  Shift,
  User,
} from "./types";
import { daysLate, statusOf, type Task } from "./tasks";

/** Vuoron alusta tämän jälkeen puuttuva sisäänleimaus on poikkeama. */
const LATE_CLOCK_IN_MINUTES = 20;

/** Vuoron lopusta tämän jälkeen yhä auki oleva työaika on poikkeama. */
const OVERRUN_MINUTES = 60;

/** Näin monta päivää eteenpäin katsotaan tekijätöntä vuoroa. */
const OPEN_SHIFT_DAYS = 3;

/** Näin monen päivän kuittitauko huomautetaan. */
const RECEIPT_GAP_DAYS = 14;

/** Myynti tämän verran alle vertailukohdan nostaa huomautuksen. */
const SALES_SHORTFALL = 0.1;

export interface OperationsContext {
  users: User[];
  shifts: Shift[];
  openShifts: OpenShift[];
  clockEvents: ClockEvent[];
  receipts: Receipt[];
  sales: DailySales[];
  /*
   * Tehtävät ovat osa samaa kysymystä kuin muut poikkeamat.
   *
   * "Onko jotain hoitamatta" on yksi kysymys, ei kaksi. Erillinen
   * tehtävälista yleiskuvassa tarkoittaisi kahta paikkaa joista
   * molemmat pitää muistaa katsoa.
   */
  tasks?: Task[];
  today: string;
  now: string;
  timezone: string;
  /** Käyttöliittymän kieli: poikkeamien teksti kirjoitetaan sillä. */
  locale: AppLocale;
}

export function operationalAlerts(ctx: OperationsContext): Alert[] {
  return [
    ...lateClockIn(ctx),
    ...shiftOverrun(ctx),
    ...unassignedShifts(ctx),
    ...salesShortfall(ctx),
    ...receiptGap(ctx),
    ...taskDeadlines(ctx),
  ];
}

/**
 * Määräaika tänään tai jo mennyt.
 *
 * Myöhässä oleva on kriittinen: eräpäivä on ohi eikä kukaan ole
 * tehnyt mitään. Tänään erääntyvä on huomautus — päivä on vielä
 * edessä.
 *
 * Tulevat eivät ole hälytyksiä. Tehtävä jonka eräpäivä on ensi
 * viikolla ei vaadi tänään mitään, ja hälytys siitä opettaisi
 * ohittamaan hälytykset.
 */
function taskDeadlines(ctx: OperationsContext): Alert[] {
  const t = adminText(ctx.locale);
  const tasks = ctx.tasks ?? [];
  const alerts: Alert[] = [];

  for (const task of tasks) {
    const status = statusOf(task, ctx.today);

    if (status === "overdue") {
      const late = daysLate(task, ctx.today);

      alerts.push({
        id: `task-overdue-${task.id}`,
        kind: "task_overdue",
        severity: "critical",
        title: task.title,
        detail:
          late === 0
            ? fill(t.havainto.dueTodayAt, { aika: task.dueTime ?? "" })
            : fill(late === 1 ? t.havainto.lateByOne : t.havainto.lateByMany, {
                maara: String(late),
              }),
        href: "/admin/tehtavat?suodatin=myohassa",
        entityId: task.id,
      });
      continue;
    }

    if (status === "due_today") {
      alerts.push({
        id: `task-due-${task.id}`,
        kind: "task_due",
        severity: task.priority === "critical" ? "critical" : "warning",
        title: task.title,
        detail: task.dueTime
          ? fill(t.havainto.dueTodayAtTime, { aika: task.dueTime })
          : t.havainto.dueToday,
        href: "/admin/tehtavat?suodatin=tanaan",
        entityId: task.id,
      });
    }
  }

  return alerts;
}

// ---------------------------------------------------------------------------

/**
 * Vuoro alkoi, kukaan ei leimannut sisään.
 *
 * Tämä on ainoa hälytys jonka ravintoloitsija haluaa nähdä minuuteissa:
 * jos tarjoilija ei tullut, sali on vajaa juuri nyt. Kaikki muu voi
 * odottaa iltaan.
 *
 * Vain kuluva päivä ja vain alkaneet vuorot. Menneiden päivien
 * puuttuvat leimaukset ovat palkka-asia, ja ne näkyvät siellä.
 */
function lateClockIn(ctx: OperationsContext): Alert[] {
  const t = adminText(ctx.locale);
  const nowMinutes = minutesOfDayIn(ctx.timezone, ctx.now);
  const alerts: Alert[] = [];

  for (const shift of ctx.shifts) {
    if (shift.date !== ctx.today) continue;
    if (shift.status === "declined") continue;

    const { startMin } = shiftBounds(shift);
    const late = nowMinutes - startMin;
    if (late < LATE_CLOCK_IN_MINUTES) continue;

    const events = eventsOnDate(
      ctx.clockEvents.filter((e) => e.userId === shift.userId),
      ctx.today,
      ctx.timezone,
    );
    if (events.length > 0) continue;

    const user = ctx.users.find((u) => u.id === shift.userId);

    alerts.push({
      id: `late-in-${shift.id}`,
      kind: "late_clock_in",
      severity: "critical",
      title: fill(t.havainto.notClockedIn, {
        nimi: user?.name ?? t.havainto.employeeFallback,
      }),
      detail: fill(t.havainto.shiftStartedAgo, {
        alku: shift.startTime,
        loppu: shift.endTime,
        maara: String(Math.round(late)),
      }),
      href: "/admin/tyovuorot",
      entityId: shift.userId,
    });
  }

  return alerts;
}

/**
 * Työaika on yhä auki pitkään vuoron päätyttyä.
 *
 * Kello käy uloskirjaukseen asti. Tunti yli on tavallista, kolme tuntia
 * yli tarkoittaa yleensä unohtunutta leimausta — ja se maksaa palkkana
 * ellei sitä huomata.
 */
function shiftOverrun(ctx: OperationsContext): Alert[] {
  const t = adminText(ctx.locale);
  const nowMinutes = minutesOfDayIn(ctx.timezone, ctx.now);
  const alerts: Alert[] = [];

  for (const shift of ctx.shifts) {
    if (shift.date !== ctx.today) continue;

    const { endMin } = shiftBounds(shift);
    const over = nowMinutes - endMin;
    if (over < OVERRUN_MINUTES) continue;

    const events = eventsOnDate(
      ctx.clockEvents.filter((e) => e.userId === shift.userId),
      ctx.today,
      ctx.timezone,
    );

    if (currentState(events) === "off") continue;

    const user = ctx.users.find((u) => u.id === shift.userId);
    const hours = Math.floor(over / 60);

    alerts.push({
      id: `overrun-${shift.id}`,
      kind: "shift_overrun",
      severity: "warning",
      title: fill(t.havainto.stillClockedIn, {
        nimi: user?.name ?? t.havainto.employeeFallback,
      }),
      detail: fill(t.havainto.shiftEndedAgo, {
        loppu: shift.endTime,
        kesto: `${hours > 0 ? `${hours} h ` : ""}${over % 60} min`,
      }),
      href: "/admin/tyovuorot",
      entityId: shift.userId,
    });
  }

  return alerts;
}

/**
 * Vuoro ilman tekijää lähipäivinä.
 *
 * Avoin vuoro on suunnitelma josta puuttuu ihminen. Kauempana oleva
 * ehtii täyttyä, mutta kolmen päivän sisällä se on jo ongelma.
 */
function unassignedShifts(ctx: OperationsContext): Alert[] {
  const t = adminText(ctx.locale);
  const limit = addDays(ctx.today, OPEN_SHIFT_DAYS);

  return ctx.openShifts
    .filter((shift) => shift.date >= ctx.today && shift.date <= limit)
    .map((shift) => ({
      id: `open-shift-${shift.id}`,
      kind: "unassigned_shift" as const,
      severity: "warning" as const,
      title: t.havainto.noAssignee,
      detail: `${formatDate(shift.date, ctx.locale)} · ${shift.startTime}–${shift.endTime}`,
      href: "/admin/tyovuorot",
      entityId: shift.id,
    }));
}

/**
 * Myynti jäi selvästi vertailukohdasta.
 *
 * Vain kun vertailukohta on olemassa: oma tavoite tai saman viikonpäivän
 * historia. Ilman kumpaakaan ei ole mitään mistä jäädä.
 *
 * Eilinen eikä tämä päivä: kesken olevaa päivää ei voi verrata koko
 * päivän lukuun.
 */
function salesShortfall(ctx: OperationsContext): Alert[] {
  const t = adminText(ctx.locale);
  const yesterday = addDays(ctx.today, -1);
  const day = ctx.sales.find((s) => s.date === yesterday);
  if (!day) return [];

  const comparison = compareSales(day, ctx.sales);
  if (comparison.kind === "none") return [];
  if (comparison.ratio >= 1 - SALES_SHORTFALL) return [];

  const shortfall = Math.round((1 - comparison.ratio) * 100);
  const benchmark =
    comparison.kind === "target"
      ? fill(t.havainto.fromTarget, {
          summa: formatMoney(comparison.targetCents),
        })
      : fill(t.havainto.fromWeekdayAverage, {
          summa: formatMoney(comparison.averageCents),
        });

  return [
    {
      id: `sales-short-${yesterday}`,
      kind: "sales_shortfall",
      severity: "warning",
      title: fill(t.havainto.yesterdayShortfall, {
        osuus: String(shortfall),
      }),
      detail: fill(t.havainto.yesterdayShortfallBody, {
        summa: formatMoney(day.netCents),
        osuus: String(shortfall),
        vertailu: benchmark,
      }),
      href: "/admin/myynti",
      entityId: yesterday,
    },
  ];
}

/**
 * Kuitteja ei ole kirjattu pitkään aikaan.
 *
 * Vain jos ravintola on selvästi toiminnassa: leimauksia on tullut
 * tauon aikana. Suljettu ravintola ei osta mitään, eikä hiljaisuus
 * silloin ole poikkeama.
 */
function receiptGap(ctx: OperationsContext): Alert[] {
  const t = adminText(ctx.locale);
  if (ctx.receipts.length === 0) return [];

  const latest = ctx.receipts.reduce(
    (max, r) => (r.date > max ? r.date : max),
    "",
  );
  const gap = daysBetween(latest, ctx.today);
  if (gap < RECEIPT_GAP_DAYS) return [];

  const worked = ctx.clockEvents.some(
    (e) => dayIn(ctx.timezone, e.at) > latest,
  );
  if (!worked) return [];

  return [
    {
      id: `receipt-gap-${latest}`,
      kind: "receipt_gap",
      severity: "warning",
      title: fill(t.havainto.noReceiptsForDays, { maara: String(gap) }),
      detail: fill(t.havainto.noReceiptsBody, {
        paiva: formatDate(latest, ctx.locale),
      }),
      href: "/admin/kuitit/uusi",
      entityId: latest,
    },
  ];
}

// ---------------------------------------------------------------------------

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

function formatDate(isoDate: string, locale: AppLocale): string {
  return formatDayShortIn(isoDate, locale);
}

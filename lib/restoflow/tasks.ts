/**
 * Tehtävät ja määräajat.
 *
 * TILA JOHDETAAN, SITÄ EI TALLENNETA.
 *
 * Myöhässä oleva tehtävä ei muutu myöhässä olevaksi minkään tapahtuman
 * seurauksena vaan siksi että aika kului. Tallennettu status olisi
 * väärässä siitä hetkestä kunnes joku ajaisi päivityksen — ja juuri
 * myöhästymisen pitää olla oikein ilman että kukaan tekee mitään.
 *
 * Kannassa on siis vain se mitä ihminen teki: milloin merkittiin
 * tehdyksi ja milloin peruttiin. Kaikki muu lasketaan tässä.
 *
 * MUISTUTUS ON LASKELMA, EI RIVI.
 *
 * Katen ilmoitukset johdetaan tilasta eikä tallenneta. Sama koskee
 * muistutuksia: sama päivä tuottaa saman muistutuksen eikä kahta,
 * joten kaksoisilmoitus on rakenteellisesti mahdoton. Lähetetyistä
 * muistutuksista ei tarvitse pitää kirjaa.
 */

import { addDays, daysBetween } from "./dates";
import type { AppLocale } from "@/lib/i18n/app-locales";
import { labels } from "@/lib/i18n/labels";

export type TaskPriority = "normal" | "important" | "critical";

export type TaskVisibility =
  "owner_only" | "managers" | "assigned_user" | "all_staff";

export type TaskRecurrence = "none" | "daily" | "weekly" | "monthly" | "yearly";

export type TaskStatus =
  "upcoming" | "due_today" | "overdue" | "completed" | "cancelled";

export interface Task {
  id: string;
  restaurantId: string;
  title: string;
  description: string | null;
  /** Eräpäivä ravintolan aikavyöhykkeellä, "2026-08-26". */
  dueOn: string;
  /** Valinnainen kellonaika "15:00". Useimmilla tehtävillä ei ole. */
  dueTime: string | null;
  priority: TaskPriority;
  visibility: TaskVisibility;
  assignedTo: string | null;
  completedAt: string | null;
  completedBy: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  recurrence: TaskRecurrence;
  parentTaskId: string | null;
  remindDaysBefore: number[];
  remindOnDue: boolean;
  remindWhenOverdue: boolean;
  createdBy: string;
  createdAt: string;
}

/**
 * Tehtävän tila juuri nyt.
 *
 * Peruttu ja tehty voittavat päivämäärän: peruttua tehtävää ei ole
 * tarkoitus tehdä, eikä tehty muutu myöhässä olevaksi.
 *
 * KELLONAIKA RATKAISEE PÄIVÄN SISÄLLÄ.
 *
 * Ilman kellonaikaa tehtävä on myöhässä vasta seuraavana päivänä:
 * "maksa lasku tänään" on ajallaan koko päivän. Kellonajan kanssa se
 * myöhästyy sinä hetkenä — muuten kello 15 määräaika ei tarkoittaisi
 * mitään.
 */
export function statusOf(
  task: Task,
  today: string,
  nowTime?: string,
): TaskStatus {
  if (task.cancelledAt !== null) return "cancelled";
  if (task.completedAt !== null) return "completed";

  if (task.dueOn < today) return "overdue";

  if (task.dueOn === today) {
    if (
      task.dueTime !== null &&
      nowTime !== undefined &&
      nowTime > task.dueTime
    ) {
      return "overdue";
    }
    return "due_today";
  }

  return "upcoming";
}

/** Onko tehtävä yhä auki: ei tehty eikä peruttu. */
export function isOpen(task: Task): boolean {
  return task.completedAt === null && task.cancelledAt === null;
}

/** Kuinka monta päivää myöhässä. Nolla jos ei myöhässä. */
export function daysLate(task: Task, today: string): number {
  if (!isOpen(task) || task.dueOn >= today) return 0;
  return daysBetween(task.dueOn, today);
}

export interface TaskCounts {
  overdue: number;
  dueToday: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  /** Myöhässä + tänään: se mikä vaatii huomiota nyt. */
  needsAttention: number;
}

export function countTasks(
  tasks: Task[],
  today: string,
  nowTime?: string,
): TaskCounts {
  const counts: TaskCounts = {
    overdue: 0,
    dueToday: 0,
    upcoming: 0,
    completed: 0,
    cancelled: 0,
    needsAttention: 0,
  };

  for (const task of tasks) {
    switch (statusOf(task, today, nowTime)) {
      case "overdue":
        counts.overdue += 1;
        break;
      case "due_today":
        counts.dueToday += 1;
        break;
      case "upcoming":
        counts.upcoming += 1;
        break;
      case "completed":
        counts.completed += 1;
        break;
      case "cancelled":
        counts.cancelled += 1;
        break;
    }
  }

  counts.needsAttention = counts.overdue + counts.dueToday;
  return counts;
}

/**
 * Järjestys jossa tehtävät luetaan.
 *
 * Myöhässä ensin, sitten tänään, sitten tulevat. Ryhmän sisällä
 * kiireellisin eräpäivä ensin ja prioriteetti ratkaisee tasatilanteen:
 * saman päivän kriittinen ennen normaalia.
 */
const STATUS_ORDER: Record<TaskStatus, number> = {
  overdue: 0,
  due_today: 1,
  upcoming: 2,
  completed: 3,
  cancelled: 4,
};

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  important: 1,
  normal: 2,
};

export function sortTasks(
  tasks: Task[],
  today: string,
  nowTime?: string,
): Task[] {
  return [...tasks].sort((a, b) => {
    const statusDiff =
      STATUS_ORDER[statusOf(a, today, nowTime)] -
      STATUS_ORDER[statusOf(b, today, nowTime)];
    if (statusDiff !== 0) return statusDiff;

    /*
     * Myöhässä olevat vanhin ensin, tulevat lähin ensin.
     *
     * Kauimmin myöhässä ollut on kiireellisin; tulevista lähin on se
     * jota seuraavaksi tehdään. Sama järjestys molemmille kääntäisi
     * toisen väärin päin.
     */
    if (a.dueOn !== b.dueOn) return a.dueOn.localeCompare(b.dueOn);

    const priorityDiff =
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    return a.title.localeCompare(b.title, "fi");
  });
}

export interface TaskGroup {
  status: TaskStatus;
  label: string;
  tasks: Task[];
}

/**
 * Tehtävät ryhmiteltynä tilan mukaan.
 *
 * Tyhjä ryhmä jätetään pois: otsikko ilman sisältöä lupaa kohtia
 * joita ei ole.
 */
export function groupTasks(
  tasks: Task[],
  today: string,
  locale: AppLocale,
  nowTime?: string,
): TaskGroup[] {
  const nimet = labels(locale);
  const order: TaskStatus[] = [
    "overdue",
    "due_today",
    "upcoming",
    "completed",
    "cancelled",
  ];

  const sorted = sortTasks(tasks, today, nowTime);

  return order
    .map((status) => ({
      status,
      label: nimet.taskStatus[status],
      tasks: sorted.filter((task) => statusOf(task, today, nowTime) === status),
    }))
    .filter((group) => group.tasks.length > 0);
}

export type ReminderKind = "before" | "due" | "overdue";

export interface TaskReminder {
  task: Task;
  kind: ReminderKind;
  /** Päiviä eräpäivään: positiivinen ennen, negatiivinen myöhässä. */
  days: number;
  text: string;
}

/**
 * Tänään aktiiviset muistutukset.
 *
 * Muistutus ei ole tapahtuma vaan tämän päivän ominaisuus: se
 * lasketaan eräpäivästä ja asetuksista joka kerta uudelleen. Siksi
 * samaa muistutusta ei voi lähettää kahdesti eikä lähetetyistä
 * tarvitse pitää kirjaa.
 *
 * Tehty ja peruttu eivät muistuta mistään.
 */
export function activeReminders(
  tasks: Task[],
  today: string,
  nowTime?: string,
): TaskReminder[] {
  const reminders: TaskReminder[] = [];

  for (const task of tasks) {
    if (!isOpen(task)) continue;

    const status = statusOf(task, today, nowTime);

    if (status === "overdue") {
      if (!task.remindWhenOverdue) continue;

      const late = daysLate(task, today);

      reminders.push({
        task,
        kind: "overdue",
        days: -late,
        text:
          late === 0
            ? `${task.title} olisi pitänyt tehdä tänään klo ${task.dueTime}.`
            : `${task.title} on myöhässä ${late} ${late === 1 ? "päivän" : "päivää"}.`,
      });
      continue;
    }

    if (status === "due_today") {
      if (!task.remindOnDue) continue;

      reminders.push({
        task,
        kind: "due",
        days: 0,
        text: `${task.title} erääntyy tänään${task.dueTime ? ` klo ${task.dueTime}` : ""}.`,
      });
      continue;
    }

    const until = daysBetween(today, task.dueOn);

    if (task.remindDaysBefore.includes(until)) {
      reminders.push({
        task,
        kind: "before",
        days: until,
        text: `${task.title} erääntyy ${until === 1 ? "huomenna" : `${until} päivän päästä`}.`,
      });
    }
  }

  /*
   * Myöhässä ensin, sitten tänään, sitten tulevat.
   *
   * Muistutuslista luetaan ylhäältä ja se katkeaa siihen mihin aika
   * loppuu. Silloin ylimmäisenä on oltava se joka on jo myöhässä.
   */
  return reminders.sort((a, b) => a.days - b.days);
}

/**
 * Seuraavan toiston eräpäivä.
 *
 * Lasketaan eräpäivästä eikä tästä päivästä: "joka kuukauden viides"
 * pysyy viidentenä vaikka tehtävä merkittäisiin tehdyksi
 * kahdeksantena. Sama sääntö kuin kannan next_task_due-funktiossa.
 */
export function nextDue(dueOn: string, rule: TaskRecurrence): string | null {
  if (rule === "none") return null;
  if (rule === "daily") return addDays(dueOn, 1);
  if (rule === "weekly") return addDays(dueOn, 7);

  const [year, month, day] = dueOn.split("-").map(Number);

  if (rule === "yearly") {
    return iso(new Date(Date.UTC(year + 1, month - 1, day, 12)));
  }

  /*
   * Kuukausi eteenpäin, päivä säilyttäen.
   *
   * 31.1. + kuukausi ei ole 31.2. Postgresin + interval '1 month'
   * rajaa kuukauden viimeiseen päivään, ja tämä tekee saman — muuten
   * näyttö ja kanta eroaisivat juuri niinä kuukausina joina asia
   * huomataan.
   */
  const target = new Date(Date.UTC(year, month, 1, 12));
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));

  return iso(target);
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

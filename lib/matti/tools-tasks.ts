import { z } from "zod";
import {
  PRIORITY_LABELS,
  activeReminders,
  countTasks,
  daysLate,
  isOpen,
  statusOf,
} from "@/lib/restoflow/tasks";
import { defineTool, type ToolDefinition } from "./tool-kit";

/**
 * Tehtävät ja määräajat Matille.
 *
 * MATTI MUISTUTTAA, EI TEE.
 *
 * Matti saa kertoa mikä on myöhässä ja mikä erääntyy tänään. Hän ei
 * luo tehtäviä, siirrä määräaikoja eikä merkitse mitään tehdyksi:
 * tehtävä on lupaus jonka ihminen antaa, ja lupauksen antaminen
 * toisen puolesta on juuri se mitä avustaja ei saa tehdä.
 *
 * Jos käyttäjä pyytää tehtävää, Matti kertoo mitä hän ehdottaisi ja
 * ohjaa Tehtävät-sivulle. Vahvistus tapahtuu siellä.
 *
 * Oikeus on tasks.manage eikä tasks.view: Matti on esihenkilön
 * työkalu ja näyttää koko ravintolan tehtävät. Työntekijän omat
 * tehtävät ovat hänen omassa näkymässään.
 */

const getTasks = defineTool({
  name: "get_tasks",
  description:
    "Ravintolan tehtävät ja määräajat: mikä on myöhässä, mikä erääntyy " +
    "tänään ja mitä on tulossa. Käytä kun kysytään mitä pitäisi tehdä, " +
    "onko jotain hoitamatta, tai kysytään jostain määräajasta. " +
    "ÄLÄ luo tehtäviä äläkä merkitse mitään tehdyksi — ohjaa " +
    "Tehtävät-sivulle.",
  level: "read",
  requires: "tasks.manage",
  schema: z.object({}),
  async run(ctx) {
    const tasks = ctx.data.tasks;

    if (tasks.length === 0) {
      return {
        summary:
          "Tehtäviä ei ole kirjattu. Määräajat lisätään Tehtävät-sivulla, " +
          "minkä jälkeen voin muistuttaa niistä.",
        data: { tasks: [] },
      };
    }

    const counts = countTasks(tasks, ctx.today);
    const open = tasks.filter(isOpen);

    const rows = open.map((task) => ({
      title: task.title,
      dueOn: task.dueOn,
      dueTime: task.dueTime,
      status: statusOf(task, ctx.today),
      daysLate: daysLate(task, ctx.today),
      priority: PRIORITY_LABELS[task.priority],
      assignedTo:
        ctx.data.users.find((user) => user.id === task.assignedTo)?.name ?? null,
      recurring: task.recurrence !== "none",
    }));

    /*
     * Yhteenveto kertoo mitä tänään on tehtävä.
     *
     * Kolmenkymmenen tehtävän lista ei ole vastaus kysymykseen "mitä
     * pitäisi tehdä". Myöhässä olevat ja tänään erääntyvät ovat.
     */
    const urgent = rows
      .filter((row) => row.status === "overdue" || row.status === "due_today")
      .slice(0, 5)
      .map((row) =>
        row.status === "overdue"
          ? `${row.title} (myöhässä ${row.daysLate} pv)`
          : `${row.title} (tänään)`,
      );

    return {
      summary:
        counts.needsAttention === 0
          ? `Mikään ei ole myöhässä eikä erääntymässä tänään. Tulevia tehtäviä on ${counts.upcoming}.`
          : `${counts.overdue} myöhässä, ${counts.dueToday} erääntyy tänään: ${urgent.join(", ")}.`,
      data: {
        counts,
        tasks: rows,
      },
    };
  },
});

const getReminders = defineTool({
  name: "get_task_reminders",
  description:
    "Tänään aktiiviset muistutukset tehtävistä: mistä pitää muistuttaa " +
    "juuri nyt. Käytä aamun yhteenvedossa ja kun kysytään mitä on " +
    "tulossa. Muistutukset lasketaan eräpäivästä ja tehtävän " +
    "muistutusasetuksista.",
  level: "read",
  requires: "tasks.manage",
  schema: z.object({}),
  async run(ctx) {
    const reminders = activeReminders(ctx.data.tasks, ctx.today);

    if (reminders.length === 0) {
      return {
        summary: "Tänään ei ole muistutettavaa.",
        data: { reminders: [] },
      };
    }

    return {
      summary: reminders.map((reminder) => reminder.text).join(" "),
      data: {
        reminders: reminders.map((reminder) => ({
          title: reminder.task.id,
          text: reminder.text,
          kind: reminder.kind,
          days: reminder.days,
          dueOn: reminder.task.dueOn,
        })),
      },
    };
  },
});

export const TASK_TOOLS: ToolDefinition[] = [getTasks, getReminders];

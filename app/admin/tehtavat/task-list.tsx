"use client";

import { useState } from "react";
import { fill } from "@/lib/i18n/auth-text";
import type { AdminText } from "@/lib/i18n/admin-text";
import type { AppLocale } from "@/lib/i18n/app-locales";
import type { Labels } from "@/lib/i18n/labels";
import { useFormStatus } from "react-dom";
import {
  cancelTask,
  completeTask,
  deleteTask,
  postponeTask,
  reopenTask,
} from "./actions";
import { TaskForm } from "./task-form";
import {
  daysLate,
  groupTasks,
  statusOf,
  type Task,
  type TaskStatus,
} from "@/lib/restoflow/tasks";
import { addDays } from "@/lib/restoflow/dates";
import type { User } from "@/lib/restoflow/types";
import { RfIcon } from "@/components/restoflow/icons";
import { Card, EmptyState, Pill } from "@/components/restoflow/ui";

/**
 * Tehtävälista ryhmiteltynä.
 *
 * MERKINTÄ TEHDYKSI ON YKSI PAINALLUS.
 *
 * Se on toiminto jota tehdään kymmenen kertaa päivässä, usein
 * puhelimella kesken muun. Vahvistusta ei ole: väärin merkityn saa
 * takaisin auki samasta rivistä.
 */
export function TaskList({
  t,
  locale,
  nimet,
  tasks,
  users,
  today,
  canManage,
}: {
  t: AdminText;
  locale: AppLocale;
  nimet: Labels;
  tasks: Task[];
  users: User[];
  today: string;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const groups = groupTasks(tasks, today, locale);

  if (tasks.length === 0) {
    return (
      <EmptyState title={t.tiimi.noTasks} description={t.tiimi.firstTaskHint} />
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card key={group.status} padded={false}>
          <div className="flex items-center justify-between gap-3 px-5 pt-4">
            <p className="flex items-center gap-2 text-[14px] font-bold">
              <Merkki status={group.status} />
              {group.label}
            </p>
            <span
              className="rf-tabular text-[13px]"
              style={{ color: "var(--rf-text-3)" }}
            >
              {group.tasks.length}
            </span>
          </div>

          <ul
            className="divide-y px-5 pb-4 pt-2"
            style={{ borderColor: "var(--rf-line)" }}
          >
            {group.tasks.map((task) =>
              editing === task.id ? (
                <li key={task.id} className="py-3">
                  <TaskForm
                    t={t}
                    nimet={nimet}
                    users={users}
                    task={task}
                    today={today}
                    onClose={() => setEditing(null)}
                  />
                </li>
              ) : (
                <li key={task.id} className="py-3 first:pt-1">
                  <Rivi
                    t={t}
                    nimet={nimet}
                    task={task}
                    users={users}
                    today={today}
                    canManage={canManage}
                    onEdit={() => setEditing(task.id)}
                  />
                </li>
              ),
            )}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function Rivi({
  t,
  nimet,
  task,
  users,
  today,
  canManage,
  onEdit,
}: {
  t: AdminText;
  nimet: Labels;
  task: Task;
  users: User[];
  today: string;
  canManage: boolean;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const status = statusOf(task, today);
  const late = daysLate(task, today);
  const owner = users.find((user) => user.id === task.assignedTo);
  const done = status === "completed" || status === "cancelled";

  return (
    <div>
      <div className="flex items-start gap-3">
        {done ? (
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center"
            style={{
              background:
                status === "completed"
                  ? "var(--rf-green-bg)"
                  : "var(--rf-inset)",
              color:
                status === "completed"
                  ? "var(--rf-green-text)"
                  : "var(--rf-text-3)",
              borderRadius: "50%",
            }}
          >
            <RfIcon
              name={status === "completed" ? "check" : "more"}
              size={13}
            />
          </span>
        ) : (
          <form action={completeTask} className="mt-0.5 shrink-0">
            <input type="hidden" name="id" value={task.id} />
            <Kuittaa t={t} title={task.title} />
          </form>
        )}

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="rf-press block w-full text-left"
          >
            <span
              className="block text-[14px] font-semibold"
              style={{
                color: done ? "var(--rf-text-3)" : undefined,
                textDecoration:
                  status === "cancelled" ? "line-through" : undefined,
              }}
            >
              {task.title}
            </span>

            <span
              className="rf-tabular mt-0.5 block text-[12px]"
              style={{ color: "var(--rf-text-3)" }}
            >
              {formatDate(task.dueOn)}
              {task.dueTime
                ? " " + fill(t.tiimi.atTime, { aika: task.dueTime })
                : ""}
              {late > 0
                ? fill(
                    late === 1 ? t.tiimi.lateSuffixOne : t.tiimi.lateSuffixMany,
                    {
                      maara: String(late),
                    },
                  )
                : ""}
              {owner ? ` · ${owner.name}` : ""}
              {task.recurrence !== "none"
                ? fill(t.tiimi.recurrenceSuffix, {
                    toistuvuus:
                      nimet.taskRecurrence[task.recurrence].toLowerCase(),
                  })
                : ""}
            </span>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {task.priority !== "normal" ? (
            <Pill tone={task.priority === "critical" ? "risk" : "warn"} dot>
              {nimet.taskPriority[task.priority].toLowerCase()}
            </Pill>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="mt-2.5 pl-[34px]">
          {task.description ? (
            <p
              className="text-[13px] leading-relaxed"
              style={{ color: "var(--rf-text-2)" }}
            >
              {task.description}
            </p>
          ) : null}

          {canManage ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {done ? (
                <form action={reopenTask}>
                  <input type="hidden" name="id" value={task.id} />
                  <Toiminto label={t.tiimi.reopen} />
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onEdit}
                    className="rf-press px-2.5 py-1 text-[12.5px] font-semibold"
                    style={{ color: "var(--rf-accent)" }}
                  >
                    {t.tiimi.edit}
                  </button>

                  {/*
                    Siirto on oma toimintonsa eikä osa muokkausta:
                    se on se mitä kiireessä tehdään, ja siitä jää
                    lokiin oma merkintänsä vanhoine ja uusine päivineen.
                  */}
                  <form action={postponeTask}>
                    <input type="hidden" name="id" value={task.id} />
                    <input
                      type="hidden"
                      name="dueOn"
                      value={addDays(task.dueOn, 1)}
                    />
                    <Toiminto label={t.tiimi.moveByDay} />
                  </form>

                  <form action={postponeTask}>
                    <input type="hidden" name="id" value={task.id} />
                    <input
                      type="hidden"
                      name="dueOn"
                      value={addDays(task.dueOn, 7)}
                    />
                    <Toiminto label={t.tiimi.moveByWeek} />
                  </form>

                  <form action={cancelTask}>
                    <input type="hidden" name="id" value={task.id} />
                    <Toiminto label={t.tiimi.cancelTask} />
                  </form>
                </>
              )}

              <form action={deleteTask}>
                <input type="hidden" name="id" value={task.id} />
                <Toiminto label={t.tiimi.remove} danger />
              </form>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Kuittaa({ t, title }: { t: AdminText; title: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={fill(t.tiimi.markDoneNamed, { nimi: title })}
      title={t.tiimi.markDone}
      className="rf-press flex h-[22px] w-[22px] items-center justify-center"
      style={{
        border: "1.5px solid var(--rf-line-strong)",
        borderRadius: "50%",
        opacity: pending ? 0.4 : 1,
      }}
    >
      {pending ? <RfIcon name="check" size={13} /> : null}
    </button>
  );
}

function Toiminto({ label, danger }: { label: string; danger?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rf-press px-2.5 py-1 text-[12.5px] font-semibold"
      style={{ color: danger ? "var(--rf-red-text)" : "var(--rf-text-2)" }}
    >
      {label}
    </button>
  );
}

function Merkki({ status }: { status: TaskStatus }) {
  const colors: Record<TaskStatus, string> = {
    overdue: "var(--rf-red)",
    due_today: "var(--rf-amber-text)",
    upcoming: "var(--rf-blue-text)",
    completed: "var(--rf-green-text)",
    cancelled: "var(--rf-text-3)",
  };

  return (
    <span
      aria-hidden="true"
      className="inline-block h-2 w-2 shrink-0"
      style={{ background: colors[status], borderRadius: "50%" }}
    />
  );
}

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${Number(d)}.${Number(m)}.${y}`;
}

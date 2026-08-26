import { monthCalendar } from "@/lib/restoflow/calendar";
import { statusOf, type Task, type TaskStatus } from "@/lib/restoflow/tasks";
import { Card } from "@/components/restoflow/ui";

/**
 * Tehtävät kalenterina.
 *
 * Lista vastaa kysymykseen "mitä on hoitamatta", kalenteri
 * kysymykseen "milloin kaikki osuu". Jälkimmäinen näkyy vasta kun
 * määräajat ovat päivien päällä: kolme laskua saman viikon sisällä on
 * listassa kolme riviä mutta kalenterissa ruuhka.
 *
 * Sama ruudukko kuin työvuorokalenterissa: viikot riveinä ja
 * maanantai ensin.
 */
export function TaskCalendar({ tasks, today }: { tasks: Task[]; today: string }) {
  const month = today.slice(0, 7);
  const weeks = monthCalendar(month, today);

  const byDate = new Map<string, Task[]>();
  for (const task of tasks) {
    byDate.set(task.dueOn, [...(byDate.get(task.dueOn) ?? []), task]);
  }

  return (
    <Card padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: "collapse", minWidth: "44rem" }}>
          <caption className="sr-only">Tehtävät kuukauden päivillä</caption>

          <thead>
            <tr>
              {["ma", "ti", "ke", "to", "pe", "la", "su"].map((day) => (
                <th
                  key={day}
                  scope="col"
                  className="px-2 py-2 text-[11px] font-bold uppercase"
                  style={{
                    color: "var(--rf-text-3)",
                    letterSpacing: "0.07em",
                    background: "var(--rf-inset)",
                    borderBottom: "1px solid var(--rf-line)",
                  }}
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {weeks.map((week) => (
              <tr key={week.week}>
                {week.days.map((day) => {
                  const dayTasks = byDate.get(day.date) ?? [];

                  return (
                    <td
                      key={day.date}
                      className="align-top"
                      style={{
                        border: "1px solid var(--rf-line)",
                        padding: "6px 6px 8px",
                        height: "5.5rem",
                        background: day.inMonth
                          ? day.isToday
                            ? "var(--rf-accent-bg)"
                            : undefined
                          : "var(--rf-inset)",
                        opacity: day.inMonth ? 1 : 0.5,
                      }}
                    >
                      <span
                        className="rf-tabular block text-[11.5px] font-semibold"
                        style={{ color: day.isToday ? "var(--rf-accent-strong)" : "var(--rf-text-3)" }}
                      >
                        {day.day}
                      </span>

                      <ul className="mt-1 space-y-1">
                        {dayTasks.slice(0, 3).map((task) => (
                          <li key={task.id}>
                            <span
                              className="flex items-start gap-1 text-[11.5px] leading-snug"
                              title={task.title}
                            >
                              <Piste status={statusOf(task, today)} />
                              <span className="min-w-0 flex-1 truncate">{task.title}</span>
                            </span>
                          </li>
                        ))}

                        {/*
                          Neljäs ja loput lasketaan.

                          Ruutu on pieni, ja täyteen ahdettuna se on
                          lukukelvoton juuri niinä päivinä joina siinä
                          on eniten katsottavaa.
                        */}
                        {dayTasks.length > 3 ? (
                          <li
                            className="text-[11px]"
                            style={{ color: "var(--rf-text-3)" }}
                          >
                            +{dayTasks.length - 3} muuta
                          </li>
                        ) : null}
                      </ul>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Piste({ status }: { status: TaskStatus }) {
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
      className="mt-1 inline-block h-1.5 w-1.5 shrink-0"
      style={{ background: colors[status], borderRadius: "50%" }}
    />
  );
}

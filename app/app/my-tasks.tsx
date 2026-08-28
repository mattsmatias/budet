import { completeTask } from "@/app/admin/tehtavat/actions";
import { daysLate, isOpen, sortTasks, statusOf, type Task } from "@/lib/restoflow/tasks";
import { RfIcon } from "@/components/restoflow/icons";

/**
 * Työntekijän omat tehtävät.
 *
 * EI KALENTERIA EIKÄ SUODATTIMIA.
 *
 * Työntekijä katsoo puhelinta kesken vuoron: hän tarvitsee tietää
 * mikä on tänään ja mitä pitää tehdä. Suunnittelu on esihenkilön
 * näkymässä.
 *
 * Rivikäytäntö on jo rajannut mitä hän näkee: omat tehtävät ja koko
 * henkilöstölle merkityt. Talous- ja hallintotehtävät eivät tule
 * tänne asti.
 */
export function MyTasks({ tasks, today }: { tasks: Task[]; today: string }) {
  const open = sortTasks(tasks.filter(isOpen), today).slice(0, 6);

  if (open.length === 0) return null;

  return (
    <section aria-label="Omat tehtävät" className="space-y-2.5">
      <h2 className="px-1 text-[15px] font-bold tracking-[-0.0075em]">
        Sinun tehtäväsi
      </h2>

      <ul className="space-y-2">
        {open.map((task) => {
          const status = statusOf(task, today);
          const late = daysLate(task, today);

          return (
            <li key={task.id}>
              <div
                className="flex items-start gap-3 px-4 py-3.5"
                style={{
                  background: "var(--rf-card)",
                  border: "1px solid var(--rf-line)",
                  borderRadius: "var(--bd-app-r)",
                  boxShadow: "var(--bd-app-shadow)",
                }}
              >
                {/*
                  Kuittaus on yksi painallus ja iso kosketuskohde.

                  Tämä tehdään käsi märkänä keittiössä. Vahvistusta ei
                  ole: väärin merkityn saa auki esihenkilöltä.
                */}
                <form action={completeTask} className="shrink-0">
                  <input type="hidden" name="id" value={task.id} />
                  <button
                    type="submit"
                    aria-label={`Merkitse tehdyksi: ${task.title}`}
                    className="rf-press flex h-11 w-11 items-center justify-center"
                    style={{
                      background: "var(--rf-inset)",
                      color: "var(--rf-text-2)",
                      borderRadius: "50%",
                    }}
                  >
                    <RfIcon name="check" size={20} />
                  </button>
                </form>

                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">{task.title}</p>

                  <p
                    className="rf-tabular mt-0.5 text-[13px]"
                    style={{
                      color:
                        status === "overdue"
                          ? "var(--rf-red-text)"
                          : status === "due_today"
                            ? "var(--rf-amber-text)"
                            : "var(--rf-text-3)",
                    }}
                  >
                    {status === "overdue"
                      ? late === 0
                        ? `Myöhässä tänään klo ${task.dueTime}`
                        : `Myöhässä ${late} ${late === 1 ? "päivä" : "päivää"}`
                      : status === "due_today"
                        ? `Tänään${task.dueTime ? ` klo ${task.dueTime}` : ""}`
                        : formatDate(task.dueOn)}
                  </p>

                  {task.description ? (
                    <p
                      className="mt-1 text-[13px] leading-relaxed"
                      style={{ color: "var(--rf-text-2)" }}
                    >
                      {task.description}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function formatDate(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(d)}.${Number(m)}.`;
}
